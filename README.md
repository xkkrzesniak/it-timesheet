# IT Timesheet

Stack: **React + Vite + TypeScript + Tailwind CSS** | **Fastify + Prisma + PostgreSQL** | **Microsoft Entra ID SSO**

---

## Uruchomienie lokalne (etap 1)

### 1. Baza danych
```bash
docker-compose up -d postgres
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Uzupełnij AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, JWT_SECRET

npm install
npm run db:generate        # generuje Prisma Client
npm run db:migrate         # tworzy tabele w bazie
npm run db:seed            # dane testowe
npm run dev                # http://localhost:3001
```

Weryfikacja:
```bash
curl http://localhost:3001/api/health
# {"status":"ok","ts":"..."}
```

---

## Architektura bezpieczeństwa stawek

```
User.hourlyRate      → snapshotUserRate   → costValue    (widoczne: USER + ADMIN)
Client.hourlyRate    → snapshotClientRate → revenueValue (widoczne: ADMIN only)
```

Middleware `selectByRole.ts` — **jedyne miejsce** decydujące o widoczności pól.
Frontend **nigdy** nie dostaje `clientRate` ani `revenueValue` przy roli USER.

---

## API Endpoints (Etap 1)

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

## Następne etapy

- **Etap 2**: Frontend React + Vite + Tailwind + MSAL (login Entra ID, /track z timerem)
- **Etap 3**: Widoki /history, /reports z tabelami zależnymi od roli
- **Etap 4**: Panel /admin (users, clients, timesheets)
- **Etap 5**: Nginx + PM2 + deployment VPS
