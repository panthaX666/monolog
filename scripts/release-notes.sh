#!/usr/bin/env bash
# Usage: scripts/release-notes.sh <version>   e.g. 0.4.2
# Prints "TITLE<TAB>v1.2.3: Title" on the first line, then that version's notes from CHANGELOG.md.
set -euo pipefail
v="$1"
file="$(dirname "$0")/../CHANGELOG.md"
heading="$(grep -m1 -E "^## \[${v//./\\.}\]" "$file" || true)"
if [ -z "$heading" ]; then
  echo "No CHANGELOG.md section for ${v}" >&2
  exit 1
fi
title="${heading##*· }"
echo -e "TITLE\tv${v}: ${title}"
awk -v v="$v" '
  $0 ~ "^## \\[" v "\\]" { on = 1; next }
  on && /^## \[/ { exit }
  on { print }
' "$file" | sed -e '/./,$!d'
