# Deploying on Portainer

> **Version française** : [DEPLOY-PORTAINER.md](DEPLOY-PORTAINER.md)

This guide explains how to deploy FormBuilder Standalone on Portainer using Docker Compose.

---

## Prerequisites

- Portainer installed and accessible
- A Git repository (GitHub, GitLab, etc.) containing the source code
- Environment variables configured (see `.env.example`)

---

## 1. Deploy via Portainer (Git Repository)

1. Log in to Portainer
2. Go to **Stacks** → **Add stack**
3. Select **"Repository"**
4. Configure your Git repository:
   - **Repository URL**: `https://github.com/your-account/your-repo.git`
   - **Repository reference**: `main` (or your branch)
   - **Compose path**: `docker-compose.yml`
5. Under **Environment variables**, add your variables:
   ```
   DATABASE_URL=file:./dev.db
   JWT_SECRET=your-secure-jwt-secret
   APP_URL=https://your-domain.com
   SMTP_HOST=smtp.your-provider.com
   SMTP_PORT=587
   SMTP_USER=your-smtp-user
   SMTP_PASS=your-smtp-password
   SMTP_FROM=noreply@your-domain.com
   ```
6. Click **"Deploy the stack"**

---

## 2. Docker Files Structure

The project includes:

| File | Description |
|------|-------------|
| `Dockerfile` | Optimized multi-stage build for Next.js |
| `docker-compose.yml` | Universal configuration (auto-detects architecture) |
| `docker-compose.amd64.yml` | AMD64/x86_64 processors (Intel, AMD, standard VPS) |
| `docker-compose.arm64.yml` | ARM64 processors (Raspberry Pi 4/5, Apple Silicon M1/M2/M3) |
| `.dockerignore` | Files excluded from the build context |

### Choosing the Right docker-compose File

| Architecture | Example Servers | File to Use |
|-------------|-----------------|-------------|
| **AMD64 / x86_64** | Intel/AMD servers, standard VPS | `docker-compose.amd64.yml` |
| **ARM64 / aarch64** | Raspberry Pi 4/5, Apple Silicon, Oracle Cloud ARM | `docker-compose.arm64.yml` |
| **Auto-detect** | Any server | `docker-compose.yml` |

> **Tip**: Use `docker-compose.yml` for automatic architecture detection. If you encounter compatibility issues, switch to the architecture-specific file.

#### How to check your server's architecture

```bash
# Linux / macOS
uname -m
# Returns "x86_64" (AMD64) or "aarch64" (ARM64)

# Windows (PowerShell)
$env:PROCESSOR_ARCHITECTURE
# Returns "AMD64" or "ARM64"
```

---

## 3. Persistent Volumes

Docker Compose automatically configures:

| Volume | Content |
|--------|---------|
| `sqlite-data` | SQLite database (`/app/prisma/data`) |
| `uploads-data` | Uploaded files (`/app/public/uploads`) |
| `templates-data` | Word `.docx` templates (`/app/storage`) |

> The database lives in its own `/app/prisma/data` subdirectory (not directly in `/app/prisma`) so the persistent volume doesn't overlay the `schema.prisma` and migration files bundled in the image.

> ⚠️ The `templates-data` volume was added after the first version of the stack. When updating an existing deployment, **recreate the container** (`docker compose up -d --force-recreate`, or a full stack redeploy in Portainer) rather than restarting it — without that volume, imported templates would be lost on every redeployment.

> That directory sits deliberately **outside `/app/public`**: files under `public/uploads` are served without authentication, which would be a poor fit for a template carrying an organisation's letterhead. Templates are only reachable through authenticated routes.

> Make sure these volumes are **not recreated** on each redeployment, otherwise your data will be lost.

---

## 4. Accessing the Application

Navigate to `http://[your-server]:3110`

The port mapping is `3110:3000` (host:container).

---

## 5. First Login

After deployment, connect with:

| Field | Value |
|-------|-------|
| **Email** | `admin@formbuilder.local` |
| **Password** | `admin123` |

> **Change this password immediately!**

Or create a new account at `/register`.

---

## 6. Public Form URLs

Public forms are accessible directly at the root of the site:

