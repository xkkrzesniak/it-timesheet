#!/usr/bin/env bash
# =============================================================================
# IT Timesheet — Azure App Registration Setup
# Tworzy App Registration w Microsoft Entra ID i zapisuje dane do .env
# Wymagania: az CLI (https://learn.microsoft.com/cli/azure/install-azure-cli)
# =============================================================================

set -euo pipefail

# ─── Kolory ──────────────────────────────────────────────────────────────────
ORANGE='\033[0;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_ENV="$ROOT_DIR/backend/.env"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"

log()     { echo -e "${CYAN}▸${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${ORANGE}$*${RESET}"; }

# ─── Sprawdź az CLI ──────────────────────────────────────────────────────────
header "IT Timesheet — Azure App Setup"
echo ""

if ! command -v az &>/dev/null; then
  error "Azure CLI nie jest zainstalowane."
  echo ""
  echo "  macOS:  brew install azure-cli"
  echo "  Ubuntu: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  echo "  Docs:   https://learn.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

success "Azure CLI $(az version --query '"azure-cli"' -o tsv) znalezione"

# ─── Logowanie ───────────────────────────────────────────────────────────────
header "Krok 1/5 — Logowanie do Microsoft Entra ID"
echo ""

# Sprawdź czy już zalogowany
CURRENT_USER=$(az account show --query "user.name" -o tsv 2>/dev/null || echo "")

if [[ -n "$CURRENT_USER" ]]; then
  echo -e "  Zalogowany jako: ${BOLD}$CURRENT_USER${RESET}"
  read -rp "  Użyć tego konta? [T/n]: " USE_CURRENT
  USE_CURRENT="${USE_CURRENT:-T}"
  if [[ "$USE_CURRENT" =~ ^[Nn]$ ]]; then
    log "Logowanie od nowa..."
    az logout 2>/dev/null || true
    CURRENT_USER=""
  fi
fi

if [[ -z "$CURRENT_USER" ]]; then
  log "Otwieranie okna logowania Microsoft..."
  # --use-device-code działa też na VPS bez przeglądarki
  if [[ "${CI:-false}" == "true" ]] || [[ ! -t 0 ]]; then
    az login --use-device-code --allow-no-subscriptions
  else
    az login --allow-no-subscriptions
  fi
  CURRENT_USER=$(az account show --query "user.name" -o tsv)
fi

success "Zalogowano jako: $CURRENT_USER"

# ─── Pobierz Tenant ID ───────────────────────────────────────────────────────
TENANT_ID=$(az account show --query "tenantId" -o tsv)
success "Tenant ID: $TENANT_ID"

# ─── Parametry aplikacji ─────────────────────────────────────────────────────
header "Krok 2/5 — Konfiguracja aplikacji"
echo ""

read -rp "  Nazwa aplikacji w Entra ID [IT-Timesheet]: " APP_NAME
APP_NAME="${APP_NAME:-IT-Timesheet}"

read -rp "  Produkcyjny URL frontendu (np. https://timesheet.lemonpro.com) [pomiń=tylko localhost]: " PROD_URL
PROD_URL="${PROD_URL:-}"

read -rp "  Sekret ważny przez ile miesięcy? [12]: " SECRET_MONTHS
SECRET_MONTHS="${SECRET_MONTHS:-12}"

# Secret expiry — oblicz datę
SECRET_END_DATE=$(date -d "+${SECRET_MONTHS} months" +%Y-%m-%d 2>/dev/null \
  || date -v "+${SECRET_MONTHS}m" +%Y-%m-%d 2>/dev/null)

echo ""
log "Tworzenie aplikacji: ${BOLD}$APP_NAME${RESET}"

# ─── Utwórz App Registration ─────────────────────────────────────────────────
header "Krok 3/5 — Tworzenie App Registration"
echo ""

# Redirect URIs (SPA — Single Page Application)
REDIRECT_URIS='["http://localhost:5173"]'
if [[ -n "$PROD_URL" ]]; then
  REDIRECT_URIS="[\"http://localhost:5173\", \"${PROD_URL}\"]"
fi

# Utwórz aplikację
log "Tworzę App Registration..."
APP_ID=$(az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience "AzureADMyOrg" \
  --query "appId" \
  -o tsv)

success "App Registration utworzone: $APP_ID"

# Ustaw redirect URIs jako SPA platform
log "Ustawiam Redirect URIs (SPA)..."
az ad app update \
  --id "$APP_ID" \
  --set spa='{"redirectUris": '"$REDIRECT_URIS"'}' \
  --output none

success "Redirect URIs: $REDIRECT_URIS"

# ─── API Permissions ─────────────────────────────────────────────────────────
log "Dodaję uprawnienia Microsoft Graph..."

# openid, profile, email — delegated
# User.Read — delegated
# Graph API resource ID (stały dla MS Graph)
GRAPH_ID="00000003-0000-0000-c000-000000000000"

