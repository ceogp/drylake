import { z } from "zod";

import { created, fromZodError, internalError } from "@/lib/api/http";
import { startExtensionAuthRequest } from "@/lib/services/extension-auth-requests";

const payloadSchema = z.object({
  editor: z.enum(["vscode", "cursor"]).default("vscode"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const connectRequest = await startExtensionAuthRequest({
      editor: parsed.data.editor,
    });

    return created(connectRequest);
  } catch (error) {
    console.error(error);
    return internalError("Failed to start extension browser connect");
  }
}