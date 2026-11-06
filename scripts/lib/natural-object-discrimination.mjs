import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

// Diagnostic cutoffs fixed before the 208 evaluation. No role uses a palette,
// template, expected class, footprint, label, filename or caller-selected threshold.
export const RULES=Object.freeze({
  version:"rgb-object-morphology-diagnostic-v1",minimumContrast:12,borderMadMultiplier:2.5,
  minAreaFraction:0.02,minAreaPixels:8,maxForegroundFraction:0.78,maxEmptyBorderMedian:10,
  minRockFill:0.56,maxRockPerimeter:7,minRockInterior:0.48,maxRockBranchRows:0.25,
  minVegetationBranchRows:0.24,minVegetationPerimeter:6.5,maxVegetationFill:0.65,maxVegetationInterior:0.50,
});
const MAX_PIXELS=256*256,MAX_BYTES=1024*1024;
function quantile(a,q){
  a.sort((x,y)=>x-y);
  return a[Math.floor((a.length-1)*q)];
}
function rgbDistance(data,i,center){
  const dr=data[3*i]-center[0],dg=data[3*i+1]-center[1],db=data[3*i+2]-center[2];
  return Math.sqrt((dr*dr+dg*dg+db*db)/3);
}

function components(mask,w,h){
  const seen=new Uint8Array(mask.length),groups=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;
    const queue=[start];seen[start]=1;let sumX=0,sumY=0;
    for(let i=0;i<queue.length;i++){
      const at=queue[i],x=at%w,y=Math.floor(at/w);
      sumX+=x;sumY+=y;
      for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++){
        for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
          const n=yy*w+xx;if(!mask[n]||seen[n])continue;
          seen[n]=1;queue.push(n);
        }
      }
    }
    const distance=Math.hypot(sumX/queue.length/(w-1)-0.5,sumY/queue.length/(h-1)-0.5);
    groups.push({pixels:queue,score:queue.length*(1-Math.min(0.5,distance))});
  }
  return groups;
}

function morphology(pixels,w,h){
  const mask=new Uint8Array(w*h);
  let l=w,r=-1,t=h,b=-1;
  for(const p of pixels){
    mask[p]=1;const x=p%w,y=Math.floor(p/w);
    l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
  }
  const radius=Math.min(r-l+1,b-t+1)>=30?2:1;
  const occupied=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&mask[y*w+x]===1;
  let perimeter=0,interior=0,branchRows=0;
  for(let y=t;y<=b;y++){
    let runs=0;
    for(let x=l;x<=r;x++){
      if(!occupied(x,y))continue;
      if(!occupied(x-1,y)){runs++;perimeter++;}
      if(!occupied(x+1,y))perimeter++;
      if(!occupied(x,y-1))perimeter++;
      if(!occupied(x,y+1))perimeter++;
      let inside=true;
      for(let dy=-radius;inside&&dy<=radius;dy++){
        for(let dx=-radius;dx<=radius;dx++){
          if(!occupied(x+dx,y+dy)){inside=false;break;}
        }
      }
      if(inside)interior++;
    }
    if(runs>=2)branchRows++;
  }
  return {area:pixels.length,fill:pixels.length/((r-l+1)*(b-t+1)),
    scaledPerimeter:perimeter/Math.sqrt(pixels.length),interiorFraction:interior/pixels.length,
    branchRowFraction:branchRows/(b-t+1),erosionRadius:radius};
}

export function classifyRgb(data,width,height){
  if(!(data instanceof Uint8Array)||![width,height].every(n=>Number.isInteger(n)&&n>=8&&n<=256)
      ||data.length!==3*width*height)throw Error("one bounded RGB crop required");
  const edge=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x<2||y<2||x>=width-2||y>=height-2)edge.push(y*width+x);
  }
  const center=[0,1,2].map(c=>quantile(edge.map(i=>data[i*3+c]),0.5));
  const border=edge.map(i=>rgbDistance(data,i,center)),median=quantile(border,0.5);
  const mad=quantile(border.map(n=>Math.abs(n-median)),0.5);
  const cut=Math.max(RULES.minimumContrast,median+RULES.borderMadMultiplier*mad);
  const distances=[],mask=new Uint8Array(width*height);
  for(let i=0;i<mask.length;i++){
    const value=rgbDistance(data,i,center);distances.push(value);mask[i]=Number(value>cut);
  }
  const minArea=Math.max(RULES.minAreaPixels,Math.ceil(mask.length*RULES.minAreaFraction));
  const candidates=components(mask,width,height).filter(c=>c.pixels.length>=minArea).sort((a,b)=>b.score-a.score);
  const fg=mask.reduce((s,x)=>s+x,0)/mask.length;
  const evidence={borderMedianDistance:median,borderMAD:mad,contrastCut:cut,foregroundFraction:fg,componentsAboveMinimum:candidates.length};
  function answer(prediction,reason){return {version:RULES.version,prediction,reason,evidence};}
  if(!candidates.length){
    if(median<=RULES.maxEmptyBorderMedian && quantile(distances,0.90)<=Math.max(10,cut*0.8))return answer("empty","background_consistent_no_distinct_component");
    return answer("abstain","no_resolved_foreground_against_complex_background");
  }
  if(fg>RULES.maxForegroundFraction)return answer("abstain","insufficient_local_background");
  const s=morphology(candidates[0].pixels,width,height);
  evidence.shape=s;
  if(s.fill>=RULES.minRockFill && s.scaledPerimeter<=RULES.maxRockPerimeter &&
      s.interiorFraction>=RULES.minRockInterior && s.branchRowFraction<=RULES.maxRockBranchRows)return answer("rock","compact_solid_component");
  if(s.branchRowFraction>=RULES.minVegetationBranchRows && s.scaledPerimeter>=RULES.minVegetationPerimeter &&
      (s.fill<RULES.maxVegetationFill||s.interiorFraction<RULES.maxVegetationInterior))return answer("vegetation","thin_branched_component");
  return answer("abstain","shape_does_not_resolve_competing_classes");
}

export async function classifyCrop(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX_BYTES)throw Error("one bounded RGB crop required");
  const decode=sharp(bytes,{limitInputPixels:MAX_PIXELS,failOn:"error"}),metadata=await decode.metadata();
  if(!["png","jpeg"].includes(metadata.format)||metadata.channels!==3||metadata.depth!=="uchar"
      ||metadata.space!=="srgb"||metadata.pages>1)throw Error("one 8-bit RGB crop without a mask or alpha channel required");
  const {data,info}=await decode.raw().toBuffer({resolveWithObject:true});
  return classifyRgb(data,info.width,info.height);
}

async function cli(){
  const arg=process.argv[2];
  if(process.argv.length!==3)throw Error("supply one RGB crop file or --stdin");
  let bytes;
  if(arg==="--stdin"){
    const parts=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;if(size>MAX_BYTES)throw Error("crop too large");parts.push(chunk);}
    bytes=Buffer.concat(parts,size);
  }else{
    if(fs.statSync(arg).size>MAX_BYTES)throw Error("crop too large");
    bytes=fs.readFileSync(arg);
  }
  console.log(JSON.stringify(await classifyCrop(bytes)));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  cli().catch(error=>{process.stderr.write(error.message+"\n");process.exitCode=1;});
}
