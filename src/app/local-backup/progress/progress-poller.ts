export type ProgressSurface={hidden:boolean;addEventListener:(event:string,listener:()=>void)=>void;removeEventListener:(event:string,listener:()=>void)=>void}
export type PollTimers={set:(callback:()=>void,delay:number)=>unknown;clear:(id:unknown)=>void}
export function createProgressPoller<T>({load,onData,onError,onBusy,onPause,surface,timers}:{load:(signal:AbortSignal)=>Promise<T>;onData:(data:T)=>void;onError:(error:unknown)=>void;onBusy:(busy:boolean)=>void;onPause:(paused:boolean)=>void;surface:ProgressSurface;timers:PollTimers}){
 let stopped=false,inFlight=false,timer:unknown=null,controller:AbortController|null=null,foregroundPending=false
 const clear=()=>{if(timer!==null)timers.clear(timer);timer=null}
 const schedule=()=>{clear();if(!stopped&&!surface.hidden)timer=timers.set(()=>{timer=null;void refresh()},15000)}
 async function refresh(){
  if(stopped||surface.hidden||inFlight)return false
  clear();inFlight=true;controller=new AbortController();const activeController=controller;onBusy(true)
  try{const data=await load(activeController.signal);if(!stopped&&!activeController.signal.aborted)onData(data)}
  catch(error){if(!stopped&&!activeController.signal.aborted)onError(error)}
  finally{inFlight=false;controller=null;if(!stopped){onBusy(false);if(foregroundPending&&!surface.hidden){foregroundPending=false;void refresh()}else schedule()}}
  return true
 }
 function visibility(){
  onPause(surface.hidden);clear()
  if(surface.hidden){foregroundPending=false;controller?.abort()}
  else if(inFlight)foregroundPending=true
  else void refresh()
 }
 surface.addEventListener('visibilitychange',visibility);onPause(surface.hidden);if(!surface.hidden)void refresh()
 return {refresh,stop(){stopped=true;clear();surface.removeEventListener('visibilitychange',visibility);controller?.abort()}}
}
