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
- [Block types](#block-types)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start-local-development)
- [Docker deployment](#docker-deployment)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
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
| 📊 **PDF reports** | Scheduled, e-mailed statistical summaries with charts and breakdowns |
| 🛡️ **Compliance** | GDPR retention & erasure, audit trail, anti-bruteforce, IP allow/deny lists |
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
- **Form settings** — progress bar (position, size), question numbering, animations, branding, custom slug, site logo display (position + alignment).

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
- **CSV export** (UTF-8 with BOM, opens straight in Excel), including group inner fields and repeater iterations as separate columns.
- Partial and completed response tracking.
- **Webhook status indicator** per response (green / orange / red / grey) with one-click replay.
- **Document status per routing circuit** — accepted by the server / failed / not concerned / never sent — showing date and recipients, with one-click replay and a direct download of the filled document.

### 📤 Outputs & integrations

- **Webhooks** — POST/GET/PUT/PATCH to external URLs, custom field mapping with drag-and-drop reordering and search, custom value templates (`{field:blockId}`, `{date:dd-MM-YYYY}`, `{entry_id}`…), and human-readable labels rather than raw slugs.
- **Word document generation** — attach a `.docx` template whose tokens are replaced by the answers, then e-mail the filled document as an attachment. Visual table of available fields (copyable token, possible answers, whether the token is actually present in the template), loop tokens for repeaters, `{case_…}` checkbox tokens rendering ☒/☐ so a blank printed template stays fillable by hand, and a warning for unknown tokens. **Tokens stay stable when a question or an option is renamed.**
- **Conditional e-mail routing** — one circuit per service, each with its own conditions, recipients, subject and body, so only the people concerned are notified. Conditions reuse the form-logic operators and are collapsed by default.
- **Periodic PDF reports** — a *Rapports* modal turns responses into a formatted PDF and mails it on a schedule.
- **Optional PDF output** — through an external [Gotenberg](https://gotenberg.dev/) container declared in the admin panel.
- **JSON import / export** of forms, and form duplication.

<details>
<summary><b>More about periodic PDF reports</b></summary>

- **Period** — rolling window (last N days), current month, previous month, since the last report (no response ever counted twice), fixed date range, or since creation. An optional **closing date** freezes the corpus permanently, with an option to send one final report that evening. That date does *not* stop the form from accepting responses.
- **Content** — seven independently toggleable sections: key indicators (total, daily average, change against the equivalent previous period, busiest day, fill rate), a response histogram, choice breakdowns in percentages with bars, numeric statistics rendered as **ratings on their declared scale** with a per-value distribution, free-text answers, per-question fill rate, and a table of the latest responses.
- **Delivery** — daily, weekly or monthly scheduling at quarter-hour precision, multiple recipients, subject and HTML body accepting tokens (`{form_title}`, `{period}`, `{response_count}`…).
- A **live figures bar** at the top of the modal is computed by *the same function as the PDF*, so what it announces is literally what the PDF will contain. "Download the PDF" and "Send now" let you check before scheduling anything.
- Scheduling relies on an **in-process timer** — no external cron to set up. A container down for a week sends one report on restart, not seven. Deployments that prefer to drive it themselves can call `POST /api/internal/reports/run`.

</details>

### 🛠 Administration

| Panel | What it does |
|-------|--------------|
| **Users** | Create, edit and delete accounts; deleting an account moves its forms to the trash rather than destroying them |
| **GDPR** (`/admin/gdpr`) | Configurable retention (default 36 months) with manual purge; cross-form search for a person's responses with a **review-then-act** export (Excel portability sheet or nominative PDF) and right-to-erasure deletion; optional GDPR notice on welcome/thank-you screens |
| **Security** (`/admin/security`) | Anti-bruteforce login protection (max attempts, time window, block duration), IP whitelist/blacklist, live list of blocked addresses, e-mail alert on repeated failed logins |
| **Activity log** (`/admin/logs`) | Searchable, filterable, paginated audit trail of logins, form lifecycle and user management; Excel export matching the current filters; configurable retention with manual purge |
| **Trash** (`/admin/trash`) | Soft-deleted forms with restore and permanent delete; orphaned forms (deleted owner) carry an amber badge and require owner reassignment before restoration |
| **Customization** | Site name, logo and favicon applied globally; login page background (solid, gradient or blurred image) and link visibility, with a pixel-identical live preview |
| **Documents** (`/admin/documents`) | Declare the external PDF converter with a connection test; PDF output only becomes selectable once a test succeeds |
| **Fonts** | Add and remove Google Fonts, available in the theme editor |
| **SMTP** | Mail server configuration with a test send |
| **Database** | Backup and restore |
| **Templates & Nextcloud** | Template library and Nextcloud integration |

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
| Multiple Choice | Single or multi-select (with optional "Other" free-text option) |
| Image Selection | Choices illustrated with clickable images (grid or stacked) |
| Dropdown | Searchable list with optional free input and dynamic filtering based on another block |
| Quantity | List of items with individual quantity inputs |
| Date | Native date picker |
| Advanced Date | Visual calendar with date-range support and configurable min/max constraints |
| Time | Time picker or time range |
| File Upload | File attachment |
| Signature | Touch/mouse signature pad |
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
| PDF conversion | Optional external [Gotenberg](https://gotenberg.dev/) container |
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
| `REPORT_SCHEDULER` | In-process report scheduler; `0` disables it (drive `/api/internal/reports/run` from your own cron instead) | `1` |
| `REPORT_SCHEDULER_INTERVAL_MINUTES` | How often due reports are checked, 1–60 | `5` |
| `MIGRATION_AUTO_REPAIR` | Automatic one-shot recovery of a blocked migration at container start-up; `0` opts out | `1` |

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
│   ├── lib/                 # Auth, Prisma, e-mail, docx, PDF, security, GDPR, audit log
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
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed the database with default data |

> [!NOTE]
> Local development uses `db:push`, while Docker replays `prisma/migrations/` with `migrate deploy`.
> **Any schema change needs a migration file**, or it will never reach production.

---

## Security

- Passwords hashed with **bcrypt**; JWT tokens with expiration in **HTTP-only cookies**.
- Server-side validation and authorization checks on every protected API route.
- **Anti-bruteforce** login protection with configurable thresholds, plus IP whitelist/blacklist enforced at the edge in the middleware (fails open on a transient outage, so a network glitch never locks everyone out).
- **Audit trail** of logins, form lifecycle and user management, with e-mail alerts on repeated failed logins — exactly one alert per failure cycle, not one per attempt.
- **Reverse-proxy aware** — `X-Forwarded-For` is only trusted from the addresses listed in `TRUSTED_PROXY_IPS`, so a client cannot spoof its IP to escape a blacklist.
- **Word templates stored outside `public/`** and reachable only through authenticated routes; filled documents are regenerated on demand rather than written to disk, so no file full of personal data accumulates.
- **Form access passwords** stored as bcrypt hashes and never returned to the browser; the unlock cookie derives from the hash, so changing the password revokes every access already granted.
- **GDPR by design** — retention purges and data-subject exports/deletions only ever act on entries the administrator has explicitly reviewed, and personal values never leak into the activity log.

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
