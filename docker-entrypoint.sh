#!/bin/sh
set -e

echo "🔄 Running database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "� Initializing database (admin user, settings, themes)..."
node ./scripts/init-db.js

echo "�🚀 Starting application..."
exec node server.js
