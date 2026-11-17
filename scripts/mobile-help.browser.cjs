'use strict';
// Run against the official generated files in the unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const buildSelector = '.build-details details';


async function prepareApp(page, width, label) {
  assert.equal(await page.locator('#mobileActions').isVisible(), false, label + ': empty action bar remains hidden');
  const png = await page.evaluate(() => { const canvas=document.createElement('canvas');canvas.width=16;canvas.height=12;canvas.getContext('2d').fillRect(0,0,16,12);return canvas.toDataURL('image/png').split(',')[1]; });
  await page.locator('#fileInput').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('.thumb-card').first().waitFor();
  assert.equal(await page.locator('#mobileActions').isVisible(), width <= 600, label + ': loaded mobile Add/Create actions preserved');
}
async function smoke(page, results, file) {
  await page.locator('#mobileCreateButton').click();
  await page.locator('#resultSection').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#mobileResultActions').isVisible(),true,'mobile result actions preserved');
  await page.locator('#outputFilename').fill('mobile-help-montage');
  const downloadPromise=page.waitForEvent('download');await page.locator('#mobileSaveButton').click();const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'mobile-help-montage.mp4');
  const target=path.join(results,file.includes('self-extract')?'synthetic-loader.mp4':'synthetic-readable.mp4');await download.saveAs(target);
  const bytes=fs.readFileSync(target);assert.ok(bytes.length>100);assert.ok(bytes.includes(Buffer.from('ftyp')),'real MP4 container');
  console.log('PASS synthetic PNG to MP4 export '+file);
}

