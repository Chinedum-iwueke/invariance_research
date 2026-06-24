import { createHash, randomUUID } from "node:crypto";
import { getResearchProgramDetail } from "@/lib/server/research-programs/service";
import { c2Repository } from "@/lib/server/research-c2/repository";
import { credentialHint, encryptExchangeCredentials } from "./credential-vault";
import { c3Repository } from "./repository";
import type { DeploymentCommandType, ExchangeEnvironment, ExchangeProductType, ExchangeVenue, StrategyDeployment } from "./models";
import { assertQueueAccepting } from "@/lib/server/ops/operations-policy";
import { configureSafetyPolicy } from "@/lib/server/research-execution/service";
import { executionSafetyRepository } from "@/lib/server/research-execution/repository";

const canonicalHash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value,Object.keys(value as object).sort())).digest("hex");
async function assertProgram(programId:string,accountId:string){const p=await getResearchProgramDetail(programId,accountId);if(!p)throw new Error("program_not_found");return p;}

export async function getC3Detail(programId:string,accountId:string){await assertProgram(programId,accountId);return c3Repository.detail(programId,accountId);}

export async function createExchangeConnector(input:{accountId:string;userId:string;venue:ExchangeVenue;environment:ExchangeEnvironment;productType:ExchangeProductType;label:string;apiKey:string;apiSecret:string;withdrawalsDisabled:boolean}){
  if(!["bybit","binance"].includes(input.venue))throw new Error("exchange_venue_unsupported");
  if(!["demo","live"].includes(input.environment))throw new Error("exchange_environment_invalid");
  if(!["spot","perpetual"].includes(input.productType))throw new Error("exchange_product_type_invalid");
  if(input.withdrawalsDisabled!==true)throw new Error("withdrawal_permission_must_be_disabled");
  const now=new Date().toISOString(),id=randomUUID();
  await c3Repository.insertConnector({connector_id:id,account_id:input.accountId,created_by_user_id:input.userId,venue:input.venue,environment:input.environment,product_type:input.productType,label:input.label.trim().slice(0,80)||`${input.venue} ${input.productType} ${input.environment}`,status:"pending",credential_ciphertext:encryptExchangeCredentials({api_key:input.apiKey,api_secret:input.apiSecret}),credential_key_version:"v1",api_key_hint:credentialHint(input.apiKey),permissions:{trade_required:true,withdrawals_forbidden:true,withdrawals_disabled_attested:true,verified:false},doctor:{status:"queued",message:"Connector validation is waiting for the execution worker."},created_at:now,updated_at:now});
  return {connector_id:id,status:"pending",api_key_hint:credentialHint(input.apiKey)};
}

export async function createDeployment(input:{programId:string;accountId:string;userId:string;connectorId:string;qualificationId:string;symbols:string[];riskPolicy:Record<string,unknown>;confirmLiveCanary?:boolean;demoDeploymentId?:string}){
  await assertProgram(input.programId,input.accountId);
  const connector=await c3Repository.findConnector(input.connectorId,input.accountId);
  if(!connector||connector.status!=="healthy")throw new Error("healthy_connector_required");
  if(connector.permissions.withdrawals_disabled_attested!==true)throw new Error("withdrawal_permission_attestation_required");
  const detail=await c2Repository.detail(input.programId,input.accountId),qualification=detail.qualifications.find(q=>q.qualification_id===input.qualificationId&&q.status==="qualified"&&q.approved_at);
  if(!qualification)throw new Error("approved_qualification_required");
  const symbols=[...new Set(input.symbols.map(s=>s.trim().toUpperCase()).filter(Boolean))];
  if(!symbols.length||symbols.length>10)throw new Error("deployment_symbols_invalid");
  if(connector.environment==="live"&&!input.confirmLiveCanary)throw new Error("live_canary_confirmation_required");
  const maxNotional=Number(input.riskPolicy.max_notional_usd),maxPositions=Number(input.riskPolicy.max_open_positions);
  if(!Number.isFinite(maxNotional)||maxNotional<=0||!Number.isInteger(maxPositions)||maxPositions<=0)throw new Error("deployment_risk_policy_invalid");
  if(connector.environment==="live"&&(maxNotional>1_000||maxPositions>3||symbols.length>3))throw new Error("live_canary_risk_cap_exceeded");
  if(connector.environment==="live"){
    if(!input.demoDeploymentId)throw new Error("approved_demo_promotion_required");
    const demo=await c3Repository.findDeployment(input.demoDeploymentId,input.accountId);if(!demo||demo.program_id!==input.programId||demo.environment!=="demo"||demo.strategy_spec_hash!==qualification.strategy_spec_hash)throw new Error("matching_demo_deployment_required");
    const execution=await executionSafetyRepository.detail(input.programId,input.accountId),promotion=execution.promotions.find(item=>item.deployment_id===demo.deployment_id&&item.to_stage==="live_canary"&&item.status==="approved");if(!promotion)throw new Error("approved_demo_promotion_required");
  }
  const now=new Date().toISOString();
  const row:StrategyDeployment={deployment_id:randomUUID(),program_id:input.programId,account_id:input.accountId,connector_id:connector.connector_id,qualification_id:qualification.qualification_id,venue:connector.venue,environment:connector.environment,product_type:connector.product_type,status:"draft",symbols,strategy_spec_hash:qualification.strategy_spec_hash,risk_policy_hash:qualification.risk_policy_hash,config_hash:qualification.config_hash,risk_policy:input.riskPolicy,live_canary_approved:connector.environment==="live"&&input.confirmLiveCanary===true,created_by_user_id:input.userId,approved_by_user_id:input.userId,approved_at:now,created_at:now,updated_at:now};
  await c3Repository.insertDeployment(row);
  await configureSafetyPolicy({deploymentId:row.deployment_id,accountId:row.account_id,userId:input.userId,approve:true,policy:{allowed_symbols:symbols,max_order_quantity:Number(input.riskPolicy.max_order_quantity??1),max_order_notional_usd:Number(input.riskPolicy.max_order_notional_usd??maxNotional),max_gross_notional_usd:Number(input.riskPolicy.max_gross_notional_usd??maxNotional),max_open_orders:Number(input.riskPolicy.max_open_orders??Math.max(1,maxPositions)),max_open_positions:maxPositions,max_daily_loss_usd:Number(input.riskPolicy.max_daily_loss_usd??Math.max(1,maxNotional*.05)),max_session_loss_usd:Number(input.riskPolicy.max_session_loss_usd??Math.max(1,maxNotional*.1)),close_positions_on_emergency_freeze:input.riskPolicy.close_positions_on_emergency_freeze===true}});return row;
}

