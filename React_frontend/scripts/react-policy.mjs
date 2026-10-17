import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

export const allowedHooks = new Set(["useState", "useEffect", "useContext", "useMemo", "useRef"]);

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "comments", "tokens"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}

// Parse real JavaScript/JSX so comments and formatting cannot fool the audit.
export function auditReactSource(source, filename = "example.jsx") {
  const issues = [];
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  walk(ast, (node) => {
    const report = (message) => issues.push(`${filename}:${node.loc.start.line} ${message}`);
    if (node.type === "ImportDeclaration") {
      const moduleName = node.source.value;
      if (/react.*router|router.*react/.test(moduleName)) report("Router import");
      if (moduleName === "react") {
        for (const specifier of node.specifiers) {
          const name = specifier.imported?.name;
          // createContext defines providers; it is not an additional hook.
          if (
            specifier.type !== "ImportSpecifier" ||
            !(allowedHooks.has(name) || name === "createContext")
          ) {
            report("Unapproved React import");
          }
        }
      } else if (moduleName.startsWith("react-dom")) {
        if (
          moduleName !== "react-dom/client" ||
          node.specifiers.some((item) => item.imported?.name !== "createRoot")
        ) {
          report("Unapproved React DOM import");
        }
      } else {
        for (const specifier of node.specifiers) {
          if (/^use[A-Z]/.test(specifier.imported?.name || specifier.local?.name || ""))
            report("Third-party hook");
        }
      }
    }
    if (
      ["FunctionDeclaration", "FunctionExpression", "VariableDeclarator"].includes(node.type) &&
      /^use[A-Z]/.test(node.id?.name || "")
    ) {
      report("Custom hook");
    }
    if (node.type === "CallExpression") {
      const name =
        node.callee.type === "Identifier" ? node.callee.name : node.callee.property?.name;
      if (/^use[A-Z]/.test(name || "") && !allowedHooks.has(name)) report("Unapproved hook call");
    }
  });
  return issues;
}
