import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const provider = process.argv[2];
  const outputPathArg = process.argv[3];

  if (!provider || !outputPathArg) {
    throw new Error("Usage: tsx scripts/prisma/render-schema.ts <provider> <outputPath>");
  }

  const inputPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const outputPath = path.resolve(process.cwd(), outputPathArg);
  const source = await fs.readFile(inputPath, "utf8");
  const rendered = source.replace('provider = env("DATABASE_PROVIDER")', `provider = "${provider}"`);

  if (rendered === source) {
    throw new Error("Unable to render provider-specific Prisma schema.");
  }

  await fs.writeFile(outputPath, rendered, "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
