# SETUP.md — VPS deployment with PM2

End-to-end recipe to run DBSMO on a Linux VPS using `npm` + `pm2`. Assumes Ubuntu/Debian and SSH access.

## 1. One-time host setup

Install Node 20+, PostgreSQL, and PM2.

```bash
# Node 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# PM2 (global, runs as your deploy user)
sudo npm install -g pm2
```

Create a Postgres database and a role:

```bash
sudo -u postgres psql <<SQL
CREATE USER dbsmo WITH PASSWORD 'change-me';
CREATE DATABASE dbsmo OWNER dbsmo;
SQL
```

## 2. Clone and configure

```bash
git clone https://github.com/CosmicCrusader23/dbsmo.git
cd dbsmo
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql://dbsmo:change-me@localhost:5432/dbsmo
NEXTAUTH_URL=https://your.domain.example
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_DEV_BYPASS=false
```

Generate the secret if you don't have one:

```bash
openssl rand -base64 32
```

## 3. Install + schema + build

```bash
npm ci
npx prisma generate
npx prisma db push          # creates / updates the schema
npm run build
```

This repo uses `prisma db push` (not `prisma migrate`). See §7 for why
and how to handle subsequent schema changes.

## 4. Start with PM2

The repo doesn't ship a PM2 ecosystem file. Two options:

**Option A — single command:**

```bash
pm2 start "npm run start" --name dbsmo --time
pm2 save
pm2 startup        # follow the printed command (sets up systemd hook)
```

**Option B — ecosystem file (recommended for redeploys):**

Create `ecosystem.config.cjs` in the project root:

```js
module.exports = {
  apps: [
    {
      name: "dbsmo",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      out_file: "logs/out.log",
      error_file: "logs/err.log",
      time: true,
    },
  ],
};
```

Then:

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup       # run the printed sudo command once
```

Verify:

```bash
pm2 status
pm2 logs dbsmo --lines 50
curl -I http://localhost:3000
```

## 5. Reverse proxy (nginx) + TLS

Minimal nginx site file at `/etc/nginx/sites-available/dbsmo`:

```nginx
server {
  server_name your.domain.example;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
  }

  listen 80;
}
```

Enable + TLS:

```bash
sudo ln -s /etc/nginx/sites-available/dbsmo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.example
```

## 6. Redeploy after a code change

```bash
cd ~/dbsmo
git pull origin main
npm ci
npx prisma generate         # regen client when schema.prisma changes
npx prisma db push          # apply schema (this repo uses db push, not migrate)
npm run build
pm2 reload dbsmo            # zero-downtime reload
pm2 logs dbsmo --lines 30
```

If you only changed CSS or a static asset, `pm2 restart dbsmo` is fine.

> **Important:** `prisma generate` must run before `pm2 reload` whenever
> `schema.prisma` changes. The pm2 process loads `@prisma/client` once at
> startup; if you skip generate, the client won't know about new models
> and any API touching them will return 500.

### Deploying this pull (image-asset support)

This commit adds the `ProblemSetAsset` table and a few related fields.
Run the standard redeploy block above — `prisma db push` will create the
new table and indexes, `prisma generate` rebuilds the client, and the
pm2 reload picks up the new code. Verify with:

```bash
psql -U dbsmo -h localhost dbsmo -c '\d "ProblemSetAsset"'
```

You should see columns `id, problemSetId, key, fileId, createdAt`.

## 7. Database schema changes

This repo uses `prisma db push` (not `prisma migrate`), so any
`schema.prisma` change applies the same way every time:

```bash
git pull
npx prisma generate         # regen the client
npx prisma db push          # apply schema to the live DB
pm2 reload dbsmo
```

`db push` is idempotent — running it when nothing changed is a no-op.
It does **not** drop columns unless you explicitly accept the prompt,
so it's safe for additive changes (new tables, new optional columns,
new indexes). Back up first (`pg_dump`, see §8) if a change is
destructive or you're not sure.

If you ever need to switch this repo to migration files, run
`prisma migrate dev --name baseline` on dev *once* to capture the
current state, commit `prisma/migrations/`, and from then on use
`prisma migrate deploy` on the VPS.

## 8. Backups

```bash
pg_dump -U dbsmo -h localhost dbsmo | gzip > backups/dbsmo-$(date +%F).sql.gz
```

Cron it:

```cron
0 3 * * * cd /home/<you>/dbsmo && pg_dump -U dbsmo -h localhost dbsmo | gzip > backups/dbsmo-$(date +\%F).sql.gz
0 4 * * 0 find /home/<you>/dbsmo/backups -name '*.sql.gz' -mtime +30 -delete
```

## 9. Monitoring + maintenance

- `pm2 monit` — live CPU + memory, log tail.
- `pm2 logs dbsmo --err` — error stream only.
- `pm2 reload dbsmo --update-env` — pick up new env vars after editing `.env`.
- `pm2 delete dbsmo` then re-`start` if the process gets stuck.

## 10. Troubleshooting

- **502 Bad Gateway** — `pm2 status` says `errored`/`stopped`. Check `pm2 logs dbsmo --err`.
- **Build OOM on VPS** — small VPS? `NODE_OPTIONS="--max-old-space-size=2048" npm run build`.
- **Prisma can't connect** — verify `DATABASE_URL`, run `psql "$DATABASE_URL" -c '\dt'` to confirm credentials.
- **Google sign-in loops** — `NEXTAUTH_URL` must be your public HTTPS URL exactly, and the OAuth redirect URI in Google Cloud must include `https://your.domain.example/api/auth/callback/google`.
- **Schema out of sync** — re-run `npx prisma db push` then `pm2 reload dbsmo`. If `pm2 logs --err` shows "Unknown field" or "Unknown model", the running pm2 process is loading a stale `@prisma/client`. Run `npx prisma generate` then `pm2 reload dbsmo`.
