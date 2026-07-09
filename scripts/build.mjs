import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env if env vars are missing
try {
  const envText = readFileSync(".env", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.trim().replace(/^\uFEFF/, "").match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const files = ["styles.css", "script.js"];
const directories = ["images", "data", "admin"];
const SITE_URL = (process.env.SITE_URL || "https://bitsbytescafe.com").replace(/\/+$/, "");
const SEO_TITLE = "Bits and Bytes Cafe | Breakfast, Lunch & Coffee in Nassau";
const SEO_DESCRIPTION = "Bits and Bytes Cafe serves affordable breakfast, lunch, coffee, wings, sandwiches, burgers, wraps, and daily lunch specials in Nassau, Bahamas.";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`);
}

for (const directory of directories) {
  if (existsSync(directory)) {
    await cp(directory, `dist/${directory}`, { recursive: true });
  }
}

if (existsSync("public/uploads")) {
  await mkdir("dist/uploads", { recursive: true });
  await cp("public/uploads", "dist/uploads", { recursive: true });
  await mkdir("dist/public/uploads", { recursive: true });
  await cp("public/uploads", "dist/public/uploads", { recursive: true });
}

function escH(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt12(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function hoursFeature(hours) {
  const open = hours.filter((h) => !h.closed);
  if (open.length === 0) return "Temporarily closed";
  const first = open[0];
  const last = open[open.length - 1];
  const range = first.day === last.day ? first.day : `${first.day.slice(0, 3)} - ${last.day.slice(0, 3)}`;
  return `${range}: ${fmt12(first.open)} - ${fmt12(first.close)}`;
}

function footerHoursHtml(hours) {
  const openDays = hours.filter((h) => !h.closed);
  const closedDays = hours.filter((h) => h.closed);
  let html = "";
  if (openDays.length > 0) {
    const first = openDays[0];
    const last = openDays[openDays.length - 1];
    const dayRange = first.day === last.day ? escH(first.day) : `${escH(first.day.slice(0, 3))} - ${escH(last.day.slice(0, 3))}`;
    html += `<p>${dayRange}<br>${escH(fmt12(first.open))} - ${escH(fmt12(first.close))}</p>`;
  }
  if (closedDays.length > 0) {
    const label = closedDays.length === 1
      ? escH(closedDays[0].day)
      : `${escH(closedDays[0].day.slice(0, 3))} - ${escH(closedDays[closedDays.length - 1].day.slice(0, 3))}`;
    html += `<p>${label}<br>Closed</p>`;
  }
  return html;
}

function toTel(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function toWaMe(phone) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function absoluteUrl(src = "") {
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE_URL}/${String(src).replace(/^\/+/, "")}`;
}

function openingHoursSpecification(hours) {
  return hours
    .filter((h) => !h.closed && h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close
    }));
}

function menuSchema(menu) {
  const visible = menu.filter((item) => item.available);
  const categories = [...new Set(visible.map((item) => item.category))];

  return {
    "@type": "Menu",
    name: "Bits and Bytes Cafe Menu",
    hasMenuSection: categories.map((category) => ({
      "@type": "MenuSection",
      name: category.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      hasMenuItem: visible
        .filter((item) => item.category === category)
        .slice(0, 20)
        .map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.description,
          image: item.image ? absoluteUrl(item.image) : undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "BSD",
            price: String(item.price || "").match(/\d+(?:\.\d{2})?/)?.[0]
          }
        }))
    }))
  };
}

