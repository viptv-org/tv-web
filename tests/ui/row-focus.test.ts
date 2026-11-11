import { expect, it } from 'vitest';
import { RowFocus } from '../../src/tv-solid/remote/row-focus';

it('keeps each shelf’s selection independently',()=>{
  const focus=new RowFocus<string>(card=>card);
  const a={id:'a',cards:['a','b','c']},b={id:'b',cards:['x','y']};
  focus.remember(a,2);focus.remember(b,1);
  expect(focus.resolve(a)).toBe(2);expect(focus.resolve(b)).toBe(1);
  expect(focus.resolve({id:'new',cards:['z']})).toBe(0);
});
it('restores identity after refresh and clamps when the remembered card is removed',()=>{
  const focus=new RowFocus<string>(card=>card);
  focus.remember({id:'row',cards:['a','b','c']},2);
  expect(focus.resolve({id:'row',cards:['c','a','b']})).toBe(0);
  expect(focus.resolve({id:'row',cards:['a']})).toBe(0);
  focus.remember({id:'row',cards:[]},0);
  expect(focus.resolve({id:'row',cards:['a','b','c']})).toBe(2);
});
it('drops removed rows and clears profile state',()=>{
  const focus=new RowFocus<string>(card=>card),row={id:'row',cards:['a','b']};
  focus.remember(row,1);focus.retain([]);expect(focus.resolve(row)).toBe(0);
  focus.remember(row,1);focus.clear();expect(focus.resolve(row)).toBe(0);
});