- Example: `https://www.yoursite.com/my-form`
- Old URLs `/f/[slug]` are automatically redirected to the new structure

---

## 7. Site Customization

After logging in as admin, go to **Admin → Customization** (`/admin/customization`) to set:

- **Site name** — displayed in the dashboard header, browser tab, and login page
- **Logo** — replaces the default "FB" icon in the dashboard header and login page (recommended: 200×50 px)
- **Favicon** — shown in browser tabs (recommended: 32×32 px)

Further down the same page, the **Login page** card lets you customize:

- Whether the **"Forgot password?"** link is shown
- The **page background** — solid color, gradient (with direction and custom colors), or an image with an **adjustable blur** that creates a fade effect behind the login card
- The **"Allow registrations"** toggle — a shortcut to the same setting as the General settings section

A live preview shows exactly how the login page will look before you save.

Changes take effect immediately on the next page load.

---

## 8. Security (Anti-bruteforce & IP Access Control)

Go to **Admin → Security** (`/admin/security`) to configure:

- **Brute-force protection** — enable/disable, maximum failed login attempts, attempt time window, and resulting block duration
- **IP whitelist** — addresses that always bypass blocking, regardless of failed attempts
- **IP blacklist** — addresses rejected outright (HTTP 403) before reaching the application, enforced directly in `middleware.ts`
- **Currently blocked IPs** — live list with failed attempt count and remaining block time, with the option to unblock manually

> Blacklist/whitelist changes can take up to 60 seconds to propagate, since the edge middleware refreshes its IP cache from the database on that interval.

---

## 9. GDPR (Retention & Data Subject Rights)

Go to **Admin → GDPR** (`/admin/gdpr`) to configure:

- **Response retention period** — enable/disable and set a duration in months (default legal retention: 36 months, with a one-click reset); the panel shows how many responses currently exceed that period (broken down per form) before any purge — deletion is **always triggered manually**, there is no scheduled job
- **Search & data subject rights** — global, cross-form search for responses belonging to a person (name, email, or any text within the submitted data); results must be reviewed and ticked/unticked before acting, then:
  - **Export** as an Excel portability sheet (plain-text values) or a nominative PDF summary ("Form — Submission date") to hand to the person
  - **Delete** (right to erasure) the selected responses, with confirmation

