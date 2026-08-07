# Contributing to FormBuilder Standalone

> **Version française** : [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md)

---

## Development Setup

### Prerequisites

- Node.js 24 — matches `.nvmrc` and the Docker image. Older versions build, but an API missing from the image's Node will pass every local test and fail only in production (see [Runtime version parity](#runtime-version-parity))
- npm or yarn
- Git

### Local Installation

```bash
# Clone the repository
git clone <repository-url>
cd formbuilder-standalone

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET

# Initialize the database
npm run db:push
npm run db:seed

# Start the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:seed` | Re-seed default data (themes, admin user) |

---

## Project Architecture

### Key Directories

| Path | Role |
|------|------|
| `src/app/api/` | REST API routes (Next.js Route Handlers) |
| `src/app/builder/[id]/` | Form builder page |
| `src/app/[slug]/` | Public form page |
| `src/components/builder/` | All builder UI components |
| `src/components/ui/` | Generic reusable UI (Button, Dialog, Input…) |
| `src/components/forms/` | Document template and sending-e-mail modals |
| `src/lib/auth.ts` | JWT authentication helpers |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/document-fields.ts` | Field/token catalog for Word templates (pure, client-safe) |
| `src/lib/docx-template.ts` | docxtemplater engine (server-only) |
| `src/lib/document-delivery.ts` | Generates a response's document and mails it |
| `src/stores/form-builder.ts` | Zustand store for builder state |
| `src/types/form.ts` | Central TypeScript type definitions |
| `prisma/schema.prisma` | Database schema |
| `prisma/migrations/` | Migration files replayed in production — see [Database Migrations](#database-migrations) |

### State Management

Builder state lives in a [Zustand](https://zustand-demo.pmnd.rs/) store (`src/stores/form-builder.ts`). All block mutations, logic, theme, and webhook changes go through this store. The store is persisted via API calls on every meaningful change.

### Authentication

JWTs are stored in HTTP-only cookies. The `src/lib/auth.ts` module exposes helpers for signing, verifying tokens, and checking permissions. Middleware (`src/middleware.ts`) protects routes that require authentication.

### Site Customization

Site name, logo, and favicon are stored in the `SystemSettings` table (single row, `id = "system"`). Server pages that display branding (dashboard, layout) fetch this row at render time via Prisma. `src/app/layout.tsx` exports an async `generateMetadata()` to inject the dynamic title and favicon. The public endpoint `/api/settings/public` exposes only `siteName`, `siteLogo`, `siteFavicon`, `registrationEnabled`, and `loginPageSettings` without authentication (used by the login page and public-facing pages).

**Important**: this Route Handler has no dynamic functions (`cookies()`, `headers()`, a `Request` param), so without `export const dynamic = 'force-dynamic'` Next.js statically caches its response at build time — any setting change made after `next build` would never reach the live site. Keep that export in place; it mirrors the same fix on `src/app/dashboard/page.tsx`.

#### Login Page Customization

`SystemSettings.loginPageSettings` stores a JSON blob (string column, same convention as `Form.settings`) typed as `LoginPageSettings` in `src/types/form.ts` — controls the "forgot password" link visibility and the page background (solid / gradient / image with blur). `src/lib/utils.ts` exports `getLoginBackgroundStyle()`, the single source of truth for turning those settings into CSS; both `src/app/login/page.tsx` and the live preview in `src/app/admin/customization/customization-client.tsx` call it, guaranteeing pixel-identical rendering. The "Allow registrations" toggle in this section writes to the same top-level `registrationEnabled` column as Admin → General — it's a convenience duplicate, not a separate flag.

### Word Document Templates

`src/lib/document-fields.ts` is deliberately **pure** — no Prisma import, no filesystem access — so `'use client'` components can import it for the field/token table; the rendering engine lives separately in `src/lib/docx-template.ts`. This is the same server/client split as `audit-actions.ts` vs `audit-log.ts`; importing a Prisma-touching module into a client component breaks the build.

Two invariants worth knowing before changing anything here:

- **Tokens are persisted, not derived.** `Form.documentSettings` stores a `tag → blockId` mapping, and `buildFieldCatalog(blocks, savedMappings)` always prefers a saved tag over a freshly slugified label. That is what keeps an already-written `.docx` working after a question is renamed. Never regenerate tokens from labels alone.
- **Tokens are deduplicated globally**, repeater children included, because docxtemplater falls back from the loop scope to the parent scope — a colliding child tag would silently shadow a top-level field.

A new block type needs no work here: the catalog is derived from the blocks, so it appears automatically.

`docxtemplater/js/inspect-module.js` (the official tag inspector) `require`s **lodash, which is not a dependency of docxtemplater** — importing it breaks the build. Tag detection therefore uses the lodash-free `get-tags.js` plus a small local module that only implements `set()` to capture each file's `postparsed`.

### Adding a New Block Type

1. Add the new type to the `BlockType` union in `src/types/form.ts`
2. Add default attributes in `src/stores/form-builder.ts` (block initializer)
3. Create the editor settings panel in `src/components/builder/block-editor.tsx`
4. Create the preview component in `src/components/builder/block-preview.tsx`
5. Create the public form component in `src/app/[slug]/public-form-client.tsx`
6. Handle the response in the response viewer (`src/app/forms/[id]/responses/responses-client.tsx`)
7. Handle the block in webhook payload serialization (API route)

---

## Code Style

- **TypeScript** — strict mode; no `any` without justification
- **Components** — functional components with typed props; no class components
- **Imports** — absolute paths (`@/…` via tsconfig paths); no `../../../`
- **Styling** — Tailwind CSS utility classes; avoid inline styles
- **Comments** — only when the **why** is non-obvious; no explanatory comments on self-describing code
- **File naming** — kebab-case for files and folders; PascalCase for component names

---

## Git Workflow

### Branch Naming

```
feat/short-description     # New feature
fix/short-description      # Bug fix
refactor/short-description # Refactoring
docs/short-description     # Documentation only
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add quantity block
fix: stale closure in repeater inner block
refactor: extract findBlockDeep helper
docs: update CHANGELOG for v1.5.0
```

### Pull Requests

- Keep PRs focused — one feature or fix per PR
- Update `CHANGELOG.md` under `[Unreleased]` for any user-visible change
- Make sure `npm run lint` passes before opening a PR
- Describe **what** changed and **why** in the PR description

---

## Environment Variables

Never commit secrets. The `.env` file is gitignored. Use `.env.example` to document required variables without values.

---

## Runtime Version Parity

The Docker image runs the Node version pinned in `.nvmrc` (currently **24**). Keep your local Node
on the same major.

When they drift, an API that exists locally compiles, passes every local test, and then throws only
in production — the build catches nothing. That has already happened: the image was on `node:18-alpine`
while development ran Node 24, and `file instanceof File` threw `ReferenceError: File is not defined`
on every template import, because `File` only became a Node global in **Node 20**.

Two habits follow from it:

- Prefer structural checks over `instanceof` for anything coming off the runtime (uploads, streams).
  The upload validation in `src/app/api/forms/[id]/document/template/route.ts` tests for an object
  exposing `arrayBuffer()` and `size` — version-independent, and no more code.
- When bumping the image, check the [Node release schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json)
  rather than assuming a major is still supported: 18 reached end-of-life in April 2025 and 20 in
  April 2026.

---

## Database Migrations

The project runs **two different mechanisms**, and confusing them has already caused a production outage — read this section before touching `prisma/schema.prisma`.

| Environment | Mechanism | Entry point |
|-------------|-----------|-------------|
| Local development | `prisma db push` — recreates tables in schema order | `npm run db:push` |
| Docker / production | `prisma migrate deploy` — replays `prisma/migrations/` in order | `docker-entrypoint.sh` |

```bash
npm run db:push     # Apply schema changes locally
npm run db:generate # Regenerate Prisma client
```

**Any schema change must ship with a migration file** in `prisma/migrations/`, otherwise it will never reach production — `db push` alone only updates your own machine.

### The trap: physical column order differs between the two

`db push` recreates a table in the order declared in the schema, whereas `migrate deploy` appends every column added by a later `ALTER TABLE` at the end of the table. The same schema therefore yields **two different physical column orders**.

This matters because SQLite has no `ALTER COLUMN`: changing a column's nullability or a foreign key means recreating the table and copying the rows. Never copy positionally:

```sql
-- WRONG — matches columns by position, so it breaks on one lineage or the other
INSERT INTO "Form_new" SELECT * FROM "Form";

-- RIGHT — correct whatever the physical order
INSERT INTO "Form_new" ("id", "title", …) SELECT "id", "title", … FROM "Form";
```

The positional form is what made `20260609000000_form_userid_nullable` fail in production while passing locally. Make table-rebuild migrations replayable too: `DROP TABLE IF EXISTS "<table>_new"` at the top and `IF NOT EXISTS` on index creations, so a retry after a failure stays safe.

### Testing a migration before shipping it

A migration that works on your `db push` database proves nothing. Rebuild a scratch database in `migrate deploy` order (original `CREATE TABLE`, then each `ALTER TABLE` in migration order), apply the migration to it, and check both that it succeeds and that the row values did not shift between columns.

> `db push` is destructive for renamed or removed fields. Test locally first.

---

## Reporting Issues

Open an issue with:
- A clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment (OS, Node version, browser if relevant)
