import { renderCertificateBadgeSvg } from "@/KYAregistry/services/public-registry";

export async function GET(_request: Request, context: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await context.params;
  const svg = await renderCertificateBadgeSvg(certificateId);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