# Scope IDs (stałe GUIDy w MS Graph)
OPENID_SCOPE="37f7f235-527c-4136-accd-4a02d197296e"   # openid
PROFILE_SCOPE="14dad69e-099b-42c9-810b-d002981feec1"   # profile
EMAIL_SCOPE="64a6cdd6-aab1-4aad-94b8-3cc8405e90d0"     # email
USERREAD_SCOPE="e1fe6dd8-ba31-4d61-89e7-88639da4683d"  # User.Read

az ad app permission add \
  --id "$APP_ID" \
  --api "$GRAPH_ID" \
  --api-permissions \
    "${OPENID_SCOPE}=Scope" \
    "${PROFILE_SCOPE}=Scope" \
    "${EMAIL_SCOPE}=Scope" \
    "${USERREAD_SCOPE}=Scope" \
  --output none

success "Uprawnienia dodane (openid, profile, email, User.Read)"

# ─── Client Secret ───────────────────────────────────────────────────────────
header "Krok 4/5 — Generowanie Client Secret"
echo ""

log "Tworzę client secret (ważny do: $SECRET_END_DATE)..."
CLIENT_SECRET=$(az ad app credential reset \
  --id "$APP_ID" \
  --display-name "timesheet-secret" \
  --end-date "$SECRET_END_DATE" \
  --query "password" \
  -o tsv)

success "Client secret wygenerowany"

# ─── JWT Secret ──────────────────────────────────────────────────────────────
log "Generuję losowy JWT_SECRET..."
JWT_SECRET=$(openssl rand -hex 48)
success "JWT_SECRET wygenerowany (96 znaków)"

# ─── Zapis do .env ───────────────────────────────────────────────────────────
header "Krok 5/5 — Zapis zmiennych do .env"
echo ""

FRONTEND_URL="${PROD_URL:-http://localhost:5173}"

# Backend .env
write_backend_env() {
  cat > "$BACKEND_ENV" <<EOF
DATABASE_URL="postgresql://timesheet:password@localhost:5432/timesheet_db"
PORT=3001
HOST=0.0.0.0

# Microsoft Entra ID — wygenerowane przez setup-azure-app.sh
AZURE_TENANT_ID=${TENANT_ID}
AZURE_CLIENT_ID=${APP_ID}
AZURE_CLIENT_SECRET=${CLIENT_SECRET}

# JWT — podpisywanie sesji
JWT_SECRET=${JWT_SECRET}

FRONTEND_URL=${FRONTEND_URL}
NODE_ENV=development
EOF
}

# Frontend .env
write_frontend_env() {
  cat > "$FRONTEND_ENV" <<EOF
VITE_AZURE_CLIENT_ID=${APP_ID}
VITE_AZURE_TENANT_ID=${TENANT_ID}
VITE_API_URL=http://localhost:3001
EOF
}

# Backup jeśli istnieją
if [[ -f "$BACKEND_ENV" ]]; then
  cp "$BACKEND_ENV" "${BACKEND_ENV}.backup.$(date +%Y%m%d%H%M%S)"
  log "Backup poprzedniego backend/.env zapisany"
fi
if [[ -f "$FRONTEND_ENV" ]]; then
  cp "$FRONTEND_ENV" "${FRONTEND_ENV}.backup.$(date +%Y%m%d%H%M%S)"
  log "Backup poprzedniego frontend/.env zapisany"
fi

write_backend_env
write_frontend_env

success "backend/.env zapisany"
success "frontend/.env zapisany"

# ─── Podsumowanie ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Gotowe! App Registration skonfigurowane.${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Aplikacja:${RESET}    $APP_NAME"
echo -e "  ${BOLD}Client ID:${RESET}    $APP_ID"
echo -e "  ${BOLD}Tenant ID:${RESET}    $TENANT_ID"
echo -e "  ${BOLD}Secret ważny:${RESET} do $SECRET_END_DATE"
echo ""
echo -e "  ${ORANGE}WAŻNE:${RESET} Admin Entra ID musi zatwierdzić uprawnienia:"
echo -e "  ${CYAN}https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${APP_ID}${RESET}"
echo ""
echo -e "  ${BOLD}Następny krok:${RESET}"
echo -e "  ${CYAN}cd backend && npm run db:migrate && npm run db:seed && npm run dev${RESET}"
echo ""

# Opcja: otwórz portal Azure
if command -v open &>/dev/null || command -v xdg-open &>/dev/null; then
  read -rp "  Otworzyć Azure Portal dla tej aplikacji? [t/N]: " OPEN_PORTAL
  if [[ "${OPEN_PORTAL:-N}" =~ ^[Tt]$ ]]; then
    PORTAL_URL="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/${APP_ID}"
    (open "$PORTAL_URL" 2>/dev/null || xdg-open "$PORTAL_URL" 2>/dev/null) &
  fi
fi
