/** GHSA-68fv-2mgg-jv7q: bounded library/PostCSS checks; no services or large-gap serialization. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {SourceMapConsumer, SourceMapGenerator, SourceNode} = require('source-map-js');
const postcss = require('postcss');
const basic = () => ({version:3, file:'out.js', sources:['input.ts'], sourcesContent:['x'], names:[], mappings:'AAAA'});
const indexed = (line:unknown, column:unknown, map:unknown=basic()) => ({version:3, sections:[{offset:{line,column},map}]});
let passed=0, failed=0;
async function check(name:string, fn:()=>unknown) {
  try { await fn(); passed++; console.log('PASS '+name); }
  catch (e) { failed++; console.error('FAIL '+name+': '+String(e)); }
}
// Constructor-only excessive offsets are safe on the old version: never iterate,
// serialize or pass such maps to SourceNode, which would trigger the costly path.
const invalid = [
  ['negative line',-1,0], ['fractional line',0.5,0], ['string line','1',0],
  ['null line',null,0], ['unsafe line',Number.MAX_SAFE_INTEGER+1,0],
  ['over-limit line',10_000_001,0], ['negative column',1,-1],
  ['fractional column',0,0.5], ['string column',0,'0'], ['null column',0,null],
  ['unsafe column',0,Number.MAX_SAFE_INTEGER+1],
] as const;
for (const [name,line,column] of invalid) {
  for (const encoding of ['object','JSON'] as const) {
    await check(name+' rejected as '+encoding,()=> {
      const map=indexed(line,column);
      assert.throws(()=>new SourceMapConsumer(encoding==='JSON'?JSON.stringify(map):map));
    });
  }
}
for (const line of [NaN,Infinity]) await check('nonfinite line '+String(line)+' rejected',()=> {
  assert.throws(()=>new SourceMapConsumer(indexed(line,0)));
});
for (const encoding of ['object','JSON'] as const) await check('cumulative nested limit rejected as '+encoding,()=> {
  const map=indexed(6_000_000,0,indexed(4_000_001,0));
  assert.throws(()=>new SourceMapConsumer(encoding==='JSON'?JSON.stringify(map):map));
});
await check('ordinary basic map query',()=> {
  const value=new SourceMapConsumer(basic()).originalPositionFor({line:1,column:0});
  assert.equal(value.source,'input.ts'); assert.equal(value.line,1);
});
await check('valid indexed offset query',()=> {
  const value=new SourceMapConsumer(indexed(2,3)).originalPositionFor({line:3,column:4});
  assert.equal(value.source,'input.ts'); assert.equal(value.line,1);
});
await check('valid nested sections retain sources',()=> {
  const consumer=new SourceMapConsumer(indexed(1,0,indexed(2,0)));
  assert.deepEqual(consumer.sources,['input.ts']); assert.deepEqual(consumer.sources,['input.ts']);
});
await check('maximum allowed line accepted without serializing a gap',()=> {
  assert.deepEqual(new SourceMapConsumer(indexed(10_000_000,0)).sources,['input.ts']);
});
await check('large legal column accepted without serializing a gap',()=> {
  assert.deepEqual(new SourceMapConsumer(indexed(0,20_000_000)).sources,['input.ts']);
});
await check('generator preserves ordinary short gaps',()=> {
  const generator=new SourceMapGenerator({file:'out.js'});
  generator.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'input.ts'});
  generator.addMapping({generated:{line:4,column:0},original:{line:2,column:0},source:'input.ts'});
  assert.equal(generator.toJSON().mappings,'AAAA;;;AACA');
});
await check('SourceNode preserves ordinary generated code',()=> {
  assert.equal(SourceNode.fromStringWithSourceMap('x',new SourceMapConsumer(basic())).toString(),'x');
});
const inline=(map:unknown)=>'a { color: red }\n/*# sourceMappingURL=data:application/json;base64,'+Buffer.from(JSON.stringify(map)).toString('base64')+' */';
await check('PostCSS inline indexed previous-map positive control',()=> {
  const root=postcss.parse(inline(indexed(0,0)),{from:'synthetic.css'});
  assert.deepEqual(root.source.input.map.consumer().sources,['input.ts']);
});
await check('PostCSS inline fractional previous-map coordinate rejected',()=> {
  assert.throws(()=>postcss.parse(inline(indexed(0.5,0)),{from:'synthetic.css'}));
});
await check('PostCSS transformation preserves normal previous-map compatibility',async()=> {
  const plugin={postcssPlugin:'synthetic-color',Declaration(decl:any){if(decl.prop==='color')decl.value='blue';}};
  const result=await postcss([plugin]).process('a { color: red }',{from:'synthetic.css',to:'out.css',map:{prev:basic(),inline:false,annotation:false}});
  assert.match(result.css,/color: blue/); assert(result.map); assert(result.map.toJSON().sources.length>0);
});
console.log(`Source-map dependency checks: ${passed} passed, ${failed} failed.`);
if (failed) process.exitCode=1;
