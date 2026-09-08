# Go live — Humasync Contabo (102.68.79.109)

**HR URL:** https://hr.humasync.solutions  
**VPS IP:** `102.68.79.109`

> **Prerequisite:** Run and test locally first — [local-development.md](local-development.md).  
> Do not deploy to production until login, rota, and uploads work on http://localhost:8080.

---

## Step 1 — DNS (do this first)

At your domain registrar for **humasync.solutions**, add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | `hr` | `102.68.79.109` | 300 |

Optional (if Afya-Sasa EMR runs on same server):

| Type | Name | Value |
|------|------|-------|
| **A** | `emr` | `102.68.79.109` |

Verify (wait 5–30 min):

```bash
dig +short hr.humasync.solutions
# should print: 102.68.79.109
```

---

## Step 2 — SSH to Contabo

```bash
ssh root@102.68.79.109
# or: ssh your-user@102.68.79.109
```

Install Docker (if not already):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw fail2ban
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

---

## Step 3 — Deploy HR app

```bash
sudo mkdir -p /opt/jalaramhr && sudo chown $USER:$USER /opt/jalaramhr
cd /opt/jalaramhr
git clone https://github.com/ropkipyego/jalaramhumanresource.git .
# or upload/rsync the project folder

cp .env.production.example .env
nano .env
```

Generate secrets (run 3 times, paste into `.env`):

```bash
openssl rand -base64 48
```

Set in `.env`:

- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET`
- `MINIO_ROOT_PASSWORD`
- `SUPER_ADMIN_EMAIL=admin@humasync.solutions` (platform admin — separate from staff `@jalaram.co.ke`)
- `STAFF_EMAIL_DOMAIN=jalaram.co.ke`
- `VITE_STAFF_EMAIL_DOMAIN=jalaram.co.ke`

Deploy:

```bash
cd /opt/jalaramhr
git pull
bash scripts/deploy-contabo.sh
```

First-time super admin (profile + role + password):

```bash
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourNewSecurePassword' \
  bash scripts/db/ensure-superadmin.sh
```

Password reset only (if profile already exists):

```bash
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourNewSecurePassword' \
  bash scripts/db/reset-admin-password.sh
```

Internal check:

```bash
curl -fsS http://127.0.0.1:8081/api/v1/health
```

---

## Step 4 — HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp infra/nginx-host-hr.conf.example /etc/nginx/sites-available/jalaram-hr
sudo ln -sf /etc/nginx/sites-available/jalaram-hr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hr.humasync.solutions
```

Test:

```bash
curl -fsS https://hr.humasync.solutions/api/v1/health
```

---

## Step 5 — Log in

| | |
|--|--|
| **URL** | https://hr.humasync.solutions |
| **Email** | `admin@humasync.solutions` |
| **Password** | Set with `reset-admin-password.sh` (see Step 3) — not stored in git or `.env` |

Then: **Go-Live Checklist** → Organization → Departments → Invite Staff → Rota.

---

## Co-host with Afya-Sasa EMR

| App | Docker port | Suggested subdomain |
|-----|---------------|---------------------|
| Afya-Sasa EMR | `127.0.0.1:8080` | `emr.humasync.solutions` |
| Jalaram HR | `127.0.0.1:8081` | `hr.humasync.solutions` |

---

## Backups

```bash
cd /opt/jalaramhr
bash ops/backup-postgres.sh
# Daily: crontab -e → 0 2 * * * cd /opt/jalaramhr && bash ops/backup-postgres.sh
```

---

## Redeploy after updates

```bash
cd /opt/jalaramhr && git pull && bash scripts/deploy-contabo.sh
```

**Never** use `FRESH_DB=1` on updates — it wipes all data.

---

## Troubleshooting

| Issue | Command |
|-------|---------|
| Containers down | `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` |
| Backend logs | `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail 50` |
| Smoke test | `BASE_URL=http://127.0.0.1:8081 EMAIL=admin@humasync.solutions PASSWORD='...' bash ops/smoke-test.sh` |
