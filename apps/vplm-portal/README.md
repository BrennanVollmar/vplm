VPLM Portal (Vite + React)

Quickstart
- cd apps/vplm-portal
- npm install
- npm run dev

What’s included
- Vite + React + TS scaffold
- PWA basics: manifest and simple service worker (`public/sw.js`)
- Offline DB: Dexie schema (`src/features/offline/db.ts`) with outbox
- Sync placeholder: `src/features/offline/sync.ts` (stub for Supabase/Firebase)
- Supabase sync: push jobs/notes/measurements/photos and pull latest (basic)
- Calculators: geometry, conversions, dosing (`src/features/calculators/*`)
 - Unit tests for calculators (run `npm run test`)
- UI stubs: SyncBadge, NoteForm, MeasureForm, CameraCapture, ChemLookup
- Routes: Dashboard `/`, Job `/job/:jobId`, Offline `/offline`
 - Import/Export: Offline page can export all data to JSON (optionally embedding media) and import it back.
 - Background sync: Service worker posts sync events; app registers one-off and periodic sync when available; also syncs on `online`.
 - Field features: Map & GPS tracking, Shoreline tracing with area (acres), Water Quality inputs (Secchi, pH, DO, Temp, Alkalinity, Hardness), Tank Mix calculator, Safety checklist, Job Summary print.
 - Field Mode: toggle in header for larger touch targets and type.

Next steps
- Replace `public/icons/icon-192.png` and `icon-512.png` with real PNGs
- Configure Supabase: create project, tables (`jobs`, `notes`, `measurements`, `photos`) and storage bucket `photos`
- Add keys to `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Consider RLS policies; ensure your anon role can upsert to these tables and upload to the `photos` bucket for your use case
- Expand calculators and add unit tests per LOGS plan
- Enhance service worker with background sync if needed
- Optional: expand SW API caching rules or adopt Workbox
 - Supply PWA icons.
 - Install new deps: `leaflet`, `react-leaflet`, `@turf/turf`, `jspdf` (already in package.json).

Location capture
- On the Dashboard, the New Job form has an option to “Store current location”.
- Users must be on site and allow location access for accurate coordinates.

Employee filter
- New Job form includes an Employee Name field (stored as `createdBy`).
- Dashboard supports filtering jobs by employee.
