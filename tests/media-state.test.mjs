// Exercise real audio-preview handlers against an asynchronous Web Audio double.
// This tests state races, not actual audio output or codec support.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const file = process.env.MONTAGE_HTML || new URL('../src/index.template.html', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
function extract(name) {
  const start = source.search(new RegExp('^      async function ' + name + '\\(', 'm'));
  assert(start >= 0, name + ' exists');
  return source.slice(start, source.indexOf('\n', start));
}
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise,resolve};
}

test('concurrent preview clicks and mode changes do not leak playback', async () => {
  const gate = deferred(), contexts = [], started = [], stopped = [];
  class FakeAudioContext {
    constructor() { contexts.push(this); this.closed = false; }
    close() { this.closed = true; return Promise.resolve(); }
    createBufferSource() {
      return { connect() {}, start() { started.push(this); }, stop() { stopped.push(this); } };
    }
    createGain() { return { gain:{value:0}, connect(){} }; }
    get destination() { return {}; }
  }
  const state = {
    musicMode:'soft', customMusicFile:null, musicVolume:.35,
    musicPreview:null, musicPreviewVersion:0, musicPreviewLoading:false
  };
  const ctx = vm.createContext({
    state, AudioContextClass:FakeAudioContext,
    selectedMusicBuffer:() => gate.promise,
    renderEnhancementSettings() {}, isBusy:() => false,
    showToast() {}, t:x=>x, console
  });
  vm.runInContext(extract('stopMusicPreview') + '\n' + extract('toggleMusicPreview'),ctx);
  const first=vm.runInContext('toggleMusicPreview()',ctx);
  await vm.runInContext('toggleMusicPreview()',ctx);
  assert.equal(contexts.length,1);
  assert.equal(state.musicPreviewLoading,true);
  await vm.runInContext('stopMusicPreview()',ctx);
  gate.resolve({});
  await first;
  assert.equal(started.length,0);
  assert.equal(contexts[0].closed,true);
  assert.equal(state.musicPreview,null);
  assert.equal(state.musicPreviewLoading,false);
  await vm.runInContext('toggleMusicPreview()',ctx);
  assert.equal(started.length,1);
  assert.equal(state.musicPreviewLoading,false);
  await vm.runInContext('toggleMusicPreview()',ctx);
  assert.equal(stopped.length,1);
  assert.equal(state.musicPreview,null);
});

test('editor cannot initialize twice and thumbnail refresh discards superseded work', async () => {
  assert.match(source, /async function openClipEditor\(index\)\{if\(isBusy\(\)\|\|state\.clipEditor\)return;/);
  const original = {file:{name:'video.mp4'},thumbUrl:'blob:old'};
  const state={items:[original],cancelRequested:false};
  const pending=[], revoked=[];
  const video={pause(){},removeAttribute(){},load(){}};
  const ctx=vm.createContext({
    state,
    openVideoFile:async()=>({video,url:'blob:source'}),
    seekVideo:()=>new Promise(resolve=>pending.push(resolve)),
    document:{createElement:()=>({width:0,height:0,getContext:()=>({})})},
    drawFit(){},canvasBlob:async()=>new Blob(['thumbnail']),
    Blob,throwIfCancelled(){},
    URL:{createObjectURL:()=> 'blob:new', revokeObjectURL:u=>revoked.push(u)}
  });
  // Only the refresh handler is needed: it owns revision checks and resource cleanup.
  vm.runInContext(extract('refreshVideoThumbnail'),ctx);
  const first=vm.runInContext('refreshVideoThumbnail(state.items[0],0.5)',ctx);
  const second=vm.runInContext('refreshVideoThumbnail(state.items[0],1.5)',ctx);
  for (let i=0;i<8 && pending.length<2;i++) await Promise.resolve();
  assert.equal(pending.length,2);
  pending[1]();await second;
  assert.equal(original.thumbUrl,'blob:new');
  pending[0]();await first;
  assert.equal(original.thumbUrl,'blob:new');
  assert.equal(revoked.filter(x=>x==='blob:old').length,1);
  assert.equal(revoked.filter(x=>x==='blob:source').length,2);
});
