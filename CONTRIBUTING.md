# Contributing to FormBuilder Standalone

> **Version française** : [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md)

---

## Development Setup

### Prerequisites

- Node.js 18+
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
| `src/lib/auth.ts` | JWT authentication helpers |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/stores/form-builder.ts` | Zustand store for builder state |
| `src/types/form.ts` | Central TypeScript type definitions |
| `prisma/schema.prisma` | Database schema |

### State Management

Builder state lives in a [Zustand](https://zustand-demo.pmnd.rs/) store (`src/stores/form-builder.ts`). All block mutations, logic, theme, and webhook changes go through this store. The store is persisted via API calls on every meaningful change.

### Authentication

JWTs are stored in HTTP-only cookies. The `src/lib/auth.ts` module exposes helpers for signing, verifying tokens, and checking permissions. Middleware (`src/middleware.ts`) protects routes that require authentication.

### Site Customization

Site name, logo, and favicon are stored in the `SystemSettings` table (single row, `id = "system"`). Server pages that display branding (dashboard, layout) fetch this row at render time via Prisma. `src/app/layout.tsx` exports an async `generateMetadata()` to inject the dynamic title and favicon. The public endpoint `/api/settings/public` exposes only `siteName`, `siteLogo`, `siteFavicon`, `registrationEnabled`, and `loginPageSettings` without authentication (used by the login page and public-facing pages).

**Important**: this Route Handler has no dynamic functions (`cookies()`, `headers()`, a `Request` param), so without `export const dynamic = 'force-dynamic'` Next.js statically caches its response at build time — any setting change made after `next build` would never reach the live site. Keep that export in place; it mirrors the same fix on `src/app/dashboard/page.tsx`.

#### Login Page Customization

`SystemSettings.loginPageSettings` stores a JSON blob (string column, same convention as `Form.settings`) typed as `LoginPageSettings` in `src/types/form.ts` — controls the "forgot password" link visibility and the page background (solid / gradient / image with blur). `src/lib/utils.ts` exports `getLoginBackgroundStyle()`, the single source of truth for turning those settings into CSS; both `src/app/login/page.tsx` and the live preview in `src/app/admin/customization/customization-client.tsx` call it, guaranteeing pixel-identical rendering. The "Allow registrations" toggle in this section writes to the same top-level `registrationEnabled` column as Admin → General — it's a convenience duplicate, not a separate flag.

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

## Database Migrations

This project uses `prisma db push` (schema-first, no migration files). When changing `prisma/schema.prisma`:

```bash
npm run db:push     # Apply schema changes
npm run db:generate # Regenerate Prisma client
```

> For production, test schema changes locally first. `db push` is destructive for renamed or removed fields.

---

## Reporting Issues

Open an issue with:
- A clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment (OS, Node version, browser if relevant)
