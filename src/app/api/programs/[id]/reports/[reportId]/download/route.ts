import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getProgramReportOwned, renderProgramReport } from "@/lib/server/research-programs/program-report-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await requireServerSession();
  const { id, reportId } = await params;
  const report = await getProgramReportOwned(reportId, session.account_id);
  if (!report || report.program_id !== id) return NextResponse.json({ error: "program_report_not_found" }, { status: 404 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "md";
  const rendered = renderProgramReport(report, format);
  return new NextResponse(rendered.bytes, {
    status: 200,
    headers: {
      "content-type": rendered.content_type,
      "content-disposition": `attachment; filename=${rendered.file_name}`,
    },
  });
}