async function interactionSmoke(page, results, label) {
  const png = await page.evaluate(() => {
    const canvas=document.createElement('canvas');canvas.width=16;canvas.height=12;
    canvas.getContext('2d').fillRect(0,0,16,12);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#fileInput').setInputFiles([
    {name:'photo-one.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')},
    {name:'photo-two.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.thumb-card').length === 3);
  const cards=page.locator('.thumb-card'), initial=await cards.count();
  await page.locator('.thumb-delete').first().click();
  assert.equal(await page.locator('#deleteDialog').isVisible(), true, label + ': delete dialog opens');
  assert.equal(await cards.count(),initial,label + ': no early delete');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#deleteDialog').isVisible(), false, label + ': Escape cancels delete');
  assert.equal(await cards.count(),initial,label + ': cancel retains item');
  await page.locator('.thumb-delete').first().click();
  await page.locator('#confirmDeleteButton').click();
  await page.waitForFunction(() => document.querySelectorAll('.thumb-card').length === 2);
  assert.equal(await page.locator('#deleteDialog').isVisible(), false, label + ': delete confirmed');
  const firstSequence=await cards.first().getAttribute('data-sequence');
  const handle=cards.first().locator('.drag-handle');
  await handle.scrollIntoViewIfNeeded();
  const start=await handle.boundingBox();
  const target=await cards.last().boundingBox();
  assert(start && target, label + ': drag geometry');
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
  await page.mouse.down();
  await page.mouse.move(target.x+target.width*.7,target.y+target.height*.65,{steps:6});
  assert.equal(await page.locator('.drag-ghost').count(),1,label + ': carried card follows pointer');
  assert.equal(await page.locator('.drag-ghost').evaluate(el=>getComputedStyle(el).position),'fixed',label + ': dragged card is floating');
  await page.mouse.up();
  assert.equal(await page.locator('.drag-ghost').count(),0,label + ': drag ghost cleaned up');
  assert.notEqual(await cards.first().getAttribute('data-sequence'),firstSequence,label + ': drag changes order');
  await page.screenshot({path:path.join(results,'mobile-drag-and-confirm.png')});
  console.log('PASS delete confirmation and floating card drag '+label);

  // Mobile cards use the thumbnail, rather than the filename row, for the crop action.
  const positionChoices=page.locator('.thumb-position:visible');
  assert.equal(await positionChoices.count(),0,label+': no crop controls before Fill');
  // Native controls do not compete visually with the three illustrated shape choices.
  assert.equal(await page.locator('.shape-choice').count(),3,label+': three illustrated aspect choices');
  assert.equal(await page.locator('#outputSettings .choice,#outputSettings .music-option').count(),0,label+': no repeated pill grids');
  assert.equal(await page.locator('#qualitySelect').inputValue(),'standard',label+': standard quality selected');
  await page.locator('#qualitySelect').selectOption('high');
  assert.match(await page.locator('#qualitySelect').locator('option:checked').textContent(),/1920×1080/,label+': quality shows actual output size');
  assert.equal(await page.locator('#qualityNote').isVisible(),true,label+': high quality warning appears only when relevant');
  await page.locator('#qualitySelect').selectOption('standard');
  assert.equal(await page.locator('#qualityNote').isVisible(),false,label+': high quality warning hides when standard');
  await page.locator('input[name="aspectRatio"][value="9:16"]').check({force:true});
  assert.match(await page.locator('#qualitySelect').locator('option:checked').textContent(),/720×1280/,label+': dimensions follow shape');
  await page.locator('input[name="aspectRatio"][value="16:9"]').check({force:true});
  assert.equal(await page.locator('#fitBackdropGroup').isVisible(),true,label+': background selector visible for Fit');

  // Adjust crop in the same browser canvas used by MP4 rendering.
  await page.locator('#fitModeSelect').selectOption('fill');
  assert.equal(await page.locator('#fitBackdropGroup').isVisible(),false,label+': background selector hidden when filling');
  assert.match(await page.locator('#displayModeHint').textContent(),/切り取り|crop/i,label+': selected mode explained');
  assert.equal(await page.locator('.thumb-position:visible').count(),2,label+': show Position buttons only for Fill');
  const overlay=page.locator('.thumb-position-mobile:visible').first();
  const previewRect=await page.locator('.thumb-preview').first().boundingBox();
  const overlayRect=await overlay.boundingBox();
  const dragRect=await page.locator('.drag-handle').first().boundingBox();
  assert.ok(previewRect&&overlayRect&&dragRect&&overlayRect.width>=44&&overlayRect.height>=44,label+': touch target is at least 44px');
  assert.ok(overlayRect.x>=previewRect.x&&overlayRect.y>=previewRect.y&&overlayRect.x+overlayRect.width<=previewRect.x+previewRect.width+1&&overlayRect.y+overlayRect.height<=previewRect.y+previewRect.height+1,label+': Position is inside the thumbnail');
  assert.ok(overlayRect.x+overlayRect.width<=dragRect.x+1,label+': Position does not overlap drag handle');
  assert.equal(await page.locator('.thumb-position-inline:visible').count(),0,label+': filename row has no Position button');
  await page.locator('.thumb-position:visible').first().click();
  await page.locator('#positionLoading').waitFor({state:'hidden',timeout:15000});
  assert.equal(await page.locator('#positionDialog').isVisible(),true,label+': Position dialog ready');
  await page.locator('#positionCanvas').press('ArrowUp');
  await page.locator('#cancelPositionButton').click();
  assert.equal(await page.locator('.thumb-position.is-adjusted:visible').count(),0,label+': cancelling Position has no effect');
  await page.locator('.thumb-position:visible').first().click();
  await page.locator('#positionLoading').waitFor({state:'hidden',timeout:15000});
  const canvas=page.locator('#positionCanvas');
  const rect=await canvas.boundingBox();
  assert(rect && rect.height>60,label+': crop preview can be dragged');
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2-rect.height*.34,{steps:6});
  await page.mouse.up();
  // Pointer movement is covered by the geometry regression; complete with a
  // keyboard nudge so this integration check also verifies accessible saving.
  await canvas.press('ArrowUp');
  await page.locator('#applyPositionButton').click();
  assert.equal(await page.locator('.thumb-position.is-adjusted:visible').count(),1,label+': crop position is retained');
  await page.locator('.thumb-position.is-adjusted:visible').click();
  await page.locator('#positionLoading').waitFor({state:'hidden',timeout:15000});
  await page.locator('#resetPositionButton').click();
  await page.locator('#applyPositionButton').click();
  assert.equal(await page.locator('.thumb-position.is-adjusted:visible').count(),0,label+': reset position returns to center');
  await page.locator('#fitModeSelect').selectOption('fit');
  assert.equal(await page.locator('.thumb-position:visible').count(),0,label+': Position buttons hidden for Fit');

  // The music fade setting appears only with a selected track.
  assert.equal(await page.locator('#musicFadeControl').isVisible(),false,label+': fade is hidden without BGM');
  assert.equal(await page.locator('#musicActions').isVisible(),false,label+': no unused music controls');
  assert.equal(await page.locator('#musicModeSelect').inputValue(),'none',label+': music defaults to none');
  await page.locator('#musicModeSelect').selectOption('soft');
  assert.equal(await page.locator('#musicActions').isVisible(),true,label+': music controls appear only after choosing music');
  assert.match(await page.locator('#musicDescription').textContent(),/明るくやわらかなループ|Bright, airy loop/,label+': track description');
  assert.equal(await page.locator('#musicFadeControl').isVisible(),true,label+': fade appears with music');
  assert.equal(await page.locator('#musicFadeOut').isChecked(),true,label+': fade defaults to on');
  await page.locator('#musicFadeControl').click();
  assert.equal(await page.locator('#musicFadeOut').isChecked(),false,label+': fade can be disabled');
  await page.locator('#musicFadeControl').click();
  assert.equal(await page.locator('#musicFadeOut').isChecked(),true,label+': fade can be enabled again');

  // Exercise a real audio-enabled MediaRecorder path when supported.
  const audioMp4=await page.evaluate(()=>['video/mp4;codecs=avc1.42E01E,opus','video/mp4;codecs=avc1,opus','video/mp4;codecs=vp9,opus','video/mp4'].some(type=>MediaRecorder.isTypeSupported(type)));
  if(audioMp4){
    await page.locator('#mobileRecreateButton').click();
    await page.locator('#confirmReplaceButton').click();
    await page.waitForFunction(()=>document.querySelector('#workspace').classList.contains('is-processing'),null,{timeout:12000});
    await page.waitForFunction(()=>!document.querySelector('#workspace').classList.contains('is-processing'),null,{timeout:30000});
    assert.equal(await page.locator('#errorBox').isVisible(),false,label+': BGM MP4 creation has no error');
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#mobileSaveButton').click();
    const audioDownload=await downloadPromise;
    const audioPath=path.join(results,'synthetic-with-bgm.mp4');
    await audioDownload.saveAs(audioPath);
    assert.ok(fs.readFileSync(audioPath).includes(Buffer.from('ftyp')),label+': MP4 with BGM saved');
    console.log('PASS BGM-enabled MP4 real browser recording '+label);
  } else console.log('SKIP audio MP4 recording unsupported by this Chromium build');
  await page.screenshot({path:path.join(results,'mobile-position-and-fade.png')});
  console.log('PASS crop position and fade controls '+label);

}

