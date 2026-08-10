# Changelog

All notable changes to FormBuilder Standalone are documented here.

> **Version française** : [CHANGELOG.fr.md](CHANGELOG.fr.md)

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Form access options** — a new **Options** entry in each form's card menu on the dashboard opens a modal governing *when* and *to whom* the public form answers:
  - **Availability window** — a go-live date and a closing date (server time, either one optional). Before the first, visitors see a "not open yet" screen announcing the opening date; after the second, a "closed" screen. Both messages are customisable.
  - **Password protection** — the form is only rendered once the password has been entered; access is then remembered for 12 h on that device. The password is stored as a bcrypt hash and **never leaves the server** — the modal only ever learns whether one is set. The unlock cookie is derived from that hash, so **changing the password immediately revokes every access already granted**, with no session list to maintain. Attempts are throttled to 10 per IP and per form over 10 minutes, deliberately separate from the account anti-bruteforce machinery so a respondent's typo can never get them blocked application-wide.
  - **Response quota** — closes the form once a maximum number of responses is reached, the counter being shown live in the modal.
  - **One response per device** — a cookie dropped after submission; described in the interface as dissuasive rather than strict, with a pointer to the login requirement for a real guarantee.
  - **Restricted to signed-in users** — the form is only served to an authenticated account; the sign-in button comes back to the form afterwards (the login page now honours a `?redirect=` parameter, restricted to internal paths).
  - **Search-engine opt-out** — a `noindex` meta tag; password-protected and sign-in-only forms are de-indexed regardless.
  - Every rule is enforced **server-side, both when the page is rendered and when a response is submitted**: a forged request bypasses none of them. A protected form does not ship its blocks in the gate screen's HTML — the questions are only sent once access is granted.
  - The dashboard card shows a "Scheduled" or "Closed" badge when a published form is not actually accepting responses, plus a slate badge counting the active options.
- **Periodic PDF reports, delivered by e-mail** — a "Rapports" button on the responses page toolbar, next to "Export CSV", opens a three-tab modal that turns responses into a readable summary and mails it automatically:
  - **Period** — rolling window (last N days), current month, previous month, since the last report (no response ever counted twice), fixed date range, or since creation. An optional **closing date** permanently caps the upper bound: past that date every report describes the same frozen corpus instead of growing indefinitely, with an option to **send a final report on the evening of the closing date** (once only). That date does not close the form to new submissions — it only affects reports.
  - **Content** — seven independently toggleable sections: key indicators (total, daily average, percentage change against the equivalent previous period, busiest day, average fill rate), a response histogram (day / week / month granularity picked from the period span), **choice breakdown in percentages** with bars for dropdowns, multiple choice, image selection, yes/no, legal consent and cumulated quantities, numeric statistics (min, average, median, max, sum), free-text answers (recurring values then latest verbatims), per-question fill rate, and a table of the latest responses.
  - **Delivery** — daily, weekly (any day of the week) or monthly (day of month, capped at 28 so the send also happens in February) scheduling, quarter-hour precision, multiple recipients, subject and HTML body accepting tokens (`{form_title}`, `{period}`, `{response_count}`, `{generated_at}`…).
  - A **live figures bar** at the top of the modal (responses in period, period analysed, average fill rate, next send) recomputed on every change by the **same function as the PDF**, plus "Download the PDF" to check the exact output before scheduling anything, and "Send now" for a control send.
  - Choice questions are **resolved to labels at display time**: an older response stored as a slug (`technique`) and a recent one stored as a label (`Technique`) count as the same option. A label containing a comma ("Écran, second") is reconstituted instead of being split into two non-existent options. Repeater fields are aggregated across all their iterations.
  - Triggering relies on an **in-process timer** (checked every 5 minutes, `REPORT_SCHEDULER_INTERVAL_MINUTES`, disabled with `REPORT_SCHEDULER=0`): no external cron to set up. A container down for a week sends **one** report on restart, not seven. For deployments that prefer to drive it themselves, `POST /api/internal/reports/run` triggers the same pass (shared secret, like `/api/internal/ip-lists`).
