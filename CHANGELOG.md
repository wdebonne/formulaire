# Changelog

All notable changes to FormBuilder Standalone are documented here.

> **Version française** : [CHANGELOG.fr.md](CHANGELOG.fr.md)

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
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
