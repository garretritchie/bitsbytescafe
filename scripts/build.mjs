import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const files = ["styles.css", "script.js"];
const directories = ["images", "data", "admin"];

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

const cms = JSON.parse(await readFile("data/cms-data.json", "utf8"));
let html = await readFile("index.template.html", "utf8");
const replacements = {
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
  "{{FOOTER_HOURS_HTML}}": footerHoursHtml(cms.hours)
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