- **Word document generation from responses, delivered by e-mail** — a form can carry a `.docx` template whose tokens are replaced by the values of a response, the result being sent as an e-mail attachment:
  - Two separate modals on the responses page toolbar, next to "Export CSV" / "Delete all" — **Document template** (import the `.docx`, field/token table, output settings) and **Sending e-mail** (subject, body, recipients)
  - Visual table of every available field: label, type, copyable token, **possible answers** for choice blocks, and whether the token is actually present in the uploaded template; tokens found in the template but unknown to the form are listed as a warning, since they render empty
  - Repeaters become loop tokens (`{#items}` … `{/items}`); the inner blocks of a group are exposed as ordinary top-level tokens; four metadata tokens are always available (response date, generation date, response id, form title)
  - Tokens are persisted as a `tag → blockId` mapping as soon as the template is imported, so **renaming a question in the builder never breaks a `.docx` that has already been written**; tokens are deduplicated globally so a repeater field can never silently shadow a top-level one
  - Recipients can be fixed addresses, the value of one or more e-mail blocks of the form, or both; subject, body and generated file name all accept the same tokens
  - Sending happens automatically on submission (optional) and can always be replayed manually; a per-response indicator mirrors the existing webhook one, alongside a button to download the filled document (see the routing circuits entry below for the per-route breakdown)
  - Uses `docxtemplater` (MIT) rather than Carbone: since v3.5.5 Carbone ships under the "Carbone Community License", whose field-of-use restrictions (internal use only, no exposure of the feature to third parties even through a wrapper, no Document-Generator-as-a-Service) are incompatible with this project's AGPLv3 licence
- **Documents admin panel** (`/admin/documents`) — declare an external PDF converter (Gotenberg container) with a connection test; the PDF output option stays hidden in forms until a test succeeds, changing the address invalidates the verification, and the server re-checks availability on every save so a stale `pdf` setting can never take effect after the converter is removed
- **User deletion — forms preserved in admin trash** — deleting a user account no longer permanently destroys their forms; all active forms are soft-deleted (moved to admin trash) before the account is removed; `Form.userId` is then set to `null` by `onDelete: SetNull`; orphaned forms appear in the admin trash with an amber "Deleted account" badge and require mandatory owner reassignment before they can be restored (the restore route returns 400 if no `userId` is provided)

### Changed
- **Ratings presented as ratings, no longer as a table of figures** — the "Numeric values" section lined up seven columns of bare numbers (Count, Min, Average, Median, Max, Total), unreadable for a 1-to-5 rating and whose total meant nothing. Every numeric question now gets its own card: the **average relative to the question's scale** ("3.9 / 5") placed on a gauge, then the **per-value distribution** as bars and percentages, best rating first, and finally a discreet line for the response count, minimum, maximum and median. Ratings nobody picked stay on the list — "no 1s at all" is information. The distribution only appears when it means something (integer values, a scale of at most eleven steps); a free-amount question keeps its average and shows the cumulative total, which is conversely hidden on a rating, where summing satisfaction scores is meaningless. The bounds used are the ones **declared on the question**, never those merely observed in the answers: without that distinction a budget question would announce "1,250 / 1,800" based on whatever the largest amount received happened to be.
- **French-formatted percentages** throughout the PDF (`66,7 %` rather than `66.7 %`), matching the averages that already used the decimal comma.

### Fixed
- **Questions truncated by the report's bars** — in the "Completion rate", "Answer breakdown" and "Free-text answers" sections the label was confined to a 190 pt column and cut off ("Activities & Entertainment — On a scale of…"), making two questions of the same group indistinguishable. A group of bars where a single label overflows now switches to a **stacked** presentation: the whole question on its own line(s), the full-width bar underneath. The decision is taken for the whole group rather than per row, otherwise one list would mix bars starting a third of the way across the page with bars starting at the left margin. Line breaking is computed by hand rather than delegated to pdfkit, whose automatic wrapping moves `doc.y` on its own and does not combine with the free-form drawing used across the report.
- **Emoji and symbols rendered as garbage in PDF reports** — a question title containing an emoji ("🏘️ General information") came out as `Ø<Ø` in the PDF. The standard PDF fonts pdfkit uses (Helvetica) are **WinAnsi**-encoded, i.e. limited to extended Latin-1: faced with a character outside that table pdfkit does not fail, it writes the low byte of each UTF-16 unit — so an emoji, encoded as a surrogate pair, produces two junk characters. No standard font carries emoji and pdfkit cannot switch fonts per character inside a single text call, so those characters are now **stripped** cleanly (`pdfSafeText()`, new `src/lib/pdf-text.ts`), including the variation selectors and invisible spaces they drag along, with the leftover whitespace collapsed. Symbols that have a readable equivalent are transposed rather than dropped (`≥` → `>=`, `→` → `->`, `✔` → `[x]`, `●` → `•`, thin spaces → regular space), and accents survive thanks to an NFC precomposition pass. The fix covers **every dynamic string** in the report — question titles, options, verbatims, table headers, site name, footer — plus the GDPR panel's PDF summary and the **attachment filename**, which previously came out percent-escaped (`%F0%9F%8F%98`). The other exports (Excel, Word, HTML) are UTF-8 and were never affected. Accepted trade-off: a label made *only* of emoji comes out empty in the PDF.

