import {registerHooks} from 'node:module'

// The native frame reader and its CLI share this fixed TypeScript dependency.
// Keep Node resolution scoped to one original parent and one exact import;
// no caller input, directory-wide fallback or permanent global hook is accepted.
export async function loadNaturalFrameVisualBinding(){
  const parent=new URL('./game-map-visual-layer-binding.ts',import.meta.url).href
  const target=new URL('../runtime-core/source-fact-identity.ts',import.meta.url).href
  const hook=registerHooks({resolve(specifier,context,next){
    if(context.parentURL===parent&&specifier==='../runtime-core/source-fact-identity')return next(target,context)
    return next(specifier,context)
  }})
  try{return await import('./game-map-visual-layer-binding.ts')}
  finally{hook.deregister()}
}
