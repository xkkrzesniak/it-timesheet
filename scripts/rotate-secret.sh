#!/usr/bin/env bash
# =============================================================================
# Rotacja Client Secret — uruchom przed wygaśnięciem (domyślnie po 12 mies.)
# =============================================================================

set -euo pipefail

ORANGE='\033[0;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_ENV="$ROOT_DIR/backend/.env"

log()     { echo -e "${CYAN}▸${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }

[[ -f "$BACKEND_ENV" ]] || error "backend/.env nie istnieje"

source <(grep -E "^AZURE_(CLIENT_ID|TENANT_ID)" "$BACKEND_ENV")

echo -e "${BOLD}${ORANGE}Rotacja Client Secret${RESET}"
echo ""
echo -e "  App: ${BOLD}${AZURE_CLIENT_ID:-?}${RESET}"
echo -e "  Tenant: ${BOLD}${AZURE_TENANT_ID:-?}${RESET}"
echo ""

# Sprawdź zalogowanie
az account show &>/dev/null || az login --allow-no-subscriptions

read -rp "  Nowy sekret ważny przez ile miesięcy? [12]: " MONTHS
MONTHS="${MONTHS:-12}"
END_DATE=$(date -d "+${MONTHS} months" +%Y-%m-%d 2>/dev/null \
  || date -v "+${MONTHS}m" +%Y-%m-%d 2>/dev/null)

log "Generuję nowy secret..."
NEW_SECRET=$(az ad app credential reset \
  --id "$AZURE_CLIENT_ID" \
  --display-name "timesheet-secret-$(date +%Y%m)" \
  --end-date "$END_DATE" \
  --query "password" -o tsv)

# Backup + podmiana w .env
cp "$BACKEND_ENV" "${BACKEND_ENV}.backup.$(date +%Y%m%d%H%M%S)"
sed -i.bak "s|^AZURE_CLIENT_SECRET=.*|AZURE_CLIENT_SECRET=${NEW_SECRET}|" "$BACKEND_ENV"
rm -f "${BACKEND_ENV}.bak"

success "Secret zaktualizowany (ważny do: $END_DATE)"
log "Pamiętaj zrestartować backend: pm2 restart timesheet-api"
