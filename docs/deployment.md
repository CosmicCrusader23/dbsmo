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

# Storage
STORAGE_DRIVER="local" # Or switch to "s3" when implemented
LOCAL_STORAGE_ROOT="./storage" # Ensure this directory persists across deployments
MAX_ZIP_UPLOAD_MB="50"
```

## Vercel Deployment (Recommended)

1. Connect your GitHub repository to Vercel.
2. In the Vercel dashboard, go to the project settings and configure the Environment Variables.
3. Ensure the build command is `npm run build` or `npm run prisma:generate && next build`.
4. Deploy the application.

_Note on File Storage on Vercel:_
Vercel's file system is ephemeral. If you use `STORAGE_DRIVER="local"`, uploaded ZIP files and PDFs will be lost on the next deployment. For production on serverless platforms, you must implement the S3 storage driver or use a VPS with a persistent disk.

## VPS Deployment (Docker / PM2)

If deploying to a VPS (e.g., DigitalOcean, Hetzner, AWS EC2), you can use PM2 or Docker to persist the local storage folder.

1. Clone the repository onto your server.
2. Run `npm install` and `npm run prisma:generate`.
3. Set your `.env` variables.
4. Run `npm run prisma:migrate deploy` to apply migrations.
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
