import type { PlayerTime } from "@viptv/video";
export interface BufferSegment { start:number; end:number; }
/** Fractions of the title timeline, preserving real HTML gaps and managed offsets. */
export function playerBuffer(time:PlayerTime,duration:number,media?:Pick<HTMLMediaElement,"currentTime"|"buffered">|null):BufferSegment[] {
  if(!Number.isFinite(duration)||duration<=0)return [];
  const ranges:BufferSegment[]=[];
  const add=(start:number,end:number)=>{
    if(!Number.isFinite(start)||!Number.isFinite(end))return;
    start=Math.max(0,start);end=Math.min(duration,end);
    if(end>start)ranges.push({start:start/duration,end:end/duration});
  };
  if(media?.buffered?.length){
    const offset=Math.max(0,time.positionSeconds-media.currentTime);
    for(let i=0;i<media.buffered.length;i++)add(media.buffered.start(i)+offset,media.buffered.end(i)+offset);
  } else if(time.bufferedEndSeconds!=null)add(time.positionSeconds,time.bufferedEndSeconds);
  return ranges;
}
