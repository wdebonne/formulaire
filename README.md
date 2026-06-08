# FormBuilder Standalone

A self-hosted, feature-rich form builder with a visual drag-and-drop editor, conditional logic, webhooks, themes, and multi-user management.

> **Version française** : [README.fr.md](README.fr.md)

---

## Features

### Form Building
- **Drag-and-drop editor** — reorder blocks visually with resizable panels
- **25+ block types** — see the [full list](#block-types) below
- **Visual conditional logic** — show/hide/jump/require blocks based on answers; text editor with block search + fullscreen visual flow builder (Tripetto-style) with SVG arrows, lane routing, and inline rule editor
- **Faithful live preview** — center panel updates in real-time on every change (label, choices, type, theme) via Zustand; the Aperçu button auto-saves then renders the form in a full-screen iframe using the exact same renderer as the published form — no visual discrepancy
- **Version history** — automatic snapshot every 10 saves + manual versions with optional label; restore or delete any version from the builder or dashboard; search across versions; current state always preserved before restore
- **Themes** — custom colors, fonts, backgrounds (solid, gradient, image), button and input styles, choice background color; the central editor preview reflects the active theme in real time (border radius, field style, colors)
- **Webhooks** — send responses to external URLs with custom field mapping, drag-and-drop reordering, and search
- **Form settings** — progress bar (position, size), question numbers, animations, branding, site logo display (position + alignment)

### Sharing & Publishing
- Public forms accessible at `/{slug}` directly from the root URL
- Share via direct link, shortcode, embed (iframe), or QR code
- Custom slug editable in settings
- 3 permission levels: **Read**, **Edit**, **Administrator**
- User autocomplete when sharing

### Admin Panel
- User management (create, edit, delete)
- **GDPR / RGPD** (`/admin/gdpr`) — configurable response retention period (default: 36-month legal retention) with manual purge of expired data; global cross-form search for a person's responses with review-then-act export (Excel portability sheet or nominative PDF summary) and right-to-erasure deletion; optional "GDPR notice" link/modal on Welcome and Thank-You screens
- **Security** — anti-bruteforce login protection (configurable max attempts, time window, block duration) and IP whitelist/blacklist with live view of currently blocked addresses
- Trash / soft delete with restoration and user reassignment
- **Site customization** — site name, logo, and favicon applied globally (dashboard header, browser tab, login page)
- **Login page customization** — show/hide the "forgot password" and "sign up" links, and set a custom background (solid color, gradient, or blurred image)
- Custom fonts management
- SMTP email configuration with test
- Nextcloud integration
- Database backup and restore
- Template library

### Responses
- View all responses per form
- Column selector (choose which fields to display)
- Export to Excel (XLSX)
- Partial and completed response tracking
- Per-response webhook replay
- Visual webhook status indicator (green / orange / red / grey)

---

## Block Types

| Block | Description |
|-------|-------------|
| Welcome Screen | Form introduction page |
| Short Text | Single-line input (optional auto-transform: uppercase, capitalize) |
| Long Text | Multi-line textarea |
| Email | Email field with configurable strict validation |
| Phone | Phone field (standard or international format, configurable digit count) |
| Address | Address field with autocomplete (French BAN API) |
| Number | Numeric input |
| Multiple Choice | Single or multi-select (with optional "Other" free-text option) |
| Image Selection | Choice illustrated with clickable images |
| Dropdown | Searchable list with optional free input and dynamic filtering based on another block |
| Quantity | List of items with individual quantity inputs |
| Date | Native date picker |
| Advanced Date | Visual calendar with date range support and configurable min/max constraints |
| Time | Time picker or time range |
| File Upload | File attachment |
| Signature | Touch/mouse signature pad |
| Slider | Numeric value with a slider |
| Website | URL with validation |
| Legal | Required checkbox |
| Statement | Informational text (no input) |
| Yes / No | Two-button yes/no question |
| Group | Group multiple questions on the same page |
| Repeater | Dynamically repeat a set of questions |
| Thank-You Screen | Custom end page (optional "Restart" button) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | SQLite via [Prisma ORM](https://www.prisma.io/) |
| Auth | JWT (HTTP-only cookies) + bcrypt |
| UI | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Email | [Nodemailer](https://nodemailer.com/) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Deployment | Docker (multi-stage, multi-arch AMD64 + ARM64) |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Initialize the database
npm run db:push
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default credentials

| Field | Value |
|-------|-------|
| Email | `admin@formbuilder.local` |
| Password | `admin123` |

> **Change this password immediately after first login.**

You can also register a new account at `/register`.

---

## Docker Deployment

```bash
docker compose up -d
```

The app runs on port `3110` by default (`http://localhost:3110`).

For Portainer and production deployment, see [DEPLOY-PORTAINER.en.md](DEPLOY-PORTAINER.en.md).

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite file path | `file:./dev.db` |
| `JWT_SECRET` | Secret key for JWT tokens | *(required in prod)* |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender email address | `noreply@formbuilder.local` |
| `SMTP_FROM_NAME` | Sender display name | `FormBuilder` |

---

## Project Structure

```
formbuilder-standalone/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Default data (themes, admin user)
├── src/
│   ├── app/
│   │   ├── [slug]/          # Public form page (/{slug})
│   │   ├── admin/           # Admin panel (users, fonts, SMTP, trash…)
│   │   ├── builder/[id]/    # Form builder editor
│   │   ├── dashboard/       # Forms list
│   │   ├── forms/[id]/
│   │   │   ├── preview/     # Auth-protected preview page (draft or published)
│   │   │   └── responses/   # Response viewer
│   │   └── api/             # REST API endpoints
│   ├── components/
│   │   ├── builder/         # Builder UI (blocks, logic, theme, webhooks…)
│   │   └── ui/              # Generic UI components (Button, Dialog, Input…)
│   ├── lib/                 # Auth, Prisma client, email, utilities
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand global state
│   └── types/               # TypeScript type definitions
├── docker-compose.yml       # Universal Docker Compose (auto-detects arch)
├── docker-compose.amd64.yml # AMD64-specific
├── docker-compose.arm64.yml # ARM64-specific (Raspberry Pi, Apple Silicon)
└── Dockerfile               # Multi-stage build
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed database with default data |

---

## Security

- Passwords hashed with bcrypt
- JWT tokens with expiration (HTTP-only cookies)
- Server-side validation on all API routes
- Authorization checks on all protected endpoints
- Anti-bruteforce login protection with configurable thresholds and IP whitelist/blacklist (`/admin/security`)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[GNU Affero General Public License v3.0](LICENSE)

---

*Inspired by [QuillForms](https://quillforms.com)*
