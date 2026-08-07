// Liste les migrations Prisma restées en échec dans la base cible.
//
// Une migration échouée laisse une ligne dans `_prisma_migrations` avec `finished_at` à NULL.
// Tant que cette ligne existe, `prisma migrate deploy` refuse d'appliquer quoi que ce soit et
// s'arrête sur P3009 — y compris après correction du SQL fautif, puisque l'état bloquant vit
// dans le volume de la base et non dans l'image.
//
// Sortie : un nom de migration par ligne sur stdout (consommé par docker-entrypoint.sh).
// Tout le reste est écrit sur stderr pour ne pas polluer cette liste.

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  let rows
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name, logs
         FROM _prisma_migrations
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL
        ORDER BY started_at`
    )
  } catch (error) {
    // Base neuve : la table n'existe pas encore, il n'y a rien à réparer.
    console.error(`ℹ️  Unable to read _prisma_migrations (${error.message})`)
    return
  }

  if (rows.length === 0) return

  for (const row of rows) {
    const reason = (row.logs || '').split('\n').find((l) => l.trim()) || 'no log recorded'
    console.error(`   • ${row.migration_name} — ${reason.trim().slice(0, 200)}`)
    console.log(row.migration_name)
  }

  // Une table « <nom>_new » résiduelle signale une reconstruction de table interrompue en
  // dehors d'une transaction : la reprise automatique est alors moins évidente, on le signale.
  try {
    const leftovers = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%\\_new' ESCAPE '\\'`
    )
    for (const t of leftovers) {
      console.error(`   ⚠️  leftover table "${t.name}" — a table rebuild was interrupted`)
    }
  } catch {
    // Inspection facultative : son échec ne doit pas empêcher la reprise.
  }
}

main()
  .catch((error) => {
    console.error(`❌ failed-migrations.js: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
