# Deploying MARS to dev-box → https://mars.derek2403.win

This mirrors your existing `gym` / `enclave` setup: the app runs as a Docker container on the
shared `proxy` network, and your `~/nginx-proxy` container routes the subdomain to it.
Cloudflare (orange-cloud) handles HTTPS; your origin only ever serves plain `:80`.

```
Browser ──HTTPS──▶ Cloudflare ──HTTP:80──▶ dev-box ──▶ nginx-proxy container
                   (DNS + TLS)                          │  proxy_pass http://mars:3000
                                                        ▼
                                                   mars container (next start :3000)
                                                   bind-mounts: db/ skills/ .env.local mars-state.json
```

Set these once in your shell so you can copy-paste:

```bash
export SRV=ubuntu@<DEV_BOX_IP>     # same box your gym/enclave run on
export APP=~/projects/mars         # where MARS will live on the server
```

---

## STEP 0 — Cloudflare DNS (do this first; it can take a minute to propagate)

1. Cloudflare dashboard → zone **derek2403.win** → **DNS → Records → Add record**:
   - **Type:** `A`
   - **Name:** `mars`
   - **IPv4 address:** your dev-box public IP — *use the exact same IP as your existing
     `gym` A record* (open the `gym` record to copy it; that's the box you're deploying to).
   - **Proxy status:** **Proxied** (orange cloud) — match `gym`/`enclave`.
   - **TTL:** Auto. Save.
2. **SSL/TLS → Overview:** leave it on whatever mode already works for `gym` (probably
   *Flexible* or *Full*). Your origin is HTTP-only on `:80`, so *Flexible* works as-is.
   *(Optional hardening later: install a Cloudflare Origin Certificate, add a `:443` server
   block to nginx, and switch the zone to **Full (strict)**.)*

Verify DNS once it's live:
```bash
dig +short mars.derek2403.win      # should return Cloudflare IPs (104.x / 172.x), proxied
```

---

## STEP 1 — World ID gotcha (READ THIS or `/world` breaks)

`NEXT_PUBLIC_RP_ID` and `NEXT_PUBLIC_WORLD_APP_ID` are **build-time** values — Next inlines
them into the client bundle during `next build`. They are tied to your domain in the World
Developer Portal.

- In the **World Developer Portal**, make sure your app's RP / allowed origin includes
  **`mars.derek2403.win`** (passkey RP IDs are domain-scoped).
- In the `.env.local` you ship to the server, set:
  ```
  NEXT_PUBLIC_RP_ID=mars.derek2403.win
  ```
  (or `derek2403.win` if your World app is registered at the apex — match the portal).
- Because it's build-time, **`.env.local` must be on the server *before* you build**, and
  if you change it later you must **rebuild** (`docker compose up -d --build`), not just restart.

---

## STEP 2 — Get the code on the server (git)

```bash
ssh $SRV
# first time:
git clone <your-repo-url> ~/projects/mars
# later updates:
cd ~/projects/mars && git pull
exit
```

Git brings everything **except** the gitignored runtime files — those come next via rsync.

---

## STEP 3 — rsync the gitignored runtime files (run from your LOCAL repo root)

These are all gitignored, so `git pull` will NOT create them. Copy them straight from your
laptop. Run these from `/Users/derekliew/Developer/ethnyc`:

```bash
# 3a. single files (secrets, seeded ids, lockfile for reproducible `npm ci`)
rsync -avz .env.local mars-state.json package-lock.json  $SRV:projects/mars/

# 3b. data dirs (the app reads/writes these at runtime)
rsync -avz db skills tee  $SRV:projects/mars/

# 3c. the gitignored API route (pages/api/tee is in .gitignore → won't arrive via git!)
rsync -avz pages/api/tee  $SRV:projects/mars/pages/api/
```

Why each one:
| Path | Why it must be rsync'd |
|---|---|
| `.env.local` | all secrets; also needed at build for `NEXT_PUBLIC_*` |
| `mars-state.json` | seeded HCS topic + HTS token ids |
| `package-lock.json` | gitignored, but `npm ci` in the Docker build wants it |
| `db/` | the JSON data store (users, audits, skills, sessions) — read+write |
| `skills/` | verified-skill artifacts (`index-v1`, `index-v2`, …) |
| `tee/` | the attestor service + its compose (see STEP 6) |
| `pages/api/tee/` | **gitignored** — the `/api/tee/attest` route source lives only here |

> ⚠️ Order matters: rsync **before** the first `docker compose up`. If `mars-state.json`,
> `db/`, or `skills/` don't exist when Compose starts, Docker creates empty *directories*
> in their place and the app breaks.

---

## STEP 4 — Build & run the app container

```bash
ssh $SRV
cd ~/projects/mars
docker compose up -d --build      # builds the image, joins the `proxy` network, starts :3000
docker compose logs -f mars       # watch it boot; Ctrl-C when you see "Ready"
```

Sanity check it's reachable on the internal network (from inside nginx-proxy):
```bash
docker exec nginx-proxy wget -qO- http://mars:3000 | head -c 200   # should print HTML
```

---

## STEP 5 — Wire up nginx + reload

```bash
# from ~/projects/mars on the server:
cp deploy/mars.conf ~/nginx-proxy/conf.d/mars.conf
docker exec nginx-proxy nginx -t          # test config
docker exec nginx-proxy nginx -s reload   # apply, zero downtime
```

Then open **https://mars.derek2403.win** 🎉

---

## STEP 6 — (optional) the TEE attestor

`tee/docker-compose.yml` runs a Phala/dstack attestor that needs `/var/run/dstack.sock`.
That socket only exists on a real Phala TDX host — **a plain Ubuntu box doesn't have it**,
so the local attestor can't produce real quotes there. Two choices:

- Point `PHALA_ATTESTOR_URL` in `.env.local` at a remote attestor you control, **or**
- Leave it; the audit pipeline fails soft and the demo still runs.

If you do have a dstack host, start it with: `cd ~/projects/mars/tee && docker compose up -d`.

---

## Updating later (redeploy)

```bash
ssh $SRV && cd ~/projects/mars
git pull
# re-sync ONLY if a gitignored file changed locally (e.g. you re-ran a demo → db/ changed):
#   (run from your laptop)  rsync -avz db skills $SRV:projects/mars/
docker compose up -d --build     # rebuild (required if NEXT_PUBLIC_* or code changed)
docker exec nginx-proxy nginx -s reload   # only needed if the mars container's IP changed
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `502 Bad Gateway` | mars container down (`docker compose ps`), or nginx cached an old IP after a rebuild → `docker exec nginx-proxy nginx -s reload` |
| nginx won't reload, "host not found in upstream mars" | the `mars` container isn't up / not on `proxy` → `docker network inspect proxy` should list both `nginx-proxy` and `mars` |
| `/world` verification fails | `NEXT_PUBLIC_RP_ID` ≠ the domain registered in the World portal, or you didn't rebuild after changing it |
| SSE audit stream stalls / cuts off | confirm `proxy_buffering off` is in `mars.conf` (it is) and Cloudflare isn't buffering — SSE works through CF, but very long idle streams may need a heartbeat |
| API route 404 (`/api/tee/attest`) | you skipped STEP 3c (that route is gitignored) |
| Cloudflare 521/522 | origin :80 unreachable — check the box's firewall/security group allows inbound 80 from Cloudflare |
