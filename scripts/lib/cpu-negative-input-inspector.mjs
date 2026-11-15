// Read-only CPU fixture inspection. Each factory call retains a distinct class; each instance owns its history.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export function createCpuNegativeInputInspector({ inside, cpuNegativeInputLayout, nodeIdentity, inputError, validateCpuNegativeLink, CPU_LINK_RESERVE_BYTES }) {
  return class CpuNegativeInputInspector {
  #root;#layout;#directories=new Map();#files=new Map();#links=new Map();#removed=new Set()
  constructor(root,layout){
    assert.deepEqual(layout,cpuNegativeInputLayout(layout.root.replace(/\/cpu-negative-inputs$/u,"")))
    this.#root=root;this.#layout=layout
    for(const logical of [layout.root,...layout.links.map(v=>v.target),layout.root+"/program-project",layout.root+"/program-project/scripts",layout.root+"/program-data",layout.root+"/program-data/hot",layout.root+"/program-data/hot/runtime"]){
      const stat=fs.lstatSync(inside(root,logical),{bigint:true})
      if(!stat.isDirectory()||stat.isSymbolicLink())throw inputError(logical,"CPU input directory must be ordinary")
      this.#directories.set(logical,nodeIdentity(stat))
    }
  }
  scan({requireRemoved=false,requireObserved=false}={}){
    const base=inside(this.#root,this.#layout.root),slots=new Map(this.#layout.links.map(v=>[v.path,v]));let actualFileBytes=0
    const seenFiles=new Set(),seenDirectories=new Set(),present=new Set()
    const walk=(physical,logical)=>{
      let before;try{before=fs.lstatSync(physical,{bigint:true})}catch(error){throw inputError(logical,"CPU input directory missing",error)}
      if(!before.isDirectory()||before.isSymbolicLink())throw inputError(logical,"CPU input directory redirected")
      const identity=nodeIdentity(before),previous=this.#directories.get(logical)
      if(previous!==undefined&&previous!==identity)throw inputError(logical,"CPU input directory identity replaced")
      this.#directories.set(logical,identity);seenDirectories.add(logical)
      for(const entry of fs.readdirSync(physical,{withFileTypes:true})){
        const child=path.join(physical,entry.name),name=logical+"/"+entry.name,slot=slots.get(name);let stat
        try{stat=fs.lstatSync(child,{bigint:true})}catch(error){if(slot&&error.code==="ENOENT"){this.#removed.add(name);continue}throw inputError(name,"CPU input vanished during accounting",error)}
        if(slot){
          if(this.#removed.has(name))throw inputError(name,"removed CPU link reappeared")
          const target=inside(this.#root,slot.target)
          const targetBefore=fs.lstatSync(target,{bigint:true})
          if(!targetBefore.isDirectory()||targetBefore.isSymbolicLink()||nodeIdentity(targetBefore)!==this.#directories.get(slot.target))
            throw inputError(slot.target,"CPU link ordinary target identity replaced")
          let redirect;try{redirect=fs.readlinkSync(child)}catch(error){if(error.code==="ENOENT"){this.#removed.add(name);continue}throw inputError(name,"registered CPU input link invalid",error)}
          let after;try{after=fs.lstatSync(child,{bigint:true})}catch(error){if(error.code==="ENOENT"){this.#removed.add(name);continue}throw inputError(name,"CPU link observation failed",error)}
          const linkIdentity=validateCpuNegativeLink(name,after,redirect,target,this.#links.get(name))
          if(nodeIdentity(stat)!==linkIdentity)throw inputError(name,"CPU link changed during observation")
          if(nodeIdentity(fs.lstatSync(target,{bigint:true}))!==nodeIdentity(targetBefore))throw inputError(slot.target,"CPU link target changed during observation")
          this.#links.set(name,linkIdentity);present.add(name);continue
        }
        if(stat.isSymbolicLink())throw inputError(name,"unregistered CPU input link refused")
        if(stat.isDirectory())walk(child,name)
        else if(stat.isFile()){
          const identity=nodeIdentity(stat),prior=this.#files.get(name)
          if(prior!==undefined&&prior!==identity)throw inputError(name,"CPU input file identity replaced")
          const after=fs.lstatSync(child,{bigint:true});if(nodeIdentity(after)!==identity||after.size!==stat.size)throw inputError(name,"CPU input file changed during accounting")
          this.#files.set(name,identity);seenFiles.add(name);actualFileBytes+=Number(after.size)
        }else throw inputError(name,"unsupported CPU input file type")
      }
      if(nodeIdentity(fs.lstatSync(physical,{bigint:true}))!==identity)throw inputError(logical,"CPU input directory changed during accounting")
    }
    walk(base,this.#layout.root)
    for(const logical of this.#directories.keys())if(!seenDirectories.has(logical))throw inputError(logical,"CPU input directory disappeared")
    for(const [logical,identity]of this.#directories){const current=fs.lstatSync(inside(this.#root,logical),{bigint:true});
      if(!current.isDirectory()||current.isSymbolicLink()||nodeIdentity(current)!==identity)throw inputError(logical,"CPU input directory identity replaced")}
    for(const logical of this.#files.keys())if(!seenFiles.has(logical))throw inputError(logical,"ordinary CPU input file disappeared")
    for(const logical of this.#links.keys())if(!present.has(logical))this.#removed.add(logical)
    if(requireRemoved&&present.size)throw inputError([...present][0],"CPU fixture cleanup incomplete")
    if(requireObserved&&this.#links.size!==3)throw inputError(this.#layout.root,"all three CPU links must be observed by this retained call")
    return {schema:"cpu-negative-input-observation-v1",root:this.#layout.root,actualFileBytes,
      linkMetadataReserveBytes:CPU_LINK_RESERVE_BYTES,reserveIsMeasurement:false,totalBytes:actualFileBytes+CPU_LINK_RESERVE_BYTES,
      links:this.#layout.links.map(v=>({...v,observedIdentity:this.#links.get(v.path)??null,present:present.has(v.path)})),
      directoryIdentities:[...this.#directories].map(([logical,identity])=>({path:logical,identity})),
      fixtureLinksRemoved:present.size===0}
  }
}
}
