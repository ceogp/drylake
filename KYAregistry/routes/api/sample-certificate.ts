import { getSampleCertificate } from "@/KYAregistry/services/sample-certificate";

export async function GET() {
  return Response.json(getSampleCertificate(), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
