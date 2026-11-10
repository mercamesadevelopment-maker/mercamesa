#!/usr/bin/env bash
# Falla si entre <base> y <head> cambió lo que recibe Meteor y no cambió
# lib/mcp/changelog.ts. Lo corre .github/workflows/mcp-cambios.yml; también sirve
# en local: `bash scripts/ci/check-mcp-changelog.sh origin/development HEAD`.
#
# SIN_CAMBIOS=true (la etiqueta `mcp-sin-cambios` del PR) lo deja pasar.
set -euo pipefail

BASE="${1:?falta la base}"
HEAD="${2:-HEAD}"
CHANGELOG="lib/mcp/changelog.ts"

changed=$(git diff --name-only "$BASE...$HEAD")

mcp=$(printf '%s\n' "$changed" \
  | grep -E '^(lib/mcp/|app/api/mcp/|app/api/meteor/|lib/whatsapp-events/)' \
  | grep -vE '\.test\.ts$' \
  | grep -vx "$CHANGELOG" || true)

if [ -z "$mcp" ]; then
  echo "Este cambio no toca el MCP."
  exit 0
fi

echo "Archivos del MCP en este cambio:"
printf '  %s\n' $mcp

if printf '%s\n' "$changed" | grep -qx "$CHANGELOG"; then
  echo "Y $CHANGELOG también cambió."
  exit 0
fi

if [ "${SIN_CAMBIOS:-false}" = "true" ]; then
  echo "Sin versión nueva: el PR tiene la etiqueta mcp-sin-cambios."
  exit 0
fi

echo "::error file=$CHANGELOG::Este cambio toca el MCP y no anota la versión nueva. Agrega una versión arriba en $CHANGELOG (Meteor la ve en /mcp/cambios) o, si Meteor no nota nada, pon la etiqueta mcp-sin-cambios en el PR."
exit 1
