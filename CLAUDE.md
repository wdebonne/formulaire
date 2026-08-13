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
| `src/components/builder/share-dialog.tsx` | Share modal — direct link, per-user permissions, shortcode, embed, QR code |
| `src/components/builder/qr-code-panel.tsx` | QR code designer (advanced options + live preview + PNG export), rendered in the share modal |
| `src/lib/qr-render.ts` | Custom canvas QR renderer — `QrDesign` type, `DEFAULT_QR_DESIGN`, `drawQrCode()` |
| `src/app/[slug]/public-form-client.tsx` | Public form renderer (end-user facing) |
| `src/app/forms/[id]/preview/page.tsx` | Auth-protected preview page — renders `PublicFormClient` regardless of published status; used by the builder "Aperçu" iframe overlay |
| `src/app/forms/[id]/responses/responses-client.tsx` | Response viewer |
| `src/components/forms/response-edit-fields.tsx` | Champs éditables du modal « Détail de la réponse » (bouton *Modifier*) — un contrôle par type de bloc, groupes et répéteurs inclus |
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
| `src/lib/audit-actions.ts` | Pure data — no Prisma import, safe to use from `'use client'` components: `AuditAction` union, `ACTION_LABELS`, `ACTION_CATEGORIES`, `actionLabel()` |
| `src/lib/audit-log.ts` | Audit log core (server-only, imports `prisma`) — `logEvent()`, `LogSettings`/`getLogSettings()`/`getLogRetentionCutoffDate()`, `parseLogFilters()`/`buildAuditLogWhere()`; re-exports the action-label data from `audit-actions.ts` |
| `src/app/admin/logs/logs-client.tsx` | Activity log admin UI (`/admin/logs`) — filterable/paginated table, Excel export, retention settings + manual purge |
| `src/app/api/admin/logs/route.ts` | Logs list API — paginated, filtered (`buildAuditLogWhere`/`parseLogFilters`) |
| `src/app/api/admin/logs/export/route.ts` | Logs export API — builds an Excel workbook (`xlsx`) from the same filters as the list, capped at 50 000 rows |
| `src/lib/gdpr.ts` | GDPR core — `GdprSettings`, `getGdprSettings()`, `getRetentionCutoffDate()`; same JSON-settings pattern as `security.ts` |
| `src/lib/response-format.ts` | Shared response-label resolution — `findBlockDeep`, `formatBlockValue`, `formatDateString`, `resolveDataLabels`; extracted from the webhook submit route, reused by the GDPR export so both resolve choice slugs → labels and format dates identically |
| `src/app/admin/gdpr/gdpr-client.tsx` | GDPR admin UI (`/admin/gdpr`) — retention settings + manual purge of expired responses; global cross-form person search with review-then-act export (Excel/PDF) and right-to-erasure deletion |
| `src/app/api/admin/gdpr/export/route.ts` | GDPR export API — builds the Excel portability workbook (`xlsx`) and the PDF summary (`pdfkit`) for admin-reviewed response IDs only |
| `src/app/api/admin/users/[id]/route.ts` | User management API — DELETE soft-deletes all active forms before removing the account; `onDelete: SetNull` then sets `userId = null` on all forms |
| `src/app/admin/trash/trash-client.tsx` | Admin trash UI — lists trashed forms; orphaned forms (deleted owner) show an amber "Compte supprimé" badge; restoration requires mandatory owner reassignment for orphans |
| `src/lib/document-fields.ts` | Pure/client-safe field catalog for .docx templates — `buildFieldCatalog()`, `slugifyTag()`, `catalogToMappings()`; no Prisma import |
| `src/lib/docx-template.ts` | Server-only docxtemplater engine — `buildDocumentData()`, `renderDocx()`, `inspectDocxTags()`, `applyTags()`, `parseFormDocumentSettings()` |
| `src/lib/document-storage.ts` | Private .docx storage outside `public/` — `saveTemplateFile()`, `readTemplateFile()`, `looksLikeDocx()` |
| `src/lib/document-delivery.ts` | Generates the document for a response and mails it — `generateDocumentForResponse()`, `sendDocumentForResponse()`, `resolveRecipients()` |
| `src/lib/pdf-convert.ts` | External Gotenberg converter — `testPdfConverter()`, `convertDocxToPdf()`, `isPdfConversionAvailable()` |
| `src/lib/form-access.ts` | Shared form permission check (`getAccessibleForm`) used by the document and report routes |
| `src/lib/form-options.ts` | Pure/client-safe access options — `FormAccessSettings` defaults, `parseFormAccessSettings()`, `accessMessage()`, `accessSummary()`, `scheduleState()`; no Prisma import |
| `src/lib/form-gate.ts` | Server-only enforcement — `resolveFormGate()`, access/submitted cookie names, `signAccessToken()`, `hashFormPassword()` |
| `src/components/forms/form-options-modal.tsx` | "Options" modal — availability window, password, quota, participation restrictions, noindex |
| `src/app/[slug]/form-gate-screen.tsx` | Public screen shown in place of a form that is closed, scheduled, full, already answered, or locked |
| `src/app/api/forms/[id]/options/route.ts` | Access options API (GET/PUT, `getAccessibleForm`) — never returns the password hash |
| `src/app/api/forms/[id]/access/route.ts` | Public password check — sets the unlock cookie; in-memory attempt throttle |
| `src/lib/report-settings.ts` | Pure/client-safe report config — `DEFAULT_REPORT_SETTINGS`, `parseFormReportSettings()`, `nextOccurrence()`/`previousOccurrence()`/`isScheduleDue()`, `applyReportTokens()`; no Prisma import |
| `src/lib/report-stats.ts` | Pure/client-safe analytics — `resolveReportRange()`, `computeReportStats()`; the modal's live preview and the PDF share it |
| `src/lib/report-pdf.ts` | Server-only pdfkit renderer — `buildReportPdf()`; charts drawn by hand, no charting dependency |
| `src/lib/pdf-text.ts` | `pdfSafeText()` — WinAnsi sanitizer shared by every pdfkit renderer; strips emoji, transposes symbols with a readable equivalent |
| `src/lib/report-delivery.ts` | Server-only — `generateReportForForm()`, `sendReportForForm()`, `recordReportStatus()` |
| `src/lib/report-scheduler.ts` | Server-only — `runDueReports()`, `startReportScheduler()` (in-process timer) |
| `src/components/forms/report-modal.tsx` | "Rapports" modal — Période / Contenu / Envoi tabs, live preview bar, PDF download, send-now |
| `src/components/forms/document-template-modal.tsx` | "Modèle de document" modal — .docx import, visual field/token table, output settings |
| `src/components/forms/document-email-modal.tsx` | "E-mail d'envoi" modal — recipients, subject, body |
| `src/app/admin/documents/documents-client.tsx` | Admin UI for the external PDF converter (URL + connection test + verified state) |
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
- `Form.userId` is `String?` (nullable) with `onDelete: SetNull` — when a user account is deleted, Prisma sets `userId = null` on all their forms instead of cascade-deleting them; the DELETE handler in `/api/admin/users/[id]` first soft-deletes all active forms before removing the account, so orphaned forms land in the admin trash
- `Form` has `webhookStatus` for tracking last webhook delivery status
- `Form` has `saveCount` (Int) — incremented on every PUT; used to trigger auto-versioning every 10 saves
- `FormVersion` stores snapshots of `blocks`, `logic`, `settings`, `webhooks`, `themeId`, `title`; `isAuto` distinguishes auto vs manual; `number` is a sequential per-form counter
- `FormShare` model handles per-user permissions (Read/Edit/Admin)
- `Theme` model stores `properties` as JSON
- `Font` model stores Google Fonts added by admins
- `FormSettings` (JSON stored in `Form.settings`) includes `showLogo`, `logoPosition` (`top`|`bottom`), `logoAlignment` (`left`|`center`|`right`) — the logo URL itself comes from `SystemSettings.siteLogo`, fetched server-side in `src/app/[slug]/page.tsx`
- `SystemSettings.loginPageSettings` (JSON stored as string, same convention as `Form.settings`) — typed as `LoginPageSettings` in `src/types/form.ts`; controls the login page's "forgot password" link visibility and background (solid/gradient/image + blur)
- `SystemSettings.gdprSettings` (JSON stored as string) — typed as `GdprSettings` in `src/types/form.ts`; holds `retentionEnabled`/`retentionMonths` (default legal retention: 36 months), read via `getGdprSettings()` in `src/lib/gdpr.ts`
- `AuditLog` model — append-only activity log: `action`, `status` (`success`|`failure`), `userId`/`userEmail` (email copied at write time so it survives user deletion), `ipAddress`, `targetType`/`targetId`/`targetLabel` (label copied at write time, e.g. form title), `metadata` (JSON-as-string), `createdAt`; indexed on `action`, `userId`, `createdAt`
- `SystemSettings.logSettings` (JSON stored as string) — typed as `LogSettings` in `src/lib/audit-log.ts`; holds `retentionEnabled`/`retentionDays` (default: 365 days), read via `getLogSettings()`/`getLogRetentionCutoffDate()`
- `Form.documentSettings` (JSON stored as string) — typed as `FormDocumentSettings` in `src/types/form.ts`; holds the `.docx` template reference (`storedName` in the private storage), the persisted `tag → blockId` mappings, and the e-mail settings (recipients, subject, body)
- `Form.accessSettings` (JSON stored as string) — typed as `FormAccessSettings`; availability window, bcrypt password hash, response quota, participation restrictions, `noIndex`. Deliberately **not** copied by `/duplicate`, **not** included in `/export`, and **not** snapshotted in `FormVersion` — it is operational configuration, not form content, and exporting it would leak the password hash
- `Response.documentStatus` (JSON stored as string, nullable) — typed as `DocumentSendStatus`; last send result, same role as `webhookStatus`
- `SystemSettings.documentSettings` (JSON stored as string) — typed as `SystemDocumentSettings`; external PDF converter URL and its verification state
- `Form.reportSettings` (JSON stored as string) — typed as `FormReportSettings`; report period, closing date, included sections, schedule (`ReportSchedule` with `lastRunAt`), recipients, subject/body, and `lastStatus` (`ReportSendStatus`)
- `SystemSettings.securitySettings` also carries the failed-login alert config: `notifyOnFailedLogin`/`notifyThreshold`/`notifyEmail` — set in `/admin/security` alongside `maxFailedAttempts`, no separate column needed

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

