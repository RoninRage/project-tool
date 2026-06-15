#!/bin/sh
set -e

echo "Running database migrations..."
node ./node_modules/prisma/build/index.js db push --accept-data-loss

if [ "${SEED_DB:-false}" = "true" ]; then
  echo "Seeding database..."
  node ./node_modules/prisma/build/index.js db seed
fi

echo "Starting application..."
exec "$@"
