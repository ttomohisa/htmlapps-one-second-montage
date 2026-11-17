// Test real fill geometry, edit gestures and Web Audio volume automation offline.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=fs.readFileSync(process.env.MONTAGE_HTML||new URL('../src/index.template.html',import.meta.url),'utf8');
function extract(name){const start=source.search(new RegExp('^      (?:async )?function '+name+'\\(','m'));assert(start>=0,name+' exists');const end=source.indexOf('\n',start);return source.slice(start,end);}
function contextOf(names,variables){const ctx=vm.createContext(variables);vm.runInContext(names.map(extract).join('\n'),ctx);return ctx;}

test('Fill geometry pans the actual source and clamps to its edges',()=>{
  const draws=[],fake={fillRect(){},drawImage(...args){draws.push(args)},set fillStyle(value){}};
  const ctx=contextOf(['clamp01','mediaDimensions','drawFill','drawOutputFrame'],{state:{fitMode:'fill'},});
  ctx.context=fake;ctx.item={focusX:1,focusY:.5};
  vm.runInContext('drawOutputFrame(context,{width:400,height:200},200,200,item)',ctx);
  assert.deepEqual(draws.at(-1).slice(1),[-200,0,400,200],'right edge');
  ctx.item.focusX=0;
  vm.runInContext('drawOutputFrame(context,{width:400,height:200},200,200,item)',ctx);
  assert.deepEqual(draws.at(-1).slice(1),[0,0,400,200],'left edge');
  ctx.item={focusX:.5,focusY:1};
  vm.runInContext('drawOutputFrame(context,{width:200,height:400},200,200,item)',ctx);
  assert.deepEqual(draws.at(-1).slice(1),[0,-200,200,400],'bottom edge');
  ctx.item.focusY=0;
  vm.runInContext('drawOutputFrame(context,{width:200,height:400},200,200,item)',ctx);
  assert.deepEqual(draws.at(-1).slice(1),[0,0,200,400],'top edge');
  ctx.item.focusY=2;ctx.item.focusX=-3;
  vm.runInContext('drawOutputFrame(context,{width:200,height:400},200,200,item)',ctx);
  assert.deepEqual(draws.at(-1).slice(1),[0,-200,200,400],'out-of-range values clamped');
});

test('Position pointer and arrow keys change only the overflowing direction',()=>{
  const canvas={width:200,height:200,getBoundingClientRect:()=>({width:200,height:200})},state={positionEditor:{renderer:{source:{width:400,height:200}},pendingX:.5,pendingY:.5,pointer:null}},events=[];
  const ctx=contextOf(['clamp01','mediaDimensions','positionOverflow','startPositionPointer','movePositionPointer','finishPositionPointer','positionKeydown'],{
    state,$:()=>canvas,renderPositionEditor:()=>events.push('draw')
  });
  ctx.start={pointerId:11,button:0,clientX:100,clientY:100,isPrimary:true,currentTarget:{setPointerCapture(){}} ,preventDefault(){}};
  vm.runInContext('startPositionPointer(start)',ctx);
  ctx.move={pointerId:11,clientX:150,clientY:150,preventDefault(){}};
  vm.runInContext('movePositionPointer(move)',ctx);
  assert.equal(state.positionEditor.pendingX,.25);
  assert.equal(state.positionEditor.pendingY,.5);
  ctx.key={key:'ArrowLeft',shiftKey:false,preventDefault(){this.handled=true}};
  vm.runInContext('positionKeydown(key)',ctx);
  assert.equal(state.positionEditor.pendingX,.29);
  assert.equal(ctx.key.handled,true);
  ctx.end={pointerId:11,currentTarget:{releasePointerCapture(){}}};
  vm.runInContext('finishPositionPointer(end,true)',ctx);
  assert.equal(state.positionEditor.pendingX,.5,'cancelled drag restores start');
  assert(events.length>=3);
});

