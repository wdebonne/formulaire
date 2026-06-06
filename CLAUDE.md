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
| `src/types/form.ts` | All TypeScript types (BlockType, FormBlock, LogicRule, Webhook, Theme…) |
| `src/stores/form-builder.ts` | Zustand store — all builder state mutations |
| `src/components/builder/visual-logic-builder.tsx` | Visual conditional logic editor |
| `src/components/builder/block-editor.tsx` | Block settings panel (right sidebar) |
| `src/components/builder/block-preview.tsx` | Block preview in builder center panel |
| `src/app/[slug]/public-form-client.tsx` | Public form renderer (end-user facing) |
| `src/app/forms/[id]/responses/responses-client.tsx` | Response viewer |
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
- `FormShare` model handles per-user permissions (Read/Edit/Admin)
- `Theme` model stores `properties` as JSON
- `Font` model stores Google Fonts added by admins

---

## Known Patterns

### Recursive Block Search
Inner blocks of groups and repeaters use `findBlockDeep()` — always use this instead of `blocks.find()` when looking for a block that might be nested.

### Conditional Logic Evaluation
Logic evaluates on `visibleBlocks` (filtered list), not `blocks` (all blocks). Jump targets use indices into `visibleBlocks`. Race conditions around `setTimeout` + state updates have been fixed using refs — don't revert to index-based calculations without syncing with refs.

### Repeater State
Repeater state (current iteration, answers per iteration) is managed locally in the public form component. When modifying repeater behavior, test with 1, 2, and 3+ iterations.

### Webhooks Payload
Webhooks serialize block values using human-readable labels (not raw values/slugs). Dates are locale-formatted. Use `findBlockDeep()` for nested field resolution.
