# IT Timesheet

Stack: **React + Vite + TypeScript + Tailwind CSS** | **Fastify + Prisma + PostgreSQL** | **Microsoft Entra ID SSO**

---

## Uruchomienie lokalne

### 1. Baza danych
```bash
docker-compose up -d postgres
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Uzupełnij: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, JWT_SECRET

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

### 3. Frontend
```bash
cd frontend
cp .env.example .env
# Uzupełnij: VITE_AZURE_CLIENT_ID, VITE_AZURE_TENANT_ID

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

## Następny etap

- **Etap 5**: Nginx + PM2 + deployment VPS (konfiguracja produkcyjna)
