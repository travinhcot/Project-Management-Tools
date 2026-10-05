// Fails if a module imports another module, shared/ imports a module, or a composition
// root (app.ts, server.ts, scripts/) imports anything but a module's interface/.
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

// Composition roots (app.ts, server.ts, scripts/) may import a module only through its interface/.
const rootFiles = [
  join(srcRoot, "app.ts"),
  join(srcRoot, "server.ts"),
  ...walk(join(srcRoot, "scripts")),
];
for (const file of rootFiles) {
  for (const match of readFileSync(file, "utf8").matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier || !specifier.startsWith(".")) continue;
    const target = resolve(dirname(file), specifier);
    if (!target.startsWith(modulesRoot)) continue;
    if (relative(modulesRoot, target).split(sep)[1] !== "interface") {
      violations.push(`${relative(srcRoot, file)}  ->  ${specifier}  (use the module's interface/)`);
    }
  }
}

if (violations.length) {
  console.error(`Cross-module imports found (${violations.length}):\n  ${violations.join("\n  ")}`);
  process.exit(1);
}
console.log("OK: no cross-module imports.");
