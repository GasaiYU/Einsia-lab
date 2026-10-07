import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const arg=process.argv.indexOf('--root');
const root=path.resolve(repo,arg<0?'public':process.argv[arg+1]);
// Built project sites add a URL prefix; disk paths and canonical task IDs do not.
const base=(process.env.BASE_PATH || '').replace(/\/$/,'');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'),(_key,value)=>
  base && typeof value==='string' && value.startsWith(base+'/') ? value.slice(base.length) : value);
const budget=950_000_000; // leave headroom below GitHub Pages' 1 GB site limit
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function* files(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    assert(!e.isSymbolicLink(),`Deployable resources must be real files: ${p}`);
    if(e.isDirectory())yield* files(p);else if(e.isFile())yield p;
  }
}
const physical=path.join(root,'phys-last-exam');
const gallery=readJson(path.join(physical,'video-gallery.json'));
const manifest=readJson(path.join(physical,'release-assets.json'));
assert.equal(gallery.delivery?.version,1,'Run prepare-web-release.py before committing evaluation assets');
assert.equal(gallery.source,'all_test');
const expected=new Map(manifest.assets.map(a=>[a.url,a]));
assert.equal(expected.size,manifest.assets.length,'Duplicate asset URLs');
const resolve=url=>{
  assert(typeof url==='string' && url.startsWith('/phys-last-exam/') && !url.includes('..') && !url.includes('\\'),`Non-portable resource: ${url}`);
  assert(expected.has(url),`Resource missing from integrity manifest: ${url}`);
  return path.join(root,url.slice(1));
};
for(const [url,item] of expected){
  const p=resolve(url);assert(fs.existsSync(p),`Missing committed resource: ${url}`);
  assert.equal(fs.statSync(p).size,item.bytes,`Resource size mismatch: ${url}`);
  assert.equal(sha(p),item.sha256,`Resource hash mismatch (or unresolved LFS pointer): ${url}`);
}
let bytes=0;let count=0;
for(const p of files(root)){
  const n=fs.statSync(p).size;bytes+=n;count++;
  assert(n<95_000_000,`File exceeds the repository's 95 MB guard: ${p}`);
  if(p.startsWith(physical+path.sep)){
    const rel=path.relative(physical,p);
    assert(!/^(all_test(?:_[12])?|videos-old)\//.test(rel),`Evaluation working directory in release: ${rel}`);
    assert(!/\.(npz|npy|pt|pth|safetensors|pyc)$/.test(rel),`Model/cache file in release: ${rel}`);
    const builtPage=path.basename(root)==='dist' && rel==='index.html';
    if(rel!=='release-assets.json' && !builtPage)assert(expected.has('/phys-last-exam/'+rel.split(path.sep).join('/')),`Unmanifested release asset: ${rel}`);
  }
}
assert(bytes<budget,`Site is ${bytes} bytes; exceeds ${budget}-byte Pages budget`);
const triples=new Set();let annotated=0;let initialized=0;
const modelSet=new Set(),taskSet=new Set();
for(const e of gallery.entries){
  const key=[e.model,e.task,e.seed].join('/');assert(!triples.has(key),`Duplicate sample: ${key}`);triples.add(key);
  modelSet.add(e.model);taskSet.add(e.task);
  for(const k of ['original','annotated','poster','measurement','frames','features','visualizationMeasurement','figure','log'])if(e[k])resolve(e[k]);
  assert(e.original && e.poster,`Missing original/poster: ${key}`);
  assert(e.delivery.originalIsWebCopy);assert.equal(e.delivery.originalSourceSha256,e.sourceSha256);
  assert.equal(expected.get(e.original).sha256,e.delivery.originalSha256);
  if(e.annotated)annotated++;
  if(e.initializationRun){
    initialized++;const r=e.initializationRun;
    const init=readJson(resolve(r.annotation));
    assert.equal(sha(resolve(r.frameZero)),init.source_image_sha256);
    assert.equal(init.source_video_sha256,e.sourceSha256);
    assert.equal(sha(resolve(r.annotation)),r.signature.annotation);
    assert(e.annotated && r.measurementRecomputed && !r.historicalLeaderboardChanged);
  }
}
assert.equal(gallery.coverage.originals,triples.size);
assert.equal(gallery.coverage.annotated,annotated);
assert.equal(gallery.coverage.models,modelSet.size);assert.equal(gallery.coverage.tasks,taskSet.size);
assert.equal(gallery.coverage.initializedSamples,initialized);
// Enforce a single task namespace throughout the published package.
const index=readJson(path.join(physical,'task-index.json'));
const results=readJson(path.join(physical,'paper-results.json'));
const benchmark=readJson(path.join(physical,'benchmark.json'));
const canonical=new Map(index.tasks.map(t=>[t.id,t]));
assert.equal(canonical.size,40);
assert.equal(new Set(index.tasks.map(t=>t.legacyId)).size,40);
for(let i=1;i<=40;i++)assert(canonical.has(`P${i}`));
for(const data of [results,benchmark,gallery])assert.equal(data.numberingScheme,index.numberingScheme);
for(const data of [results,benchmark]) {
  assert.equal(data.tasks.length,40);
  assert.equal(new Set(data.tasks.map(t=>t.id)).size,40);
  for(const t of data.tasks) {
    const c=canonical.get(t.id);assert(c,`Unknown task ${t.id}`);
    for(const k of ['name','legacyId','category','difficulty'])assert.equal(t[k],c[k],`${t.id}: ${k} mismatch`);
    assert(!('paperId' in t),'Separate paper IDs are no longer supported');
    if(t.preview)assert.equal(t.preview,`/phys-last-exam/tasks/${t.id}.webp`);
    if(t.preview)resolve(t.preview);
  }
}
for(const kind of ['videos','evidence'])for(const model of fs.readdirSync(path.join(physical,kind))) {
  for(const task of fs.readdirSync(path.join(physical,kind,model)))assert(canonical.has(task),`Legacy asset directory: ${kind}/${model}/${task}`);
}
assert.deepEqual(new Set(fs.readdirSync(path.join(physical,'tasks'))),new Set(index.tasks.map(t=>`${t.id}.webp`)));
for(const e of gallery.entries) {
  assert.equal(e.legacyTaskId,canonical.get(e.task)?.legacyId);
  for(const value of Object.values(e))if(typeof value==='string' && /^\/phys-last-exam\/(videos|evidence)\//.test(value)) {
    const parts=value.split('/');assert.equal(parts[3],e.model);assert.equal(parts[4],e.task);assert.equal(parts[5],String(e.seed));
  }
  for(const key of ['measurement','visualizationMeasurement','features'])if(e[key]) {
    const doc=readJson(resolve(e[key]));
    for(const field of ['task','task_id'])if(doc[field])assert.equal(doc[field],e.task,`${e[key]}: ${field}`);
  }
  if(e.initializationRun) {
    const doc=readJson(resolve(e.initializationRun.annotation));
    assert.equal(doc.task_id,e.task);
  }
}
if(path.basename(root)==='dist')assert(fs.existsSync(path.join(root,'phys-last-exam/index.html')));
console.log(`PASS ${path.relative(repo,root)}: ${triples.size} originals, ${annotated} overlays, ${initialized} initializations; ${manifest.assets.length} verified assets; site ${(bytes/1e6).toFixed(1)} MB / 950 MB (${count} files).`);
