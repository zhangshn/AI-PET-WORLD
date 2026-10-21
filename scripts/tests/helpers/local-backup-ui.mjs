import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export function uiHarness(filename,exportName,{fetch,props={},pathname='/local-backup',url='http://localhost:3000/local-backup'}={}){
 const slots=[],effects=[],requests=[],navigation=[],listeners=new Map(),modules=new Map();let index=0,tree,currentProps=props,currentPathname=pathname
 const hooks={useState(initial){const i=index++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value}]},useRef(initial){const i=index++;return slots[i]??={current:initial}},useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){old?.cleanup?.();slots[i]={deps};effects.push(()=>slots[i].cleanup=fn())}}}
 const window={location:new URL(url),addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)}
 const navigate=(destination,kind)=>{navigation.push({destination,kind});window.location=new URL(destination,window.location);currentPathname=window.location.pathname;if(exportName==='LocalBackupWorkPanel')currentProps={date:window.location.searchParams.get('date')??undefined,moduleId:window.location.searchParams.get('moduleId')??'',reporterId:window.location.searchParams.get('reporterId')??''}}
 const router={push:destination=>navigate(destination,'push'),replace:destination=>navigate(destination,'replace')}
 const jsx=(type,props)=>typeof type==='function'?type(props):({type,props})
 const request=async(url,options)=>{requests.push({url,options});return fetch(url,options)}
 function load(filename){
  const file=path.resolve(filename);if(modules.has(file))return modules.get(file)
  const exports={};modules.set(file,exports)
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  new Function('require','exports','fetch','window',code)(name=>{
   if(name==='react')return hooks
   if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'}
   if(name==='next/link')return'a'
   if(name==='next/navigation')return{useRouter:()=>router,usePathname:()=>currentPathname}
   if(name.endsWith('.css'))return new Proxy({},{get:(_,key)=>String(key)})
   if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);return load(target+(fs.existsSync(target+'.tsx')?'.tsx':'.ts'))}
   throw Error('Unexpected test import: '+name)
  },exports,request,window)
  return exports
 }
 const component=load(filename)[exportName]
 const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)]
 const text=node=>node===null||node===undefined?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children)
 const render=()=>{index=0;tree=component(currentProps);for(const fn of effects.splice(0))fn();return tree}
 render()
 return{render,requests,navigation,nodes:()=>nodes(tree),text:()=>text(tree),button:name=>nodes(tree).find(node=>node.type==='button'&&text(node).startsWith(name)),setProps(value){currentProps=value;render()},backTo(destination){navigate(destination,'popstate');render()},hash(value){window.location.hash=value;listeners.get('hashchange')?.();render()},async tick(){for(let i=0;i<40;i++)await Promise.resolve();render()},unmount(){for(const slot of slots)slot?.cleanup?.()}}
}
export const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body})
