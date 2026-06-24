import { requireServerSession } from "@/lib/server/auth/session";
import { executionSafetyRepository } from "@/lib/server/research-execution/repository";

export const dynamic="force-dynamic";
export const maxDuration=30;

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await requireServerSession(),{id}=await params,encoder=new TextEncoder(),after=request.headers.get("last-event-id")||new URL(request.url).searchParams.get("after")||undefined;
  const stream=new ReadableStream({async start(controller){let cursor=after,closed=false;const stop=()=>{closed=true;try{controller.close();}catch{}};request.signal.addEventListener("abort",stop,{once:true});const deadline=Date.now()+24_000;try{while(!closed&&Date.now()<deadline){const events=await executionSafetyRepository.eventsAfter(id,session.account_id,cursor,100);for(const event of events.reverse()){const occurred=String(event.occurred_at),eventId=`${occurred}|${String(event.deployment_event_id)}`;controller.enqueue(encoder.encode(`id: ${eventId}\nevent: ${String(event.event_type)}\ndata: ${JSON.stringify({...event,payload:typeof event.payload_json==="string"?JSON.parse(event.payload_json):event.payload_json})}\n\n`));cursor=eventId;}controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ts:new Date().toISOString()})}\n\n`));await new Promise(resolve=>setTimeout(resolve,1_000));}}finally{stop();}}});
  return new Response(stream,{headers:{"content-type":"text/event-stream","cache-control":"no-cache, no-transform","connection":"keep-alive","x-accel-buffering":"no"}});
}
