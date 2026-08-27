# Deploying EduCRM to a VPS

Backend (Node/Express + SQLite) runs under PM2; the frontend (React/Vite) is
built to static files and served by Nginx, which also reverse-proxies `/api`
to the backend. Tested layout: Ubuntu 22.04+, but any systemd-based distro
works the same way.

## 1. Server prerequisites

```bash
# Node 20 LTS (matches what this project was built/tested against)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git build-essential

# PM2 — keeps the backend running, restarts it on crash and on reboot
sudo npm install -g pm2

# Certbot — free TLS cert (optional but strongly recommended)
sudo apt-get install -y certbot python3-certbot-nginx
```

## 2. Get the code onto the server

```bash
sudo mkdir -p /var/www/educrm
sudo chown $USER:$USER /var/www/educrm
git clone <your-repo-url> /var/www/educrm
cd /var/www/educrm
```

## 3. Backend setup

```bash
cd /var/www/educrm/backend
npm ci --omit=dev          # production install, respects package-lock.json
cp .env.example .env
```

Edit `.env` and set, at minimum:

```bash
NODE_ENV=production
PORT=5001
JWT_SECRET=$(openssl rand -base64 48)   # generate one, paste the output in
CLIENT_URL=https://crm.example.com      # your real domain, no trailing slash
# DB_PATH=/var/lib/educrm/crm.db        # optional: keep the DB outside the repo dir
```

The app **refuses to start** in production if `JWT_SECRET` is missing/still
the placeholder, or if `CLIENT_URL` is unset — this is intentional, don't
work around it.

Start it with PM2:

```bash
mkdir -p /var/www/educrm/logs
pm2 start ecosystem.config.js
pm2 save                # persist the process list
pm2 startup             # prints a systemd command — run the command it prints
                         # so PM2 (and this app) survive a server reboot
```

Verify: `curl http://127.0.0.1:5001/api/health` → `{"status":"ok",...}`

Create the first admin account — **do not run `seed.js` here**: that script
deletes and replaces students/groups/payments/etc. with fake demo data and
is for local development only. Instead:

```bash
node create-admin.js   # interactive prompt, password entry is hidden
```

(Alternatively, set `INITIAL_SUPERADMIN_EMAIL` and `INITIAL_SUPERADMIN_PASSWORD`
in `.env` *before* the first `pm2 start` — the app creates that account
automatically on first boot if both are set. There is no default admin
account in production; unlike earlier versions of this project, nothing
with a hardcoded password is ever created automatically.)

## 4. Frontend build

```bash
cd /var/www/educrm/frontend
npm ci
npm run build            # picks up .env.production (VITE_API_URL=/api) automatically
```

This produces `frontend/dist/` — the Nginx config below serves it directly.
There is nothing to "run" for the frontend; it's static files.

## 5. Nginx

```bash
sudo cp /var/www/educrm/deploy/nginx.conf.example /etc/nginx/sites-available/educrm
sudo nano /etc/nginx/sites-available/educrm   # replace crm.example.com with your real domain
sudo ln -s /etc/nginx/sites-available/educrm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default    # avoid the default site clashing on port 80
sudo nginx -t && sudo systemctl reload nginx
```

Point your domain's DNS A record at the server's IP before the next step.

```bash
sudo certbot --nginx -d crm.example.com
```

Certbot edits the Nginx config in place to add HTTPS and a port 80 → 443
redirect, and sets up auto-renewal.

## 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable
```

Port 5001 (the backend) should **not** be opened externally — Nginx reaches
it over `127.0.0.1`, which stays reachable regardless of the firewall.

## 7. Verify

- `https://crm.example.com` loads the login page
- Log in with the seeded admin account and confirm the dashboard loads
- `pm2 status` shows `educrm-backend` as `online`
- `pm2 logs educrm-backend` shows no errors

## Redeploying after a code change

```bash
cd /var/www/educrm
git pull

cd backend
npm ci --omit=dev
pm2 restart educrm-backend

cd ../frontend
npm ci
npm run build   # Nginx serves the new dist/ immediately, no reload needed
```

## Database backups

The whole database is one file (`backend/crm.db`, or wherever `DB_PATH`
points). A daily copy is enough for a project this size:

```bash
# crontab -e
0 3 * * * cp /var/www/educrm/backend/crm.db /var/backups/educrm-$(date +\%F).db
```

Keep backups off the same disk (rsync/scp them elsewhere) for real disaster
recovery — a local copy only protects against application-level mistakes,
not disk failure.

## What NOT to change for a "production-ready" deploy

These are already handled — don't re-introduce them:
- `JWT_SECRET`/`CLIENT_URL` startup guards in `backend/src/app.js`
- `trust proxy` is set in `app.js` (needed for `express-rate-limit` and
  `req.ip` to see the real client IP through Nginx)
- CORS only allows `CLIENT_URL` when `NODE_ENV=production` (see `app.js`)
- `helmet()` + `compression()` are already wired in
- PM2 runs the backend in `fork` mode with a single instance — better-sqlite3
  is a single-writer database; running multiple instances against the same
  file risks `SQLITE_BUSY` errors under write load. If you outgrow SQLite,
  migrate to Postgres (the codebase's `query()` wrapper already speaks
  `$1`-style placeholders internally) before scaling instances.
