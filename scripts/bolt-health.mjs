import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

try {
  const envText = readFileSync(".env", "utf8");
  for (const line of envText.split("\n")) {
    const match = line.trim().replace(/^\uFEFF/, "").match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL and SUPABASE_ANON_KEY. Copy .env.example to .env and add the Bolt database anon key.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const tables = [
  "site_settings",
  "menu_categories",
  "menu_items",
  "media_assets",
  "specials",
  "admin_user_profiles",
  "admin_activity_log",
  "analytics_events"
];

const results = {};
let failed = false;

for (const table of tables) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) {
    failed = true;
    results[table] = `ERROR: ${error.message}`;
  } else {
    results[table] = count ?? 0;
  }
}

console.table(results);

if (failed) {
  process.exit(1);
}
