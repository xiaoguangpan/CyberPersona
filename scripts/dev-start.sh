#!/bin/sh
set -eu

if [ ! -f /tmp/cyberpersona_dev_bootstrapped ]; then
  npm run db:generate
  npm run db:migrate
  touch /tmp/cyberpersona_dev_bootstrapped
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3000
