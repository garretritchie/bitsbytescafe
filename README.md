# Bits and Bytes Cafe

Website and CMS for Bits and Bytes Cafe.

## Local Bolt-backed testing

Use this setup when troubleshooting CMS or publishing issues before pushing changes to Bolt.

1. Copy `.env.example` to `.env`.
2. Put the Bolt database anon key in `SUPABASE_ANON_KEY`.
3. Run `npm run health:bolt` to confirm the local copy can reach the Bolt database.
4. Run `npm run dev:bolt`.
5. Open `http://127.0.0.1:3000/admin/login`.

CMS login:

- Username: `admin`
- Password: `password123`

The admin SPA talks directly to the Bolt database, matching the published Bolt-hosted behavior. The Express server also exposes `/api/health` and `/api/*` routes for local diagnostics.

## Database migrations

Apply files in `supabase/migrations/` through Bolt before publishing CMS features that need schema changes. The user password feature requires `20260709110000_add_admin_user_passwords.sql`.

## Build

Run:

```bash
npm run build
```

The build reads `site_settings`, `menu_items`, and `menu_categories` from the Bolt database and regenerates `index.html` plus `dist/`.

## Files

- `index.html` - generated public website page
- `index.template.html` - public website template
- `admin/` - CMS login and admin SPA
- `scripts/build.mjs` - Bolt-backed static build
- `scripts/bolt-health.mjs` - local Bolt database health check
- `server.js` - local Express diagnostic server
- `images/` - logo, menu reference, and cafe photos
