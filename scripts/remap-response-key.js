// Rebranche les réponses d'un bloc supprimé sur le bloc qui l'a remplacé.
//
// `Response.data` est un objet indexé par l'ID du bloc, jamais par son libellé. Recréer une
// question (changer un « texte court » en « adresse », par exemple) produit un nouvel UUID :
// les anciennes valeurs restent en base sous l'ancienne clé, mais plus aucun bloc du
// formulaire ne porte cet ID, donc elles disparaissent du détail, du tableau, du rapport et
// de l'export CSV — qui lisent tous `data[block.id]`.
//
// Ce script liste ces clés orphelines et, sur demande, les réécrit vers le bloc actuel.
//
//   node scripts/remap-response-key.js --form <id|slug>
//   node scripts/remap-response-key.js --form <id|slug> --from <ancienneCle> --to <idDuBloc>
//   node scripts/remap-response-key.js --form <id|slug> --from <ancienneCle> --to <idDuBloc> --apply
//
// Sans --apply, rien n'est écrit : le script se contente d'annoncer ce qu'il ferait.
// En Docker : docker exec -it <conteneur> node scripts/remap-response-key.js --form <slug>

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function parseArgs(argv) {
  const args = { apply: false, force: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--apply') args.apply = true
    else if (arg === '--force') args.force = true
    else if (arg.startsWith('--')) args[arg.slice(2)] = argv[++i]
  }
  return args
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '')
  } catch {
    return fallback
  }
}

// Tous les identifiants de blocs du formulaire, blocs internes compris.
function collectBlockIds(blocks) {
  const topLevel = new Set()
  const inner = new Set()
  for (const block of blocks) {
    topLevel.add(block.id)
    for (const child of block.innerBlocks || []) inner.add(child.id)
  }
  return { topLevel, inner }
}

// Une clé de réponse est reconnue si elle désigne un bloc existant, directement ou via les
// formes propres aux répéteurs : {repeaterId}_{n}_{innerId}, {repeaterId}_initial,
// {repeaterId}_repeat_{n}. Même découpage que resolveDataLabels() dans src/lib/response-format.ts.
function isKnownKey(key, ids) {
  if (ids.topLevel.has(key) || ids.inner.has(key)) return true

  const control = key.match(/^(.+)_(?:initial|repeat_\d+)$/)
  if (control && ids.topLevel.has(control[1])) return true

  const repeated = key.match(/^(.+)_(\d+)_(.+)$/)
  if (repeated && ids.inner.has(repeated[3])) return true

  return false
}

// Libellé d'un bloc disparu, retrouvé dans les instantanés de versions du formulaire.
// Les versions conservent les blocs tels qu'ils étaient, y compris ceux supprimés depuis.
function findLabelInVersions(versions, blockId) {
  for (const version of versions) {
    const blocks = parseJson(version.blocks, [])
    for (const block of blocks) {
      if (block.id === blockId) return { label: block.attributes?.label, type: block.type }
      for (const child of block.innerBlocks || []) {
        if (child.id === blockId) return { label: child.attributes?.label, type: child.type }
      }
    }
  }
  return null
}

// Bloc actuel portant ce libellé — la cible probable du rebranchement.
function findCurrentBlockByLabel(blocks, label) {
  if (!label) return null
  const normalize = (s) => String(s || '').trim().toLowerCase()
  const target = normalize(label)
  for (const block of blocks) {
    if (normalize(block.attributes?.label) === target) return { block, parent: null }
    for (const child of block.innerBlocks || []) {
      if (normalize(child.attributes?.label) === target) return { block: child, parent: block }
    }
  }
  return null
}

