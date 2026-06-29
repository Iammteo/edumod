<div align="center">

# Edumod

**The all-in-one operating system for African schools.**

Attendance, finance, results, communication and compliance for one school or a whole network, in a single fast TypeScript app.

</div>

---

## The vision

Most schools in Nigeria (and across Africa) still run on paper registers, WhatsApp broadcasts, a bursar's spreadsheet and a locked filing cabinet. The data exists, but it is scattered, unverifiable and impossible to act on. Fees go uncollected, attendance is guessed at, results take weeks to compile, and leadership has no real-time picture of the school.

**Edumod replaces that patchwork with one trustworthy system.** The goal is simple: give every school, no matter its size or budget, the operational clarity that the best-run institutions have, on hardware they already own (a phone, a cheap tablet, a laptop).

We optimise for three things:

- **Trust** - money and attendance are auditable by design. Maker-checker approvals, anti-buddy-punching clock-in, and a complete audit trail mean the numbers can be relied on.
- **Reach** - it works on a low-end Android phone over patchy data, supports cash-first realities, and never assumes a card reader or a fat pipe.
- **Speed** - school staff are busy. Marking a class, recording a payment or issuing a bill should take seconds, not training.

The long-term picture is a connected layer for education: schools run day to day on Edumod, parents see fees and results in real time, and (with consent) districts and partners get aggregate insight to fund and improve learning.

## Who it is for

- **School admins / proprietors** - the full operational picture: collections, attendance, staffing, audit.
- **Bursars & accountants** - record and reconcile payments with maker-checker safety and instant receipts.
- **Principals & vice-principals** - approvals, oversight and class performance.
- **Class & subject teachers** - clock in, mark their register, record results.
- **Students & parents** - their own attendance, fees and results (rolling out).

## What it does today

**Attendance**
- Teacher clock-in/out via a **rotating-QR kiosk** (the token refreshes every few seconds to stop screenshot sharing) or an **in-app QR scanner** on the teacher's phone.
- Phone-dead fallback: **6-digit PIN + selfie** at the kiosk, uploaded asynchronously (BullMQ to Cloudflare R2, with a local fallback).
- Student attendance: mark present / absent / late / excused, **bulk actions**, a whole-school overview with per-class drill-in, and **Late / Left-early** flags from configurable school hours.
- Printable registers (PDF with photos, Excel, CSV) for **any date range**, with per-person summaries.

**Finance**
- **Record payment** with maker-checker: the recorder cannot approve their own payment.
- **Approvals** queue, **multi-item bills & reusable fee structures** (mandatory / optional items), **invoices & receipts**, **overpayments & refunds**, and a **class finance summary** with collection rates and outstanding balances.
- Dependency-free exports (Excel / PDF / Word / CSV), optionally including guardian phone numbers.

**People & academics**
- Multi-tenant schools with **role-based access** (admin, principal, vice-principal, bursar, teacher, parent, student).
- Staff invitations with a generated **Staff ID** (sign in with Staff ID or email); students sign in with a school code + Student ID and school-branded passwords.
- **Class management** (create / rename / delete, including the built-in classes) and **academic sessions & terms** created and switched right from the dashboard.
- Results / grades, an interactive **dashboard** (time-aware banner, KPIs, fee chart, sections donut, calendar & events, recent activity), and a complete **audit log**.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | **Next.js (App Router)** + React, server actions, TypeScript |
| Styling | **Tailwind CSS v4** (design tokens in `app/globals.css`) |
| Database | **PostgreSQL** + **Drizzle ORM** (typed schema & migrations) |
| Auth | **Better Auth** (email + OTP, username / Staff-ID, role memberships) |
| Background jobs | **BullMQ** + **Redis** (ioredis), worker via `tsx` |
| Storage | **Cloudflare R2** via `@aws-sdk/client-s3` (selfies, proof of payment) |
| Messaging | Email (nodemailer / Resend), SMS (Termii) |
| Validation | **Zod** end to end |
| Icons / QR | lucide-react, `qrcode` (generate), `jsqr` (scan) |

## Project structure

```
app/                 Next.js routes
  (marketing)/       Public landing, contact, legal
  (app)/dashboard/   The authenticated app shell
  login, signup, onboarding, kiosk, clock-in, receipt/[id], r/[token]
  api/auth/          Better Auth handler
components/app/       Dashboard UI (admin app, finance, attendance, ...)
lib/
  actions/           Server actions (finance, attendance, people, academics, ...)
  identity/          School codes, student/staff IDs, passwords
  queues/            BullMQ queue definitions
  auth, db, email, sms, r2, export-report, audit, ...
db/schema.ts         Drizzle schema (single source of truth)
drizzle/             Generated SQL migrations
workers/             BullMQ workers (e.g. attendance selfie upload)
```

## Getting started

Prerequisites: **Node 20+**, **Docker** (for Postgres + Redis) and **npm**.

```bash
# 1. Configure environment
cp .env.example .env          # then set DATABASE_URL, BETTER_AUTH_SECRET, etc.

# 2. Start Postgres + Redis
docker compose up -d

# 3. Install dependencies
npm install

# 4. Set up the database
npm run db:generate           # generate migrations when db/schema.ts changes
npm run db:migrate            # apply migrations

# 5. Run the app (two terminals)
npm run dev                   # Next.js dev server -> http://localhost:3000
npm run worker                # BullMQ worker (selfie uploads, async jobs)
```

Then open `http://localhost:3000`, click **Create an organization**, and you have a school with an admin account.

### Key environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Auth session / signing secret |
| `REDIS_URL` | Redis connection for BullMQ |
| `ATTENDANCE_QR_SECRET` | HMAC secret for rotating kiosk QR tokens |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Cloudflare R2 (selfies, proof of payment) |
| Email / SMS keys | Transactional email and SMS providers |

> `.env` is gitignored and must never be committed. If a secret is ever exposed, rotate it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run worker` | Run BullMQ workers |
| `npm run db:generate` | Generate Drizzle migrations from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run the test suite |

## Design principles

- **Cash-first and offline-tolerant** - the realities of African schools come first.
- **Auditable by default** - sensitive actions (payments, marks) are logged and, where it matters, require a second approver.
- **Multi-tenant** - every record is scoped to a school; one deployment serves many.
- **Light by default** - PDFs, spreadsheets and charts are built from first principles to keep the app fast on cheap devices.

## Roadmap

- Deepen the **parent & student portals** (live fees, results, attendance).
- Complete the redesigned **finance suite** (approvals, class summary, bills, invoices).
- **Communications** (SMS / email broadcasts), **exams & report cards**, and **timetabling**.
- Offline-first capture and **network / district-level** analytics.

---

<div align="center">
Built with care for schools that deserve better tools.
</div>
