import { getHostedCertificate } from "@/KYAregistry/services/public-registry";

export async function GET(_request: Request, context: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await context.params;
  const certificate = await getHostedCertificate(certificateId);

  if (!certificate) {
    return Response.json({ error: "KYA certificate not found." }, { status: 404 });
  }

  return Response.json(certificate, {
    headers: {
      "Cache-Control": certificate.active ? "public, max-age=300" : "no-store",
    },
  });
}
