# Jalaram Hospital HR

Self-hosted HR · Rota · Attendance · Payroll

---

## 1. Run offline locally first (recommended)

**Guide:** [docs/local-development.md](docs/local-development.md)

```bash
cp .env.example .env          # edit passwords locally
bash scripts/local-dev.sh     # start stack + seed super admin if empty
```

Open **http://localhost:8080**

| | |
|--|--|
| **Super admin** | `admin@humasync.solutions` |
| **Staff domain** | `@jalaram.co.ke` |
| **Local password** | from `SUPER_ADMIN_PASSWORD` in `.env` |

Fresh local database (wipes **local** volume only):

```bash
bash scripts/local-dev.sh fresh
```

When rota, login, uploads, and payroll work locally → go to step 2.

---

## 2. Go live on Contabo

| | |
|--|--|
| **VPS** | `102.68.79.109` |
| **HR URL** | https://hr.humasync.solutions |

**Guide:** [docs/go-live-humasync.md](docs/go-live-humasync.md) · **Safety:** [docs/production-auth-and-safety.md](docs/production-auth-and-safety.md)

```bash
cd /opt/jalaramhr
git pull
bash scripts/deploy-contabo.sh
```

Create super admin on production (first time):

```bash
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='...' \
  bash scripts/db/ensure-superadmin.sh
```

**Never** run `FRESH_DB=1` or `fresh-install.sh` on production.

---

## More docs

| Doc | Purpose |
|-----|---------|
| [docs/local-development.md](docs/local-development.md) | Offline Docker dev |
| [docs/go-live-humasync.md](docs/go-live-humasync.md) | Contabo production |
| [docs/production-auth-and-safety.md](docs/production-auth-and-safety.md) | Auth, passwords, what not to run |
| [DOCKER.md](DOCKER.md) | Architecture reference |
