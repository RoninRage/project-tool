#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push

if [ "${SEED_DB:-false}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Starting application..."
exec "$@"
