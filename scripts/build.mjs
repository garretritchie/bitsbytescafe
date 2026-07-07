import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "styles.css", "script.js"];
const directories = ["images"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`);
}

for (const directory of directories) {
  await cp(directory, `dist/${directory}`, { recursive: true });
}
