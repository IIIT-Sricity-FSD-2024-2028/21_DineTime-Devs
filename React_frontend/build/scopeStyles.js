// Keep the former shadow boundaries using ordinary CSS selectors. :where()
// adds no specificity, so the original rule ordering and cascade stay intact.
export function limitGlobalSelector(selector) {
  let depth = 0;
  let quote = "";
  let pseudoElement = selector.length;
  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    else if (
      depth === 0 &&
      char === ":" &&
      (selector[i + 1] === ":" ||
        /^(before|after|first-line|first-letter)(?![\w-])/.test(selector.slice(i + 1)))
    ) {
      pseudoElement = i;
      break;
    }
  }
  const limit = ":where(:not(.diner-app, .diner-app *, .staff-app, .staff-app *))";
  return selector.slice(0, pseudoElement) + limit + selector.slice(pseudoElement);
}

export function scopeActorStyles() {
  return {
    postcssPlugin: "dinetime-actor-scopes",
    OnceExit(root) {
      const file = root.source?.input.file?.replaceAll("\\", "/") || "";
      const inline = file.includes("inline");
      const staff = file.includes("/restaurant-staff/");
      const surface = staff ? ".staff-surface" : ".diner-surface";
      const animations = new Map();
      if (inline) {
        root.walkAtRules(/keyframes$/, (rule) => {
          const original = rule.params;
          const scoped = `${staff ? "staff" : "diner"}-${original}`;
          animations.set(original, scoped);
          rule.params = scoped;
        });
        root.walkDecls(/^(?:-webkit-)?animation(?:-name)?$/, (declaration) => {
          declaration.value = declaration.value.replace(
            /[\w-]+/g,
            (word) => animations.get(word) || word,
          );
        });
      }
      root.walkRules((rule) => {
        if (rule.parent.type === "atrule" && rule.parent.name.endsWith("keyframes")) return;
        rule.selectors = rule.selectors.map((selector) => {
          if (!inline) return limitGlobalSelector(selector);
          if (staff)
            selector = selector
              .replace(/:root|:host/g, surface)
              .replace(/(^|[\s>+~,(])body(?=$|[\s>+~.#:[,)])/g, `$1${surface}`);
          return selector.startsWith(surface) ? selector : `:where(${surface}) ${selector}`;
        });
      });
    },
  };
}
