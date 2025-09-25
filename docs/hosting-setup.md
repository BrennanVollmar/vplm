# Hosted Deployment Blueprint

This guide outlines the minimum steps to run the VPLM portal on a managed cloud stack with shared data. The recommended pairing is **Vercel** (frontend hosting) + **Supabase** (database, storage, auth backbone). Alternative providers are listed at the end.

## 1. Create the cloud accounts

| Provider | Purpose | Notes |
| --- | --- | --- |
| [Vercel](https://vercel.com/signup) | Build/deploy the Vite SPA with global edge caching. | Pro plan ($20/mo per seat) unlocks analytics & better bandwidth, but the Hobby tier is fine while testing. |
| [Supabase](https://supabase.com/dashboard/sign-up) | Managed Postgres, REST endpoints, row-level security, file storage. | The free tier includes 500 MB DB + 1 GB storage, which is enough for pilots. |

## 2. Supabase project setup

1. **Create a new project** and note the `Project URL` and `anon` public API key (Settings → API).
2. **Disable Row Level Security temporarily** on the tables we create below (RLS → toggle off). Once Supabase Auth is wired up, re-enable RLS with appropriate policies. Do *not* ship to production with RLS disabled for untrusted clients.
3. **Create the schema**: open the SQL Editor in Supabase and run the script from `scripts/supabase/schema.sql` (added in this repo). This provisions:
   - `jobs`, `notes`, `measurements`, `photos` tables aligned with the Dexie models.
   - Trigger columns for `created_at`/`updated_at` defaults and indexes for syncing.
4. **Create a storage bucket** named `photos` (Storage → Create bucket) and mark it public. Vite uses this bucket for uploaded job photos during sync.
5. (Optional, recommended) enable Point-in-Time recovery (Project Settings → Database → PITR) for production projects.

## 3. Configure environment variables

1. Copy `apps/vplm-portal/.env.example` to `apps/vplm-portal/.env` (or create the variables in Vercel later).
2. Populate:
   - `VITE_SUPABASE_URL` – your Supabase project URL (starts with `https://`...).
   - `VITE_SUPABASE_ANON_KEY` – the anon API key from Supabase settings.
3. Never commit `.env` files with real secrets; they are ignored via `.gitignore`.

## 4. Local smoke test

```bash
npm install
npm run dev
```

- The dev server picks up the `.env` values and the sync badge should show Supabase connectivity.
- Creating/editing jobs now writes to Dexie and queues a sync to Supabase (`features/offline/sync.ts`).
- Watch network logs for `supabase.co` requests to verify the REST API calls are succeeding.

## 5. Deploy the site via Vercel

1. Push your changes to GitHub; ensure the repository is clean and includes the new docs and scripts.
2. In Vercel, “Import Project” from GitHub → select this repo.
3. Build settings:
   - Framework: **Vite** (auto-detected).
   - Root directory: `apps/vplm-portal`.
   - Build command: `npm run build`.
   - Output directory: `dist`.
4. Environment variables (Project → Settings → Environment Variables): add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production (and Preview if desired).
5. Deploy. Vercel will run the build script and serve the static assets globally.

## 6. Attach the GitHub Pages custom domain (optional)

If you keep GitHub Pages active for the custom domain, point `www.lakemanagementservice.com` at Vercel instead:

1. Update DNS A/ALIAS records to Vercel per the dashboard instructions.
2. Remove or archive the GitHub Pages site to avoid conflicting responses.

## 7. Future hardening checklist

- **Supabase Auth**: replace the local phone/password guard with Supabase’s auth provider so RLS can be re-enabled safely.
- **Edge functions / API**: migrate write operations into Supabase edge functions or Vercel serverless functions to keep the anon key read-only.
- **Realtime**: subscribe to Supabase Realtime channels to broadcast job/notes updates instantly.
- **Backups**: schedule database backups (Supabase PITR or external dumping).
- **Monitoring**: enable Vercel analytics / Supabase logs for observability.

## Alternative stacks

| Hosting | Database | Pros | Cons |
| --- | --- | --- | --- |
| Netlify + Supabase | Same schema | Similar to Vercel, cheaper edge functions. | Slightly slower cold starts; fewer analytics. |
| Render Web Services | Render PostgreSQL | Single provider for web/API/DB, predictable pricing. | Regional hosting only; manual CDN setup. |
| Cloudflare Pages + D1 | Cloudflare D1/KV | Ultra-low latency edge deployments. | D1 is still maturing; SQL feature gaps. |
| AWS Amplify | RDS / DynamoDB | Enterprise integration, fine-grained IAM. | Higher complexity, pay-per-use billing. |

Choose the mix that best matches budget and Ops familiarity, but the Vercel + Supabase pairing is the quickest path to a performant, collaborative deployment.
