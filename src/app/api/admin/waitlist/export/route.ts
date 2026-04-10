import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/server/admin/guards";
import { isValidWaitlistStatus, listWaitlistEntries } from "@/lib/server/waitlist/repository";

function csvEscape(value: string | null | undefined) {
  const raw = value ?? "";
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export async function GET(request: Request) {
  await requireAdminSession();
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusParam && isValidWaitlistStatus(statusParam) ? statusParam : undefined;

  const rows = listWaitlistEntries(status);
  const header = ["email", "name", "source_page", "role_or_team", "status", "note", "created_at", "updated_at"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [row.email, row.name, row.source_page, row.role_or_team, row.status, row.note, row.created_at, row.updated_at].map(csvEscape).join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="research-desk-waitlist${status ? `-${status}` : ""}.csv"`,
    },
  });
}
