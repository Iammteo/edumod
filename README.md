# Edumod

A modular school management platform for Nigerian private schools, built as one TypeScript full-stack application.

## What is included
- Next.js App Router foundation and plain-CSS implementation of the approved Edumod visual direction.
- Landing page, FAQ section and school-admin dashboard starter.
- PostgreSQL/Drizzle schema for multi-tenancy, shared core, attendance, finance, audit logs, notifications and Phase 2 seams.
- Better Auth configuration starter, BullMQ queue setup, worker scaffold and Docker services for Postgres/Redis.

## What still needs production implementation
- Better Auth generated tables and exact adapter schema must be generated from the installed Better Auth version.
- Actual email, Termii, Cloudflare R2, PDF generation and server actions.
- Role guards, tenancy query helpers, audit-log database privileges, migrations, tests and RLS hardening.

## Local setup
1. Copy `.env.example` to `.env` and set secure secrets.
2. `docker compose up -d`
3. `npm install`
4. `npm run auth:generate`
5. `npm run db:generate && npm run db:migrate`
6. `npm run dev` in one terminal and `npm run worker` in another.

## Recommended build order
1. Finalise auth schema and tenancy guard helpers.
2. Build shared core admin flows.
3. Attendance end to end.
4. Payments plus maker-checker approvals and receipts.
5. Bursar, teacher, principal and parent dashboards.
6. Phase 2 exams and results only after MVP acceptance.


## Tailwind CSS

This project now uses Tailwind CSS v4 for all component styling. `app/globals.css` contains only Tailwind's import, theme tokens, base styles and accessibility defaults. Run `npm install` after pulling this update so Tailwind and its PostCSS plugin are installed.
# edumod