### Correction d'une réponse enregistrée
`PATCH /api/forms/[id]/responses/[responseId]` corrige les valeurs d'une réponse déjà reçue (bouton
« Modifier » du modal de détail). Trois garde-fous, tous délibérés :

1. **Seules les clés connues** sont acceptées — un bloc du formulaire (`findBlockDeep`), une clé de
   répéteur `{repeaterId}_{n}_{innerId}`, ou une clé déjà présente dans `Response.data`. Le client
   renvoie tout le brouillon, pas un diff, donc le tri se fait côté serveur.
2. **Seules les clés réellement différentes** repassent par `resolveDataLabels()` — la même
   normalisation qu'à la soumission (slug de choix → libellé, date au format du bloc), pour qu'une
   valeur corrigée soit stockée exactement comme une valeur saisie par le répondant. Les champs non
   touchés sont recopiés tels quels : une correction ne doit pas réécrire au passage les réponses
   antérieures à `resolveDataLabels` (qui contiennent encore des slugs).
3. Le composant d'édition fait la conversion inverse à l'affichage (`« A, B »` → cases cochées,
   `« 12/08/2026 »` → `<input type="date">`). Quand une valeur ne se relit pas (plage de dates,
   format inattendu), il retombe sur un champ texte libre plutôt que d'afficher un champ vide qui
   effacerait la donnée au premier enregistrement.