### Added
- **Automatic recovery from a blocked migration on container start-up** — a failed migration leaves a blocking row in `_prisma_migrations`, *inside the database volume*, so fixing the offending SQL and rebuilding the image never unblocks an existing instance: the container keeps crash-looping on `P3009` until someone runs `migrate resolve` by hand, which is awkward on a Portainer deployment. `docker-entrypoint.sh` now detects the blocking migration (new `scripts/failed-migrations.js`), marks it rolled back so Prisma replays it, and retries **once**; a second failure stops the container with an explicit message instead of looping forever. Set `MIGRATION_AUTO_REPAIR=0` to opt out. Verified end to end by reproducing the real outage — a populated database, the old positional SQL, the resulting `P3009` loop — then running the recovery and checking that forms, responses and their column values all survived intact.

### Added
- **Conditional e-mail routing (routing circuits)** — the single recipient list is replaced by a list of routes, each with its own conditions, recipients, subject and body, so only the concerned service is notified: the canteen hears about a mission only when catering is ticked, the technical department only when equipment is. Conditions reuse the operators of the form logic editor (`equals`, `contains`, `is_empty`…) with all/any matching, and sit **collapsed by default** inside each route card since most routes are set up once and left alone. A route with no condition always fires. Each response records one status per route — triggered and accepted, triggered and failed, or simply not concerned (shown in grey, since a skipped route is a deliberate outcome rather than an error) — visible per row, detailed in the response modal, and replayable in one click.
- **Checkbox tokens for Word templates** — every option of a choice, yes/no or consent block gets a `{case_…}` token rendering ☒ when selected and ☐ otherwise (or `þ`/`¨` in Wingdings, selectable per template). The empty state is a real box glyph, so the same template printed blank remains fillable by hand without any change to the document. Tokens are listed with a copy button next to the field they belong to and stay stable when an option is renamed. Word's *native* form-field checkboxes cannot be driven this way — they are XML structures rather than text — so they must be replaced with a plain glyph.
- **SMTP acceptance tracking** — the per-route status records the addresses `accepted` and `rejected` by the sending server, and the UI calls it « accepted by the server » rather than « delivered »: detecting a rejection further down the chain would require bounce processing.

### Changed
- **Docker base image moved from `node:18-alpine` to `node:24-alpine`** — Node 18 reached end-of-life in April 2025 and receives no security fixes; Node 20 reached end-of-life in April 2026, so it was not a viable target either. Node 24 is in Active LTS until October 2026 and maintained until April 2028, and it matches the version used for development — which removes the local-versus-production divergence that produced the `File is not defined` bug above. Verified safe for this project: no native modules anywhere in the dependency tree (no `binding.gyp`), every declared `engines` constraint satisfied (the strictest is Next.js at `>=18.17.0`), no use of any API removed in Node 20-24, and no `binaryTargets` pinned in `prisma/schema.prisma` — the Prisma engine is detected by `prisma generate` inside the builder stage, which shares the runner's base image, so it stays self-consistent. A `.nvmrc` now pins the same major for local development.

