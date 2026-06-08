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

### Slow First Start on ARM64
The ARM64 build takes longer (especially on Raspberry Pi). The healthcheck `start_period` is adjusted accordingly — wait up to 2 minutes on first start.

### SMTP Not Working
Use the SMTP test button in the admin panel (`/admin/smtp`) to verify your configuration. Check that your SMTP provider allows the connection from your server IP.
