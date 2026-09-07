# Jalaram HR — Contabo VPS Go-Live Guide

**Stack:** Docker Compose — PostgreSQL, Redis, MinIO, NestJS, PostgREST, React, Nginx  
**Co-host:** Runs beside Afya-Sasa EMR on the same VPS (EMR `:8080`, HR `:8081`)

---

## 1. What you need

| Item | Example |
|------|---------|
| Contabo VPS | 4 GB RAM minimum, **8 GB recommended** |
| OS | Ubuntu 22.04 LTS |
| Domain | `hr.humasync.solutions` → A record `102.68.79.109` |
| Quick guide | **[go-live-humasync.md](go-live-humasync.md)** |

---

## 2. Server setup (once)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw fail2ban nginx certbot python3-certbot-nginx
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Deploy the app

```bash
sudo mkdir -p /opt/jalaramhr
sudo chown $USER:$USER /opt/jalaramhr
cd /opt/jalaramhr
git clone <YOUR_REPO_URL> .
```

### Configure environment

```bash
cp .env.production.example .env
nano .env
```

**Must change before go-live:**

```bash
openssl rand -base64 48   # use for POSTGRES_PASSWORD, JWT_ACCESS_SECRET, MINIO_ROOT_PASSWORD
```

Set:

- `PUBLIC_URL` and `FRONTEND_ORIGIN` → `https://hr.humasync.solutions`
- `VITE_SUPABASE_URL` → same as `PUBLIC_URL`
- `S3_PUBLIC_ENDPOINT` → `https://hr.humasync.solutions/minio`
- `SUPER_ADMIN_PASSWORD` → strong password (not the example default)

### First deploy (fresh database + super admin)

```bash
chmod +x scripts/deploy-contabo.sh ops/*.sh
FRESH_DB=1 bash scripts/deploy-contabo.sh
```

This will:

1. Build production containers (only nginx exposed on `127.0.0.1:8081`)
2. Apply all SQL migrations
3. Create one **SUPER_ADMIN** account
4. Run smoke test (health + login)

---

## 4. HTTPS (host nginx + Let's Encrypt)

Docker HR listens on **127.0.0.1:8081** only. Host nginx terminates TLS.

```bash
sudo cp infra/nginx-host-hr.conf.example /etc/nginx/sites-available/jalaram-hr
# Edit server_name if your domain differs
sudo ln -sf /etc/nginx/sites-available/jalaram-hr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hr.humasync.solutions
```

Test:

```bash
curl -fsS https://hr.humasync.solutions/api/v1/health
```

---

## 5. Co-host with Afya-Sasa on same Contabo VPS

| App | Docker nginx bind | Public domain |
|-----|-------------------|---------------|
| Afya-Sasa EMR | `127.0.0.1:8080` | `emr.humasync.solutions` |
| Jalaram HR | `127.0.0.1:8081` | `hr.humasync.solutions` |

Both use separate Docker volumes — databases do not mix.

---

## 6. Daily use — first login checklist

1. Open **https://hr.humasync.solutions**
2. Log in as super admin (`SUPER_ADMIN_EMAIL` from `.env`)
3. **Go-Live Checklist** in sidebar — complete setup steps
4. **Organization** — hospital name and logo
5. **Departments** → **Invite Staff** → create HEAD / FINANCE_ADMIN users
6. **Upload Rota** or **Department Rota** → publish week
7. **Payroll** → create period when ready

---

## 7. Backups (mandatory)

```bash
# Manual backup
bash ops/backup-postgres.sh

# Daily cron (2 AM UTC)
crontab -e
# 0 2 * * * cd /opt/jalaramhr && bash ops/backup-postgres.sh
```

Backups saved to `backups/jalaramhr-*.sql.gz`

---

## 8. Updates / redeploy

```bash
cd /opt/jalaramhr
git pull
bash scripts/deploy-contabo.sh
```

Do **not** use `FRESH_DB=1` on updates — that wipes all data.

---

## 9. Quick commands

```bash
# Status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# Smoke test
BASE_URL=http://127.0.0.1:8081 EMAIL=admin@jalaram.co.ke PASSWORD='your-password' bash ops/smoke-test.sh

# Test rota + overtime (optional)
bash scripts/test-hr-modules.sh
```

---

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| 502 Bad Gateway | `docker compose ps` — restart: `docker compose ... up -d` |
| Login works but blank pages | Rebuild with correct `VITE_SUPABASE_URL`: `docker compose ... up -d --build frontend` |
| CORS error | `FRONTEND_ORIGIN` must exactly match browser URL (https) |
| PostgREST 401 | `JWT_ACCESS_SECRET` must match in backend + postgrest |
| Port clash with EMR | Set `NGINX_HOST_PORT=8081` in `.env` |

---

## Related

- Local Docker: `DOCKER.md`
- Fresh DB only: `FRESH_DB=1 bash scripts/db/fresh-install.sh` (dev)
- Afya-Sasa EMR guide: `../Afya-Sasa/docs/contabo-deployment-guide.md`