`file`, `signature` et `quantity` sont volontairement en lecture seule : ce sont des structures
(fichier, data-URL, objet quantité) qu'un champ texte ne peut pas corriger sans les corrompre.

L'action est journalisée (`response.update`) avec la **liste des champs** modifiés, jamais leurs
valeurs — le journal d'activité ne doit pas devenir une seconde copie des données personnelles.

### Webhooks Payload
Webhooks serialize block values using human-readable labels (not raw values/slugs). Dates are locale-formatted. Use `findBlockDeep()` for nested field resolution.

### Form Versioning
Auto-versions are created inside the PUT `/api/forms/[id]` route when `saveCount % 10 === 0`, using a `$transaction` to update the form and create the version atomically. Manual versions are created via POST `/api/forms/[id]/versions`. Restore always snapshots the current state first (label: "Avant restauration vN") before overwriting, so no data is ever lost silently.

### QR Code Designer (Share Dialog)
The QR tab of `share-dialog.tsx` renders through `src/lib/qr-render.ts` (`drawQrCode()`), **not** `QRCode.toCanvas()`. The `qrcode` package is used only via `QRCode.create()` to obtain the module matrix; every module is then painted by hand on a canvas so colors, gradients, dot/eye shapes and a center logo can be applied. `QrCodePanel` (`src/components/builder/qr-code-panel.tsx`) owns the design state and redraws on every change — the preview canvas is always rendered at 1024 px and merely displayed at 200 px, so what you see is exactly what the download produces (the export re-runs `drawQrCode` on an offscreen canvas at 512/1024/2048 px). The design is deliberately **not persisted** — it lives in component state and only matters at download time.

Scannability constraints, verified by decoding the generated PNGs with both zbar and OpenCV:
- **Dot styles are free**: `square`/`rounded`/`dots`/`classy` keep every module center identical to a plain QR code (0 divergent modules), so they never affect decoding.
- **Eye styles are not**: rounding the finder patterns removes modules from the detection anchors, and those are *not* protected by error correction. A true circular finder (radius `3 × cell`) removes 16 modules per eye and made zbar fail as soon as any other styling was combined with it — that is why `eyeStyle: 'circle'` draws a *very* rounded square (`r = 2.6 × cell`) with a circular pupil rather than a real circle, and `'rounded'` uses `r = 1.4 × cell`. Don't raise those radii. OpenCV's `QRCodeDetector` rejects any non-square finder, so the amber warning shown under the eye-style picker is accurate and should stay.
- **Logo**: presence of a logo forces `errorCorrectionLevel: 'H'` inside `drawQrCode()` regardless of the UI setting (the select is disabled and shows `H`). The 35% size cap is the tested limit — a 35% logo at 512 px still decodes with both readers.

The logo is read client-side as a data URL (`FileReader`) and never uploaded, so `canvas.toDataURL()` is never tainted; the "Logo du site" shortcut pulls `siteLogo` from `/api/settings/public`, which is same-origin and therefore equally safe.

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