function preview(value) {
  const text = value === null || typeof value !== 'object' ? String(value) : JSON.stringify(value)
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

function isEmpty(value) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.form) {
    console.error('Usage : node scripts/remap-response-key.js --form <id|slug> [--from <cle> --to <blocId>] [--apply]')
    process.exitCode = 1
    return
  }

  const form = await prisma.form.findFirst({
    where: { OR: [{ id: args.form }, { slug: args.form }] },
  })

  if (!form) {
    console.error(`❌ Aucun formulaire pour « ${args.form} » (ni ID, ni slug).`)
    process.exitCode = 1
    return
  }

  const blocks = parseJson(form.blocks, [])
  const ids = collectBlockIds(blocks)
  const responses = await prisma.response.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\n📋 ${form.title} (${form.slug}) — ${responses.length} réponse(s)\n`)

  if (args.from && args.to) {
    await remap(form, blocks, responses, args)
    return
  }

  // ── Inventaire des clés orphelines ────────────────────────────────────────
  const orphans = new Map()
  for (const response of responses) {
    const data = parseJson(response.data, {})
    for (const [key, value] of Object.entries(data)) {
      if (isKnownKey(key, ids)) continue
      if (isEmpty(value)) continue
      const entry = orphans.get(key) || { count: 0, samples: [] }
      entry.count++
      if (entry.samples.length < 3) entry.samples.push(preview(value))
      orphans.set(key, entry)
    }
  }

  if (orphans.size === 0) {
    console.log('✅ Aucune valeur orpheline : toutes les réponses pointent vers un bloc existant.')
    return
  }

  const versions = await prisma.formVersion.findMany({
    where: { formId: form.id },
    orderBy: { number: 'desc' },
  })

  console.log(`⚠️  ${orphans.size} clé(s) orpheline(s) — valeurs présentes en base mais rattachées à aucun bloc :\n`)

  for (const [key, entry] of orphans) {
    const origin = findLabelInVersions(versions, key)
    console.log(`  ${key}`)
    console.log(`    ${entry.count} réponse(s) · ex. ${entry.samples.join(' | ')}`)

    if (origin?.label) {
      console.log(`    ancien bloc : « ${origin.label} » (${origin.type})`)
      const match = findCurrentBlockByLabel(blocks, origin.label)
      if (match) {
        const where = match.parent ? ` dans « ${match.parent.attributes?.label || match.parent.id} »` : ''
        console.log(`    ➜ bloc actuel de même libellé : ${match.block.id} (${match.block.type})${where}`)
        console.log(`    ➜ node scripts/remap-response-key.js --form ${form.slug} --from ${key} --to ${match.block.id} --apply`)
      } else {
        console.log('    ➜ aucun bloc actuel ne porte ce libellé — indiquez la cible avec --to')
      }
    } else {
      console.log('    origine inconnue (aucune version ne contient ce bloc) — indiquez la cible avec --to')
    }
    console.log('')
  }
}

async function remap(form, blocks, responses, args) {
  const ids = collectBlockIds(blocks)
  const { from, to } = args

  if (!ids.topLevel.has(to) && !ids.inner.has(to)) {
    console.error(`❌ Le bloc cible ${to} n'existe pas dans ce formulaire.`)
    process.exitCode = 1
    return
  }

  if (isKnownKey(from, ids)) {
    console.error(`❌ ${from} désigne un bloc existant : ce n'est pas une clé orpheline, rien à rebrancher.`)
    process.exitCode = 1
    return
  }

  const updates = []
  let skipped = 0

  for (const response of responses) {
    const data = parseJson(response.data, {})
    if (!(from in data) || isEmpty(data[from])) continue

    // Ne jamais écraser une valeur déjà saisie sur le nouveau bloc : les réponses arrivées
    // depuis le remplacement sont les seules à jour.
    if (!isEmpty(data[to]) && !args.force) {
      skipped++
      continue
    }

    data[to] = data[from]
    delete data[from]
    updates.push({ id: response.id, data: JSON.stringify(data), sample: preview(data[to]) })
  }

  console.log(`${from}  ➜  ${to}\n`)

  if (updates.length === 0) {
    console.log('Aucune réponse à rebrancher.')
    if (skipped > 0) console.log(`${skipped} réponse(s) ignorée(s) : le bloc cible a déjà une valeur (--force pour écraser).`)
    return
  }

  for (const update of updates.slice(0, 10)) {
    console.log(`  ${update.id}  ${update.sample}`)
  }
  if (updates.length > 10) console.log(`  … et ${updates.length - 10} autre(s)`)
  console.log('')

  if (skipped > 0) {
    console.log(`${skipped} réponse(s) ignorée(s) : le bloc cible a déjà une valeur (--force pour écraser).\n`)
  }

  if (!args.apply) {
    console.log(`🔍 Simulation : ${updates.length} réponse(s) seraient modifiées. Relancez avec --apply pour écrire.`)
    return
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.response.update({ where: { id: update.id }, data: { data: update.data } })
    )
  )

  console.log(`✅ ${updates.length} réponse(s) rebranchée(s) sur ${to}.`)
}

main()
  .catch((error) => {
    console.error(`❌ ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
