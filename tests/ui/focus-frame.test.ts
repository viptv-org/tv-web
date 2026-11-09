import {expect,it} from "vitest";
import {focusFrameEdges,homeCardSize} from "../../src/tv-solid/remote/focus-frame";

it("joins all four edges within the same whole-pixel poster rectangle",()=>{
  for(const [width,height] of [[423.4,237.6],[255.2,382.8],[424,238],[256,383]]){
    const edges=focusFrameEdges(width,height),w=Math.ceil(width),h=Math.ceil(height);
    expect(edges).toHaveLength(4);
    for(const edge of edges){
      expect(Number.isInteger(edge.x)&&Number.isInteger(edge.y)&&Number.isInteger(edge.w)&&Number.isInteger(edge.h)).toBe(true);
      expect(edge.x+edge.w).toBeLessThanOrEqual(w);expect(edge.y+edge.h).toBeLessThanOrEqual(h);
    }
    expect(edges.reduce((area,edge)=>area+edge.w*edge.h,0)).toBe(w*h-(w-8)*(h-8));
  }
});
it("uses the poster's same integer bounds and does not construct an empty outline",()=>{
  expect(homeCardSize(false)).toMatchObject({width:424,height:238});
  expect(homeCardSize(true)).toMatchObject({width:256,height:383});
  expect(focusFrameEdges(0,0)).toEqual([]);
});