### Fixed
- **Template import returning `500` in production (`POST /api/forms/[id]/document/template`)** — the route validated the uploaded file with `file instanceof File`, but **`File` only became a Node global in Node 20**, and the Docker image runs `node:18-alpine`. Referencing the identifier therefore threw `ReferenceError: File is not defined` on every import. It passed local testing because the development machine runs Node 24 — the same local-versus-production divergence as the migration bug above. The check is now structural (an object exposing `arrayBuffer()` and `size`), which works on any Node version.
- **Opaque `500`s on the document routes** — none of the new document handlers had the `try/catch` + `console.error` wrapper every other route in this project uses, so any unexpected error surfaced as a bodyless 500 with nothing in the container logs. All of them now log the cause and return a proper message; a failure to write the template also states explicitly that the private storage may not be mounted or writable.
- **Migration `20260609000000_form_userid_nullable` failing on any database built by `migrate deploy`** — the SQLite table rebuild copied rows with `INSERT INTO "Form_new" SELECT * FROM "Form"`, which matches columns **by position**. The physical column order of `Form` differs depending on how the database was built: with `migrate deploy`, `deletedAt` and `saveCount` were appended by later `ALTER TABLE` statements and therefore sit *after* `createdAt`/`updatedAt`, whereas `db push` recreates the table in schema order. On a `migrate deploy` lineage the positional copy shifted `deletedAt` — `NULL` for every non-trashed form — into the `NOT NULL` `createdAt` column, aborting with `NOT NULL constraint failed: Form_new.createdAt` and blocking every subsequent migration with `P3009`. The failure only shows on a database that **already contains forms**: on an empty one the copy touches no rows and passes silently, which is why fresh deployments were unaffected. Columns are now listed explicitly, which is correct for both lineages. The `DROP TABLE IF EXISTS "Form_new"` guard added at the same time turned out to be load-bearing rather than precautionary: reproducing the outage showed Prisma does **not** roll the transaction back here, so the half-built `Form_new` table survives the failure and would make the retry fail on "table already exists". Index creations use `IF NOT EXISTS` for the same reason.
- **Dockerfile — Prisma version mismatch in CI/CD** — `npx prisma generate` in the build stage could silently download a newer Prisma CLI (v6+ in 2026 uses a different `url` config format), causing `npm run build` to fail; changed to `./node_modules/.bin/prisma generate` to always use the project-local binary; also committed `package-lock.json` (previously in `.gitignore`) and updated the Dockerfile to use `npm ci` so dependency versions are locked and reproducible across builds and deployments

### Added
- **Activity log / audit trail panel** (`/admin/logs`) — new admin section recording and surfacing security-relevant and content-changing events:
  - Logs logins (who, IP address, success or failure and reason), logouts, registrations, password reset requests/completions, the full form lifecycle (create, update, publish/unpublish, delete, restore, permanent delete, duplicate, version create/restore), and user management actions (create, update with role-change tracking, delete)
  - Filterable, paginated table (`/api/admin/logs`) — by action/category, status (success/failure), date range, and free-text search across user, email, IP address, and target label
  - Export the current filtered view to Excel (`/api/admin/logs/export`, capped at 50,000 rows) — guaranteed to match exactly what the admin has filtered, sharing the same `buildAuditLogWhere`/`parseLogFilters` helpers as the list endpoint
  - Configurable retention (in days, default 365) with a manual "Purge expired entries" button — same review-before-purge pattern as the GDPR retention card, cutoff date always recomputed server-side
  - Optional email alert to a dedicated, configurable address after a configurable number of consecutive failed login attempts (default disabled; threshold set alongside the existing anti-bruteforce settings in `/admin/security`) — sends exactly one alert per failure cycle (the counter resets on success or on a new time window), not one per attempt past the threshold

### Added
- **GDPR / RGPD compliance panel** (`/admin/gdpr`) — new admin section for data retention and data-subject rights:
  - Configurable maximum retention period for responses (default: legal retention of 36 months); a "Purge expired responses" button previews the count (with a per-form breakdown) before manually deleting anything — no automatic cron purge
  - Global cross-form search for responses belonging to a person (name, email, or any text within the submitted data), with a review step — admins tick/untick individual matches before acting, so exports and deletions only ever touch explicitly reviewed response IDs
  - Export the selected responses as a portability spreadsheet (Excel — one sheet per form, human-readable values with choice labels resolved and dates formatted) or as a PDF summary (form title + submission date per response) to hand to the data subject; the PDF can be addressed by name (`Concernant : <nom>`) using the search term that identified the person
  - Manual deletion (right to erasure) of the selected responses, with confirmation
  - Optional "GDPR notice" link and modal on Welcome Screen / Thank-You Screen blocks — form admins write custom privacy text (retention period, rights, DPO contact…) shown to respondents on demand

### Fixed
- **PDF export crashing in production (`500` on `/api/admin/gdpr/export`)** — `pdfkit` loads its font metrics (`.afm` files) at runtime via `__dirname`-relative paths; in `output: 'standalone'` builds, webpack bundled the package into the server chunks, so `__dirname` no longer pointed at its real directory and `fs.readFileSync` threw `ENOENT`. Marked `pdfkit` as an external package via `experimental.serverComponentsExternalPackages` in `next.config.js` (so Next traces it intact into `.next/standalone/node_modules`) and added an explicit `COPY` for it in the `Dockerfile`, mirroring the existing `bcryptjs` workaround for packages missed by automatic file tracing

