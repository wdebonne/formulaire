// Résolution des valeurs brutes d'une réponse (slugs de choix, dates) en valeurs lisibles.
// Utilisé pour les payloads webhook (submit) et les exports RGPD (portabilité des données),
// afin de ne jamais transmettre de valeurs brutes/slugs à un destinataire externe.

// Cherche un bloc par ID dans les blocs de premier niveau ET dans leurs innerBlocks.
// Nécessaire car les blocs internes d'un groupe/répéteur ne sont pas dans le tableau racine.
export function findBlockDeep(blocks: any[], blockId: string): any | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block
    if (block.innerBlocks?.length) {
      const inner = block.innerBlocks.find((ib: any) => ib.id === blockId)
      if (inner) return inner
    }
  }
  return undefined
}

// Formate une date YYYY-MM-DD selon le format configuré sur le bloc (ex: DD/MM/YYYY)
export function formatDateString(isoDate: string, format: string): string {
  // Accepte YYYY-MM-DD mais aussi un objet { start, end } sérialisé comme chaîne
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(isoDate)
  const [, year, month, day] = m
  // Remplacer les tokens les plus longs en premier pour éviter les collisions (YYYY avant YY, etc.)
  return format
    .replace('YYYY', year)
    .replace('YY', year.slice(-2))
    .replace('MM', month)
    .replace('DD', day)
}

// Convertit une valeur brute en valeur lisible selon le type du bloc :
//  - date / advanced-date → format configuré (DD/MM/YYYY…)
//  - multiple-choice / dropdown / image-selection → label du choix (pas la valeur slug)
export function formatBlockValue(block: any, rawValue: any): any {
  if (rawValue === undefined || rawValue === null) return rawValue
  if (!block) return rawValue // bloc introuvable → valeur brute inchangée

  // ── Dates ──────────────────────────────────────────────────────────────────
  if (block.type === 'date' && typeof rawValue === 'string') {
    const fmt = block.attributes?.format || 'DD/MM/YYYY'
    return formatDateString(rawValue, fmt)
  }

  if (block.type === 'advanced-date') {
    const fmt = block.attributes?.format || 'DD/MM/YYYY'
    if (typeof rawValue === 'string') return formatDateString(rawValue, fmt)
    // Plage de dates : { start, end }
    if (rawValue && typeof rawValue === 'object' && rawValue.start) {
      const start = formatDateString(rawValue.start, fmt)
      const end   = rawValue.end ? formatDateString(rawValue.end, fmt) : ''
      return end ? `${start} - ${end}` : start
    }
    return rawValue
  }

  // ── Quantité ───────────────────────────────────────────────────────────────
  if (block.type === 'quantity' && rawValue && typeof rawValue === 'object') {
    const outputFormat = block.attributes?.quantityOutputFormat || 'object'
    if (outputFormat === 'value') {
      const quantities = Object.values(rawValue) as number[]
      if (quantities.length === 1) return String(quantities[0])
      return quantities.join(', ')
    }
    // Format objet : nettoyer les clés __other__:
    const cleaned: Record<string, any> = {}
    for (const [k, v] of Object.entries(rawValue)) {
      const cleanKey = k.startsWith('__other__:') ? k.slice(10) : k
      cleaned[cleanKey] = v
    }
    return cleaned
  }

  // ── Choix (multiple-choice, dropdown, image-selection) ─────────────────────
  const choices: any[] = block.attributes?.choices || []
  const stripOther = (v: string) => v.startsWith('__other__:') ? v.slice(10) : v
  if (choices.length) {
    const findLabel = (v: string) => {
      if (v.startsWith('__other__:')) return v.slice(10)
      const c = choices.find((c: any) => c.value === v || c.id === v || c.label === v)
      return c?.label ?? v
    }
    if (Array.isArray(rawValue)) return rawValue.map(findLabel).join(', ')
    return findLabel(String(rawValue))
  }
  // Pas de choices définis (ex: dropdown allowCustomValue sans liste) : nettoyer quand même
  if (typeof rawValue === 'string') return stripOther(rawValue)
  if (Array.isArray(rawValue)) return rawValue.map((v: any) => typeof v === 'string' ? stripOther(v) : v).join(', ')

  return rawValue
}

// Résout les valeurs brutes (slugs de choix, dates) en valeurs lisibles pour tous les champs soumis.
export function resolveDataLabels(data: Record<string, any>, blocks: any[]): Record<string, any> {
  const resolved: Record<string, any> = {}

  for (const [key, value] of Object.entries(data)) {
    // Clés de contrôle du répéteur (_initial, _repeat_N) : on garde as-is
    if (/_initial$/.test(key) || /_repeat_\d+$/.test(key)) {
      resolved[key] = value
      continue
    }

    // Clé directe (bloc de premier niveau ou groupe)
    let block = findBlockDeep(blocks, key)

    // Clé de répéteur : format {repeaterId}_{repNum}_{innerBlockId}
    if (!block) {
      const match = key.match(/^(.+)_(\d+)_(.+)$/)
      if (match) {
        const [, , , innerBlockId] = match
        block = findBlockDeep(blocks, innerBlockId)
      }
    }

    resolved[key] = formatBlockValue(block, value)
  }

  return resolved
}
