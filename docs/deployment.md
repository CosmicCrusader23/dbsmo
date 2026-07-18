# Deployment Guide

The MO Training Platform is designed to be easily deployed as a standard Next.js application with a PostgreSQL database.

## Prerequisites

- **PostgreSQL Database**: A managed Postgres instance (e.g., Supabase, Neon, AWS RDS, Render).
- **Node.js Environment**: Vercel, Railway, Render, or a VPS with Docker.
- **Google OAuth Credentials**: An OAuth 2.0 Client ID and Secret from Google Cloud Console.

## Environment Variables

Create a `.env` file in your production environment using the variables in `.env.example` as a template:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-a-strong-random-secret-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
SCHOOL_EMAIL_DOMAINS="g.dbs.edu.hk,dbs.edu.hk"
# Keep false in production. Set to true only in a trusted local development environment.
AUTH_DEV_BYPASS="false"

# Storage
STORAGE_DRIVER="local" # Use "s3" on ephemeral/serverless filesystems
LOCAL_STORAGE_ROOT="./storage" # Ensure this directory persists across deployments
MAX_JSON_UPLOAD_MB="5"
MAX_ZIP_UPLOAD_MB="50"

# Required only when STORAGE_DRIVER="s3"
S3_ENDPOINT="https://s3.example.com"
S3_BUCKET="dbsmo"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_REGION="us-east-1"
```

`SCHOOL_EMAIL_DOMAINS` is a comma-separated allowlist of exact email domains. Invalid
entries are ignored, and an explicitly empty value denies all Google sign-ins. The
developer credentials provider is available only when `AUTH_DEV_BYPASS="true"` and
`NODE_ENV` is not `production`.

The JSON and legacy ZIP settings can lower their respective 5 MB and 50 MB hard
limits, but cannot raise them.

## Vercel Deployment (Recommended)

1. Connect your GitHub repository to Vercel.
2. In the Vercel dashboard, go to the project settings and configure the Environment Variables.
3. Ensure the build command is `npm run build` or `npx prisma generate && next build`.
4. Deploy the application.

_Note on File Storage on Vercel:_
Vercel's file system is ephemeral. If you use `STORAGE_DRIVER="local"`, uploaded files will be lost on the next deployment. Configure the implemented S3-compatible driver or use a VPS with a persistent disk.

## VPS Deployment (Docker / PM2)

If deploying to a VPS (e.g., DigitalOcean, Hetzner, AWS EC2), you can use PM2 or Docker to persist the local storage folder.

1. Clone the repository onto your server.
2. Run `npm install` and `npx prisma generate`.
3. Set your `.env` variables.
4. Run `npx prisma db push` to apply the schema, matching `SETUP.md`.
5. Run `npm run build`.
6. Start the server with `pm2 start npm --name "dbsmo" -- run start`.

## Database Backups

For managed databases (Supabase, RDS), automated backups are typically handled by the provider. Ensure they are enabled.

If managing your own Postgres instance:

- Set up a daily cron job to run `pg_dump`:
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y-%m-%d).sql
  ```
- Use a tool like `aws s3 cp` to sync backups offsite.
