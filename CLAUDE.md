# CLAUDE.md — FormBuilder Standalone

Context for Claude Code when working on this project.

---

## Project Overview

**FormBuilder Standalone** is a self-hosted form builder built with Next.js 14 (App Router), TypeScript, SQLite (Prisma), and Tailwind CSS. It allows users to create, publish, and collect responses from forms with a visual drag-and-drop editor.

- **Port**: `3000` (dev) / `3110` (Docker)
- **Default admin**: `admin@formbuilder.local` / `admin123`
- **Database**: SQLite at `prisma/dev.db`

---

## Key Architecture

### Stack
- **Next.js 14 App Router** — pages in `src/app/`, API routes in `src/app/api/`
- **Prisma + SQLite** — schema at `prisma/schema.prisma`; client singleton at `src/lib/prisma.ts`
- **JWT auth** — HTTP-only cookies; helpers in `src/lib/auth.ts`; middleware at `src/middleware.ts`
- **Zustand** — global builder state in `src/stores/form-builder.ts`
- **Tailwind CSS + Radix UI** — styling in `src/components/ui/`

### Important Files

| File | Purpose |
|------|---------|
| `src/types/form.ts` | All TypeScript types (BlockType, FormBlock, LogicRule, Webhook, Theme, FormVersion…) |
| `src/stores/form-builder.ts` | Zustand store — all builder state mutations |
| `src/components/builder/visual-logic-builder.tsx` | Visual conditional logic editor |
| `src/components/builder/versions-modal.tsx` | Form version history modal (list, create, restore) |
| `src/components/builder/block-editor.tsx` | Block settings panel (right sidebar) |
| `src/components/builder/center-block-preview.tsx` | Static block preview in builder center panel (read-only, reactive via Zustand) |
| `src/components/builder/block-preview.tsx` | Block preview in builder center panel |
| `src/components/builder/settings-editor.tsx` | Form settings panel (progress bar, logo, branding, slug, animations) |
| `src/app/[slug]/public-form-client.tsx` | Public form renderer (end-user facing) |
| `src/app/forms/[id]/preview/page.tsx` | Auth-protected preview page — renders `PublicFormClient` regardless of published status; used by the builder "Aperçu" iframe overlay |
| `src/app/forms/[id]/responses/responses-client.tsx` | Response viewer |
| `src/app/api/forms/[id]/versions/route.ts` | Versions API — GET list, POST create manual version |
| `src/app/api/forms/[id]/versions/[versionId]/route.ts` | Versions API — DELETE a specific version |
| `src/app/api/forms/[id]/versions/[versionId]/restore/route.ts` | Versions API — POST restore (snapshots current state first) |
| `src/app/admin/customization/customization-client.tsx` | Site name / logo / favicon admin UI + "Login page" card (forgot-password toggle, background, registration shortcut) with live preview |
| `src/app/login/page.tsx` | Login page — renders branding, background, and forgot-password/sign-up links from `SystemSettings` |
| `src/app/api/admin/settings/route.ts` | SystemSettings API (GET/PUT, admin-only) |
| `src/app/api/settings/public/route.ts` | Public settings endpoint (no auth, `force-dynamic`) — used by login page and public forms |
| `src/app/layout.tsx` | Root layout — `generateMetadata()` reads `SystemSettings` for dynamic title and favicon |
| `src/lib/security.ts` | Anti-bruteforce core: `SecuritySettings`, `getClientIp()`, `checkIpAccess()`, `recordFailedLogin()`, `recordSuccessfulLogin()` |
| `src/app/admin/security/security-client.tsx` | Security admin UI — anti-bruteforce settings, IP whitelist/blacklist management, live blocked-IP list |
| `src/app/api/admin/security/route.ts` | Security settings API (GET/PUT, admin-only) — `maxFailedAttempts`, `attemptWindowMinutes`, `blockDurationMinutes` |
| `src/app/api/internal/ip-lists/route.ts` | Internal endpoint (shared-secret auth via `x-internal-secret`) returning whitelist/blacklist IPs — polled by the Edge middleware cache |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Default data (themes, admin account) |

---

## Development Commands

```bash
npm run dev          # Start dev server
npm run db:push      # Apply schema changes
npm run db:studio    # Open database GUI
npm run db:seed      # Re-seed default data
npm run lint         # ESLint
npm run build        # Production build
```

---

## Adding a New Block Type

When adding a new block type, update **all** of these:

1. `src/types/form.ts` — add to `BlockType` union; add attributes to `BlockAttributes` if needed
2. `src/stores/form-builder.ts` — default attributes in the block initializer
3. `src/components/builder/block-editor.tsx` — settings panel
4. `src/components/builder/block-preview.tsx` — builder preview
5. `src/app/[slug]/public-form-client.tsx` — public form renderer
6. `src/app/forms/[id]/responses/responses-client.tsx` — response display and export
7. API webhook route — payload serialization

---

## Conventions

- **No comments** unless the WHY is non-obvious
- **No `any`** in TypeScript without justification
- **Absolute imports** — `@/components/…` (configured in `tsconfig.json`)
- **Server components by default** — use `'use client'` only when needed (hooks, interactivity)
- **API routes** — always check auth and permissions; use `src/lib/auth.ts` helpers
- **Prisma** — always use the singleton from `src/lib/prisma.ts`, never instantiate directly

---

## Database Schema Notes

