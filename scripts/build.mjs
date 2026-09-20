import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
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
  "activity"
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

console.log(`BAOX.AI static site compiled to ${output}`);