function seoHead(cms, menu) {
  const heroImage = absoluteUrl(cms.hero.image);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: "Bits and Bytes Cafe",
    url: SITE_URL,
    image: heroImage,
    logo: absoluteUrl("images/bits-bytes-logo-wide-cropped.png"),
    description: SEO_DESCRIPTION,
    telephone: cms.contact.phone,
    priceRange: "$",
    servesCuisine: ["Bahamian", "Breakfast", "Cafe", "Comfort Food"],
    address: {
      "@type": "PostalAddress",
      streetAddress: cms.contact.addressLine1,
      addressLocality: "Nassau",
      addressCountry: "BS"
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 25.0743892,
      longitude: -77.3254307
    },
    openingHoursSpecification: openingHoursSpecification(cms.hours),
    sameAs: [
      "https://www.facebook.com/bitsbytescafe",
      "https://www.instagram.com/bitsbytescafe",
      "https://www.tiktok.com/@bitsandbytes242"
    ],
    hasMenu: menuSchema(menu)
  };

  return `<link rel="canonical" href="${escH(SITE_URL)}/">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#f36c13">
    <meta property="og:type" content="restaurant">
    <meta property="og:site_name" content="Bits and Bytes Cafe">
    <meta property="og:title" content="${escH(SEO_TITLE)}">
    <meta property="og:description" content="${escH(SEO_DESCRIPTION)}">
    <meta property="og:url" content="${escH(SITE_URL)}/">
    <meta property="og:image" content="${escH(heroImage)}">
    <meta property="og:image:alt" content="Fresh food from Bits and Bytes Cafe in Nassau, Bahamas">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escH(SEO_TITLE)}">
    <meta name="twitter:description" content="${escH(SEO_DESCRIPTION)}">
    <meta name="twitter:image" content="${escH(heroImage)}">
    <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function robotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function sitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

// Read CMS data — prefer Supabase, fall back to local JSON
let cms, menu;
try {
  const { data: siteSettings } = await sb.from("site_settings").select("*").maybeSingle();
  const { data: menuItems } = await sb
    .from("menu_items")
    .select("*, menu_categories(name, slug, display_order)")
    .eq("is_available", true)
    .order("display_order");
  if (siteSettings) {
    cms = {
      hero: {
        heading: siteSettings.hero_heading || "Fresh bites.",
        headingSpan: siteSettings.hero_heading_span || "Friendly bytes.",
        subheading: siteSettings.hero_subheading || "",
        image: siteSettings.hero_image_url || "images/74604694_795940760878125_3195495164743254016_n.jpg",
      },
      hours: siteSettings.opening_hours || [],
      contact: {
        phone: siteSettings.primary_phone || "",
        whatsapp: siteSettings.whatsapp || "",
        email: siteSettings.email || "",
        addressLine1: siteSettings.address_line1 || "",
        addressCity: siteSettings.address_city || "",
      },
    };
    console.log("Build: loaded CMS data from Supabase");
  } else {
    throw new Error("No site_settings row");
  }
  if (menuItems?.length) {
    menu = menuItems.map(item => ({
      ...item,
      category: item.menu_categories?.slug || item.category || item.category_id || "",
      categoryName: item.menu_categories?.name || "",
      categoryDisplayOrder: item.menu_categories?.display_order ?? 0,
      image: item.image_url,
      available: item.is_available !== false,
      price: item.price,
    }));
    console.log(`Build: loaded ${menu.length} menu items from Supabase`);
  } else {
    throw new Error("No menu items");
  }
} catch (err) {
  console.warn("Build: falling back to local JSON files:", err.message);
  cms = JSON.parse(await readFile("data/cms-data.json", "utf8"));
  menu = JSON.parse(await readFile("data/menu.json", "utf8"));
}

let html = await readFile("index.template.html", "utf8");
const replacements = {
  "{{SEO_HEAD}}": seoHead(cms, menu),
  "{{HERO_HEADING}}": escH(cms.hero.heading),
  "{{HERO_HEADING_SPAN}}": escH(cms.hero.headingSpan),
  "{{HERO_SUBHEADING}}": escH(cms.hero.subheading),
  "{{HERO_IMAGE}}": escH(cms.hero.image),
  "{{HOURS_FEATURE}}": escH(hoursFeature(cms.hours)),
  "{{PHONE_DISPLAY}}": escH(cms.contact.phone),
  "{{PHONE_TEL}}": escH(toTel(cms.contact.phone)),
  "{{WHATSAPP_DISPLAY}}": escH(cms.contact.whatsapp),
  "{{WHATSAPP_WAME}}": toWaMe(cms.contact.whatsapp),
  "{{ADDRESS_LINE1}}": escH(cms.contact.addressLine1),
  "{{ADDRESS_CITY}}": escH(cms.contact.addressCity),
  "{{FOOTER_HOURS_HTML}}": footerHoursHtml(cms.hours),
  "{{SUPABASE_URL}}": escH(SUPABASE_URL),
  "{{SUPABASE_ANON_KEY}}": escH(SUPABASE_ANON_KEY)
};

for (const [token, value] of Object.entries(replacements)) {
  html = html.replaceAll(token, value);
}

await cp("package.json", "dist/package.json");
await cp("server.js", "dist/server.js");
await cp("index.template.html", "dist/index.template.html");
await mkdir("dist/scripts", { recursive: true });
await cp("scripts/seed.mjs", "dist/scripts/seed.mjs");
await cp("package-lock.json", "dist/package-lock.json");
await writeFile("index.html", html, "utf8");
await writeFile("dist/index.html", html, "utf8");
await writeFile("data/menu.json", `${JSON.stringify(menu, null, 2)}\n`, "utf8");
await writeFile("dist/data/menu.json", `${JSON.stringify(menu, null, 2)}\n`, "utf8");
await writeFile("robots.txt", robotsTxt(), "utf8");
await writeFile("dist/robots.txt", robotsTxt(), "utf8");
await writeFile("sitemap.xml", sitemapXml(), "utf8");
await writeFile("dist/sitemap.xml", sitemapXml(), "utf8");

// Inject Supabase credentials into admin HTML files so the SPA works without Express
async function injectAdminCreds(filePath) {
  if (!existsSync(filePath)) return;
  let content = await readFile(filePath, "utf8");
  content = content
    .replaceAll("{{SUPABASE_URL}}", SUPABASE_URL)
    .replaceAll("{{SUPABASE_ANON_KEY}}", SUPABASE_ANON_KEY);
  await writeFile(filePath, content, "utf8");
}
await injectAdminCreds("admin/index.html");
await injectAdminCreds("admin/login.html");
await injectAdminCreds("dist/admin/index.html");
await injectAdminCreds("dist/admin/login.html");
console.log("Build: injected Supabase credentials into admin HTML");
