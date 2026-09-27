import {it,expect} from "vitest";
import {playerBuffer} from "../../src/tv-solid/playerBuffer";
it("preserves buffer gaps and maps managed media time to the title timeline",()=>{
 const media={currentTime:10,buffered:{length:2,start:(i:number)=>[0,50][i],end:(i:number)=>[30,160][i]}};
 expect(playerBuffer({positionSeconds:100,durationSeconds:200},200,media)).toEqual([{start:.45,end:.6},{start:.7,end:1}]);
});
it("uses actual engine data when HTML ranges are absent, never inventing a buffer",()=>{
 expect(playerBuffer({positionSeconds:40,durationSeconds:100,bufferedEndSeconds:70},100)).toEqual([{start:.4,end:.7}]);
 expect(playerBuffer({positionSeconds:40,durationSeconds:100},100)).toEqual([]);
 expect(playerBuffer({positionSeconds:40,durationSeconds:null,bufferedEndSeconds:70},0)).toEqual([]);
});
