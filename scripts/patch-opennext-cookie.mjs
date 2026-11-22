import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// OpenNext calls cookie.default.parse. cookie@1 is marked as an ES module
// without a default export, and esbuild drops a patched default because the
// package declares sideEffects: false. Any request with a Cookie header then
// throws, which Cloudflare shows as error 1101.
const pattern = /exports\.parse=parseCookie([;,])(?!exports\.default=exports)/g;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (name.endsWith(".mjs") || name.endsWith(".js")) files.push(path);
  }
  return files;
}

let patched = 0;
for (const file of walk(".open-next")) {
  const source = readFileSync(file, "utf8");
  const next = source.replace(pattern, "exports.parse=parseCookie$1exports.default=exports$1");
  if (next !== source) {
    writeFileSync(file, next);
    patched += 1;
    console.log(`Patched cookie default export in ${file}`);
  }
}
if (patched === 0) console.log("No OpenNext cookie bundles needed a default export.");
