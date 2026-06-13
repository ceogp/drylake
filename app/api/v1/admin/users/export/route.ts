import { requireAdminApiRequest } from "@/app/api/v1/admin/_lib/access";
import { internalError } from "@/lib/api/http";
import { getAdminUsersExportRows } from "@/lib/services/admin-ai-content";

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
    const users = await getAdminUsersExportRows();

    return csvResponse("xupra-users.csv", [
      "user_id",
      "email",
      "display_name",
      "auth_provider",
      "auth_subject",
      "status",
      "created_at",
      "updated_at",
      "job_title",
      "phone_number",
      "country",
      "address_line_1",
      "address_line_2",
      "city",
      "region",
      "postal_code",
      "signup_plan_intent",
      "onboarding_completed_at",
      "timezone",
      "locale",
      "memberships_json",
      "created_projects",
      "created_packages",
      "created_versions",
      "transform_jobs",
      "deployment_jobs",
    ], users.map((user) => [
      user.id,
      user.email,
      user.profile?.displayName ?? "",
      user.authProvider,
      user.authSubject,
      user.status,
      user.createdAt,
      user.updatedAt,
      user.profile?.jobTitle ?? "",
      user.profile?.phoneNumber ?? "",
      user.profile?.country ?? "",
      user.profile?.addressLine1 ?? "",
      user.profile?.addressLine2 ?? "",
      user.profile?.city ?? "",
      user.profile?.region ?? "",
      user.profile?.postalCode ?? "",
      user.profile?.signupPlanIntent ?? "",
      user.profile?.onboardingCompletedAt ?? "",
      user.profile?.timezone ?? "",
      user.profile?.locale ?? "",
      user.memberships.map((membership) => ({
        role: membership.role,
        createdAt: membership.createdAt,
        organization: membership.organization,
      })),
      user._count.createdProjects,
      user._count.createdPackages,
      user._count.createdVersions,
      user._count.transformJobs,
      user._count.deploymentJobs,
    ]));
  } catch (error) {
    console.error(error);
    return internalError("Failed to export admin users");
  }
}