### Added
- **Security admin panel** (`/admin/security`) — anti-bruteforce protection and IP access control:
  - Configurable brute-force protection: enable/disable, max failed login attempts, attempt window, and block duration
  - IP whitelist / blacklist with optional notes; whitelisted IPs always bypass blocking
  - Live list of currently blocked IPs with failed attempt count and remaining block time
  - Blacklisted IPs are rejected at the edge in `middleware.ts` via an in-memory cache refreshed every 60s from the internal `/api/internal/ip-lists` endpoint (the Edge Runtime cannot use Prisma/SQLite directly); fails open on fetch error so a transient outage never locks everyone out

### Fixed
- **Docker — SQLite volume overlaying the bundled Prisma files** — `docker-compose*.yml` mounted the `sqlite-data` volume directly on `/app/prisma`, hiding the `schema.prisma` and migration files copied into the image at build time; the database now lives in a dedicated `/app/prisma/data` subdirectory (`DATABASE_URL=file:/app/prisma/data/dev.db`)

### Added
- **Login page customization** — new "Login page" card in Admin → Customization (`/admin/customization`) to configure:
  - Show/hide the "Forgot password?" link
  - Page background: solid color, gradient (8 directions, custom start/end colors), or image — with an adjustable blur (0–40 px) that creates a fade effect behind the (always sharp) login card
  - Convenience toggle for "Allow registrations" — mirrors the same global `registrationEnabled` setting as Admin → General, always kept in sync
  - Live preview that renders pixel-identically to the real login page (shared `getLoginBackgroundStyle()` helper)

### Fixed
- **Stale "Sign up" link on the login page** — `/api/settings/public` was a Route Handler with no dynamic functions, so Next.js cached its response at build time in production; toggling "Allow registrations" off in the admin panel never reached the live login page until a rebuild. Added `export const dynamic = 'force-dynamic'` (same pattern already used on the dashboard page) so the setting is read fresh on every request.

### Added
- **Theme — choice background color** (`choicesBgColor`) — new theme property to set an independent background color for unselected options in Multiple Choice, Image Selection, and Dropdown blocks; applied to the dropdown suggestion panel, choice items in the published form, the central editor preview, and the sidebar block preview

### Fixed
- **Mouse wheel navigation in public form** — scrolling the wheel had no effect when navigating between questions; a `wheel` event listener is now added (30 px threshold, 600 ms cooldown); scrolling inside a scrollable element (open dropdown list) does not trigger navigation — detected by walking up the DOM to `body`
- **Required fields in groups bypassed by navigation buttons** — the ↑/↓ navigation buttons and the wheel could move to the next question even when a required field inside a Group block was empty; required inner-block validation is now enforced before any navigation
- **Theme not applied in central editor preview** — `buttonsBorderRadius`, `inputStyle`, and `inputBorderRadius` were ignored by the builder's central block preview (`CenterBlockPreview`); all buttons and text fields now faithfully reflect the active theme style (border radius, underline/outlined/filled) immediately when changed in the theme editor, without waiting for publication

### Changed
- **Builder preview (Aperçu) — faithful rendering** — the Aperçu button no longer uses a custom in-app re-implementation (`form-preview.tsx`) that diverged from the real form; it now auto-saves any pending changes, then opens an auth-protected iframe at `/forms/[id]/preview` that renders the exact same `PublicFormClient` component as the published form — preview is guaranteed to be pixel-perfect with production at all times; `form-preview.tsx` is kept but no longer used

### Added
- **Form preview endpoint** (`/forms/[id]/preview`) — auth-protected server route that renders any form (draft or published) using the full public renderer; accessible to owners, collaborators (any permission level), and admins; used as the iframe target for the builder Aperçu button

### Fixed
- **Site customization not applied** — logo, site name, and favicon saved in the admin panel were ignored by the dashboard header (hardcoded "FB" / "FormBuilder") and the browser tab title (hardcoded static metadata); the dashboard page now fetches `SystemSettings` server-side and passes `siteName` / `siteLogo` to the client; `layout.tsx` uses `generateMetadata()` (async) to set the dynamic title and favicon icons

