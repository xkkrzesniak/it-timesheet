#!/usr/bin/env bash
# =============================================================================
# IT Timesheet — Deploy na VPS (Nginx + PM2 + PostgreSQL)
# Uruchom raz jako root lub sudo, później jako user aplikacji
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
APP_DIR="${APP_DIR:-/opt/timesheet}"
APP_USER="${APP_USER:-timesheet}"
DOMAIN="${DOMAIN:-}"

log()     { echo -e "${CYAN}▸${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${ORANGE}$*${RESET}"; }

# ─── Azure App Setup ─────────────────────────────────────────────────────────
header "IT Timesheet — Deployment"
echo ""

# Jeśli .env nie istnieje — odpal setup Azure
if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  echo -e "${ORANGE}Plik backend/.env nie istnieje.${RESET}"
  read -rp "  Skonfigurować teraz Azure App Registration? [T/n]: " DO_AZURE
  DO_AZURE="${DO_AZURE:-T}"
  if [[ "$DO_AZURE" =~ ^[Tt]$ ]]; then
    bash "$SCRIPT_DIR/setup-azure-app.sh"
  else
    error "backend/.env jest wymagany. Uruchom: scripts/setup-azure-app.sh"
  fi
fi

# ─── Zależności systemowe ─────────────────────────────────────────────────────
header "Krok 1 — Zależności systemowe"
echo ""

if [[ $EUID -ne 0 ]]; then
  log "Nie uruchomiono jako root — pomijam instalację systemowych pakietów"
  log "Jeśli to pierwszy deploy, uruchom najpierw: sudo bash scripts/deploy.sh"
else
  log "Aktualizacja pakietów..."
  apt-get update -qq

  # Node.js 20 LTS
  if ! command -v node &>/dev/null; then
    log "Instaluję Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  # PostgreSQL
  if ! command -v psql &>/dev/null; then
    log "Instaluję PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
    systemctl enable --now postgresql
  fi

  # Nginx
  if ! command -v nginx &>/dev/null; then
    log "Instaluję Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
  fi

  # PM2
  if ! command -v pm2 &>/dev/null; then
    log "Instaluję PM2..."
    npm install -g pm2
    pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || true
  fi

  # Azure CLI (dla setup-azure-app.sh)
  if ! command -v az &>/dev/null; then
    log "Instaluję Azure CLI..."
    curl -sL https://aka.ms/InstallAzureCLIDeb | bash
  fi

  success "Zależności zainstalowane"
fi

# ─── Baza danych ─────────────────────────────────────────────────────────────
header "Krok 2 — PostgreSQL"
echo ""

# Wczytaj DATABASE_URL z .env
source <(grep DATABASE_URL "$ROOT_DIR/backend/.env" | sed 's/DATABASE_URL=/DB_URL=/')
DB_URL="${DB_URL:-}"

if [[ -n "$DB_URL" ]] && command -v psql &>/dev/null; then
  # Wyciągnij dane z URL postgresql://user:pass@host:port/db
  DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

  log "Tworzę użytkownika i bazę danych..."
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  success "Baza danych: $DB_NAME"
else
  log "Pomijam konfigurację PostgreSQL (brak połączenia lub nie root)"
fi

# ─── Build ───────────────────────────────────────────────────────────────────
header "Krok 3 — Build aplikacji"
echo ""

log "Backend — npm install..."
cd "$ROOT_DIR/backend"
npm ci --omit=dev
npm run db:generate

log "Backend — migracje..."
npm run db:deploy

log "Frontend — npm install i build..."
cd "$ROOT_DIR/frontend"
npm ci
npm run build

success "Build zakończony"

# ─── PM2 ─────────────────────────────────────────────────────────────────────
header "Krok 4 — PM2"
echo ""

cd "$ROOT_DIR/backend"

if pm2 list | grep -q "timesheet-api"; then
  log "Restartuję istniejący proces PM2..."
  pm2 restart timesheet-api
else
  log "Startuję nowy proces PM2..."
  pm2 start npm \
    --name "timesheet-api" \
    --cwd "$ROOT_DIR/backend" \
    -- start
fi

pm2 save
success "PM2 uruchomiony"

# ─── Nginx + Let's Encrypt ───────────────────────────────────────────────────
header "Krok 5 — Nginx + SSL (Let's Encrypt)"
echo ""

NGINX_CONF="/etc/nginx/sites-available/timesheet"

if [[ -z "${DOMAIN:-}" ]]; then
  read -rp "  Domena produkcyjna (np. timesheet.lemonpro.com) [pomiń=tylko IP]: " DOMAIN
  DOMAIN="${DOMAIN:-}"
fi

# E-mail do Certbot — wyciągnij z .env lub zapytaj
SSL_EMAIL=""
if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  SSL_EMAIL=$(grep -oP 'AZURE_.*EMAIL[=:]\K.*' "$ROOT_DIR/backend/.env" 2>/dev/null || true)
fi
if [[ -z "$SSL_EMAIL" && -n "${DOMAIN:-}" ]]; then
  read -rp "  E-mail dla Let's Encrypt (powiadomienia o wygaśnięciu): " SSL_EMAIL
