const assets = import.meta.glob("./images/*", {
  eager: true,
  query: "?url",
  import: "default",
});

export function image(name) {
  return assets[`./images/${name}`] || assets["./images/indian.jpg"];
}
