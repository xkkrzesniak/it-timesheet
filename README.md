# IT Timesheet

Stack: **React + Vite + TypeScript + Tailwind CSS** | **Fastify + Prisma + PostgreSQL** | **Microsoft Entra ID SSO**

---

## Uruchomienie lokalne

### 1. Skonfiguruj Azure App Registration automatycznie

Skrypt loguje się do Entra ID, tworzy App Registration, generuje secret i zapisuje wszystko do `.env`:

```bash
bash scripts/setup-azure-app.sh
```

Wymaga [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli):
- macOS: `brew install azure-cli`
- Ubuntu/VPS: `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`

### 2. Baza danych
```bash
docker-compose up -d postgres
```

### 3. Backend
```bash
cd backend
npm install
npm run db:generate        # generuje Prisma Client
npm run db:migrate         # tworzy tabele
npm run db:seed            # dane testowe (admin + 2 userów + 2 klientów)
npm run dev                # http://localhost:3001
```

Weryfikacja:
```bash
curl http://localhost:3001/api/health
# {"status":"ok","ts":"..."}
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

---

## Architektura bezpieczeństwa stawek

```
User.hourlyRate      → snapshotUserRate   → costValue    (widoczne: USER + ADMIN)
Client.hourlyRate    → snapshotClientRate → revenueValue (widoczne: ADMIN only)
```

- `selectByRole.ts` — **jedyne miejsce** decydujące o widoczności pól w Prisma select
- Frontend **nigdy** nie dostaje `snapshotClientRate` ani `revenueValue` przy roli USER
- `adminGuard` middleware chroni wszystkie trasy `/api/admin/*`
- USER widzi wyłącznie własne wpisy (`WHERE userId = caller.sub`)

---

## Widoki

| Ścieżka | Rola | Opis |
|---------|------|------|
| `/login` | — | Logowanie przez Microsoft Entra ID (MSAL popup) |
| `/track` | USER+ADMIN | Timer live + ręczny wpis czasu |
| `/history` | USER+ADMIN | Historia wpisów z filtrowaniem, edycją, usuwaniem |
| `/reports` | USER+ADMIN | Raporty z KPI; ADMIN widzi przychód/marżę |
| `/admin/timesheets` | ADMIN | Wszystkie wpisy zespołu z pełnymi danymi finansowymi |
| `/admin/users` | ADMIN | Edycja stawek wewnętrznych i ról |
| `/admin/clients` | ADMIN | Zarządzanie klientami i stawkami sprzedażowymi |

---

## API Endpoints

| Method | Path | Opis | Rola |
|--------|------|------|------|
| POST | `/api/auth/azure` | Login Entra ID → JWT | — |
| GET | `/api/auth/me` | Profil zalogowanego | ANY |
| GET | `/api/time-entries` | Lista wpisów | ANY |
| POST | `/api/time-entries` | Nowy wpis (snapshot stawek) | ANY |
| PATCH | `/api/time-entries/:id` | Edycja wpisu | owner/ADMIN |
| DELETE | `/api/time-entries/:id` | Usuń wpis | owner/ADMIN |
| GET | `/api/reports/summary` | Raport z sumami | ANY |
| GET | `/api/reports/export/csv` | Eksport CSV | ANY |
| GET | `/api/reports/export/pdf` | Eksport PDF | ANY |
| GET | `/api/clients` | Lista klientów | ANY |
| POST | `/api/clients` | Nowy klient | ADMIN |
| PATCH | `/api/clients/:id` | Edycja klienta | ADMIN |
| GET | `/api/projects` | Lista projektów | ANY |
| POST | `/api/projects` | Nowy projekt | ADMIN |
| GET | `/api/admin/users` | Lista userów + stawki | ADMIN |
| PATCH | `/api/admin/users/:id` | Edycja roli/stawki | ADMIN |
| GET | `/api/admin/timesheets` | Wszystkie wpisy | ADMIN |

---

## Deployment na VPS

```bash
# Pełny deploy (instalacja zależności + build + PM2 + Nginx + SSL)
sudo bash scripts/deploy.sh

# Skrypt sam wykryje brak .env i zaproponuje setup Azure
```

### Rotacja Client Secret (co 12 miesięcy)
```bash
bash scripts/rotate-secret.sh
```

### Skrypty

| Skrypt | Opis |
|--------|------|
| `scripts/setup-azure-app.sh` | Tworzy App Registration w Entra ID, zapisuje Tenant ID + Client ID do `.env` |
| `scripts/deploy.sh` | Pełny deploy: build + PM2 + Nginx + SSL (Let's Encrypt) |

> **Dlaczego brak Client Secret?**
> Backend weryfikuje tokeny Azure przez **JWKS** (publiczne klucze RSA Microsoft dostępne pod
> `login.microsoftonline.com/{tenant}/discovery/v2.0/keys`). Client secret byłby potrzebny
> tylko gdyby backend samodzielnie wywoływał Microsoft Graph API. W tej architekturze
> robi to frontend (MSAL), a backend jedynie waliduje otrzymany token.
