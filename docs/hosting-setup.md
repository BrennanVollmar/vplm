# Hosted Deployment Blueprint

This guide outlines the minimum steps to run the VPLM portal on a managed cloud stack with shared data. The recommended pairing is **Vercel** (frontend hosting) + **Supabase** (database, storage, auth backbone). Alternative providers are listed at the end.

## 1. Account creation & prerequisites (10–15 minutes)

| Provider | Purpose | Notes |
| --- | --- | --- |
| [Vercel](https://vercel.com/signup) | Deploy the Vite SPA with automatic HTTPS and global edge CDN. | Hobby tier is free for evaluation; upgrade to Pro for team analytics or higher bandwidth. |
| [Supabase](https://supabase.com/dashboard/sign-up) | Managed Postgres + REST API + storage + auth. | Free tier covers prototypes (500 MB DB, 1 GB storage). |

Before you begin, make sure you have:

- A GitHub account (Vercel imports directly from GitHub).
- Node 18+ locally (for running `npm run dev` and Vite builds).
- Basic understanding of your DNS registrar if you plan to move the custom domain to Vercel later.

## 2. Provision Supabase in detail (20–30 minutes)

1. **Create the project**
   1. Log into [Supabase](https://supabase.com/dashboard) → New project.
   2. Select a **strong database password** (stored in your password manager). You only need the anon key in the client, but keep the DB password handy for admin access.
   3. Choose a region close to the majority of your users (e.g., `us-east-1`).
   4. Once the project is ready, open **Project Settings → API** and copy:
      - `Project URL` (begins with `https://...supabase.co`).
      - `anon` public API key (under “Project API keys”).

2. **Run the schema migration**
   1. In the left nav, click **SQL Editor** → `+ New query`.
   2. Paste the contents of `scripts/supabase/schema.sql` from this repo. (You can open it locally and copy/paste.)
   3. Press **Run**. Wait for the success toast—this creates the core tables (`jobs`, `notes`, `measurements`, `photos`) with indexes and triggers.
   4. Optional sanity check: open **Table Editor**; you should see the four tables listed under the `public` schema.

3. **Disable RLS temporarily**
   - For each table (`jobs`, `notes`, `measurements`, `photos`): Table Editor → table name → **Security** tab → switch *Row Level Security* to `OFF`.
   - This allows the SPA to make direct writes using the anon key while we are still using the built-in developer login. Once Supabase Auth replaces the local login, re-enable RLS with policies.

4. **Create the photo storage bucket**
   1. Left nav → **Storage** → `Create new bucket`.
   2. Name: `photos` (must match `PHOTO_BUCKET` constant in code).
   3. Visibility: `Public` (the site generates shareable URLs for crews).
   4. After creation, open the bucket → **Policies** → ensure the default “public read” policy is active (Supabase does this automatically for public buckets).

5. **Optional safety nets**
   - Settings → Database → **Point-in-Time Recovery** if you plan to store production data (paid tier feature).
   - Settings → Logs → enable log retention to help debug sync issues later.

## 3. Prepare local environment (10 minutes)

1. Run `npm install` at the repo root if you haven’t already.
2. Copy the environment template:
   ```bash
   cp apps/vplm-portal/.env.example apps/vplm-portal/.env
   ```
3. Open `apps/vplm-portal/.env` and set:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<copy-from-supabase>
   ```
4. Leave the `.env` file uncommitted; `.gitignore` already excludes it.

## 4. Verify local data synchronisation (15 minutes)

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Browse to `https://localhost:5173` (mkcert supplies HTTPS). The sync badge in the header should flip to “Online” once the Supabase client initialises.
3. Create a test job, add a note, and optionally attach a photo.
4. Watch the browser Network tab for requests to `https://<project>.supabase.co`. You should see `POST /rest/v1/jobs` or similar.
5. In the Supabase dashboard, Table Editor → `jobs`, confirm your new record exists.
6. Delete the sample record when you’re done (either from the UI or via the Table Editor).

Troubleshooting tips:

- 401 error → check the anon key.
- CORS error → ensure you’re using the HTTPS dev server (`npm run dev` already enables it).
- Writes not visible → confirm RLS is OFF and that the table names match (`jobs`, not `job`).

## 5. Deploy the frontend on Vercel (20–25 minutes)

1. **Push these repo changes** to GitHub so Vercel can import.
2. In Vercel, click **Add New → Project** → “Continue with GitHub” → authorize if prompted.
3. Select the `VPLM` repository.
4. Build configuration (Vercel often detects this automatically, but confirm):
   - Framework preset: `Vite`.
   - Root directory: `apps/vplm-portal`.
   - Build command: `npm run build`.
   - Output directory: `dist`.
   - Install command: leave default (`npm install`).
5. Under **Environment Variables**, add two entries for the Production environment:
   - `VITE_SUPABASE_URL` → same URL as local.
   - `VITE_SUPABASE_ANON_KEY` → same anon key.
   *Repeat for the Preview environment if you want branch deploys to hit the shared Supabase instance.*
6. Kick off the first deploy. Vercel clones the repo, runs the build, and hosts the static assets globally.
7. When the deploy finishes, open the Production URL and repeat the smoke test (create a job, ensure Supabase tables update).

## 6. Map the custom domain to Vercel (optional, 30 minutes depending on DNS TTL)

If you want `www.lakemanagementservice.com` to point at the new Vercel deployment:

1. In Vercel Project Settings → **Domains** → `Add` → enter the domain.
2. Vercel shows the exact DNS records required (typically an A record to Vercel’s Anycast IPs or a CNAME to `cname.vercel-dns.com`).
3. Update the DNS at your registrar and wait for propagation (5 minutes to 24 hours, depending on TTL).
4. Once verified, remove the GitHub Pages deployment to avoid conflicting responses.

## 7. After-go-live hardening (ongoing)

To graduate from prototype to production:

1. **Integrate Supabase Auth**
   - Replace the local phone/password login with Supabase’s auth providers (email OTP, magic link, SSO, etc.).
   - Re-enable RLS on each table and add policies, e.g.:
     ```sql
     create policy "jobs_owner_read" on public.jobs
       for select using (auth.uid() = created_by);
     create policy "jobs_owner_write" on public.jobs
       for all using (auth.uid() = created_by);
     ```
   - Store the Supabase session in context so trusted-device logic maps to authenticated users.

2. **Move sensitive writes server-side**
   - Use Supabase Edge Functions or Vercel Serverless functions to validate payloads, enforce business rules, and keep the anon key read-only.

3. **Enable realtime collaboration**
   - Subscribe to Supabase Realtime channels (`supabase.channel('jobs')`) so all devices receive job updates instantly.

4. **Backups & monitoring**
   - Schedule automated exports (`pg_dump`) or enable PITR.
   - Turn on Vercel Analytics / Supabase Performance to track slow queries.

5. **CI/CD automation**
   - Add smoke tests (Playwright, Cypress) that run on Vercel previews before promotion.

## Alternative stacks

| Hosting | Database | Pros | Cons |
| --- | --- | --- | --- |
| Netlify + Supabase | Same schema | Similar CI/CD experience, cheaper paid tier. | Fewer analytics, slower cold start for serverless functions. |
| Render Web Services | Render PostgreSQL | One provider for web/API/DB, cron jobs, background workers. | Regional (no edge CDN), manual caching setup. |
| Cloudflare Pages + D1 | Cloudflare D1/KV | Ultra-low latency edge functions, generous free tier. | D1 is beta; SQL feature gaps (no triggers yet). |
| AWS Amplify | RDS / DynamoDB | Enterprise-grade infra, integrates with wider AWS stack. | Higher operational complexity, pay-per-resource billing. |

The Vercel + Supabase pairing stays the fastest route to production-grade hosting while keeping monthly spend predictable.