> The PDF export requires `pdfkit` to be present in the built image (see [Troubleshooting](#troubleshooting) below if the export fails with a 500 error after an update).

---

## 10. Activity Log / Audit Trail

Go to **Admin → Logs** (`/admin/logs`) to review and configure:

- **Activity log** — searchable, filterable, paginated record of logins (who, IP address, success/failure and reason), form lifecycle events (create, update, publish/unpublish, delete, restore, duplicate, versions), and user management actions (create, update, delete); filter by action/category, status, date range, or free-text search, then export the current view to Excel
- **Retention** — enable/disable and set a duration in days (default: 365); the panel shows how many entries currently exceed that period before any purge — deletion is **always triggered manually**, there is no scheduled job
- **Failed-login email alerts** — configured alongside the anti-bruteforce settings in **Admin → Security**: enable, set the consecutive-attempt threshold, and the address that should receive the alert; exactly one email is sent per failure cycle (the counter resets on a successful login or a new time window), not one per attempt past the threshold

---

## 11. Word Documents & PDF Conversion

A form can carry a Word template whose tokens are replaced by the answers, the filled document then being sent as an e-mail attachment. Everything is configured from the form's responses page, through two buttons in the top bar: **Document template** and **Sending e-mail**. Filling the `.docx` needs no external dependency — only **PDF output** requires an extra service.

### Enabling PDF output (optional)

No faithful `.docx` → PDF converter exists in pure JavaScript: preserving a Word template's header, tables and corporate fonts requires LibreOffice. Rather than inflating the application image by several hundred megabytes, conversion is delegated to a dedicated container.

Add the service to your `docker-compose.yml`:

```yaml
  gotenberg:
    image: gotenberg/gotenberg:8
    container_name: gotenberg
    restart: unless-stopped
```

Then, in **Admin → Documents** (`/admin/documents`), enter `http://gotenberg:3000` and click **Test connection**.

- The PDF option only appears in forms **after a successful test**
- Changing the address invalidates the verification — test it again
- The server re-checks availability on every save, so a PDF setting left in the database cannot take effect once the converter is removed

> Don't publish Gotenberg's port: the service has no authentication. Both containers share the Compose network, so they reach each other by service name without any port mapping.

---

## Updating the Application

To update to a newer version in Portainer:

1. Pull the latest code to your Git repository
2. In Portainer, go to your stack
3. Click **"Update the stack"** (or **"Redeploy"**)

The build process will run again with the latest code.

---

## Troubleshooting

### Architecture Compatibility Error
If the image doesn't start with a format error, verify you're using the correct docker-compose file for your architecture.

### Container Restarting in a Loop
Check logs with:
```bash
docker logs formbuilder
```

### Empty Database After Restart
Ensure the `sqlite-data` volume is persistent and not recreated on each deployment.

### `Error: P3009` — a failed migration blocks all the others

A failed migration leaves a blocking row in the `_prisma_migrations` table, **inside the database volume**. Fixing the offending SQL and rebuilding the image therefore does not clear it: `prisma migrate deploy` keeps refusing to do any work, the entrypoint exits with an error, and the container restarts in a loop.

**Since the version that includes automatic recovery, a plain redeploy is enough**:

```bash
git pull
docker compose build
docker compose up -d --force-recreate
```

On start-up, if `migrate deploy` fails, the entrypoint identifies the blocking migration (`scripts/failed-migrations.js`), marks it as rolled back so Prisma replays it, and retries **once**. The logs then show:

```
⚠️  Migration failed — looking for a blocking failed migration...
   • 20260609000000_form_userid_nullable — A migration failed to apply...
↩️  Marking 20260609000000_form_userid_nullable as rolled back so it can be replayed
🔄 Retrying migrations...
✅ Recovered and migrations applied.
```

If the second attempt fails as well, the container stops with an explicit message rather than retrying forever: the cause lies elsewhere and needs manual investigation. Set `MIGRATION_AUTO_REPAIR=0` to disable this behaviour.

**Back up the `sqlite-data` volume before touching anything.**

#### Manual recovery

If you'd rather do it yourself (or automatic recovery is disabled):

```bash
# The entrypoint is failing, so --entrypoint is used to get a plain shell
docker compose run --rm --entrypoint sh app -c \
  "node ./node_modules/prisma/build/index.js migrate resolve --rolled-back <migration_name>"

docker compose up -d --force-recreate
```

`--rolled-back` tells Prisma to **replay** the migration, which is the right choice once the offending SQL has been fixed. If instead the migration was applied outside Prisma (a manual database fix), use `--applied` to mark it done without replaying it.

> Known case: `20260609000000_form_userid_nullable` failed with `NOT NULL constraint failed: Form_new.createdAt` on any database built by `migrate deploy` **that already contained forms** — on an empty database the copy touched no rows and passed silently. The cause and fix are detailed in the [CHANGELOG](CHANGELOG.md).

### 500 Error on PDF Export (GDPR)
If **Admin → GDPR → Export (PDF)** returns a 500 error, the running image predates the fix that bundles `pdfkit` correctly into the `standalone` build (the module and its `.afm` font files are missing from the image). Rebuild the image (`docker compose build --no-cache`, or trigger a full stack redeploy in Portainer) and restart the container — a plain restart without a rebuild won't pick up the fix.

### Build Failure — `npm run build` exits with code 1
Two common causes:
- **Incompatible Prisma version**: if `npx prisma generate` downloads a newer CLI than the project's pinned version (Prisma v6+ uses a different `url` config format), the build fails silently. The Dockerfile now uses `./node_modules/.bin/prisma generate` to prevent this.
- **Non-reproducible dependencies**: `package-lock.json` is now committed to the repository and the Dockerfile uses `npm ci` — if your image still uses `npm install`, rebuild from the latest code (`docker compose build --no-cache`).

### Slow First Start on ARM64
The ARM64 build takes longer (especially on Raspberry Pi). The healthcheck `start_period` is adjusted accordingly — wait up to 2 minutes on first start.

### SMTP Not Working
Use the SMTP test button in the admin panel (`/admin/smtp`) to verify your configuration. Check that your SMTP provider allows the connection from your server IP.