export async function revokeExchangeConnector(input:{connectorId:string;accountId:string}){const connector=await c3Repository.findConnector(input.connectorId,input.accountId);if(!connector)throw new Error("connector_not_found");await c3Repository.revokeConnector(input.connectorId,input.accountId);return {connector_id:input.connectorId,status:"revoked" as const};}
export async function replaceExchangeConnectorCredentials(input:{connectorId:string;accountId:string;apiKey:string;apiSecret:string}){const connector=await c3Repository.findConnector(input.connectorId,input.accountId);if(!connector)throw new Error("connector_not_found");const ciphertext=encryptExchangeCredentials({api_key:input.apiKey,api_secret:input.apiSecret});await c3Repository.replaceConnectorCredentials(input.connectorId,input.accountId,ciphertext,credentialHint(input.apiKey));return {connector_id:input.connectorId,status:"pending" as const,api_key_hint:credentialHint(input.apiKey)};}

export async function enqueueDeploymentCommand(input:{deploymentId:string;accountId:string;userId:string;commandType:DeploymentCommandType;idempotencyKey?:string;payload?:Record<string,unknown>}){
  assertQueueAccepting("execution");
  const deployment=await c3Repository.findDeployment(input.deploymentId,input.accountId);if(!deployment)throw new Error("deployment_not_found");
  const allowed:Record<string,DeploymentCommandType[]>={draft:["start","stop","recovery_drill"],queued:["freeze","emergency_freeze","stop"],starting:["freeze","emergency_freeze","stop"],active:["pause","freeze","emergency_freeze","recovery_drill","reconcile","submit_order","stop"],paused:["resume","emergency_freeze","recovery_drill","reconcile","stop"],frozen:["recovery_drill","reconcile","resume","stop"],failed:["recovery_drill","reconcile","stop"],stopped:["recovery_drill"]};
  if(!allowed[deployment.status]?.includes(input.commandType))throw new Error(`deployment_transition_invalid:${deployment.status}:${input.commandType}`);
  const now=new Date().toISOString(),key=input.idempotencyKey||canonicalHash({deployment:input.deploymentId,type:input.commandType,user:input.userId,minute:now.slice(0,16)});
  const existing=await c3Repository.findCommandByIdempotencyKey(key,input.accountId);if(existing)return existing;
  const command={command_id:randomUUID(),deployment_id:deployment.deployment_id,program_id:deployment.program_id,account_id:deployment.account_id,command_type:input.commandType,status:"queued" as const,idempotency_key:key,payload:{expected_status:deployment.status,strategy_spec_hash:deployment.strategy_spec_hash,risk_policy_hash:deployment.risk_policy_hash,config_hash:deployment.config_hash,...(input.payload??{})},requested_by_user_id:input.userId,available_at:now,attempt_count:0,max_attempts:3,created_at:now};
  await c3Repository.insertCommand(command);
  await executionSafetyRepository.saveAudit({deploymentId:deployment.deployment_id,programId:deployment.program_id,accountId:deployment.account_id,actionType:`command.${input.commandType}`,actorUserId:input.userId,payload:{command_id:command.command_id,idempotency_key:key,expected_status:deployment.status}});
  if(input.commandType==="start")await c3Repository.updateDeployment(deployment.deployment_id,"queued",{});return command;
}