### GDPR / RGPD — Retention, Search, Export & Erasure
`SystemSettings.gdprSettings` (JSON-as-string, same convention as `securitySettings`/`loginPageSettings`) holds `retentionEnabled`/`retentionMonths` (default legal retention: **36 months**), read via `getGdprSettings()` / `getRetentionCutoffDate()` in `src/lib/gdpr.ts`. Purging expired responses (`/api/admin/gdpr/retention` DELETE) is **manual only** — no cron — and always recomputes the cutoff server-side rather than trusting a client-supplied date.

The person-search/export/erasure flow (`/admin/gdpr` Card B) is intentionally **review-then-act**: `POST /api/admin/gdpr/search` returns candidate matches across *all* forms, but the export (`/api/admin/gdpr/export`) and purge (`/api/admin/gdpr/purge`) routes only ever operate on the explicit `responseIds` the admin has ticked — they never re-run the search server-side. This guarantees that what gets exported to (or deleted for) a data subject exactly matches what the admin visually verified, with no risk of an unreviewed false-positive slipping through.

`src/lib/response-format.ts` centralizes `findBlockDeep`/`formatBlockValue`/`formatDateString`/`resolveDataLabels` (originally inline in the webhook submit route) so the GDPR Excel export resolves choice values to human-readable labels and formats dates exactly like webhook payloads do — per the "Choice Value vs Label" convention, raw slugs are never handed to an external person.

The optional "GDPR notice" on `welcome-screen`/`thankyou-screen` blocks (`showGdprNotice`/`gdprNoticeLinkText`/`gdprNoticeText` in `BlockAttributes`) follows the existing modal pattern in `public-form-client.tsx` (`fixed inset-0 z-50 … bg-black/60`) via two small reusable components, `GdprNoticeLink`/`GdprNoticeModal`, wired into all four welcome/thank-you render paths (stack, float, split, and the post-submission thank-you screen).

**`pdfkit` + `output: 'standalone'` gotcha**: `pdfkit` reads its font metrics (`.afm` files) at runtime via `fs.readFileSync(__dirname + '/data/<Font>.afm')`. Left to webpack, it gets bundled into the server chunks — `__dirname` then resolves inside `.next/server/...` instead of the package's real directory, `readFileSync` throws `ENOENT`, and the route 500s. Fixed by declaring `pdfkit` in `experimental.serverComponentsExternalPackages` (`next.config.js`) so Next traces it intact into `.next/standalone/node_modules`, **plus** an explicit `COPY --from=builder /app/node_modules/pdfkit ./node_modules/pdfkit` in the `Dockerfile` as a safety net — the same belt-and-suspenders approach already used for `bcryptjs`, which Next's automatic file tracing also misses. `xlsx` does **not** have this problem (no `__dirname` usage — its `readFileSync` calls are generic helpers for user-supplied file paths).

### Audit Log / Activity Trail
The audit-log code is split across two files specifically to respect the server/client module boundary: `src/lib/audit-actions.ts` holds pure data (the `AuditAction` union, `ACTION_LABELS`, `ACTION_CATEGORIES`, `actionLabel()`) with **no Prisma import**, so `'use client'` components like `logs-client.tsx` can import it directly for filter dropdowns and display labels; `src/lib/audit-log.ts` holds the server-only core (`logEvent()`, `LogSettings`/`getLogSettings()`/`getLogRetentionCutoffDate()`, `parseLogFilters()`/`buildAuditLogWhere()`) and re-exports the label data so route handlers only need one import. Importing a Prisma-touching module into a client component breaks the build — this split is the same reasoning behind keeping `src/lib/gdpr.ts` and `src/lib/security.ts` server-only.

`logEvent()` is a fire-safe wrapper around `prisma.auditLog.create()` — it wraps the write in `try/catch` and only `console.error`s on failure, never throws. A logging failure must never cause the underlying action (login, form save, user edit…) to fail or roll back.

`GET /api/admin/logs` (paginated list) and `POST /api/admin/logs/export` (Excel) share `parseLogFilters()`/`buildAuditLogWhere()` so the exported workbook always matches exactly what the admin sees on screen — same convention as the GDPR export matching the admin-reviewed `responseIds`. The export is capped at 50,000 rows.

Retention mirrors the GDPR pattern exactly: `SystemSettings.logSettings` (`retentionEnabled`/`retentionDays`, default 365 days) is read via `getLogSettings()`, purging (`/api/admin/logs/retention` DELETE) is **manual only** with the cutoff date always recomputed server-side from `getLogRetentionCutoffDate()`, never trusting a client-supplied date.

The failed-login email alert (config lives in `SystemSettings.securitySettings`: `notifyOnFailedLogin`/`notifyThreshold`/`notifyEmail`, set in `/admin/security` next to `maxFailedAttempts`) fires from `recordFailedLogin()` in `src/lib/security.ts` on **strict equality** — `failedAttempts === settings.notifyThreshold` — not `>=`. Since the counter resets to zero on a successful login or a new time window, this guarantees exactly one alert email per failure cycle rather than one per attempt past the threshold.

