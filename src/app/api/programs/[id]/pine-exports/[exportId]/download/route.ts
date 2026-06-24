import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { signedPineFile } from "@/lib/server/research-c2/service";
export async function GET(request:Request,{params}:{params:Promise<{id:string;exportId:string}>}){const s=await requireServerSession(),{id,exportId}=await params,file=new URL(request.url).searchParams.get("file")??"strategy_visualization.pine";try{return NextResponse.redirect(await signedPineFile(id,s.account_id,exportId,file));}catch(error){return NextResponse.json({error:{code:"pine_download_failed",message:error instanceof Error?error.message:"pine_download_failed"}},{status:404});}}
