import { getKyaRegistryIssuerMetadata } from "@/KYAregistry/services/public-registry";

export async function GET() {
  return Response.json(await getKyaRegistryIssuerMetadata(), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