### Added
- **Logo in forms** — display the site logo (from admin customization) inside the published form; configurable position (top / bottom) and alignment (left / center / right) from the form settings panel; works across all three layouts (standard, float, split)
- **Form versioning** — hybrid auto/manual version history for every form
  - Automatic snapshot every 10 saves (Auto badge, blue)
  - Manual "Save current version" button with optional label (Manual badge, green)
  - Version history modal accessible from the dashboard dropdown ("Version history") and the builder header ("Versions" button)
  - Restore any version with one click — current state is automatically snapshotted before restore ("Before restore vN") so nothing is ever lost
  - Delete any version with two-step confirmation (no accidental deletions)
  - Search bar (appears when more than 3 versions) — filters on label, title, number, and type (auto/manual); × button to clear; result counter
  - Versions listed in reverse chronological order with number, label, type badge, title, and creation date
- **Visual Logic Builder** — fullscreen Tripetto-style modal for building conditional logic visually; block cards arranged in a vertical flow, SVG orthogonal arrows connecting source and target blocks, rounded corners on paths, colored badges on arrows showing the rule summary
  - Left/right lane alternation per rule to minimize arrow overlap
  - Independent lane pools per side with non-overlapping lane assignment algorithm
  - Arrow stagger offset (±16 px) per rule to prevent same-Y starts/ends from the same block
  - Click on an arrow or block name to open the rule editor directly
  - Rule navigation sidebar — lists all rules for the selected block; click to switch instantly without large mouse movements
  - Searchable block dropdowns in the condition editor (filter by label in real time)
  - Default "If" block = the source block; default "Then" block = the immediately following block
  - Block numbers in dropdowns match the visual canvas numbering (original index, not filtered-list index)
  - Right-aligned labels on left-side lanes, left-aligned on right-side lanes — consistent visual gap on both sides
  - Auto-opens the rule editor immediately after creating a new rule

### Fixed
- **`addLogicRule` — ID overwrite** — the store was replacing the caller-provided rule ID with a fresh `uuidv4()`, causing the newly selected rule to be unfindable; the provided ID is now preserved
- **Visual Logic Builder — block number mismatch** — condition dropdowns were using the filtered `selectable` list index instead of the block's actual position in the full `blocks` array
- **Visual Logic Builder — left-side label overlap** — labels on left-side arrow lanes were positioned too far left and visually inconsistent with right-side labels; fixed with right-aligned text flush to the lane line and a wider left-side canvas margin (`BL` 220 → 260)

---

## [1.5.0] — 2026-05-17

### Added
- **Yes/No block** — two-button question with optional conditional hiding of subsequent blocks; works in standalone, group, and repeater contexts
- **Conditional logic editor** — real-time block search field (case-insensitive filter by label)
- **Blocks sidebar** — search field filtering blocks by name; also matches inner blocks of groups and repeaters; × button to clear; "No block found" empty state; drag-and-drop suspended during search
- **Webhooks — drag-and-drop mapping reorder** (expanded view) — `⠿` handle on each mapping row; disabled automatically when a search filter is active
- **Webhooks — mapping search** (expanded view) — search bar filters simultaneously on JSON key and field label; result counter; × button to clear; resets on each modal open
- **Dropdown — dynamic choice filtering** — hide specific choices based on a previous block's answer (dropdown, multiple choice, or image selection); per-source-value configuration panels with checkboxes; "N hidden" counter on collapsed panel; built-in search for large option lists; works in standalone, group, and repeater
- **Webhook mapping — block search** — integrated search field in the field selector; filters available blocks in real time by label
- **Quantity block** — list of items with individual quantity inputs; configurable max and default value per line; selectable output format; works in standalone, group, and repeater; search filter in the choice editor for large lists
- **Multiple choice — "Other" option** — optional free-text input alongside predefined choices; correctly exported in responses and webhooks; works in standalone, group, and repeater
- **Exclude previously selected choices in repeaters** — prevents the same option from being picked in multiple iterations
- **Resizable panels** in the builder — drag the border between left/right panels to adjust workspace width
- **Collapsible groups and repeaters** in the block list — fold/unfold button to declutter the sidebar

### Changed
- Webhooks now expose inner fields of groups and repeaters in the field mapping selector
- Group and repeater labels display improved in the sidebar

