import { canvasFont } from "./fonts";
let context:CanvasRenderingContext2D|null;
const widths=new Map<string,number>();
export function heroLabelWidth(label:string) {
  let width=widths.get(label);
  if(width===undefined){context??=document.createElement("canvas").getContext("2d")!;context.font=`24px ${canvasFont("Onest600",24)}`;width=context.measureText(label).width;if(widths.size>100)widths.clear();widths.set(label,width);}
  return width;
}
