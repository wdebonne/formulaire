#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Running database seed..."
npx prisma db seed || echo "⚠️ Seed skipped (already exists or error)"

echo "🚀 Starting application..."
exec node server.js
