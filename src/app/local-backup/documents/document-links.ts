export function headingSlug(text:string){return text.toLowerCase().replace(/[`*_]/g,'').replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s/g,'-')}
export function documentHeadings(content:string){let fenced=false;const counts=new Map<string,number>();return content.split(/\r?\n/).flatMap((line,index)=>{if(/^```/.test(line)){fenced=!fenced;return[]}const match=!fenced&&line.match(/^(#{1,6})\s+(.+)$/);if(!match)return[];const base=headingSlug(match[2]),count=counts.get(base)??0;counts.set(base,count+1);return[{id:'section-'+(index+1),slug:base+(count?'-'+count:''),title:match[2],depth:match[1].length}]})}
export function safeDocumentHref(href:string|undefined,current:string,links:{documentId:string;relativePath:string}[],content:string){
 if(!href||href.length>1024||/[\\\x00-\x20]|^[a-z][a-z0-9+.-]*:|^\//i.test(href))return null
 const [file,anchor,...extra]=href.split('#');if(extra.length||file.includes('?')||/%/.test(file))return null
 if(!file){const item=documentHeadings(content).find(h=>h.slug===anchor||h.id===anchor);return item?'#'+item.id:null}
 const parts=current.split('/').slice(0,-1);for(const segment of file.split('/')){if(segment==='..'){if(!parts.length)return null;parts.pop()}else if(segment!=='.'&&segment)parts.push(segment)}
 const target=links.find(link=>link.relativePath===parts.join('/'));if(!target)return null
 const query=new URLSearchParams({id:target.documentId});if(anchor)query.set('anchor',anchor)
 return '/local-backup/documents?'+query.toString()
}
