#!/bin/sh
set -eu

echo "Starting BattleArena"
echo "NODE_ENV=${NODE_ENV:-unset}"
echo "HOSTNAME=${HOSTNAME:-unset}"
echo "PORT=${PORT:-unset}"

exec node server.js
