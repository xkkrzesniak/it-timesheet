#!/usr/bin/env bash
# =============================================================================
# IT Timesheet — Azure App Registration Setup
#
# Tworzy App Registration w Microsoft Entra ID i zapisuje dane do .env.
# Client secret NIE jest wymagany — backend weryfikuje tokeny przez JWKS
# (klucze publiczne Microsoft), więc wystarczy Client ID + Tenant ID.
#
# Wymagania: az CLI (https://learn.microsoft.com/cli/azure/install-azure-cli)
#   macOS:  brew install azure-cli
#   Ubuntu: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
# =============================================================================

set -euo pipefail

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
error()   { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${ORANGE}$*${RESET}"; }

# ─── Sprawdź az CLI ──────────────────────────────────────────────────────────
header "IT Timesheet — Azure App Setup"
echo ""

if ! command -v az &>/dev/null; then
  echo -e "${RED}✗${RESET} Azure CLI nie jest zainstalowane."
  echo ""
  echo "  macOS:  brew install azure-cli"
  echo "  Ubuntu: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
  exit 1
fi

success "Azure CLI $(az version --query '"azure-cli"' -o tsv) znalezione"

# ─── Krok 1: Logowanie ───────────────────────────────────────────────────────
header "Krok 1/4 — Logowanie do Microsoft Entra ID"
echo ""

CURRENT_USER=$(az account show --query "user.name" -o tsv 2>/dev/null || echo "")

if [[ -n "$CURRENT_USER" ]]; then
  echo -e "  Zalogowany jako: ${BOLD}$CURRENT_USER${RESET}"
  read -rp "  Użyć tego konta? [T/n]: " USE_CURRENT
  if [[ "${USE_CURRENT:-T}" =~ ^[Nn]$ ]]; then
    az logout 2>/dev/null || true
    CURRENT_USER=""
  fi
fi

if [[ -z "$CURRENT_USER" ]]; then
  log "Otwieranie okna logowania Microsoft..."
  if [[ "${CI:-false}" == "true" ]] || [[ ! -t 0 ]]; then
    az login --use-device-code --allow-no-subscriptions
  else
    az login --allow-no-subscriptions
  fi
  CURRENT_USER=$(az account show --query "user.name" -o tsv)
fi

TENANT_ID=$(az account show --query "tenantId" -o tsv)
success "Zalogowano jako: $CURRENT_USER"
success "Tenant ID: $TENANT_ID"

# ─── Krok 2: Parametry ───────────────────────────────────────────────────────
header "Krok 2/4 — Konfiguracja aplikacji"
echo ""

read -rp "  Nazwa Twojej organizacji/firmy (np. Powerity sp. z o.o.): " ORG_NAME
ORG_NAME="${ORG_NAME:-}"
if [[ -z "$ORG_NAME" ]]; then
  error "Nazwa organizacji jest wymagana."
fi

read -rp "  Nazwa aplikacji w Entra ID [IT-Timesheet]: " APP_NAME
APP_NAME="${APP_NAME:-IT-Timesheet}"

read -rp "  Produkcyjny URL frontendu (np. https://ts.powerity.pl) [pomiń=tylko localhost]: " PROD_URL
PROD_URL="${PROD_URL:-}"

echo ""
log "Tworzę aplikację: ${BOLD}$APP_NAME${RESET}"

# ─── Krok 3: App Registration ────────────────────────────────────────────────
header "Krok 3/4 — Tworzenie App Registration"
echo ""

# Redirect URIs dla SPA (Single Page Application — MSAL popup)
REDIRECT_URIS='["http://localhost:5173"]'
if [[ -n "$PROD_URL" ]]; then
  REDIRECT_URIS="[\"http://localhost:5173\", \"${PROD_URL}\"]"
fi

log "Tworzę App Registration..."
APP_ID=$(az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience "AzureADMyOrg" \
  --query "appId" \
  -o tsv)
success "App Registration: $APP_ID"

log "Ustawiam Redirect URIs jako SPA platform..."
az ad app update \
  --id "$APP_ID" \
  --set spa='{"redirectUris": '"$REDIRECT_URIS"'}' \
  --output none
success "Redirect URIs: $REDIRECT_URIS"

log "Dodaję uprawnienia Microsoft Graph (openid, profile, email, User.Read)..."
GRAPH_ID="00000003-0000-0000-c000-000000000000"
az ad app permission add \
  --id "$APP_ID" \
  --api "$GRAPH_ID" \
  --api-permissions \
    "37f7f235-527c-4136-accd-4a02d197296e=Scope" \
    "14dad69e-099b-42c9-810b-d002981feec1=Scope" \
    "64a6cdd6-aab1-4aad-94b8-3cc8405e90d0=Scope" \
    "e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope" \
  --output none
success "Uprawnienia dodane"

# ─── Krok 4: Zapis .env ──────────────────────────────────────────────────────
header "Krok 4/4 — Generowanie JWT_SECRET i zapis .env"
echo ""

JWT_SECRET=$(openssl rand -hex 48)
success "JWT_SECRET wygenerowany (96 znaków hex)"

FRONTEND_URL="${PROD_URL:-http://localhost:5173}"

# Backup jeśli istnieją poprzednie pliki
for ENV_FILE in "$BACKEND_ENV" "$FRONTEND_ENV"; do
  if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
    log "Backup: ${ENV_FILE}.backup.*"
  fi
done

cat > "$BACKEND_ENV" <<EOF
DATABASE_URL="postgresql://timesheet:password@localhost:5432/timesheet_db"
PORT=3001
HOST=0.0.0.0

# Microsoft Entra ID — tylko Tenant ID i Client ID
# Client secret NIE jest potrzebny: backend weryfikuje tokeny przez JWKS
# (publiczne klucze Microsoft na login.microsoftonline.com/{tenant}/discovery/v2.0/keys)
AZURE_TENANT_ID=${TENANT_ID}
AZURE_CLIENT_ID=${APP_ID}

# JWT — własne tokeny sesji po weryfikacji tokena Azure
JWT_SECRET=${JWT_SECRET}

FRONTEND_URL=${FRONTEND_URL}
NODE_ENV=development
EOF

cat > "$FRONTEND_ENV" <<EOF
VITE_AZURE_CLIENT_ID=${APP_ID}
VITE_AZURE_TENANT_ID=${TENANT_ID}
VITE_API_URL=http://localhost:3001
VITE_ORG_NAME=${ORG_NAME}
EOF

success "backend/.env zapisany"
success "frontend/.env zapisany"

# ─── Podsumowanie ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Gotowe! App Registration skonfigurowane.${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Organizacja:${RESET} $ORG_NAME"
echo -e "  ${BOLD}Aplikacja:${RESET}  $APP_NAME"
echo -e "  ${BOLD}Client ID:${RESET}  $APP_ID"
echo -e "  ${BOLD}Tenant ID:${RESET}  $TENANT_ID"
echo -e "  ${BOLD}Secret:${RESET}     nie wymagany (JWKS)"
echo ""
echo -e "  ${ORANGE}Uwaga:${RESET} jeśli admin consent jest wymagany w Twoim tenancie,"
echo -e "  zatwierdź uprawnienia pod:"
echo -e "  ${CYAN}https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/${APP_ID}${RESET}"
echo ""
echo -e "  ${BOLD}Następny krok:${RESET}"
echo -e "  ${CYAN}cd backend && npm run db:migrate && npm run db:seed && npm run dev${RESET}"
echo ""