- `Form` has a `deletedAt` field for soft delete (trash feature)
- `Form` has `webhookStatus` for tracking last webhook delivery status
- `Form` has `saveCount` (Int) — incremented on every PUT; used to trigger auto-versioning every 10 saves
- `FormVersion` stores snapshots of `blocks`, `logic`, `settings`, `webhooks`, `themeId`, `title`; `isAuto` distinguishes auto vs manual; `number` is a sequential per-form counter
- `FormShare` model handles per-user permissions (Read/Edit/Admin)
- `Theme` model stores `properties` as JSON
- `Font` model stores Google Fonts added by admins
- `FormSettings` (JSON stored in `Form.settings`) includes `showLogo`, `logoPosition` (`top`|`bottom`), `logoAlignment` (`left`|`center`|`right`) — the logo URL itself comes from `SystemSettings.siteLogo`, fetched server-side in `src/app/[slug]/page.tsx`
- `SystemSettings.loginPageSettings` (JSON stored as string, same convention as `Form.settings`) — typed as `LoginPageSettings` in `src/types/form.ts`; controls the login page's "forgot password" link visibility and background (solid/gradient/image + blur)

---

## Known Patterns

### Recursive Block Search
Inner blocks of groups and repeaters use `findBlockDeep()` — always use this instead of `blocks.find()` when looking for a block that might be nested.

### Conditional Logic Evaluation
Logic evaluates on `visibleBlocks` (filtered list), not `blocks` (all blocks). Jump targets use indices into `visibleBlocks`. Race conditions around `setTimeout` + state updates have been fixed using refs — don't revert to index-based calculations without syncing with refs.

### Repeater State
Repeater state (current iteration, answers per iteration) is managed locally in the public form component. When modifying repeater behavior, test with 1, 2, and 3+ iterations.

### Choice Value vs Label
Blocks with choices (`dropdown`, `multiple-choice`, `image-selection`) store `choice.value` (slug, e.g. `service-informatique`) in `FormResponse.data`, not the human-readable `choice.label`. The responses page resolves slugs to labels at display time using `formatValueWithChoices(value, block.attributes.choices)` defined in `responses-client.tsx`. This applies to the table, the detail modal, and the CSV export. Do not change the stored value — always resolve at display time.

### Webhooks Payload
Webhooks serialize block values using human-readable labels (not raw values/slugs). Dates are locale-formatted. Use `findBlockDeep()` for nested field resolution.

### Form Versioning
Auto-versions are created inside the PUT `/api/forms/[id]` route when `saveCount % 10 === 0`, using a `$transaction` to update the form and create the version atomically. Manual versions are created via POST `/api/forms/[id]/versions`. Restore always snapshots the current state first (label: "Avant restauration vN") before overwriting, so no data is ever lost silently.

### Builder Preview System
The "Aperçu" button in the builder does **not** use a custom re-implementation of the form renderer. Instead:
1. If the form has unsaved changes (`isDirty`), it auto-saves first.
2. It opens a `fixed inset-0` iframe overlay pointing to `/forms/[id]/preview`.
3. That page (`src/app/forms/[id]/preview/page.tsx`) is auth-protected and renders the exact same `PublicFormClient` component as the public form — regardless of published/draft status.

This guarantees the preview is always pixel-perfect with the published form. `src/components/builder/form-preview.tsx` is a legacy component that is no longer used.

### Login Page Customization & Public Settings Caching
`SystemSettings.loginPageSettings` drives the forgot-password link visibility and the page background (solid/gradient/image+blur). `src/lib/utils.ts` exports `getLoginBackgroundStyle()` — the single source of truth for turning those settings into CSS (separate blurred image layer behind the card so the card itself stays sharp). Both `src/app/login/page.tsx` and the live preview in `customization-client.tsx` call this helper, so they always render identically.

`src/app/api/settings/public/route.ts` has no dynamic functions (`cookies()`, `headers()`, `Request` param), so Next.js statically caches it at build time in production unless `export const dynamic = 'force-dynamic'` is present — **never remove that export**, or settings changes (registration toggle, login customization, branding) will silently stop reaching the live site until the next rebuild. The "Allow registrations" toggle inside the "Login page" customization card writes to the same top-level `registrationEnabled` column as Admin → General — a convenience duplicate, not an independent flag.

### Builder Center Preview (Reactive)
The center panel (`CenterBlockPreview`) is driven entirely by the Zustand store. Every `updateBlock`, `updateInnerBlock`, `addBlock`, `removeBlock`, or `moveBlock` call immediately updates `blocks` in the store, which causes `FormBuilderClient` to recompute `selectedBlock` and pass the updated prop to `CenterBlockPreview` — no refresh needed. Theme changes are also reflected in real-time via the `themes` state in `FormBuilderClient`.

### Anti-bruteforce / IP Access Control (Edge Middleware Cache)
`src/lib/security.ts` holds the core logic — `checkIpAccess()` (whitelist/blacklist/temporary block lookup), `recordFailedLogin()` / `recordSuccessfulLogin()` (failure counting and block duration from `SecuritySettings`, stored as JSON in `SystemSettings.securitySettings`). It's used from `src/app/api/auth/login/route.ts` and is Prisma-backed, so it can only run in the Node runtime.

`src/middleware.ts` runs in the Edge Runtime and **cannot** use Prisma/SQLite directly, so blacklist/whitelist enforcement there works differently: it keeps an in-memory `Set`-based cache refreshed at most every 60s by fetching `src/app/api/internal/ip-lists/route.ts` (authenticated via a shared `x-internal-secret` header derived from `JWT_SECRET`). The internal route is excluded from the IP filter itself to avoid self-blocking, and a fetch failure leaves the existing cache in place ("fail open") so a transient DB/network issue never locks everyone out. Only the blacklist/whitelist check happens at the edge — failed-attempt counting and temporary blocks are evaluated in the login route itself (`checkIpAccess()` / `recordFailedLogin()`), where Prisma is available.
