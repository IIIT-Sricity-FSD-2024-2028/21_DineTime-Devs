import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

async function sourceFiles(folder) {
  const items = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(
    items.map(async (item) => {
      const path = join(folder, item.name);
      if (item.isDirectory()) return sourceFiles(path);
      return /\.(js|jsx)$/.test(item.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "comments", "tokens"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}

test("every hook call has an explicit import or a local definition", async () => {
  const failures = [];
  for (const file of await sourceFiles(fileURLToPath(new URL("../src", import.meta.url)))) {
    const source = await readFile(file, "utf8");
    const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
    const available = new Set();
    for (const statement of ast.program.body) {
      if (statement.type === "ImportDeclaration") {
        for (const specifier of statement.specifiers) available.add(specifier.local.name);
      }
      if (statement.type === "FunctionDeclaration" && statement.id) available.add(statement.id.name);
      if (statement.type === "VariableDeclaration") {
        for (const declaration of statement.declarations) {
          if (declaration.id.type === "Identifier") available.add(declaration.id.name);
        }
      }
    }
    walk(ast, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
      const name = node.callee.name;
      if (/^use[A-Z]/.test(name) && !available.has(name)) failures.push(`${file}: ${name}`);
    });
  }
  assert.deepEqual(failures, []);
});