### User Deletion & Orphaned Forms
When an admin deletes a user account (`DELETE /api/admin/users/[id]`):
1. All the user's **active** forms (`deletedAt = null`) are soft-deleted (`deletedAt = now()`), moving them to the admin trash.
2. The user record is then deleted; Prisma `onDelete: SetNull` sets `userId = null` on **all** associated forms (including already-trashed ones).

Orphaned forms (`userId = null`) appear in the admin trash with an amber "Compte supprimé" badge. Restoring one via `POST /api/admin/trash/[id]` **requires** a `userId` in the request body — the route returns 400 without one, preventing restoration without a valid owner.

The SQLite migration `prisma/migrations/20260609000000_form_userid_nullable` fully recreates the `Form` table to add the nullable column and `SET NULL` foreign-key constraint (SQLite cannot `ALTER COLUMN`).

### Word Templates → Filled Document → E-mail
A form can carry a `.docx` template whose tokens are replaced by the response values, the result
being mailed as an attachment. Configured from **two separate modals** on the responses page
toolbar (next to "Exporter CSV" / "Tout supprimer"): *Modèle de document* and *E-mail d'envoi*.

**Why docxtemplater and not Carbone**: Carbone switched from Apache-2.0 to the *Carbone Community
License* in v3.5.5 (2023-02-15) and every release since. The CCL adds field-of-use restrictions
(internal use only, "no exposing the feature to third parties, even via a wrapper", no
Document-Generator-as-a-Service, non-transferable, no sublicensing) that AGPLv3 §7 forbids — this
project is AGPLv3, so Carbone ≥ 3.5.5 cannot be shipped with it. `docxtemplater` (MIT) and
`pizzip` (MIT OR GPL-3.0) are used instead. Do not "upgrade" to Carbone.

