#!/usr/bin/env bash
# Push Paymi migrations to the linked Supabase project.
# Requires: supabase login (run once in your terminal)

set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Linking paymi (no password needed on latest CLI)..."
npx supabase@latest link --project-ref gvfzsfjxehjnqdjokvcv --yes

echo "→ Pushing migrations..."
npx supabase@latest db push --yes

echo ""
echo "✓ Done. Tables: profiles, groups, group_members, receipts, receipt_items, split_assignments"