test('Output freshness tracks fill positioning and active fade only',()=>{
  const state={aspectRatio:'16:9',fitMode:'fit',backgroundMode:'solid',quality:'standard',yearDividers:false,musicMode:'none',musicVolume:.35,musicFadeOut:true,customMusicFile:null,items:[{sequence:1,kind:'image'},{sequence:2,kind:'video',clipStart:1.25}]};
  const ctx=contextOf(['musicSignature','outputSignature'],{state});
  const original=vm.runInContext('outputSignature()',ctx);
  state.items[0].focusX=.8;state.musicFadeOut=false;
  assert.equal(vm.runInContext('outputSignature()',ctx),original,'invisible position and inactive fade are irrelevant');
  state.fitMode='fill';
  const fillSignature=vm.runInContext('outputSignature()',ctx);
  assert.notEqual(fillSignature,original);
  state.items[0].focusX=.5;
  assert.notEqual(vm.runInContext('outputSignature()',ctx),fillSignature,'crop changes output');
  state.musicMode='soft';
  const musicSignature=vm.runInContext('outputSignature()',ctx);
  state.musicFadeOut=true;
  assert.notEqual(vm.runInContext('outputSignature()',ctx),musicSignature,'fade changes output with BGM');
});

test('BGM fades for the final two seconds, scales down for short clips, or stays steady when disabled',async()=>{
  const contexts=[],audios=[];
  class FakeAudioContext{
    constructor(){this.currentTime=10;this.state='running';this.events=[];contexts.push(this);}
    async resume(){this.state='running';}
    async suspend(){this.state='suspended';}
    async close(){this.state='closed';}
    createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[{}]}};}
    createGain(){const calls=this.events;return {gain:{value:0,setValueAtTime(value,time){calls.push(['set',value,time]);},linearRampToValueAtTime(value,time){calls.push(['ramp',value,time]);}},connect(){}};}
    createBufferSource(){const context=this;return {connect(){},start(time){audios.push(['start',time]);},stop(){audios.push(['stop']);}};}
  }
  const state={musicMode:'soft',musicVolume:.35};
  const ctx=contextOf(['prepareMusicRuntime'],{state,AudioContextClass:FakeAudioContext,selectedMusicBuffer:async()=>({})});
  let runtime=await vm.runInContext('prepareMusicRuntime()',ctx);
  runtime.start(5,true);
  assert.deepEqual(contexts.at(-1).events,[['set',.35,10],['set',.35,13],['ramp',0,15]]);
  runtime.start(5,true);
  assert.equal(audios.filter(x=>x[0]==='start').length,1,'start is idempotent');
  await runtime.suspend();await runtime.resume();await runtime.dispose();
  runtime=await vm.runInContext('prepareMusicRuntime()',ctx);
  runtime.start(1,true);
  assert.deepEqual(contexts.at(-1).events,[['set',.35,10],['set',.35,10],['ramp',0,11]]);
  await runtime.dispose();
  runtime=await vm.runInContext('prepareMusicRuntime()',ctx);
  runtime.start(8,false);
  assert.deepEqual(contexts.at(-1).events,[['set',.35,10]]);
  await runtime.dispose();
});

test('Output uses canvas video track with selected BGM and per-item position',()=>{
  assert.match(source,/videoStream=canvas\.captureStream\(30\);stream=videoStream;/);
  assert.match(source,/new MediaStream\(\[\.\.\.videoStream\.getVideoTracks\(\),\.\.\.musicRuntime\.destination\.stream\.getAudioTracks\(\)\]\)/);
  assert.match(source,/musicRuntime\?\.start\(sequence\.length,state\.musicFadeOut\)/);
  assert.match(source,/drawOutputFrame\(ctx,renderer\.source,canvas\.width,canvas\.height,renderer\.item\)/);
  assert.match(source,/holdImageFrame\(ctx,canvas,renderer\.source,1000,renderer\.item\)/);
  assert.match(source,/holdVideoFrame\(ctx,canvas,renderer\.source,1000,renderer\.item\)/);
  assert.match(source,/name==='fitMode'\)renderThumbs\(\)/);
  assert.match(source,/positionDialog\.addEventListener\('cancel'/);
});
