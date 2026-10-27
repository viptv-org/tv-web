import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {edgeRequest,joinChannelWindow,pageRequest,validateChannelPage} from '../../src/tv-solid/remote/channelWindow';
import type {LivePage} from '../../src/tv-solid/remote/types';

const fixture=readFileSync('tests/fixtures/remote-producer.json');
const provenance=JSON.parse(readFileSync('tests/fixtures/remote-producer-ref.json','utf8'));
const shared=JSON.parse(fixture.toString()).live_reverse_paging;
function page(paging:LivePage['paging']):LivePage {
  const start=Number(paging.origin);
  return {paging,snapshot_id:'producer-scope',complete:paging.next===null,availability:'Available',groups:[],
    channels:Array.from({length:Math.max(0,Math.min(paging.limit,shared.catalog_size-start))},(_,i)=>({id:`channel-${start+i}`,connection_id:'connection',card:{identity:{kind:'live',id:`channel-${start+i}`,ids:[]},provider_id:'connection',title:`Channel ${start+i}`,badges:[]}}))};
}
describe('producer-owned bounded channel windows',()=>{
  it('pins the exact shared producer fixture without requiring a sibling checkout',()=>expect(createHash('sha256').update(fixture).digest('hex')).toBe(provenance.sha256));
  it('consumes the shared short reverse slice and restores its navigation budget',()=>{
    const last=page(shared.paging),middle=page(shared.previous_response_paging),first=page(shared.first_response_paging);
    let window=joinChannelWindow([last],middle,'previous');
    for(let cycle=0;cycle<10;cycle++){
      window=joinChannelWindow(window,first,'previous');
      expect(window.map(p=>p.paging.origin)).toEqual(['0','2']);
      expect(pageRequest(first)).toEqual({cursor:'0',limit:2,page_size:3});
      expect(edgeRequest([first],'next')).toEqual({cursor:'2',limit:3,page_size:3});
      window=joinChannelWindow(window,last,'next');
      expect(window.map(p=>p.paging.origin)).toEqual(['2','5']);
    }
  });
  it('rejects mismatched scope, changed request budgets and overlapping payloads',()=>{
    const first=page(shared.first_response_paging),middle=page(shared.previous_response_paging);
    expect(()=>joinChannelWindow([first],{...middle,snapshot_id:'other'},'next')).toThrow('snapshot');
    expect(()=>joinChannelWindow([first],{...middle,paging:{...middle.paging,page_size:2}},'next')).toThrow('adjoins');
    expect(()=>joinChannelWindow([first],{...middle,channels:[first.channels[0]]},'next')).toThrow('repeated channels');
  });
  it('preserves unsigned cursor bounds without inventing an adjacent cursor',()=>{
    const empty=page(shared.past_end_paging);
    expect(validateChannelPage(empty,pageRequest(empty))).toBe(empty);
    expect(edgeRequest([empty],'previous')).toEqual({cursor:'4',limit:3,page_size:3});
  });
  it.each([
    undefined,
    {...shared.paging,limit:201},
    {...shared.paging,origin:'6'},
    {...shared.paging,page_size:2},
    {...shared.paging,next:{cursor:'5',limit:3,page_size:3}},
    {...shared.paging,previous:{cursor:'4294967296',limit:3,page_size:3}},
    {...shared.paging,next:{cursor:'8',limit:0,page_size:3}},
  ])('rejects incompatible envelope %j',paging=>{
    const value=page(shared.paging);
    expect(()=>validateChannelPage({...value,paging},pageRequest(value))).toThrow('incompatible');
  });
});
