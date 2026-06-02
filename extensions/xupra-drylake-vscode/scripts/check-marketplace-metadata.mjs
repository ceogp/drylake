import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const required = ["name", "publisher", "displayName", "description", "keywords"];
const missing = required.filter((key) => !pkg[key]);

if (missing.length) {
  console.error(`Missing required Marketplace fields: ${missing.join(", ")}`);
  process.exit(1);
}

if (!Array.isArray(pkg.keywords)) {
  console.error("package.json keywords must be an array.");
  process.exit(1);
}

if (pkg.keywords.length > 30) {
  console.warn(`Keyword count is ${pkg.keywords.length}. VS Code Marketplace documentation lists a 30-keyword limit; verify the Marketplace accepts the larger list before publishing.`);
}

const duplicates = pkg.keywords.filter((kw, i) => pkg.keywords.indexOf(kw) !== i);

if (duplicates.length) {
  console.error(`Duplicate keywords: ${[...new Set(duplicates)].join(", ")}`);
  process.exit(1);
}

if (pkg.description.length > 180) {
  console.warn(`Description is ${pkg.description.length} characters. Consider shortening for Marketplace display.`);
}

console.log("Marketplace metadata looks valid.");
console.log(`displayName: ${pkg.displayName}`);
console.log(`description: ${pkg.description}`);
console.log(`keywords: ${pkg.keywords.length}`);
