import { getPublicRegistryExplorer } from "@/KYAregistry/services/public-registry";

function firstValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const registry = await getPublicRegistryExplorer({
    q: firstValue(searchParams.get("q")),
    type: firstValue(searchParams.get("type")),
    risk: firstValue(searchParams.get("risk")),
    kya: firstValue(searchParams.get("kya")),
    protocol: firstValue(searchParams.get("protocol")),
  });

  return Response.json(registry, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