fi

NGINX_SERVER_NAME="${DOMAIN:-_}"

write_nginx_http_conf() {
  # Konfiguracja HTTP — Certbot doda blok HTTPS automatycznie
  cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${NGINX_SERVER_NAME};

    # Potrzebne do weryfikacji Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Frontend — statyczne pliki React
    root ${ROOT_DIR}/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy do Fastify (port 3001)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/javascript application/json
               application/x-javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1000;

    # Cache statycznych assetów Vite (mają hash w nazwie)
    location ~* \.(js|css|woff2|woff|ttf|ico|svg|png|jpg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Nie cachuj index.html (SPA entry point)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
NGINX
}

if [[ $EUID -eq 0 ]]; then
  # Katalog dla ACME challenge
  mkdir -p /var/www/certbot

  write_nginx_http_conf

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/timesheet
  rm -f /etc/nginx/sites-enabled/default

  nginx -t && systemctl reload nginx
  success "Nginx (HTTP) skonfigurowany"

  # ── Let's Encrypt ────────────────────────────────────────────────────────
  if [[ -n "$DOMAIN" ]]; then
    # Instalacja Certbot
    if ! command -v certbot &>/dev/null; then
      log "Instaluję Certbot..."
      apt-get install -y certbot python3-certbot-nginx
    fi
    success "Certbot $(certbot --version 2>&1 | head -1)"

    log "Pobieranie certyfikatu Let's Encrypt dla: $DOMAIN"
    certbot --nginx \
      --non-interactive \
      --agree-tos \
      --email "$SSL_EMAIL" \
      --domains "$DOMAIN" \
      --redirect \
      --hsts \
      --staple-ocsp \
      --keep-until-expiring

    success "Certyfikat SSL wystawiony"

    # Weryfikacja auto-odnowienia
    log "Sprawdzam timer auto-odnowienia certbot..."
    if systemctl is-active --quiet certbot.timer 2>/dev/null; then
      success "certbot.timer aktywny — certyfikat odnawia się automatycznie"
    elif systemctl is-active --quiet snap.certbot.renew.timer 2>/dev/null; then
      success "snap certbot.timer aktywny — auto-odnowienie OK"
    else
      # Fallback: dodaj cron jeśli timer nie istnieje
      log "Dodaję cron dla auto-odnowienia (2x dziennie)..."
      CRON_LINE="0 3,15 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'"
      (crontab -l 2>/dev/null | grep -qF "certbot renew") \
        || (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
      success "Cron auto-odnowienia dodany"
    fi

    # Test odnowienia (dry-run)
    log "Testuję mechanizm odnowienia (dry-run)..."
    certbot renew --dry-run --quiet \
      && success "Dry-run odnowienia: OK" \
      || log "Dry-run nie powiódł się — sprawdź logi: journalctl -u certbot"

    # Reload Nginx po certbot (certbot może zmienić konfig)
    nginx -t && systemctl reload nginx
    success "Nginx przeładowany z konfiguracją HTTPS"

  else
    log "Pominięto Let's Encrypt (brak domeny)"
    log "Aby dodać SSL później: certbot --nginx -d twoja-domena.pl --email admin@firma.pl"
  fi

else
  # Nie root — zapisz konfig do pliku, żeby admin mógł skopiować ręcznie
  log "Pomijam konfigurację Nginx (wymagany root)"
  CONF_OUT="$ROOT_DIR/scripts/nginx-timesheet.conf"
  write_nginx_http_conf
  # Nadpisz plik wyjściowy (nie /etc/nginx)
  NGINX_CONF="$CONF_OUT"
  write_nginx_http_conf
  success "Konfig Nginx zapisany: scripts/nginx-timesheet.conf"
  echo ""
  echo -e "  Skopiuj ręcznie jako root:"
  echo -e "  ${CYAN}sudo cp scripts/nginx-timesheet.conf /etc/nginx/sites-available/timesheet${RESET}"
  echo -e "  ${CYAN}sudo ln -sf /etc/nginx/sites-enabled/timesheet /etc/nginx/sites-available/timesheet${RESET}"
  echo -e "  ${CYAN}sudo nginx -t && sudo systemctl reload nginx${RESET}"
  [[ -n "$DOMAIN" ]] && \
  echo -e "  ${CYAN}sudo certbot --nginx -d $DOMAIN --email $SSL_EMAIL --redirect --non-interactive --agree-tos${RESET}"
fi

# ─── Podsumowanie ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Deploy zakończony!${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════${RESET}"
echo ""
[[ -n "${DOMAIN:-}" ]] && echo -e "  ${BOLD}URL:${RESET}    https://$DOMAIN"
echo -e "  ${BOLD}Status PM2:${RESET}"
pm2 status timesheet-api || true
echo ""
echo -e "  ${CYAN}Logi: pm2 logs timesheet-api${RESET}"
echo ""
