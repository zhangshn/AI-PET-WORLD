import {resolveRuntimePath} from './runtime-working-directory.mjs'
import path from 'node:path'
import {registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'

export const LOOP_RUNTIME_FILES = Object.freeze(['world-runtime-production-store.ts','world-runtime-record-validation.ts',
  'world-runtime-schema.ts','runtime-path-security.ts','world-evolution-transaction.ts','world-evolution-clock.ts','world-evolution-history.ts'])
const pendingByRoot = new Map()
export function loadLoopRuntime(root){
  const key=resolveRuntimePath(root)
  if(pendingByRoot.has(key))return pendingByRoot.get(key)
  const pending=(async()=>{
    const dir=resolveRuntimePath(root,'src/world/runtime'),prefix=pathToFileURL(dir+path.sep).href
    const hook=registerHooks({resolve(specifier,context,next){
      if(context.parentURL?.startsWith(prefix)&&specifier.startsWith('.')&&!path.extname(specifier)){
        const url=new URL(specifier+'.ts',context.parentURL)
        if(!url.href.startsWith(prefix)||!LOOP_RUNTIME_FILES.includes(path.basename(url.pathname)))throw Error('loop_loader_dependency')
        return next(url.href,context)
      }return next(specifier,context)
    }})
    try{return {store:await import(/* webpackIgnore: true */ pathToFileURL(path.join(dir,'world-runtime-production-store.ts')).href),
      validation:await import(/* webpackIgnore: true */ pathToFileURL(path.join(dir,'world-runtime-record-validation.ts')).href),
      transaction:await import(/* webpackIgnore: true */ pathToFileURL(path.join(dir,'world-evolution-transaction.ts')).href),
      clock:await import(/* webpackIgnore: true */ pathToFileURL(path.join(dir,'world-evolution-clock.ts')).href),
      history:await import(/* webpackIgnore: true */ pathToFileURL(path.join(dir,'world-evolution-history.ts')).href)}}finally{hook.deregister()}
  })()
  pendingByRoot.set(key,pending)
  pending.catch(()=>{if(pendingByRoot.get(key)===pending)pendingByRoot.delete(key)})
  return pending
}
