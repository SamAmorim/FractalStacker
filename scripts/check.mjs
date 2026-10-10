import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const listModules = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return listModules(full);
  return entry.name.endsWith(".js") ? [full] : [];
});

const exportsOf = new Map();
const modules = listModules(SRC);
const problems = [];

for (const file of modules) {
  const source = fs.readFileSync(file, "utf8");
  try {
    new vm.SourceTextModule(source, { identifier: file });
  } catch (error) {
    problems.push(path.relative(ROOT, file) + ": " + error.message);
  }
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    match[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach((name) => names.add(name));
  }
  exportsOf.set(file, { source, names });
}

for (const [file, { source }] of exportsOf) {
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), match[2]);
    const targetInfo = exportsOf.get(target);
    if (!targetInfo) {
      problems.push(path.relative(ROOT, file) + ": missing module " + match[2]);
      continue;
    }
    match[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((name) => {
      if (!targetInfo.names.has(name)) {
        problems.push(path.relative(ROOT, file) + ": '" + name + "' is not exported by " + match[2]);
      }
    });
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("ok: " + modules.length + " modules, imports resolved");
