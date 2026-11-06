export function nativePixelAt(clientX,clientY,rect,width,height){
  if(![clientX,clientY,rect?.left,rect?.top,rect?.width,rect?.height,width,height].every(Number.isFinite)||
    rect.width<=0||rect.height<=0||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)return null
  const x=(clientX-rect.left)/rect.width,y=(clientY-rect.top)/rect.height
  if(x<0||y<0||x>1||y>1)return null
  return {x:Math.min(width-1,Math.floor(x*width)),y:Math.min(height-1,Math.floor(y*height))}
}
