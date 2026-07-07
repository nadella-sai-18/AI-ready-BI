# AWS EC2 — Metabase + MinusX (production)

Runs **Metabase** and **MinusX OSS** on one AWS EC2 instance, behind **Nginx** with
**automatic HTTPS** (Let's Encrypt), both reading your **existing Railway PostgreSQL**
as a data source.

**Your Railway frontend / backend / database are NOT touched.** This only adds the two
BI tools on EC2. Your database schema stays exactly as it is.

```
Internet ──▶ EC2 (nginx-proxy :80/:443, auto-SSL)
                 ├─▶ metabase.<domain>  ──▶ Metabase ─┐
                 └─▶ minusx.<domain>    ──▶ MinusX     ├─▶ (data source) Railway Postgres
                                          Metabase's settings ─▶ local metabase-db
```

---

## 0. Pick the right instance size (important — money + memory)
Metabase and MinusX are both memory-heavy. Running **both** needs **≥ 3–4 GB RAM**.
- **AWS Free Tier (`t2.micro` / `t3.micro`, 1 GB) is too small** — they'll crash (OOM),
  the same problem you saw on Render's 512MB.
- **Recommended:** `t3.small` (2 GB, ~$15/mo) for one app, or **`t3.medium` (4 GB, ~$30/mo)**
  to run both comfortably. EC2 is **x86_64**, so MinusX's amd64 image runs natively.
- Cheapest that fits both: `t3.medium`. If budget is tight, run **MinusX only** on `t3.small`
  and use Metabase locally.

Use **Ubuntu Server 22.04 LTS** as the AMI.

---

## 1. Launch the EC2 instance
1. AWS Console → **EC2 → Launch instance**.
2. **Name:** `college-bi`. **AMI:** Ubuntu Server 22.04 LTS. **Type:** `t3.medium`.
3. **Key pair:** create/download one (e.g. `college-bi.pem`) — you'll SSH with it.
4. **Network / Security group** — create one allowing inbound:
   | Type | Port | Source |
   |------|------|--------|
   | SSH | 22 | **My IP** |
   | HTTP | 80 | `0.0.0.0/0` |
   | HTTPS | 443 | `0.0.0.0/0` |
5. **Storage:** 20 GB. Launch.
6. **Elastic IP (so the IP never changes):** EC2 → *Elastic IPs* → Allocate → Associate it
   with this instance. Use **that** IP for DNS below.

---

## 2. Connect + install Docker
SSH in (from the folder with your `.pem`):
```bash
chmod 400 college-bi.pem
ssh -i college-bi.pem ubuntu@<ELASTIC_IP>
```
Then on the instance:
```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version    # confirm
```
*(AWS Ubuntu AMIs don't block ports at the OS level — only the Security Group matters, so no iptables step needed, unlike Oracle.)*

---

## 3. Point your domains at the instance (DNS)
Create two **A records** → your **Elastic IP**:
```
metabase.yourdomain.com  ->  <ELASTIC_IP>
minusx.yourdomain.com    ->  <ELASTIC_IP>
```
**No domain?** Use free `nip.io`: if your IP is `203.0.113.45`, use
`metabase.203-0-113-45.nip.io` and `minusx.203-0-113-45.nip.io`.

---

## 4. Get the files + configure
```bash
git clone https://github.com/nadella-sai-18/AI-ready-BI.git
cd AI-ready-BI/deploy/aws
cp .env.example .env
nano .env     # fill domains, email, MB_DB_PASS, ANTHROPIC_API_KEY, NEXTAUTH_SECRET
```
Generate `NEXTAUTH_SECRET` with: `openssl rand -hex 32`.

---

## 5. Start everything
```bash
docker compose up -d
docker compose ps
docker compose logs -f acme-companion   # watch SSL certs issue (~1 min); Ctrl+C to exit
```
First boot: Metabase ~1–2 min, certificates ~1 min. Then:
- **Metabase:** `https://metabase.yourdomain.com`
- **MinusX:**   `https://minusx.yourdomain.com`

---

## 6. Connect the COLLEGE database (Railway Postgres) — in each UI
Get your Railway **public** DB URL (Railway → Postgres → Connect → Public Network):
`postgresql://postgres:PASS@crossover.proxy.rlwy.net:32097/railway`

### Metabase
**Admin settings → Databases → Add database → PostgreSQL**:
| Field | Value |
|-------|-------|
| Host | `crossover.proxy.rlwy.net` |
| Port | `32097` |
| Database name | `railway` |
| Username | `postgres` |
| Password | *(from the URL)* |
| Use SSL | **ON** |

### MinusX
Add a **PostgreSQL** data source → **Connection String** tab:
```
postgresql://postgres:PASS@crossover.proxy.rlwy.net:32097/railway?sslmode=disable
```

---

## 7. Validation checklist
- [ ] `https://metabase.<domain>` loads with a valid padlock (SSL).
- [ ] `https://minusx.<domain>` loads with a valid padlock.
- [ ] Metabase → Browse data → `students` = 800 rows.
- [ ] MinusX answers from `v_at_risk_students` (55).
- [ ] Railway website still works: `https://focused-charisma-production.up.railway.app`
- [ ] Railway backend still works: `https://ai-ready-bi-production.up.railway.app/health`

---

## Operations
```bash
docker compose ps                 # status
docker compose logs -f minusx     # or metabase / nginx-proxy / acme-companion
docker compose restart metabase   # restart one service
docker compose down               # stop all (keeps data volumes)
docker compose up -d              # start again
docker compose pull && docker compose up -d   # update images
```
All services use `restart: unless-stopped` (auto-restart on reboot; Docker starts on boot).

---

## Deployment review (issues checked)
- **Port conflicts:** only nginx-proxy binds host ports (80/443). Metabase & MinusX both
  listen on 3000 *internally* — no clash; the proxy routes by domain.
- **MinusX port binding:** `HOSTNAME=0.0.0.0` is set so MinusX binds all interfaces and the
  proxy can reach it (this was the exact fix from the Render attempt).
- **Wrong DB target:** Metabase's `MB_DB_*` points to the LOCAL `metabase-db` (its own
  settings). College data is a separate data source → never mixed.
- **Broken URLs / callbacks:** `MB_SITE_URL` and MinusX `NEXTAUTH_URL` are the real
  `https://<domain>` values, so logins/redirects resolve.
- **SSL:** issued automatically by acme-companion from the `LETSENCRYPT_HOST` labels.
- **CORS:** N/A — Metabase and MinusX are full apps on their own domains, not called
  cross-origin by your Railway frontend.
- **DB connection:** EC2 reaches Railway Postgres via its public URL; Metabase uses SSL ON,
  MinusX uses `?sslmode=disable`.
- **MinusX ↔ Metabase:** no internal link needed — MinusX queries the database directly.
- **Firewall:** AWS Security Group must allow 80/443 (step 1) — the only firewall on Ubuntu AMIs.

## Security notes
- `.env` and `data/` are git-ignored — keys/certs never get committed.
- Keep SSH (22) restricted to **My IP** in the Security Group.
- Secrets live only in the instance's `.env`.
- Stop the instance when not demoing to save cost: EC2 → Instance state → **Stop**
  (data persists; `docker compose up -d` again after you Start it).
