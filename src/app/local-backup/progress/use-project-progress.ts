'use client'
import {useEffect,useRef,useState} from 'react'
import {reason} from '../local-backup-shared'
import {createProgressPoller,type ProgressSurface} from './progress-poller'
import type {ProgressResponse} from './progress-types'

export function useProjectProgress(){
 const [state,setState]=useState<{data:ProgressResponse|null;error:string;busy:boolean;paused:boolean}>({data:null,error:'',busy:false,paused:false}),poller=useRef<ReturnType<typeof createProgressPoller<ProgressResponse>>|null>(null)
 useEffect(()=>{
  // Fallback only serves non-DOM component render harnesses. Browsers always use
  // their real document visibility and AbortController-backed request.
  const surface:ProgressSurface=window.document??{hidden:false,addEventListener(){},removeEventListener(){}}
  const instance=createProgressPoller<ProgressResponse>({surface,timers:{set:(callback,delay)=>setTimeout(callback,delay),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>)},load:async signal=>{
   const response=await fetch('/api/local-backup/project-progress',{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])}),value=await response.json()
   if(!response.ok)throw Error(value.reasonCode??'progress_read_failed')
   if(!value.projection?.mvp)throw Error('progress_projection_incomplete')
   return value
  },onData:data=>setState(previous=>({...previous,data,error:''})),onError:error=>setState(previous=>({...previous,error:reason(error)})),onBusy:busy=>setState(previous=>({...previous,busy})),onPause:paused=>setState(previous=>({...previous,paused}))})
  poller.current=instance;return()=>{instance.stop();poller.current=null}
 },[])
 return {...state,refresh:()=>poller.current?.refresh()}
}
