import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server/auth/session";
import { enforceRateLimit } from "@/lib/server/rate-limits";
import { createDeployment, createExchangeConnector, enqueueDeploymentCommand, getC3Detail, replaceExchangeConnectorCredentials, revokeExchangeConnector } from "@/lib/server/research-c3/service";
import type { DeploymentCommandType, ExchangeEnvironment, ExchangeProductType, ExchangeVenue } from "@/lib/server/research-c3/models";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const session=await requireServerSession(),{id}=await params;return NextResponse.json({detail:await getC3Detail(id,session.account_id)});}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await requireServerSession(),limited=await enforceRateLimit({request,route:"research_c3",kind:"program_write",userId:session.user_id,accountId:session.account_id});if(limited)return limited;
  const {id}=await params,body=await request.json().catch(()=>({})) as Record<string,unknown>;
  try{
    if(body.action==="create_connector")return NextResponse.json({connector:await createExchangeConnector({accountId:session.account_id,userId:session.user_id,venue:String(body.venue) as ExchangeVenue,environment:String(body.environment) as ExchangeEnvironment,productType:String(body.product_type) as ExchangeProductType,label:String(body.label??""),apiKey:String(body.api_key??""),apiSecret:String(body.api_secret??""),withdrawalsDisabled:body.withdrawals_disabled===true})});
    if(body.action==="replace_credentials")return NextResponse.json({connector:await replaceExchangeConnectorCredentials({connectorId:String(body.connector_id??""),accountId:session.account_id,apiKey:String(body.api_key??""),apiSecret:String(body.api_secret??"")})});
    if(body.action==="revoke_connector")return NextResponse.json({connector:await revokeExchangeConnector({connectorId:String(body.connector_id??""),accountId:session.account_id})});
    if(body.action==="create_deployment")return NextResponse.json({deployment:await createDeployment({programId:id,accountId:session.account_id,userId:session.user_id,connectorId:String(body.connector_id??""),qualificationId:String(body.qualification_id??""),symbols:Array.isArray(body.symbols)?body.symbols.map(String):String(body.symbols??"").split(","),riskPolicy:typeof body.risk_policy==="object"&&body.risk_policy?body.risk_policy as Record<string,unknown>:{},confirmLiveCanary:body.confirm_live_canary===true,demoDeploymentId:typeof body.demo_deployment_id==="string"?body.demo_deployment_id:undefined})});
    if(body.action==="command")return NextResponse.json({command:await enqueueDeploymentCommand({deploymentId:String(body.deployment_id??""),accountId:session.account_id,userId:session.user_id,commandType:String(body.command_type) as DeploymentCommandType,idempotencyKey:typeof body.idempotency_key==="string"?body.idempotency_key:undefined})});
    return NextResponse.json({error:{code:"action_invalid",message:"A connector, deployment, or deployment command action is required."}},{status:400});
  }catch(error){const message=error instanceof Error?error.message:"deployment_action_failed";return NextResponse.json({error:{code:message.split(":")[0],message}},{status:/not_found/.test(message)?404:/required|restricted|confirmation/.test(message)?403:400});}
}
