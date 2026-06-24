import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import {
  comparePineExport,
  createAlertCredential,
  createQualification,
  generatePineExport,
  getC2Detail,
  importPine,
  previewPineCompatibility,
  revokeAlertCredential,
  syncProgramArtifactCatalog,
} from "@/lib/server/research-c2/service";
import { parseSignalCsv } from "@/lib/server/research-c2/signal-csv";

type C2ActionBody = {
  action?: string;
  spec_bundle_id?: string;
  experiment_job_id?: string;
  evidence?: Record<string, unknown>;
  approval?: Record<string, unknown>;
  confirm_exact_hashes?: boolean;
  source?: string;
  pine_export_id?: string;
  engine_signals?: Array<Record<string, unknown>>;
  tradingview_signals?: Array<Record<string, unknown>>;
  engine_signal_csv?: string;
  tradingview_signal_csv?: string;
  context?: Record<string, unknown>;
  credential_id?: string;
};

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireServerSession(),
    { id } = await params;
  return NextResponse.json({ detail: await getC2Detail(id, s.account_id) });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await requireServerSession(),
    limited = await enforceRateLimit({
      request,
      route: "research_c2",
      kind: "program_write",
      userId: s.user_id,
      accountId: s.account_id,
    });
  if (limited) return limited;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256_000)
    return NextResponse.json(
      {
        error: {
          code: "request_too_large",
          message: "This research action is limited to 256 KB.",
        },
      },
      { status: 413 },
    );
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as C2ActionBody;
  try {
    if (b.action === "sync_catalog")
      return NextResponse.json({
        catalog: await syncProgramArtifactCatalog(id, s.account_id),
      });
    if (b.action === "qualify" && b.spec_bundle_id)
      return NextResponse.json({
        qualification: await createQualification({
          programId: id,
          accountId: s.account_id,
          userId: s.user_id,
          specBundleId: b.spec_bundle_id,
          experimentJobId: b.experiment_job_id,
          evidence: b.evidence ?? {},
          approval: b.approval ?? {},
          confirmExactHashes: b.confirm_exact_hashes === true,
        }),
      });
    if (b.action === "generate_pine" && b.spec_bundle_id)
      return NextResponse.json({
        pine_export: await generatePineExport({
          programId: id,
          accountId: s.account_id,
          userId: s.user_id,
          specBundleId: b.spec_bundle_id,
        }),
      });
    if (b.action === "preview_pine" && b.spec_bundle_id)
      return NextResponse.json({
        compatibility: await previewPineCompatibility({
          programId: id,
          accountId: s.account_id,
          specBundleId: b.spec_bundle_id,
        }),
      });
    if (b.action === "import_pine" && typeof b.source === "string")
      return NextResponse.json({
        pine_import: await importPine({
          programId: id,
          accountId: s.account_id,
          userId: s.user_id,
          source: b.source,
        }),
      });
    if (b.action === "compare_pine" && b.pine_export_id)
      return NextResponse.json({
        parity: await comparePineExport({
          programId: id,
          accountId: s.account_id,
          userId: s.user_id,
          exportId: b.pine_export_id,
          engine:
            typeof b.engine_signal_csv === "string"
              ? parseSignalCsv(b.engine_signal_csv)
              : (b.engine_signals ?? []),
          tradingview:
            typeof b.tradingview_signal_csv === "string"
              ? parseSignalCsv(b.tradingview_signal_csv)
              : (b.tradingview_signals ?? []),
          context: b.context ?? {},
        }),
      });
    if (b.action === "create_alert_credential" && b.pine_export_id)
      return NextResponse.json({
        credential: await createAlertCredential({
          programId: id,
          accountId: s.account_id,
          userId: s.user_id,
          exportId: b.pine_export_id,
        }),
      });
    if (b.action === "revoke_alert_credential" && b.credential_id)
      return NextResponse.json({
        credential: await revokeAlertCredential({
          programId: id,
          accountId: s.account_id,
          credentialId: b.credential_id,
        }),
      });
    return NextResponse.json(
      {
        error: {
          code: "action_invalid",
          message:
            "A valid qualification, catalog, or Pine action is required.",
        },
      },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "research_c2_failed";
    return NextResponse.json(
      { error: { code: message.split(":")[0], message } },
      {
        status: /not_found/.test(message)
          ? 404
          : /restricted|quota/.test(message)
            ? 403
            : 400,
      },
    );
  }
}
