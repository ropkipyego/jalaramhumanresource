# Jalaram Hospital HR

Self-hosted HR · Rota · Attendance · Payroll

## Go live — Humasync Contabo

| | |
|--|--|
| **VPS** | `102.68.79.109` |
| **HR URL** | https://hr.humasync.solutions |
| **DNS** | A record `hr` → `102.68.79.109` |

**Full steps:** [docs/go-live-humasync.md](docs/go-live-humasync.md)

```bash
# On Contabo VPS
cd /opt/jalaramhr
cp .env.production.example .env && nano .env   # set secrets
FRESH_DB=1 bash scripts/deploy-contabo.sh
sudo certbot --nginx -d hr.humasync.solutions
```

Login: `admin@humasync.solutions` + password from `SUPER_ADMIN_PASSWORD` in `.env`

---

## Local development

```bash
cp .env.example .env
FRESH_DB=1 bash scripts/go-live.sh
```

Open **http://localhost:8080**

See **DOCKER.md** and **docs/contabo-deployment-guide.md** for details.
