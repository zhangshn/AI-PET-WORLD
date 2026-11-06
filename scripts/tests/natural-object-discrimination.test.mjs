import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {classifyRgb,classifyCrop} from "../lib/natural-object-discrimination.mjs";

test("identical bounded flat RGB has a neutral result independent of hue",()=>{
  for(const color of [[12,35,19],[224,210,180]]){
    const data=Buffer.alloc(20*20*3);
    for(let i=0;i<data.length;i+=3)for(let c=0;c<3;c++)data[i+c]=color[c];
    assert.equal(classifyRgb(data,20,20).prediction,"empty");
  }
});
test("RGB input must be bounded and cannot include a truth mask or alpha plane",async()=>{
  assert.throws(()=>classifyRgb(Buffer.alloc(4*8*8),8,8),/bounded RGB/);
  assert.throws(()=>classifyRgb(Buffer.alloc(3),1,1),/bounded RGB/);
  const png=await sharp(Buffer.alloc(8*8*4),{raw:{width:8,height:8,channels:4}}).png().toBuffer();
  await assert.rejects(classifyCrop(png),/without a mask/);
});
test("a salient thin stripe without branching or solid interior causes abstention",()=>{
  const w=64,data=Buffer.alloc(w*w*3,100);
  for(let y=31;y<=32;y++)for(let x=8;x<56;x++)data.fill(180,(y*w+x)*3,(y*w+x)*3+3);
  assert.equal(classifyRgb(data,w,w).prediction,"abstain");
});
