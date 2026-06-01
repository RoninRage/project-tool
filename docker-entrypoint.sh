#!/bin/sh
set -e

echo "Running database migrations..."
./node_modules/.bin/prisma db push

if [ "${SEED_DB:-false}" = "true" ]; then
  echo "Seeding database..."
  ./node_modules/.bin/prisma db seed
fi

echo "Starting application..."
exec "$@"
