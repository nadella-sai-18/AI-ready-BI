# Oracle Cloud VM — Metabase + MinusX (production)

Runs **Metabase** and **MinusX OSS** on an Oracle Cloud Free VM, behind **Nginx**
with **automatic HTTPS** (Let's Encrypt), both connecting to your **existing Railway
PostgreSQL** as a data source.

**This does not touch your Railway frontend / backend / database.** Those stay exactly
as they are. This folder only adds the two BI tools on a separate VM.

```
Internet ──▶ Oracle VM (nginx-proxy :80/:443, auto-SSL)
                 ├─▶ metabase.<domain>  ──▶ Metabase  ─┐
                 └─▶ minusx.<domain>    ──▶ MinusX     ├─▶ (data source) Railway Postgres
                                          Metabase's settings ─▶ local metabase-db
```

---

## 0. Pick the right VM shape (IMPORTANT)
MinusX's image is **amd64-only**. Oracle's big free shape is **ARM (Ampere A1)**.
- **Easiest:** create an **AMD** VM — `VM.Standard.E2.1.Micro` (x86). Everything runs natively.
- **If you use the ARM (Ampere A1) shape:** Metabase runs fine, but MinusX (amd64) needs
  emulation. After installing Docker, run once:
  ```bash
  docker run --privileged --rm tonistiigi/binfmt --install amd64
  ```
  MinusX will then run under emulation (slower, but works). The compose already sets
  `platform: linux/amd64`.

Use **Ubuntu 22.04** as the image (commands below assume Ubuntu).

---

## 1. Open the firewall (Oracle has TWO — you must open both)
**a) Cloud level** — Oracle Console → your VM → *Virtual Cloud Network* → *Security List*
(or NSG) → **Add Ingress Rules**: allow **TCP 80** and **TCP 443** from `0.0.0.0/0`.

**b) OS level** — SSH into the VM and run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```
*(Oracle Ubuntu images block ports by default at the OS level — skipping this is the #1 reason "the site won't load".)*

---

## 2. Install Docker + Compose on the VM
```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker    # run docker without sudo
docker compose version                            # confirm it works
```

---

## 3. Point your domains at the VM (DNS)
Create two **A records** pointing at your VM's **public IP**:
```
metabase.yourdomain.com   ->  <VM_PUBLIC_IP>
minusx.yourdomain.com     ->  <VM_PUBLIC_IP>
```
**No domain?** Use free wildcard DNS `nip.io` — no setup needed. If your IP is
`203.0.113.45`, your domains become:
```
metabase.203-0-113-45.nip.io
minusx.203-0-113-45.nip.io
```
(Let's Encrypt issues certs for nip.io hosts fine.)

---

## 4. Get the files onto the VM + configure
```bash
git clone https://github.com/nadella-sai-18/AI-ready-BI.git
cd AI-ready-BI/infra/oracle
cp .env.example .env
nano .env      # fill in every value (domains, email, MB_DB_PASS, ANTHROPIC_API_KEY, NEXTAUTH_SECRET)
```
Generate a `NEXTAUTH_SECRET` with: `openssl rand -hex 32`.

---

## 5. Start everything
```bash
docker compose up -d
docker compose ps          # all should become healthy/running
docker compose logs -f acme-companion   # watch SSL certs get issued (Ctrl+C to exit)
```
First boot: Metabase takes ~1–2 min, and certificates take ~1 min to issue. Give it a few minutes.

Your apps are now at:
- **Metabase:** `https://metabase.yourdomain.com`
- **MinusX:**   `https://minusx.yourdomain.com`

---

## 6. Connect the COLLEGE database (Railway Postgres) — do this in each UI

Get your Railway **public** DB URL (Railway → Postgres → Connect → Public Network),
it looks like:
`postgresql://postgres:PASS@crossover.proxy.rlwy.net:32097/railway`

### Metabase
1. Open Metabase → finish the admin signup.
2. **Admin settings → Databases → Add database → PostgreSQL**:
   | Field | Value |
   |-------|-------|
   | Host | `crossover.proxy.rlwy.net` |
   | Port | `32097` |
   | Database name | `railway` |
   | Username | `postgres` |
   | Password | *(from the URL)* |
   | Use SSL | **ON** |
3. Save → Metabase syncs your tables + all `v_*` analytics views.

### MinusX
1. Open MinusX → create the admin workspace.
2. Add a **PostgreSQL** data source → **Connection String** tab:
   ```
   postgresql://postgres:PASS@crossover.proxy.rlwy.net:32097/railway?sslmode=disable
   ```
3. Save. Ask e.g. *"From v_at_risk_students, list at-risk students"*.

---

## 7. Validation checklist
- [ ] `https://metabase.<domain>` loads with a padlock (valid SSL).
- [ ] `https://minusx.<domain>` loads with a padlock.
- [ ] Metabase → Browse data → your `students` table shows 800 rows.
- [ ] MinusX answers a question from `v_at_risk_students` (55).
- [ ] Railway website still works: `https://focused-charisma-production.up.railway.app`
- [ ] Railway backend still works: `https://ai-ready-bi-production.up.railway.app/health`

---

## Operations
```bash
docker compose ps                 # status
docker compose logs -f metabase   # or minusx / nginx-proxy / acme-companion
docker compose restart metabase   # restart one service
docker compose down               # stop all (keeps volumes/data)
docker compose up -d              # start again
docker compose pull && docker compose up -d   # update images
```
All services use `restart: unless-stopped`, so they auto-restart on VM reboot (Docker starts on boot).

---

## Deployment review (things that commonly break — already handled here)
- **Port conflicts:** only nginx-proxy binds host ports (80/443). Metabase & MinusX both
  listen on 3000 *internally* — no clash because the proxy routes by domain, not port.
- **Wrong DB target:** Metabase's `MB_DB_*` points to the LOCAL `metabase-db` (its own
  settings). Your college data is added as a data source → never mixed.
- **Broken URLs / callbacks:** `MB_SITE_URL` and MinusX `NEXTAUTH_URL` are set to the real
  `https://<domain>` so login redirects and OAuth-style callbacks resolve correctly.
- **SSL:** issued automatically by acme-companion from the `LETSENCRYPT_HOST` labels.
- **CORS:** not applicable — Metabase and MinusX are full apps served at their own domains
  (not called cross-origin by your Railway frontend).
- **DB connection:** the VM reaches Railway Postgres over the public proxy URL (works from
  anywhere); use **SSL on** for Metabase, `?sslmode=disable` for MinusX.
- **Firewall:** see step 1 — both Oracle layers must allow 80/443.

## Security notes
- `.env` and `data/` are git-ignored — your keys and certs never get committed.
- Restrict SSH (port 22) to your IP in the Oracle Security List.
- `ANTHROPIC_API_KEY` and DB passwords live only in the VM's `.env`.