async function main() {
  const results = path.resolve(__dirname, '..', 'test-results', 'mobile-help');
  fs.mkdirSync(results, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'one-second-montage.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of [[1360, 900], [601, 568], [600, 568], [360, 640], [320, 568], [393, 252]]) {
          const context = await browser.newContext({ viewport: { width, height }, locale: language, reducedMotion: 'reduce' });
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
          const label = `${file} ${language} ${width}x${height}`;
          try {
            await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
            await page.locator('#helpButton').waitFor();
            if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
            assert.equal(await page.locator('[data-i18n="localBadge"]').textContent(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label);
            if (width <= 600) {
              assert.equal(await page.locator('.local-badge').isVisible(), false, label + ': no mobile local badge');
            } else {
              assert.ok(await page.locator('.local-badge').evaluate(el => {
                const box = el.getBoundingClientRect();
                const range = document.createRange();
                range.selectNodeContents(el.querySelector('[data-i18n="localBadge"]'));
                return box.left >= 0 && box.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1
                  && [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
              }), label + ': desktop badge text fits');
            }
            assert.equal(await page.locator('main #buildVersion').count(), 0, label);
            assert.equal(await page.locator('footer').isVisible(), width > 600, label);
            assert.equal(await page.locator('.page-intro').isVisible(), true, label + ': hero shown initially');
            assert.equal(await page.locator('#startOverview').isVisible(), true, label + ': first-visit steps shown initially');
            if(file==='dist/index.html'&&language==='ja'){
              const positions=await page.evaluate(()=>{
                const box=selector=>document.querySelector(selector).getBoundingClientRect();
                const workspace=box('#workspace'),flow=box('.start-flow'),picker=box('#dropZone'),formats=box('.empty-format');
                return {leftGap:Math.abs(workspace.left-flow.left),rightGap:Math.abs(workspace.right-flow.right),formatCenter:Math.abs((picker.left+picker.right)/2-(formats.left+formats.right)/2)};
              });
              assert.ok(positions.leftGap<3&&positions.rightGap<3,label+': three steps align with work area');
              assert.ok(positions.formatCenter<3,label+': format list is centered in drop zone');
            }
            if (width <= 600) {
              const fallback = page.locator('.file-fallback-button.block');
              assert.equal(await fallback.isVisible(), true, label + ': secondary file picker remains available');
              assert.equal(await fallback.evaluate(el => getComputedStyle(el).borderTopWidth), '0px', label + ': fallback is subtle');
            }
            await prepareApp(page, width, label);
            assert.equal(await page.locator('.shape-choice').count(),3,label+': shape tiles');
            assert.equal(await page.locator('#fitModeSelect').inputValue(),'fit',label+': show-all default');
            assert.equal(await page.locator('#backgroundModeSelect').inputValue(),'solid',label+': black bars default');
            assert.equal(await page.locator('#qualitySelect').inputValue(),'standard',label+': quality default');
            assert.equal(await page.locator('#musicModeSelect').inputValue(),'none',label+': BGM default');
            if(file==='dist/index.html'&&language==='ja'&&[1360,360,320].includes(width)){
              await page.screenshot({path:path.join(results,'settings-'+width+'.png')});
            }
            const positions=await page.evaluate(()=>({media:document.querySelector('#readyPanel>.media-section').getBoundingClientRect().top,settings:document.querySelector('#readyPanel>.output-settings').getBoundingClientRect().top}));
            assert.ok(width<=600?positions.media<positions.settings:positions.settings<positions.media,label+': correct responsive media / settings order');
            assert.equal(await page.locator('.page-intro').isVisible(), false, label + ': hero hidden after any import');
            assert.equal(await page.locator('#startOverview').isVisible(), false, label + ': guide steps hidden after import');
            assert.equal(await page.locator('.local-badge').isVisible(), false, label + ': privacy badge hidden with hero after import');
            assert.equal(await page.locator('.start-capabilities').count(), 0, label + ': no decorative feature list');
            assert.equal(await page.locator('#processNote').count(), 0, label + ': no redundant cancellation notice');
            if (file==='dist/index.html' && language==='ja' && [320,600,601].includes(width)) {
              await page.locator('#fitModeSelect').selectOption('fill');
              const visible=page.locator('.thumb-position:visible');
              assert.equal(await visible.count(),1,label+': one visible crop action per card');
              if(width<=600){
                assert.equal(await page.locator('.thumb-position-mobile:visible').count(),1,label+': phone uses thumbnail crop action');
                assert.equal(await page.locator('.thumb-position-inline:visible').count(),0,label+': phone hides inline crop action');
                const crop=await visible.first().boundingBox(),handle=await page.locator('.drag-handle').first().boundingBox();
                assert.ok(crop&&handle&&crop.width>=44&&crop.height>=44&&crop.x+crop.width<=handle.x+1,label+': narrow phone buttons fit without overlap');
              }else{
                assert.equal(await page.locator('.thumb-position-mobile:visible').count(),0,label+': desktop hides thumbnail crop action');
                assert.equal(await page.locator('.thumb-position-inline:visible').count(),1,label+': desktop keeps inline crop action');
              }
              await page.locator('#fitModeSelect').selectOption('fit');
            }
            if(file==='dist/index.html'&&language==='ja'&&width===1360){
              const compact=await page.evaluate(()=>{
                const box=selector=>document.querySelector(selector).getBoundingClientRect();
                const fit=box('#fitModeSelect'),backdrop=box('#backgroundModeSelect'),shapes=box('.settings-shape'),music=box('.enhancement-grid');
                return {selectGap:Math.abs(fit.top-backdrop.top),musicGap:music.top-shapes.bottom};
              });
              assert.ok(compact.selectGap<3,label+': desktop display and background share one row');
              assert.ok(compact.musicGap>=0&&compact.musicGap<35,label+': no huge gap beneath shape buttons');
            }
            if(file==='dist/index.html'&&language==='ja'&&[360,320].includes(width)){
              await page.evaluate(()=>window.scrollTo(0,0));
              await page.waitForFunction(()=>scrollY===0);
              await page.evaluate(()=>window.scrollTo(0,Math.min(480,document.documentElement.scrollHeight-innerHeight)));
              await page.waitForFunction(()=>scrollY>90);
              if(width<=600){
                await page.waitForFunction(()=>document.querySelector('.app-header').classList.contains('is-hidden'));
                assert.equal(await page.locator('.app-header').evaluate(el=>el.classList.contains('is-hidden')),true,label+': header hides on downward scroll');
                await page.evaluate(()=>window.scrollBy(0,-90));
                await page.waitForFunction(()=>!document.querySelector('.app-header').classList.contains('is-hidden'));
              }else assert.equal(await page.locator('.app-header').evaluate(el=>el.classList.contains('is-hidden')),false,label+': desktop header never auto-hides');
              await page.evaluate(()=>window.scrollTo(0,0));
              await page.waitForFunction(()=>scrollY===0&&!document.querySelector('.app-header').classList.contains('is-hidden'));
            }
            if(file==='dist/index.html'&&language==='ja'&&width===1360){
              assert.equal(await page.locator('.app-header').evaluate(el=>el.classList.contains('is-hidden')),false,label+': desktop header is never auto-hidden');
            }
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');

            await page.locator('#helpButton').click();
            const body = page.locator('#helpDialog .dialog-body');
            assert.ok(await body.evaluate(el => el.lastElementChild.contains(document.querySelector('#buildVersion'))), label + ': build is final body child');
            assert.equal(await page.locator(buildSelector).count(), 1, label);
            assert.equal(await page.locator(buildSelector).isVisible(), true, label);
            for (const id of ['buildVersion', 'builtAt', 'dependencyCount']) assert.equal(await page.locator('#' + id).count(), 1, label);

            if (await page.locator(buildSelector).getAttribute('open') === null) {
              const summary = page.locator(buildSelector).locator('summary');
              await summary.focus();
              await page.keyboard.press('Enter');
              assert.equal(await page.locator(buildSelector).getAttribute('open'), '', label);
              assert.notEqual(await page.locator('#buildVersion').innerText(), '—', label);
              assert.notEqual(await page.locator('#builtAt').innerText(), '—', label);
              assert.match(await page.locator('#builtAt').innerText(), /\d{4}/, label + ': populated build timestamp');
            }
            await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
            const finalItem = page.locator('#dependencyCount');
            const finalBox = await finalItem.boundingBox(), bodyBox = await body.boundingBox();
            console.log('GEOMETRY ' + label + ' ' + JSON.stringify({ finalBox, bodyBox, viewportHeight: height }));
            assert.ok(finalBox && bodyBox && finalBox.y >= 0 && finalBox.y + finalBox.height <= height && finalBox.y >= bodyBox.y - 1 && finalBox.y + finalBox.height <= bodyBox.y + bodyBox.height + 1, label + ': final Help item reachable');
            assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
            const headerBox = await page.locator('#helpDialog .dialog-header').boundingBox();
            assert.ok(headerBox && headerBox.x >= 0 && headerBox.x + headerBox.width <= width && headerBox.y >= 0 && headerBox.y + headerBox.height <= height, label + ': header visible');
            assert.equal(await page.locator('#helpDialog .dialog-footer').count(), 0, label + ': redundant Help footer is absent');
            assert.equal(await page.locator('#closeHelpFooterButton').count(), 0, label + ': redundant footer Close is absent');
            assert.equal(await page.locator('#closeHelpButton').isVisible(), true, label + ': header Close remains visible');
            if (file === 'dist/index.html' && [1360, 320].includes(width)) {
              await page.screenshot({ path: path.join(results, `help-${language}-${width}.png`) });
            }
            const dialogBox = await page.locator('#helpDialog').boundingBox();
            assert.ok(finalBox.y >= dialogBox.y - 1 && finalBox.y + finalBox.height <= dialogBox.y + dialogBox.height + 1, label + ': final item inside dialog');
            assert.ok(dialogBox.y > 1, label + ': top coordinate is genuine backdrop');
            const beforeScroll = await page.evaluate(() => scrollY);
            await page.mouse.move(2, 1);
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': background locked');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape');
            await page.locator('#helpButton').click();
            await page.locator('#closeHelpButton').click();
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': reopen and Close');
            await page.locator('#helpButton').click();
            await page.mouse.click(2, 1);
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': backdrop');
            if (file !== 'one-second-montage.html' && language === 'ja' && width === 360) await smoke(page, results, file);
            if (file === 'dist/index.html' && language === 'ja' && width === 360) await interactionSmoke(page, results, label);
            assert.deepEqual(errors, [], label + ': console errors');
            assert.deepEqual(requests, [], label + ': external runtime requests');
            console.log('PASS ' + label);
          } catch (error) {
            await page.screenshot({ path: path.join(results, `failure-${file.replace(/[^a-z0-9]/gi, '-')}-${language}-${width}x${height}.png`) }).catch(() => {});
            throw error;
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
