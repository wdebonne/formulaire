<div align="center">

# FormBuilder Standalone

**A self-hosted form builder — visual editor, conditional logic, documents, reports, GDPR tooling.**

Build forms with a drag-and-drop editor, publish them at your own URL, collect responses,
and turn them into Word documents, PDF reports or webhook payloads — all on your own server,
with no third-party service in the loop.

[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-AMD64%20%2B%20ARM64-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node 24](https://img.shields.io/badge/Node-24%20LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

**English** · [Français](README.fr.md)

</div>

---

## Table of contents

- [At a glance](#at-a-glance)
- [Features](#features)
  - [Form building](#-form-building)
  - [Sharing & access control](#-sharing--access-control)
  - [Responses](#-responses)
  - [Outputs & integrations](#-outputs--integrations)
  - [Administration](#-administration)
  - [Accessibility](#-accessibility)
- [Block types](#block-types)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start-local-development)
- [Docker deployment](#docker-deployment)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [Tests & continuous integration](#tests--continuous-integration)
- [Security](#security)
- [Contributing, changelog & license](#contributing)

---

## At a glance

| | |
|---|---|
| 🧱 **24 block types** | From short text to signatures, repeaters, quantity grids and image selection |
| 🔀 **Visual logic** | Show / hide / jump / require, edited in a fullscreen flow builder with SVG arrows |
| 🎨 **Themes & branding** | Colors, Google Fonts, gradients, background images, logo placement |
| 🔐 **Access control** | Availability window, password, quota, one-per-device, sign-in required |
| 📄 **Word documents** | `.docx` templates filled with the answers and mailed to the right service |
| ✉️ **E-mails on response** | Acknowledgement to the respondent, notification to the team, conditional routing — with or without an attachment |
| 📊 **PDF reports** | Scheduled, e-mailed statistical summaries with charts and breakdowns |
| 📈 **On-screen statistics** | The same figures, read directly for any period, without generating a PDF |
| 🛡️ **Compliance** | GDPR retention & erasure, audit trail, anti-bruteforce, IP allow/deny lists |
| ♿ **Accessibility** | Public form usable by keyboard and screen reader — ARIA roles, managed focus, announced errors |
| 🐳 **Self-hosted** | Single Docker image, SQLite, multi-arch (AMD64 + ARM64) |

---

## Features

### 🏗 Form building

- **Drag-and-drop editor** — reorder blocks visually, resizable side panels, collapsible groups and repeaters, searchable block list.
- **24 block types** — see the [full list](#block-types) below.
- **Visual conditional logic** — show / hide / jump to / make required, based on previous answers. A text editor with block search, plus a fullscreen visual flow builder (Tripetto-style) with SVG orthogonal arrows, lane routing, rule badges and an inline rule editor.
- **Faithful live preview** — the center panel reacts instantly to every change (label, choices, type, theme) through Zustand. The **Aperçu** button auto-saves, then renders the form in a fullscreen iframe using *the exact same renderer as the published page* — no visual discrepancy is possible.
- **Version history** — automatic snapshot every 10 saves, plus manual versions with an optional label. Restore or delete any version from the builder or the dashboard, search across versions, and the current state is always snapshotted before a restore so nothing is ever lost silently.
- **Themes** — colors, Google Fonts, backgrounds (solid, gradient with 8 directions, image with opacity), button and input styles, choice background color. The builder preview reflects the active theme in real time.
- **Form settings** — progress bar (position, size), question numbering, animations, branding, custom slug, site logo display (position + alignment), entry resuming.

<details>
<summary><b>More about the visual logic builder</b></summary>

- Block cards laid out in a vertical flow, connected by rounded orthogonal SVG arrows carrying a colored badge summarising the rule.
- Left/right lane alternation with independent, non-overlapping lane pools per side, and a ±16 px stagger so two rules leaving the same block never share a start point.
- Click an arrow *or* a block name to open the rule editor; a sidebar lists every rule of the selected block so you can switch without large mouse movements.
- Searchable block dropdowns, sensible defaults (the *If* block is the source, the *Then* block is the next one), and the editor opens automatically after creating a rule.

</details>

### 🔗 Sharing & access control

- Public forms served at **`/{slug}`**, directly at the root of the site (legacy `/f/{slug}` URLs redirect).
- **Share modal** — direct link, customisable shortcode, `<iframe>` embed snippet, and a full QR code designer.
- **3 permission levels** — Read, Edit, Administrator — with user autocomplete when sharing.
- **Access options** (form card menu → *Options*) — go-live and closing dates, password protection, maximum number of responses, one response per device, restriction to signed-in users, and search-engine opt-out. Every rule is enforced **server-side both when the page is rendered and when a response is submitted**, with a customisable message per situation. The dashboard shows a *Scheduled* / *Closed* badge when a published form is not actually accepting responses.
- **Anti-spam** (same modal, *Anti-spam* section) — three cumulative measures, no captcha and no external service: a **honeypot field** invisible to respondents (filled in, the response is silently discarded), a **minimum fill time** attested by a server-signed timestamp (so it cannot be backdated, and a script POSTing straight to the submit endpoint without loading the page is refused), and a **rate limit per IP address and per form**. On by default for every form; each measure can be tuned or turned off.
- **Resuming an interrupted form** — the entry in progress is kept in the respondent's browser as they type. Should they come back after closing the tab, losing the network or running out of battery, a **resume** prompt hands back their answers and the question they had reached, instead of making them retype everything. On a long form, with repeaters and declarations spanning several iterations, that is the difference between a response and an abandonment. A *Brouillon enregistré* marker tells them so while they answer, without which closing the tab still feels like a risk. Can be turned off per form in *Paramètres*.
  - **Nothing leaves the device** — the draft lives in the respondent's browser, not on the server: no half-filled response is created in the database, so there is nothing more to retain or to purge under GDPR. It is cleared as soon as the response is sent, as it is when the respondent chooses to start over, and it expires on its own after 7 days.
  - **A signature is not kept** — it is an act, not an entry, and re-signing after an interruption is the honest behaviour; the resume prompt says so when the form carries one. **An already uploaded file is found again**: the response only carries its reference and the file already sits on the server, so resuming spares a re-upload.

<details>
<summary><b>QR code designer</b></summary>

Every module of the QR code is painted by hand on a canvas rather than delegated to a generic renderer, which allows:

- **Colors** — solid fill or gradient (linear with a free angle, or radial), plus a custom background.
- **Shapes** — four dot styles (square, rounded, dots, classy) and three eye styles.
- **Center logo** — uploaded from the machine or pulled from the site logo, square or circle, up to 35 % of the code.
- **Export** — PNG at 512, 1024 or 2048 px; the on-screen preview is rendered at full resolution and merely displayed smaller, so what you see is exactly what you download.

Scannability was verified by decoding the generated PNGs with both zbar and OpenCV: dot styles never affect decoding, a logo forces error-correction level **H** automatically, and the eye-style picker warns that non-square finder patterns are rejected by some readers.

</details>

<details>
<summary><b>How password protection works</b></summary>

The password is stored as a **bcrypt hash and never leaves the server** — the options modal only ever learns whether one is set. The unlock cookie is an HMAC derived from that hash, so **changing the password immediately revokes every access already granted**, with no session list to maintain. Attempts are throttled per IP and per form, deliberately separate from the account anti-bruteforce machinery so a respondent's typo can never blacklist them application-wide. A protected form does not even ship its questions in the gate screen's HTML.

*Known limitation:* the cookie is `SameSite=Lax`, so a password-protected form cannot be unlocked from inside a **cross-site** iframe embed. Password protection and cross-site embedding are mutually exclusive; the direct link works normally.

</details>

### 📊 Responses

- Response table with a **column selector** (choose which questions to display), pagination, and a detail modal.
- **Correct a recorded response** — the detail modal's *Modifier* button re-opens the answers in proper editable controls (checkboxes, dates, dropdowns, group and repeater fields) and stores the correction exactly as a respondent's answer would have been stored. The change is written to the activity log with the **list of edited fields, never their values**.
- **On-screen statistics** (`/forms/{id}/stats`) — choice breakdowns, ratings, per-question completion rates, response volume over time and recent verbatims, for the period of your choice. These are **exactly the PDF report's figures**, computed by the same function: reading a question's completion rate no longer requires generating a document.
- **Excel and CSV export, with a period filter** — the *Exporter* modal produces an `.xlsx` workbook (columns sized to their content) or a CSV (UTF-8 with BOM, opens straight in Excel), and restricts the export to a period — everything, last N days, current or previous month, a date range — instead of all or nothing. Both formats hold the same table: one row per response, one column per question, with group inner fields and repeater iterations expanded into separate columns. The modal states the row and column count before the download.
- **Attachments and signatures** — a file uploaded by the respondent downloads from the response detail, a signature is displayed there; both appear in the exports and in generated documents. Deleting a response deletes its files.
- **Webhook status indicator** per response (green / orange / red / grey) with one-click replay.
- **Document status per routing circuit** — accepted by the server / failed / not concerned / never sent — showing date and recipients, with one-click replay and a direct download of the filled document.

### 📤 Outputs & integrations

- **Webhooks** — POST/GET/PUT/PATCH to external URLs, custom field mapping with drag-and-drop reordering and search, custom value templates (`{field:blockId}`, `{date:dd-MM-YYYY}`, `{entry_id}`…), and human-readable labels rather than raw slugs. **Optional HMAC-SHA256 signature** (`X-Webhook-Signature` header, the GitHub/Stripe convention): set a shared secret and the receiver can verify the call really comes from this form, rather than from anyone who saw the URL go by.
- **External equipment catalog** — a multiple-choice or dropdown block can draw its options from an equipment-management application instead of a hand-typed list, showing only what is still available on the date answered earlier in the form, filtered by service, kind and category. A typed list ages: an item sold, ten tables bought, and the form still offers last year's stock.
- **Word document generation** — attach a `.docx` template whose tokens are replaced by the answers, then e-mail the filled document as an attachment. Visual table of available fields (copyable token, possible answers, whether the token is actually present in the template), loop tokens for repeaters, `{case_…}` checkbox tokens rendering ☒/☐ so a blank printed template stays fillable by hand, and a warning for unknown tokens. **Tokens stay stable when a question or an option is renamed.**
- **Conditional e-mail routing** — one circuit per service, each with its own conditions, recipients, subject and body, so only the people concerned are notified. Conditions reuse the form-logic operators and are collapsed by default.
- **Acknowledgement and team notification** — the attachment is optional: a circuit without a document sends a plain e-mail, **with no Word template required**. The recipient can be the address the respondent typed in (any *Email* block of the form), which gives the acknowledgement; a fixed address gives the team notification on every new response. Subject and body accept the same `{…}` tokens as templates, resolved even when no template exists.
- **Periodic PDF reports** — a *Rapports* modal turns responses into a formatted PDF and mails it on a schedule.
- **Optional PDF output** — through the office server of your **NextCloud** (Euro-Office, ONLYOFFICE, Nextcloud Office: nothing more to install) or a dedicated [Gotenberg](https://gotenberg.dev/) container, whichever you pick in the admin panel. Should the conversion fail at send time, the filled `.docx` goes out in place of the PDF rather than nothing at all.
- **JSON import / export** of forms, and form duplication.

<details>
<summary><b>More about periodic PDF reports</b></summary>

- **Period** — rolling window (last N days), current month, previous month, since the last report (no response ever counted twice), fixed date range, or since creation. An optional **closing date** freezes the corpus permanently, with an option to send one final report that evening. That date does *not* stop the form from accepting responses.
- **Content** — seven independently toggleable sections: key indicators (total, daily average, change against the equivalent previous period, busiest day, fill rate), a response histogram, choice breakdowns in percentages with bars, numeric statistics rendered as **ratings on their declared scale** with a per-value distribution, free-text answers, per-question fill rate, and a table of the latest responses.
- **Layout** — three densities (*Compact*, *Normal*, *Airy*) driving row heights, cards, chart height and the white space between blocks, plus an option to start each section on a new page. Only the blanks change, never the type size; *Normal* reproduces the original layout exactly.
- **Free-text answers** — either the last N distinct verbatims, or **every answer received** (duplicates included, 1 000 max per question). Either way, a long verbatim wraps over several lines instead of being truncated.
- **Delivery** — daily, weekly or monthly scheduling at quarter-hour precision, multiple recipients, subject and HTML body accepting tokens (`{form_title}`, `{period}`, `{response_count}`…).
- A **live figures bar** at the top of the modal is computed by *the same function as the PDF*, so what it announces is literally what the PDF will contain. "Download the PDF" and "Send now" let you check before scheduling anything.
- Scheduling relies on an **in-process timer** — no external cron to set up. A container down for a week sends one report on restart, not seven. Deployments that prefer to drive it themselves can call `POST /api/internal/reports/run`.

</details>

### 🛠 Administration

| Panel | What it does |
|-------|--------------|
| **Users** | Create, edit and delete accounts; deleting an account moves its forms to the trash rather than destroying them |
| **GDPR** (`/admin/gdpr`) | Configurable retention (default 36 months) with a manual **or daily automatic** purge; cross-form search for a person's responses with a **review-then-act** export (Excel portability sheet or nominative PDF) and right-to-erasure deletion; optional GDPR notice on welcome/thank-you screens |
| **Security** (`/admin/security`) | Anti-bruteforce login protection (max attempts, time window, block duration), IP whitelist/blacklist, live list of blocked addresses, e-mail alert on repeated failed logins |
| **Activity log** (`/admin/logs`) | Searchable, filterable, paginated audit trail of logins, form lifecycle and user management; Excel export matching the current filters; configurable retention with a manual **or daily automatic** purge |
| **Trash** (`/admin/trash`) | Soft-deleted forms with restore and permanent delete; orphaned forms (deleted owner) carry an amber badge and require owner reassignment before restoration |
| **Customization** | Site name, logo and favicon applied globally; login page background (solid, gradient or blurred image) and link visibility, with a pixel-identical live preview |
| **Documents** (`/admin/documents`) | Pick the PDF conversion engine — the configured NextCloud's office server, or a Gotenberg container — with a **connection test** and a **conversion test** that converts a witness document, names the path that answered and hands back the produced PDF; PDF output only becomes selectable once a test succeeds |
| **Catalog** (`/admin/catalog`) | Wire the equipment-management application (URL and token), test the connection and preview what it answers, filtered by service, kind, category and period. The token stays on the server: the screen only ever learns that one is set |
| **Fonts** | Add and remove Google Fonts, available in the theme editor |
| **SMTP** | Mail server configuration with a test send |
| **Database** | Backup and restore |
| **Templates & Nextcloud** | Template library and Nextcloud integration |

### ♿ Accessibility

The public form — the part respondents fill in — is built to be usable **by keyboard alone and with a screen reader**, targeting RGAA 4.1 (WCAG 2.1 AA).

- **Choice controls properly exposed** — single choice, image selection and Yes/No form a `radiogroup` of radio buttons, multiple choice a group of checkboxes; every option announces its state, and the group carries the question's heading along with whether it is required.
- **Full keyboard journey** — a choice group is a single tab stop and is traversed with the arrow keys; Enter and Space check an option. The *Advanced date* calendar's days are proper buttons, named with the full date.
- **Focus moved on every question change**, never taken from an input that already holds it; the thank-you screen is announced the same way.
- **Validation errors announced** (`role="alert"`) and tied to the field concerned.
- **Labels tied to their fields** — `<label for>` for native controls, `aria-labelledby` for button-based sets, in plain questions as well as in groups and repeaters.
- **Zoom left unhindered**, and modals handled as `dialog`s (focus taken, Escape closes).

**Known limitation**: the *Signature* block requires a pointing device (mouse, finger or stylus). That is the nature of the thing, not a markup shortfall — avoid it on a form that must be completable by keyboard alone. The frame announces the signature's state and how to provide it.

> If you deploy this application for a French local authority or public body, publishing an **accessibility statement** remains your responsibility: it depends on an audit of your own instance, theme and content included.

---

## Block types

| Block | Description |
|-------|-------------|
| Welcome Screen | Form introduction page (optional GDPR notice) |
| Short Text | Single-line input (optional auto-transform: UPPERCASE, Capitalize) |
| Long Text | Multi-line textarea |
| Email | Email field with configurable strict validation |
| Phone | Phone field (standard or international format, configurable digit count) |
| Address | Autocomplete via the official French Address API (BAN) — full address, or **town only** with its department and region shown in the suggestions |
| Number | Numeric input |
| Multiple Choice | Single or multi-select (with optional "Other" free-text option); options can be drawn from the equipment catalog |
| Image Selection | Choices illustrated with clickable images (grid or stacked) |
| Dropdown | Searchable list with optional free input, dynamic filtering based on another block; options can be drawn from the equipment catalog |
| Quantity | List of items with individual quantity inputs |
| Date | Native date picker |
| Advanced Date | Visual calendar with date-range support and configurable min/max constraints |
| Time | Time picker or time range |
| File Upload | Respondent file upload — formats and size capped per block, stored outside the public folder, downloadable only by people with access to the form |
| Signature | Mouse or finger signature pad, stored as a PNG image in the response (adjustable height and pen colour) |
| Slider | Numeric value with a slider |
| Website | URL with validation |
| Legal | Required consent checkbox |
| Statement | Informational text (no input) |
| Yes / No | Two-button yes/no question |
| Group | Several questions on the same page |
| Repeater | Dynamically repeat a set of questions |
| Thank-You Screen | Custom end page (optional "Restart" button, optional GDPR notice) |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | SQLite via [Prisma ORM](https://www.prisma.io/) |
| Auth | JWT (HTTP-only cookies) + bcrypt |
| UI | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| Drag & drop | [@dnd-kit](https://dndkit.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Email | [Nodemailer](https://nodemailer.com/) |
| Word templating | [docxtemplater](https://docxtemplater.com/) + [PizZip](https://github.com/open-xml-templating/pizzip) (MIT) |
| PDF generation | [PDFKit](https://pdfkit.org/) |
| PDF conversion | NextCloud office server (Euro-Office / ONLYOFFICE / Nextcloud Office) or a [Gotenberg](https://gotenberg.dev/) container — optional |
| Spreadsheets | [SheetJS](https://sheetjs.com/) (`xlsx`) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Deployment | Docker (multi-stage, multi-arch AMD64 + ARM64) |

> **Why docxtemplater and not Carbone?** Carbone moved to the *Carbone Community License* in v3.5.5, whose
> field-of-use restrictions are incompatible with this project's AGPLv3 licence. `docxtemplater` (MIT) is used instead.

---

## Quick start (local development)

### Prerequisites

- **Node.js 24** — the version the Docker image runs (`.nvmrc`). Anything from 18.17 will build, but it no longer matches production.
- npm or yarn

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
#    Edit .env — JWT_SECRET is mandatory (openssl rand -base64 32)

# 3. Initialize the database
npm run db:push
npm run db:seed

# 4. Start the dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### Default credentials

| Field | Value |
|-------|-------|
| Email | `admin@formbuilder.local` |
| Password | `admin123` |

> [!WARNING]
> **Change this password immediately after the first login.** You can also register a new account at `/register`.

---

## Docker deployment

```bash
docker compose up -d
```

The app runs on port **`3110`** by default (`http://localhost:3110`).

| File | Target |
|------|--------|
| `docker-compose.yml` | Universal — auto-detects the architecture |
| `docker-compose.amd64.yml` | Force AMD64 (Intel / AMD) |
| `docker-compose.arm64.yml` | Force ARM64 (Raspberry Pi, Apple Silicon) |

Three named volumes keep your data outside the image: `sqlite-data` (database), `uploads-data`
(uploaded images and files) and `templates-data` (private `.docx` templates).

Migrations are replayed automatically on start-up, with a **bounded auto-repair** of a migration
left blocking in `_prisma_migrations` (disable with `MIGRATION_AUTO_REPAIR=0`).

For Portainer and production deployment, see **[DEPLOY-PORTAINER.en.md](DEPLOY-PORTAINER.en.md)**.

---

## Environment variables

### Core

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite file path | `file:./dev.db` |
| `JWT_SECRET` | Secret for JWT tokens and internal endpoint authentication — **32 characters minimum** | *(required in prod)* |
| `APP_URL` | Public URL of the deployment; an `https://` value makes the auth cookie `Secure` | `http://localhost:3110` |
| `NEXT_PUBLIC_APP_URL` | Public URL used to build links inside e-mails | `http://localhost:3000` |

### E-mail (SMTP)

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender e-mail address | `noreply@formbuilder.local` |
| `SMTP_FROM_NAME` | Sender display name | `FormBuilder` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `TRUSTED_PROXY_IPS` | Comma-separated IPs of trusted reverse proxies. When set, `X-Forwarded-For` is only honoured for connections coming from these addresses — leave empty when the app is exposed directly | *(empty)* |
| `DOCUMENT_STORAGE_DIR` | Private directory holding the uploaded `.docx` templates | `<project>/storage/templates` |
| `RESPONSE_UPLOAD_DIR` | Private directory holding the files uploaded by respondents | `<project>/storage/response-files` |
| `SCHEDULER` | In-process timer (periodic reports **and** retention purges); `0` disables it — drive `/api/internal/reports/run` and `/api/internal/retention/run` from your own cron instead. `REPORT_SCHEDULER`, the historical name, is still honoured | `1` |
| `SCHEDULER_INTERVAL_MINUTES` | How often due work is checked, 1–60. `REPORT_SCHEDULER_INTERVAL_MINUTES` is still honoured | `5` |
| `MIGRATION_AUTO_REPAIR` | Automatic one-shot recovery of a blocked migration at container start-up; `0` opts out | `1` |
| `CATALOG_API_URL` | Address of the equipment-management application. **Fallback only**: the wiring is set in Admin → Catalog, which takes precedence | *(empty)* |
| `CATALOG_API_TOKEN` | Read-only API token for the catalog, same caveat | *(empty)* |

---

## Project structure

```
formbuilder-standalone/
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Replayed by migrate deploy in Docker
│   └── seed.ts              # Default data (themes, admin user)
├── scripts/                 # Start-up helpers (DB init, migration repair)
├── src/
│   ├── app/
│   │   ├── [slug]/          # Public form page (/{slug}) + access gate screen
│   │   ├── admin/           # Admin panels (users, security, logs, GDPR, trash…)
│   │   ├── builder/[id]/    # Form builder editor
│   │   ├── dashboard/       # Forms list
│   │   ├── forms/[id]/
│   │   │   ├── preview/     # Auth-protected preview (draft or published)
│   │   │   └── responses/   # Response viewer
│   │   └── api/             # REST API endpoints
│   ├── components/
│   │   ├── builder/         # Builder UI (blocks, logic, theme, webhooks, QR…)
│   │   ├── forms/           # Options, report, document and e-mail modals
│   │   └── ui/              # Generic UI components (Button, Dialog, Input…)
│   ├── lib/                 # Auth, Prisma, e-mail, docx, PDF, security, GDPR, audit log, accessibility
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand global state
│   └── types/               # TypeScript type definitions
├── storage/
│   └── templates/           # Private .docx templates — never served statically
├── docker-compose.yml       # Universal Docker Compose (auto-detects arch)
├── docker-compose.amd64.yml # AMD64-specific
├── docker-compose.arm64.yml # ARM64-specific (Raspberry Pi, Apple Silicon)
└── Dockerfile               # Multi-stage build
```

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm start` | Start the production server |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Re-run tests on every change |
| `npm run typecheck` | Check types without emitting |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed the database with default data |

> [!NOTE]
> Local development uses `db:push`, while Docker replays `prisma/migrations/` with `migrate deploy`.
> **Any schema change needs a migration file**, or it will never reach production.

---

## Tests & continuous integration

The pure/server module split followed throughout the project makes the business logic directly
testable: `report-stats.ts`, `catalog.ts`, `form-options.ts`, `condition-eval.ts`,
`response-format.ts` and `document-fields.ts` import neither Prisma, nor `next/headers`, nor
nodemailer.

```bash
npm test          # the whole suite, in under a second
npm run typecheck # tsc --noEmit, tests included
```

What the suite guarantees: choice labels resolved at display time without ever rewriting what is
stored, an option never counted twice depending on its stored shape, attachments and signatures
copied untouched, anti-spam protections on by default, the closing date capping every report period,
and Word template tokens surviving a question being renamed.

CI (`.github/workflows/ci.yml`) checks types, runs the tests and builds the application on every
push. A second job **replays the migrations on a seeded database**: a migration that rebuilds a table
passes on an empty database and fails on one holding data — which is how a migration once shipped
broken and blocked existing instances.

> [!NOTE]
> API routes, React components and server modules are not covered by automated tests: CI's
> `next build` keeps them compiling, and nothing more.

---

## Security

- Passwords hashed with **bcrypt**; JWT tokens with expiration in **HTTP-only cookies**.
- Server-side validation and authorization checks on every protected API route.
- **Anti-bruteforce** login protection with configurable thresholds, plus IP whitelist/blacklist enforced at the edge in the middleware (fails open on a transient outage, so a network glitch never locks everyone out).
- **Audit trail** of logins, form lifecycle and user management, with e-mail alerts on repeated failed logins — exactly one alert per failure cycle, not one per attempt.
- **Reverse-proxy aware** — `X-Forwarded-For` is only trusted from the addresses listed in `TRUSTED_PROXY_IPS`, so a client cannot spoof its IP to escape a blacklist.
- **Word templates stored outside `public/`** and reachable only through authenticated routes; filled documents are regenerated on demand rather than written to disk, so no file full of personal data accumulates.
- **Form access passwords** stored as bcrypt hashes and never returned to the browser; the unlock cookie derives from the hash, so changing the password revokes every access already granted.
- **GDPR by design** — data-subject exports and deletions only ever act on entries the administrator has explicitly reviewed. Retention purges, manual or automatic, always recompute their cutoff server-side and leave an audit entry; automatic deletion stays a switch you turn on, never a behaviour an upgrade imposes. Personal values never leak into the activity log.

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for the detailed audit.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[GNU Affero General Public License v3.0](LICENSE)

---

<div align="center">

*Inspired by [QuillForms](https://quillforms.com)*

</div>
