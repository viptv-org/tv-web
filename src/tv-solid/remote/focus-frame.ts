export const homeCardSize = (portrait: boolean) => portrait
  ? { width: 256, height: 383, step: 271.2 }
  : { width: 424, height: 238, step: 442.4 };

export function focusFrameEdges(width: number, height: number, thickness = 4) {
  const w=Math.ceil(width),h=Math.ceil(height),stroke=Math.min(thickness,Math.floor(Math.min(w,h)/2));
  if (!(w>0&&h>0&&stroke>0)) return [];
  return [
    {id:"top",x:0,y:0,w,h:stroke},
    {id:"bottom",x:0,y:h-stroke,w,h:stroke},
    {id:"left",x:0,y:stroke,w:stroke,h:h-2*stroke},
    {id:"right",x:w-stroke,y:stroke,w:stroke,h:h-2*stroke},
  ];
}
