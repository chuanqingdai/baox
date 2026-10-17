import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const root = process.cwd();
const output = join(root, "dist");
const entries = [
  ".nojekyll",
  "index.html",
  "favicon.ico",
  "app.js",
  "styles.css",
  "header-unified.css",
  "silk-scene.css",
  "wave-layers.js",
  "assets",
  "masterclass",
  "poster",
  "collection",
  "tool",
  "about",
  "activity",
  "zhibo",
  "zx202610",
  "2026syx",
  "information",
  "membership-assets",
  "login",
  "account",
  "admin"
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const entry of entries) {
  const source = join(root, entry);
  if (!existsSync(source)) {
    throw new Error(`Missing required site entry: ${entry}`);
  }
  cpSync(source, join(output, basename(entry)), { recursive: true });
}

// Never emit controlled HTML as public static content. Vercel Functions authorize it.
for (const page of ["masterclass","poster","collection","tool","about","activity","zhibo","zx202610","2026syx","information"]) {
  const removeHtml = directory => {
    for (const entry of readdirSync(directory, {withFileTypes:true})) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) removeHtml(path);
      else if (entry.name.endsWith('.html')) rmSync(path);
    }
  };
  removeHtml(join(output, page));
}
rmSync(join(output, "account", "denied.html"), { force: true });
console.log(`BAOX.AI static site compiled to ${output}`);
