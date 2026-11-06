import path from 'node:path'
import {registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'

export const LOOP_RUNTIME_FILES = Object.freeze(['world-runtime-production-store.ts','world-runtime-record-validation.ts',
  'world-runtime-schema.ts','runtime-path-security.ts','world-evolution-transaction.ts','world-evolution-clock.ts','world-evolution-history.ts'])
let pending
export function loadLoopRuntime(root){
  if(pending)return pending
  pending=(async()=>{
    const dir=path.resolve(root,'src/world/runtime'),prefix=pathToFileURL(dir+path.sep).href
    const hook=registerHooks({resolve(specifier,context,next){
      if(context.parentURL?.startsWith(prefix)&&specifier.startsWith('.')&&!path.extname(specifier)){
        const url=new URL(specifier+'.ts',context.parentURL)
        if(!url.href.startsWith(prefix)||!LOOP_RUNTIME_FILES.includes(path.basename(url.pathname)))throw Error('loop_loader_dependency')
        return next(url.href,context)
      }return next(specifier,context)
    }})
    try{return {store:await import(pathToFileURL(path.join(dir,'world-runtime-production-store.ts')).href),
      validation:await import(pathToFileURL(path.join(dir,'world-runtime-record-validation.ts')).href),
      transaction:await import(pathToFileURL(path.join(dir,'world-evolution-transaction.ts')).href),
      clock:await import(pathToFileURL(path.join(dir,'world-evolution-clock.ts')).href),
      history:await import(pathToFileURL(path.join(dir,'world-evolution-history.ts')).href)}}finally{hook.deregister()}
  })();return pending
}
