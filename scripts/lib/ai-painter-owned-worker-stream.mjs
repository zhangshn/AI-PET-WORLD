// Stream transport only. No receipt authority, process ownership, filesystem,
// resource admission or cleanup. The caller retains all live-call state.
import assert from "node:assert/strict"

// Parsing is still per frame; expensive disk accounting is once per incoming
// block and again at finalization. No disk total is cached between callbacks.
export function consumeNativeOwnerChunk(pending,chunk,{onFrame,onError,onOverflow,account}){
 let input=pending+chunk.toString("ascii"),index,frames=0;
 while((index=input.indexOf("\n"))>=0){
  const line=input.slice(0,index).trimEnd();input=input.slice(index+1);frames++;
  try{onFrame(line)}catch(error){onError(error)}
 }
 if(input.length>65536){onOverflow();input="";}
 if(frames)try{account()}catch(error){onError(error)}
 return input;
}
// Install only AFTER retained error/close listeners. An asynchronous spawn
// failure has no child PID and must follow those original failure handlers.
export function deferCompletionParserUntilSpawn(child,create,onReady,onFailure){
 assert(child.listenerCount("error")>0&&child.listenerCount("close")>0,"retained failure listeners required before parser startup");
 child.once("spawn",()=>{try{
   assert(Number.isInteger(child.pid)&&child.pid>0,"real spawned owner PID required");
   onReady(create(child.pid));
 }catch(error){onFailure(error)}});
}
// Terminal-frame observation only closes this call's control-writing window;
// it grants no cleanup authority. Every control error still reaches the same
// strict protocol-error handler, including a write already in flight.
export function createRetainedNativeStopSender(child,{isClosed,isSettled,hasTerminalFrame,onError}){
 let sent=false;
 child.stdin.on("error",onError);
 return reason=>{
  if(sent||isClosed()||isSettled()||hasTerminalFrame()||child.exitCode!==null||child.signalCode!==null
    ||child.stdin.destroyed||!child.stdin.writable||child.stdin.writableEnded||child.stdin.writableFinished)return false;
  sent=true;
  child.stdin.write(Buffer.from(reason).toString("base64")+"\n");
  return true;
 };
}
// Capture an already observed execution/transport failure before the later
// fixture, cleanup and receipt checks. This selects error precedence only;
// every existing acceptance and cleanup condition still fails closed.
export function primaryErrorBeforeNativeFinalization({primaryError=null,stopReason=null,protocolError=null,proof=null}){
 if(primaryError)return primaryError;
 if(stopReason)return new Error(stopReason);
 if(protocolError)return new Error(protocolError);
 if(typeof proof?.stopReason==="string"&&proof.stopReason)return new Error(proof.stopReason);
 if(Number.isInteger(proof?.exitCode)&&proof.exitCode!==0)
  return Object.assign(new Error(`worker_exit_${proof.exitCode}`),{status:proof.exitCode});
 return null;
}
