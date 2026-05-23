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

## 3. Install + migrate + build

```bash
npm ci
npx prisma migrate deploy   # applies committed migrations
npx prisma generate
npm run build
```

If the database is fresh and there are no migration files yet, use `npx prisma db push` once to create the schema, then commit a baseline migration on your dev box later.

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
npx prisma migrate deploy   # only does work if there are new migrations
npm run build
pm2 reload dbsmo            # zero-downtime reload
pm2 logs dbsmo --lines 30
```

If you only changed CSS or a static asset, `pm2 restart dbsmo` is fine.

## 7. Database migrations after schema changes

After pulling code that includes `prisma/schema.prisma` changes:

```bash
npx prisma migrate deploy
```

If there's no migration file (this repo has been using `db push`-style flow during dev), generate one on your dev box first:

```bash
# on dev
npx prisma migrate dev --name <describe-change>
git add prisma/migrations && git commit -m "db: <describe-change>"
git push

# on VPS
git pull && npx prisma migrate deploy && pm2 reload dbsmo
```

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
- **Schema out of sync** — `npx prisma migrate status` to see what's pending.
