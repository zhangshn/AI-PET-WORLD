// Inert SVG image output only. Reject executable elements, CSS URLs and actions.
export function checkedSvgCss(css:string){
 if(/[<\\]|@(?:import|font-face|namespace)|https?:|data:|javascript:|file:|expression\s*\(|image-set\s*\(|image\s*\(|src\s*\(/i.test(css))throw Error('diagram_svg_css_rejected')
 for(const rule of css.matchAll(/@([\w-]+)/g))if(!['keyframes','-webkit-keyframes'].includes(rule[1]))throw Error('diagram_svg_css_rejected')
 for(const match of css.matchAll(/url\(([^)]+)\)/gi))if(!/^['"]?#[\w:.-]+['"]?$/.test(match[1]))throw Error('diagram_svg_css_rejected')
}
export function checkedSvgImage(source:string){
 if(source.length>2*1024*1024)throw Error('diagram_svg_limit')
 const parsed=new DOMParser().parseFromString(source,'image/svg+xml'),svg=parsed.documentElement
 if(svg.localName!=='svg'||parsed.querySelector('parsererror'))throw Error('diagram_svg_invalid')
 const allowed=new Set(['svg','g','path','rect','circle','ellipse','polygon','polyline','line','text','tspan','defs','marker','style','title','desc','clipPath','filter','feDropShadow','linearGradient','stop'])
 for(const element of [svg,...svg.querySelectorAll('*')]){
  if(!allowed.has(element.localName)||element.namespaceURI!=='http://www.w3.org/2000/svg')throw Error('diagram_svg_element_'+element.localName.toLowerCase().replace(/[^a-z]/g,'')+'_rejected')
  for(const attr of element.attributes){const name=attr.name.toLowerCase(),value=attr.value
   if(name.startsWith('on')||/href|src|action/.test(name))throw Error('diagram_svg_action_rejected')
   if(name!=='xmlns'&&/(?:[\\]|https?:|data:|javascript:|file:|@import|expression\s*\(|image-set\s*\()/i.test(value))throw Error('diagram_svg_url_rejected')
   for(const match of value.matchAll(/url\(([^)]+)\)/gi))if(!/^['"]?#[\w:.-]+['"]?$/.test(match[1]))throw Error('diagram_svg_url_rejected')
  }
  if(element.localName==='style'){
   const css=element.textContent??''
   checkedSvgCss(css)
  }
 }
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg))
}
