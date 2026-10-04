// Fails if a module imports another module, or shared/ imports a module.
// Run: bun run check:boundaries  (from backend/)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = fileURLToPath(new URL("../", import.meta.url));
const modulesRoot = join(srcRoot, "modules") + sep;
const sharedRoot = join(srcRoot, "shared") + sep;
const importPattern =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

const moduleOf = (file: string) => relative(modulesRoot, file).split(sep)[0];
const violations: string[] = [];

for (const file of [...walk(modulesRoot), ...walk(sharedRoot)]) {
  for (const match of readFileSync(file, "utf8").matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier || !specifier.startsWith(".")) continue;
    const target = resolve(dirname(file), specifier);
    if (!target.startsWith(modulesRoot)) continue; // shared/, packages and built-ins are allowed
    if (file.startsWith(sharedRoot) || moduleOf(target) !== moduleOf(file)) {
      violations.push(`${relative(srcRoot, file)}  ->  ${specifier}`);
    }
  }
}

if (violations.length) {
  console.error(`Cross-module imports found (${violations.length}):\n  ${violations.join("\n  ")}`);
  process.exit(1);
}
console.log("OK: no cross-module imports.");
