#!/bin/sh
set -e

PRISMA="node ./node_modules/prisma/build/index.js"

echo "🔄 Running database migrations..."

if $PRISMA migrate deploy; then
  echo "✅ Migrations applied."
else
  # Une migration en échec laisse une ligne bloquante dans `_prisma_migrations`, à l'intérieur
  # du volume de la base. Corriger le SQL et reconstruire l'image ne la retire pas : sans
  # intervention, le conteneur redémarre indéfiniment sur P3009. La reprise est donc tentée ici,
  # une seule fois, plutôt que d'exiger un accès CLI au conteneur (peu commode via Portainer).
  if [ "${MIGRATION_AUTO_REPAIR:-1}" = "0" ]; then
    echo "❌ Migrations failed and MIGRATION_AUTO_REPAIR=0 — stopping."
    exit 1
  fi

  echo "⚠️  Migration failed — looking for a blocking failed migration..."
  FAILED=$(node ./scripts/failed-migrations.js)

  if [ -z "$FAILED" ]; then
    echo "❌ No failed migration recorded — the failure is not recoverable automatically."
    exit 1
  fi

  # Prisma exécute une migration SQLite dans une transaction : un échec la ramène à son état
  # initial. La marquer « rolled back » demande simplement à Prisma de la rejouer, ce qui est
  # le comportement attendu une fois le SQL fautif corrigé dans l'image.
  for MIGRATION in $FAILED; do
    echo "↩️  Marking $MIGRATION as rolled back so it can be replayed"
    $PRISMA migrate resolve --rolled-back "$MIGRATION"
  done

  echo "🔄 Retrying migrations..."
  # Une seule reprise : si cela échoue encore, la cause est ailleurs et doit être examinée
  # à la main plutôt que réessayée en boucle.
  if ! $PRISMA migrate deploy; then
    echo "❌ Migrations still failing after recovery — manual intervention required."
    echo "   Back up the database volume, then inspect it before retrying."
    exit 1
  fi
  echo "✅ Recovered and migrations applied."
fi

echo "🔧 Initializing database (admin user, settings, themes)..."
node ./scripts/init-db.js

echo "🚀 Starting application..."
exec node server.js
