import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { getValidationCommandLayer } from "@/lib/server/evidence/validation-command-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  const { id } = await params;
  try {
    const layer = await getValidationCommandLayer({ analysis_id: id, account_id: session.account_id });
    return NextResponse.json(layer);
  } catch (error) {
    const code = error instanceof Error ? error.message : "command_layer_failed";
    return NextResponse.json({ error: { code, message: "Validation command layer could not be loaded." } }, { status: 404 });
  }
}

