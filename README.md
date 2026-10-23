# Medicare Hub — Full-Stack Hospital Management System

A production-ready full-stack medical management system built with **Next.js 16 (App Router) + TypeScript + Prisma (SQLite) + Tailwind CSS 4 + shadcn/ui**.

## ✨ Features

- **Role-based dashboards** — ADMIN and USER see different experiences
- **Authentication** — register, login, logout, forgot/reset password (HMAC-signed session token, Bearer + cookie dual-channel)
- **Client-side portal (USER)** — personal dashboard, profile editing, doctor directory, **appointment booking** with live slot availability, "My Appointments" with cancel
- **Admin dashboard (ADMIN)** — hospital stats & charts, patients, doctors, departments, records, articles
- **Appointment workflow** — admin can **approve / cancel / complete** requests and **provide slots**; statuses: `Pending → Approved / Cancelled / Completed`
- **Slot management** — admins create/open doctor slots; users can only book open, unbooked slots
- **Billing** — invoices, payments, tax/discount, status tracking
- **Health articles** — published educational content

## 🚀 Getting Started (Windows / macOS / Linux)

```bash
# 1. Install dependencies
npm install        # or: bun install

# 2. Push the database schema + seed demo data (already-seeded db/custom.db is included)
npm run db:push

# 3. Start the dev server
npm run dev        # → http://localhost:3000
```

> The `dev` script uses a cross-platform Node runner (`scripts/dev.mjs`) — no `tee`/shell piping, so it works out of the box on Windows cmd/PowerShell.

## 🔐 Demo Accounts

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| ADMIN | admin@medicarehub.com  | demo1234   |
| USER  | user@medicarehub.com   | demo1234   |

New registrations automatically get the `USER` role and land on the client-side dashboard.

## 🗂 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/            # REST API: auth, appointments, slots, patients,
│   │   │                   # doctors, departments, records, articles, billing, stats
│   │   └── page.tsx        # Single-page app shell (view switching)
│   ├── components/
│   │   ├── medicare/       # Feature views (dashboard, appointments, billing, auth…)
│   │   └── ui/             # shadcn/ui component library
│   ├── hooks/              # use-toast, use-mobile
│   └── lib/                # auth, auth-store, api client, prisma client, types
├── prisma/
│   ├── schema.prisma       # Doctor, Patient, Appointment, AppointmentSlot,
│   │                       # Invoice, MedicalRecord, Department, User, HealthArticle
│   ├── seed.ts             # Demo data (admin + user accounts)
│   └── migrate-slots.ts    # One-off slot backfill helper
├── db/custom.db            # SQLite database (pre-seeded)
├── scripts/dev.mjs         # Cross-platform dev runner (Windows-safe)
├── .env                    # DATABASE_URL + AUTH_SECRET
└── package.json
```

## 🔌 API Overview

All endpoints return `{ data: ... }` and are protected via session
(`Authorization: Bearer <token>` header or `mh_session` cookie).

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` · `GET/PUT /api/auth/profile` |
| Appointments | `GET/POST /api/appointments` · `PATCH/DELETE /api/appointments/[id]` (admin approve/cancel/complete) |
| Slots | `GET /api/slots` · `POST /api/slots` (admin provide slots) · `PATCH/DELETE /api/slots/[id]` |
| Core | `/api/patients` · `/api/doctors` · `/api/departments` · `/api/records` · `/api/articles` · `/api/billing` · `/api/stats` |

## 🛠 Tech Stack

Next.js 16 · React 19 · TypeScript 5 · Prisma 6 + SQLite · Tailwind CSS 4 · shadcn/ui (New York) · Zustand · TanStack Query · Recharts · Framer Motion · zod

## 📝 Notes

- Theme: emerald/teal medical palette (no blue/indigo).
- Fully responsive, dark-mode ready, sticky footer, accessible (ARIA + keyboard nav).
- `worklog.md` contains the full development history.