`inspect-module.js` (docxtemplater's official tag inspector) `require`s **lodash, which is not a
dependency of docxtemplater** — importing it breaks the build. `inspectDocxTags()` therefore uses
the lodash-free `docxtemplater/js/get-tags.js` plus a 3-line local module that only implements
`set()` to capture each file's `postparsed` (module-wrapper.js fills in every other hook). Its
TypeScript declaration lives in `src/types/docxtemplater-get-tags.d.ts`.

**Token stability is the core guarantee**: `DocumentFieldMapping { tag, blockId }` is persisted in
`Form.documentSettings`, and `buildFieldCatalog(blocks, savedMappings)` always prefers a saved tag
over a freshly slugified label. Renaming a question in the builder therefore never breaks a `.docx`
already written. Mappings are persisted automatically right after a template import, not only on
"Enregistrer", precisely because the user copies the tokens into Word at that moment. Tags are
deduplicated **globally** (including repeater children) since docxtemplater falls back from the
loop scope to the parent scope — a colliding child tag would silently shadow a top-level field.

Repeaters become docxtemplater loops (`{#tag}…{/tag}`), reading the `{repeaterId}_{n}_{innerId}`
keys; group inner blocks are flattened to top-level tokens because that is how they sit in
`Response.data`. `buildDocumentData` re-applies `formatBlockValue` even though `Response.data` is
already label-resolved at submit time — it is idempotent, and it covers responses stored before
that resolution existed.

**Storage is private by design**: templates live in `storage/templates/` (env
`DOCUMENT_STORAGE_DIR`), never in `public/uploads`, because `/api/uploads/[filename]` serves that
folder **without any authentication**. Both the template and the filled document are only reachable
through authenticated routes gated by `getAccessibleForm()`. Filled documents are never written to
disk — they are regenerated on each download/send, so no file full of personal data accumulates.

**PDF output is gated on a verified converter**: `SystemSettings.documentSettings` holds
`pdfConverterUrl` / `pdfConverterVerified`. Only `POST /api/admin/documents/test` can set
`pdfConverterVerified = true`, and saving a *different* URL resets it to false. The PUT on
`/api/forms/[id]/document` re-checks `isPdfConversionAvailable()` server-side and forces `docx`
otherwise, so a stale `outputFormat: 'pdf'` left in the DB can never take effect after the
converter is removed. `convertDocxToPdf()` targets Gotenberg's
`/forms/libreoffice/convert` and has **not** been exercised against a live instance.

**Checkbox tokens**: a mapping carrying `choiceValue` renders `☒` when that specific option is
selected and `☐` otherwise (or `þ`/`¨` with `checkboxStyle: 'wingdings'`). The empty state is a real
box glyph on purpose — the same template printed blank stays fillable by hand. Word's *native*
form-field checkboxes (`FORMCHECKBOX`, `w:checkBox`) and content controls cannot be driven this way:
they are XML structures, not text, and text substitution leaves `w:checked` untouched (verified).
Tell users to replace them with a plain glyph. `isChoiceSelected()` must keep accepting all three
storage shapes: raw slug arrays (pre-`resolveDataLabels` responses), the comma-joined label string
produced today, and a single value.

**Email routing**: `DocumentEmailSettings.routes` is a list of `DocumentEmailRoute`, each with its
own conditions, recipients, subject and body — so only the concerned service is notified. A route
with **no condition always fires**; that is deliberately the opposite of form logic (where an empty
rule never applies), because a freshly created route, and the single route migrated from the old
flat config, must send without inventing an always-true condition.

`src/lib/condition-eval.ts` is a **separate** evaluator from the one in `public-form-client.tsx`, and
must stay separate: the form one compares against answers being typed, which hold raw slugs, while
this one compares against `Response.data`, where `resolveDataLabels` already replaced slugs with
labels and joined multi-choice answers into `"A, B"`. `canonicalizeValue()` normalises both sides
(slug/id/label → label, and `yes`/`Oui`/`true` → `yes` for yes-no blocks), so a condition keeps
working on responses recorded before that resolution existed. `equals` on a multi-valued answer is
true when the option is among those selected — that is what "si la réponse est Matériel" means to a
user, and it differs from the form evaluator's strict `===`.

Sending is fully backend-internal (`sendDocumentForResponse`), never throws — a broken template or
an unreachable SMTP must not fail the respondent's submission, same contract as `logEvent()`. It
writes `Response.documentStatus` (`DocumentSendStatus`) with one `DocumentRouteStatus` per route.
`matched: false` means the conditions were not met — a deliberate skip, **not** a failure, and the
UI must keep showing it in grey rather than red. The status records nodemailer's `accepted` /
`rejected` addresses: that attests to hand-off to the sending server only. Never label it
"delivered" — detecting a downstream rejection would require bounce processing.

### Periodic PDF Reports
A form can carry a report configuration (`Form.reportSettings`, typed `FormReportSettings`) that
turns its responses into a formatted PDF and mails it on a schedule. Configured from the
**Rapports** modal on the responses toolbar, next to "Exporter CSV".

**One computation, two consumers.** `src/lib/report-stats.ts` is pure — no Prisma, no pdfkit, no
nodemailer — so the modal imports it directly to render its live preview bar while the server
feeds the identical `ReportStats` object to `buildReportPdf()`. What the modal announces is
therefore literally what the PDF will contain; don't fork the maths into the component.

**Response values arrive in two shapes.** Since `resolveDataLabels()` was added to the submit
route, `Response.data` holds resolved labels comma-joined (`"A, B"`), but responses recorded
before that still hold raw slugs and arrays. `optionLabels()`/`tokenize()`/`matchOption()`
normalise all three so one option is never counted twice. `tokenize()` does **not** naively split
on commas: it re-joins consecutive fragments that reconstitute a known option, longest match
first — otherwise a single choice labelled `Écran, second` is counted as two options that don't
exist. The same resolution runs on the response table via `displayValue()`, per the project's
"Choice Value vs Label" convention (resolve at display time, never rewrite what's stored).

**Density changes blanks, never type size.** `settings.density` (`compact`/`normal`/`airy`)
selects a `ReportLayout` in `report-pdf.ts` — row heights, card and chart heights, a multiplier on
the `moveDown` between blocks. Font sizes stay fixed on purpose: every offset in that file is
hand-computed around them (card lines, table cells, the value right of each bar), so scaling type
would shift alignments for nothing. `normal` reproduces the pre-setting layout byte for byte, so an
existing report only changes when someone picks another density. Rows keep their content vertically
centred via `top + (rowHeight - 11) / 2`, which collapses to the historical `top + 2` at the normal
row height. `sectionPageBreak` starts each section on a fresh page — except the first, which would
otherwise open the report on a near-empty page.

**"All free answers" is a different intent from a sample.** `showAllTextAnswers` lists every
verbatim, duplicates included (two respondents writing the same thing are two answers), newest
first, capped at `MAX_ALL_SAMPLES` (1 000 per question) with the PDF stating "n affichées sur N"
when it bites. The sampled mode keeps deduplicating — there, the point is to show *different*
formulations. Verbatims wrap over several lines rather than being ellipsed like a label: a truncated
verbatim is cut exactly where it was going to be read.

**Numeric questions render as ratings, not table rows.** `resolveScale()` (`report-stats.ts`)
decides how: bounds *declared* on the block (`attributes.min`/`max` — a 1-to-5 slider) are what
make "4,2 / 5" meaningful, so they are kept distinct from bounds merely observed in the answers,
otherwise a free-amount question would announce "1 250 / 1 800" against whatever the largest
answer happened to be. A per-value distribution is only computed when every answer is an integer
and the span is ≤ `MAX_SCALE_SPAN` (10); values nobody picked are kept, since "no 1s at all" is
information. The cumulative total is shown only when there is no declared scale — summing
satisfaction ratings means nothing.

**Bar rows stack per group, not per row.** `needsStackedLayout()` measures every label of a group
up front; if one overflows the 190 pt label column the whole group switches to "full label on its
own line, bar underneath". Deciding row by row would leave one list mixing bars that start a third
of the way across the page with bars at the left margin. `wrapText()` breaks lines by hand rather
than through pdfkit's `LineWrapper`, which moves `doc.y` on its own and fights the free drawing
used everywhere else in this file.

**pdfkit renders WinAnsi, not Unicode.** The standard PDF fonts (Helvetica & co.) only cover
extended Latin-1, and pdfkit does not fail on a character outside that table — it writes the low
byte of each UTF-16 unit, so an emoji (a surrogate pair) comes out as two junk characters
(`🏘` = U+1F3D8 = `D83C DFD8` → `Ø<`). No standard font carries emoji, and pdfkit cannot switch
fonts per character inside one `text()` call, so `pdfSafeText()` (`src/lib/pdf-text.ts`) strips
them and transposes the symbols that have a readable equivalent. **Every dynamic string handed to
pdfkit must go through it.** In `report-pdf.ts` that is enforced in one place: `truncate()` is the
single funnel for dynamic text, so it sanitizes *and* measures widths on the string actually
written. Anything that bypasses `truncate()` (the header's site name, the GDPR summary) calls
`pdfSafeText()` explicitly. The same sanitizer runs on the report's attachment filename, otherwise
an emoji in the form title surfaces percent-escaped in `Content-Disposition`.

**pdfkit layout traps**, both hit and fixed here, worth knowing before editing `report-pdf.ts`:
- `doc.text(..., { lineBreak: false })` advances **`x`, not `y`** (pdfkit's `_line()` only bumps
  `y` when a `LineWrapper` exists). Every subsequent line then overprints the previous one. Use
  the local `writeLine()` helper, which repositions `doc.y` explicitly.
- Writing the page footer below the bottom margin makes pdfkit think the text overflows and
  **append a blank page per footer**. `drawFooters()` zeroes `doc.page.margins.bottom` around
  each write and restores it. Page numbering needs `bufferPages: true`.
- Manual drawing (`rect`, `roundedRect`) never moves `doc.y`, so anything hand-drawn must call
  `ensureSpace()` before and set `doc.y` after.

**Scheduling runs in-process, not by cron.** `startReportScheduler()` arms a `setInterval`
(5 min default, `REPORT_SCHEDULER_INTERVAL_MINUTES`, off with `REPORT_SCHEDULER=0`) and is called
from `src/app/layout.tsx` — **not** from `instrumentation.ts`. Next compiles `instrumentation.ts`
for the Edge runtime too (the middleware forces it), where `fs`, `path` and nodemailer don't
resolve; the build fails even with the documented `NEXT_RUNTIME === 'nodejs'` guard around a
dynamic import. The layout only ever runs in Node. Trade-off: the scheduler starts on the first
page served rather than at container boot. `POST /api/internal/reports/run` (shared secret, same
pattern as `/api/internal/ip-lists`) triggers the same pass for deployments preferring a system
cron.

Due-detection compares only the **last** past occurrence to `schedule.lastRunAt`, so a container
down for a week sends one report on restart, not seven. `lastRunAt` is stamped — without sending —
when a schedule is enabled or its timing edited, so turning on "Monday 8am" at 9am on a Monday
doesn't fire retroactively. It is also stamped **on failure**, otherwise an unreachable SMTP would
resend the same report every five minutes. `sendReportForForm()` never throws (same contract as
`sendDocumentForResponse()` and `logEvent()`), and `recordReportStatus()` re-reads settings from
the DB immediately before writing, since the scheduler can run while someone edits the modal.

The closing date (`closingDate`) caps the report period only — it does **not** stop the public
form from accepting responses. `sendFinalReportOnClosing` fires once, guarded by
`finalReportSentAt`, which is cleared when the closing date changes so a new date earns a new
final report.

### Form Access Options (the "Options" Modal)
`Form.accessSettings` decides when and to whom the public form answers: availability window
(`opensAt`/`closesAt`), password, response quota, one-response-per-device, sign-in requirement,
`noIndex`. The split follows the `audit-actions.ts` / `audit-log.ts` precedent — `src/lib/form-options.ts`
is pure (parsing, defaults, messages, `scheduleState()`) so the `'use client'` modal can import it,
while `src/lib/form-gate.ts` holds everything needing Prisma, `next/headers` or crypto.

**`resolveFormGate()` is called twice per response**: once in `src/app/[slug]/page.tsx` and once in
`/api/forms/[id]/submit`. Never drop the second one — the first only decides what to render, and a
forged POST bypasses it entirely. The page also **parses `form.blocks` only after the gate opens**,
so a password-protected form does not ship its questions in the gate screen's HTML.

**The unlock cookie is an HMAC of `${formId}:${passwordHash}`, not a random session id.** That is
what makes a password change revoke every outstanding access for free, with no session table to
expire. It also means the cookie is worthless if copied to another form. Password verification
(`/api/forms/[id]/access`) has its own small in-memory throttle rather than calling
`recordFailedLogin()` — the account anti-bruteforce path blacklists an IP application-wide, which
would be a wildly disproportionate response to a respondent mistyping a form password.

Dates are stored exactly as the `datetime-local` input produces them (`2026-09-01T08:30`), with no
timezone, and are therefore interpreted in the **server's** timezone. Anything derived from them
must be formatted **server-side** and passed down as a string — `FormGateScreen` receives
`opensAtLabel`, not a date, because formatting it in the client would hydrate differently whenever
the visitor's timezone differs from the server's.

`onePerDevice` rests on a cookie set by the submit route, so it is dissuasive, not strict; the modal
says so and points at `requireLogin` for a real guarantee. Don't silently upgrade its wording.

**Known limitation**: both cookies are `SameSite=Lax`, like `auth-token`. A password-protected form
therefore cannot be unlocked from inside a *cross-site* iframe embed — the browser won't send the
cookie back. `SameSite=None` is not the fix: it requires `Secure`, which plain-HTTP self-hosted
deployments don't have, so it would break those instead. Password protection and cross-site
embedding are mutually exclusive; the direct link works normally.

### Runtime Version Parity — Keep the Image and the Dev Machine on the Same Node
The Docker image is `node:24-alpine`, matching `.nvmrc` and the typical dev machine. **Keep them in
step.** When they drift, APIs available locally compile, pass every local test, and then throw at
runtime in production — nothing in the build catches it.

That already happened once, on `node:18-alpine`: `File` only became a global in **Node 20**, so
`file instanceof File` threw `ReferenceError: File is not defined` on every template import while
passing locally on Node 24. The upload check is deliberately structural (an object exposing
`arrayBuffer()` and `size`) rather than `instanceof` — keep it that way, it costs nothing and does
not depend on the runtime version.

If the image is ever pinned below the dev machine again, the APIs to watch are `File` (20),
`Object.groupBy` (21), `Array.fromAsync` / `toSorted` / `findLast` (20-22). Node's LTS calendar
matters too: 18 died in April 2025 and **20 in April 2026** — check
`https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` before recommending a version
rather than assuming a major is still supported.

Every route handler must wrap its body in `try/catch` with `console.error` — the codebase does this
everywhere, and without it a runtime error like the above surfaces as a bodyless 500 with nothing in
the container logs to diagnose.

### Migrations — Two Lineages, Two Column Orders
Local dev uses `npm run db:push`; Docker/production replays `prisma/migrations/` via
`migrate deploy` in `docker-entrypoint.sh`. **Any schema change needs a migration file** or it never
reaches production.

The two produce **different physical column orders** for the same schema: `db push` recreates a
table in schema order, while `migrate deploy` appends every `ALTER TABLE ... ADD COLUMN` at the end.
Since SQLite has no `ALTER COLUMN`, changing nullability or a foreign key means rebuilding the table
— and `INSERT INTO "X_new" SELECT * FROM "X"` copies **by position**, so it silently targets the
wrong columns on one lineage or the other. Always list columns explicitly on both sides.

This is exactly how `20260609000000_form_userid_nullable` shipped broken: on a `migrate deploy`
database, `deletedAt` (NULL for every non-trashed form) landed in the `NOT NULL` `createdAt` column,
failing with `NOT NULL constraint failed: Form_new.createdAt` and blocking all later migrations with
`P3009` — while passing locally, where the `db push` order happened to match. It also only fails on
a database that **already holds rows**: on an empty one the copy touches nothing and passes, so a
fresh deployment is no proof either. Verifying such a migration means rebuilding a scratch DB in
`migrate deploy` order, seeding it, then checking values did not shift between columns.

Table-rebuild migrations must be replayable — `DROP TABLE IF EXISTS "X_new"` at the top, `IF NOT
EXISTS` on index creations. This is not defensive styling: reproducing the outage showed Prisma does
**not** roll back the transaction here, so the half-built `X_new` survives a failure and the retry
would die on "table already exists".

A failed migration also leaves a blocking row in `_prisma_migrations`, which lives in the *database
volume* — fixing the SQL and rebuilding the image never unblocks an existing instance on its own.
`docker-entrypoint.sh` therefore detects it (`scripts/failed-migrations.js`), marks it rolled back so
Prisma replays it, and retries **once** before failing hard; `MIGRATION_AUTO_REPAIR=0` opts out. Keep
that retry bounded — an unbounded auto-repair loop would mask genuine failures.

### Dockerfile — Local Prisma Binary
The Dockerfile uses `./node_modules/.bin/prisma generate` instead of `npx prisma generate`. Using `npx` in a Docker build layer can download a newer Prisma version (v6+ in 2026), which uses a different `url` config format and breaks the build. The local binary is pinned to the exact version in `package-lock.json`, which is committed to the repository (removed from `.gitignore`) so that `npm ci` produces identical dependency trees across all environments and CI/CD runs.
