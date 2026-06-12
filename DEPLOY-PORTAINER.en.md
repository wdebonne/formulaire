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

> The database lives in its own `/app/prisma/data` subdirectory (not directly in `/app/prisma`) so the persistent volume doesn't overlay the `schema.prisma` and migration files bundled in the image.

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