### Fixed
- **Short text transform in groups** — auto-transform (UPPERCASE / Capitalize) was not applied to short-text blocks inside a group
- **InnerBlockInput — stale closure** — `onNext()` was called with a stale React closure on `answers` in inner blocks; fixed by merging `currentValue` before the call
- **InnerBlockInput — value not passed to onNext** — selected value was not forwarded as second argument to `onNext()`, causing navigation inconsistencies
- **isInnerBlockVisible / getNextVisibleInnerIndex** — moved outside the React component to avoid `react-hooks/exhaustive-deps` warnings and unnecessary recreations
- **TypeScript TS2554** — `onNext` prop only accepted one argument (`skipValidation`); now correctly typed for two arguments (`onNext(true, value)`)
- **Logic editor layout** — CSS adjustments to improve readability of blocks and rules in the conditional logic panel

---

## [1.4.1] — 2026-05-16

### Added
- **Form trash** — soft delete: deleted forms go to trash instead of being permanently removed (`deletedAt` field on `Form` model)
- **Admin trash panel** (`/admin/trash`) — lists all deleted forms with original owner, deletion date, and response count; Restore (with optional user reassignment) and Permanently Delete (with confirmation warning) actions
- **Address block** — single-line address input with real-time autocomplete via the official French Address API (BAN, free, no key required); 300ms debounce; keyboard navigation in suggestions (↑↓ Enter Escape); free-text fallback; configurable placeholder; works in standalone, group, and repeater
- **Short text — auto-transform** — new "Response format" option: None / UPPERCASE / Capitalize, applied in real time while typing in the public form
- **Thank-you screen — Restart button** — optional toggle in block properties; customizable label (default: "Restart"); fully resets the form (answers, index, repeater state) for a new submission; live preview in builder
- **Webhooks — expanded view** — "Expand" button per webhook opens a full-screen modal with configuration and mapping side by side; inner blocks of groups and repeaters available in field selector
- **Webhooks — custom value template** — new `_custom` value type with template editor; supports `{field:blockId}`, date/time tokens (`{date:dd-MM-YYYY}`, `{time:HH-mm-ss}`), `{entry_id}`, `{form_id}`; real-time preview of resolved value

### Fixed
- **Admin rights — form delete** — an admin could not delete a form belonging to another user (check used `findFirst({ userId })` instead of `checkFormAccess()` which handles the admin role)
- **Conditional logic — jump offset race condition** — the jump target index was calculated at click time but the 300ms `setTimeout` fired after `setAnswers` updated `visibleBlocks` (shifted indices when a block was hidden); fixed with a ref always in sync with visible blocks
- **Conditional logic — premature hiding** — `not_equals` with `undefined` evaluated `undefined !== 'X' = true`, hiding blocks on load before any interaction; all operators (except `is_empty` / `is_not_empty`) now return `false` when the answer is absent
- **Conditional logic — group auto-hide** — if all inner blocks of a group are hidden by logic, the group itself is now automatically hidden (avoids displaying an empty page)
- **Webhooks — TypeError on inner blocks** — mapping to an inner field of a group returned `undefined` because `blocks.find()` only searched the first level; added recursive `findBlockDeep()` for `innerBlocks`
- **Webhooks — human-readable labels and formatted dates** — webhooks were sending raw values (slugs, ISO dates) instead of human-readable labels and locale-formatted dates; fixed for all contexts: explicit mapping, groups, repeaters, and custom templates
- **Address block — race condition on suggestion selection** — clicking a suggestion called `onNext()` with a stale closure on `answers` (still the typed text); selection now updates the value without auto-advancing; user confirms with OK or Enter

---

## [1.4.0] — 2026-01-19

### Added
- **Dropdown — always-on autocomplete** — all dropdown blocks now use an autocomplete component; keyboard navigation (↑↓ Enter Escape); new "Allow custom answers" option: when disabled (default) user must pick from list, when enabled free-text is recorded
- **Image Selection block** — choices illustrated with clickable images; two layout modes: side-by-side grid (2/3/4 columns, responsive) or stacked; configurable image size (small/medium/large), optional image labels, single or multi-select; integrated image upload or external URL; full support in groups and repeaters
- **Phone block — advanced validation** — format choice (Standard 06... / International +33...); configurable expected digit count; numeric keyboard on mobile; real-time validation on submit
- **Email block — advanced validation** — strict email validation enabled by default; supports complex formats (`test@test.fr`, `didier.jean-marie@neuf.com`); can be disabled per block

