# Edumod architecture

## Core principle
Edumod is one Next.js App Router application. It contains its own UI, Server Actions and Route Handlers. A separate BullMQ worker is the only extra process, used for long-running jobs.

## Tenancy boundary
Every school-owned table has `school_id`. Every server-side query must begin by resolving a membership for the authenticated user and selected school. Never accept a school ID from the browser without checking membership.

## Payment rule
A payment begins `pending_approval`. Approval requires `canApprovePayments` or `school_admin`, and the approver ID must not equal the recorder ID. The database check is a second layer of protection. Each creation, approval and rejection writes an audit log entry in the same transaction.

## Module seams
- `attendance_*`, `payments`, `bank_deposits` and `notifications` are MVP modules.
- grading and exam tables exist but must remain invisible in MVP routes until Phase 2.
- Payment gateways, fingerprint hardware and advanced analytics are intentionally absent.

## Deployment
Run Next.js and `npm run worker` as two Coolify services, plus standard Postgres and Redis. Cloudflare R2 stays behind an S3-compatible storage adapter.
