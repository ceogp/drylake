import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";
import { internalError, notFound } from "@/lib/api/http";
import { getAdminAiContentExportRows } from "@/lib/services/admin-ai-content";

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const unauthorized = requireAdminApiRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId")?.trim() || undefined;
    const rows = await getAdminAiContentExportRows({ userId });

    if (userId && rows.length === 0) {
      return notFound("No AI content found for this user.");
    }

    return csvResponse(userId ? `xupra-user-${userId}-ai-content.csv` : "xupra-all-user-ai-content.csv", [
      "row_id",
      "database_id",
      "created_at",
      "user_id",
      "user_email",
      "user_display_name",
      "organization_id",
      "organization_name",
      "organization_slug",
      "project_id",
      "project_name",
      "package_id",
      "package_name",
      "version_id",
      "version_number",
      "source_platform",
      "target_platform",
      "record_stage",
      "record_type",
      "item_name",
      "logical_path",
      "content",
      "metadata_json",
    ], rows.map((row) => [
      row.id,
      row.dbId,
      row.createdAt,
      row.userId,
      row.userEmail,
      row.userDisplayName,
      row.organizationId,
      row.organizationName,
      row.organizationSlug,
      row.projectId,
      row.projectName,
      row.packageId,
      row.packageName,
      row.versionId,
      row.versionNumber,
      row.sourcePlatform,
      row.targetPlatform,
      row.recordStage,
      row.recordType,
      row.itemName,
      row.logicalPath,
      row.content,
      row.metadata,
    ]));
  } catch (error) {
    console.error(error);
    return internalError("Failed to export admin AI content");
  }
}