### Fixed
- **Conditional logic "Jump to" for groups** — rules defined on inner blocks of a group (4A, 4B…) were not evaluated or applied
- **Conditional logic "Jump to"** — logic was applied to all blocks instead of only the currently displayed block
- **Variables (@1, @2, etc.) in groups** — replacement variables now work correctly in titles and descriptions of group blocks and their inner questions
- **Dropdown — unwanted auto-advance** — the form no longer auto-advances during typing; navigation happens only on explicit selection (click or Enter)

---

## [1.3.0] — 2026-01-18

### Added
- **Multi-arch Docker support** — `docker-compose.yml` (universal, auto-detect), `docker-compose.amd64.yml`, `docker-compose.arm64.yml`; adjusted healthchecks per architecture; full documentation in DEPLOY-PORTAINER.md
- **Column selector** on the responses page — gear button opens a dropdown to choose visible columns; checkboxes per question; "Show all / Reset" button; Date always visible; first 4 questions shown by default
- **Share dialog** — "Share" button in the builder (when published); 4 modes: direct link, customizable shortcode, embed (iframe), downloadable QR code (via `qrcode` library)
- **User autocomplete for sharing** — replaces the plain email field; searches all non-admin users by name or email; 300ms debounce; shows name + email in suggestions
- **3 permission levels for form sharing** — Read, Edit, Administrator; users with Edit/Admin can access the builder; all three can view responses; Admin can manage shares; inline permission change via dropdown
- **Custom slug** — editable in form settings (before the Branding section)
- **Public forms at root URL** — forms accessible at `/{slug}` directly; old `/f/[slug]` URLs redirect automatically; share link and admin URL updated accordingly
- **Dashboard redesign** — gradient background, 4 stat cards (Total, Published, Draft, Responses), glassmorphism header, redesigned form cards with color indicator bar, modern status badges, animated hover effects
- **Responses page redesign** — 3 stat cards, gradient table header with alternating rows, dates on two lines (day + time), clickable pagination, animated modals with blur
- **Shared form access** — users with Edit or Admin permission can access the builder; all three levels can view responses
- **Form duplication fix** — duplicated form appears immediately in the list without page reload
- **Custom fonts loading** on public forms — Google Fonts loaded automatically; custom fonts now render correctly
- **Webhook status indicator** per response — green (all ok), red (all failed), orange (partial), grey (not sent yet); updates after each send/resend
- **Group block in response viewer** — inner fields displayed in detail modal and exported as separate columns in CSV/XLSX
- **Mobile optimization** for public form — improved touch interface, adapted font sizes and buttons, responsive padding
- **Progress bar** — configurable position (top/bottom/left/right) and size (small/medium/large)
- **Custom fonts management** (`/admin/fonts`) — add/remove Google Fonts; live preview; auto-initialized with 20 default fonts; popular font suggestions; available in theme selector
- **Advanced themes** — background types: solid color, gradient (2 colors + 8 directions + opacity 0-100%), background image (upload + opacity 0-100%); live preview in builder
- **SMTP — Sender Name** — new field to customize the display name in emails
- **Time block** — time picker or time range (start/end); customizable labels; modern design with clock icon; works in builder and public form; compatible with logic and export
- **Per-response webhook replay** from the responses page
- **Nextcloud integration** in admin panel
- **Template library** in admin panel

### Fixed
- **Dashboard cache** — new forms appear immediately without manual reload (`force-dynamic` rendering)
- **Phone block render** in public form
- **Dropdown render** in public form — now renders a real autocomplete select
- **Image upload in Docker** — 404 resolved for standalone Docker deployment
- **SMTP sender name** initialization — `webhookStatus` column added automatically if missing

---

## [1.0.0] — 2024-xx-xx

### Added
- Initial release
- Authentication (register, login, logout, forgot/reset password)
- Visual drag-and-drop form builder
- Core block types: short text, long text, email, phone, number, multiple choice, dropdown, date, website, welcome screen, thank-you screen
- Conditional logic (show/hide/jump/require) with visual builder
- Basic webhook support (POST/GET/PUT/PATCH, JSON/FORM)
- Basic theme customization (colors, fonts, button/input styles)
- Import/export forms as JSON
- Response viewer with XLSX export
- Partial response tracking
- User management (admin panel)
- Password reset via email (Nodemailer)
- SQLite database via Prisma ORM
- Docker deployment (multi-stage Dockerfile)
- Default admin account seeded on first run
