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
            if (width <= 600) {
              const fallback = page.locator('.file-fallback-button.block');
              assert.equal(await fallback.isVisible(), true, label + ': secondary file picker remains available');
              assert.equal(await fallback.evaluate(el => getComputedStyle(el).borderTopWidth), '0px', label + ': fallback is subtle');
            }
            await prepareApp(page, width, label);
            assert.equal(await page.locator('.page-intro').isVisible(), width > 600, label + ': hero hidden after mobile import');
            assert.equal(await page.locator('.local-badge').isVisible(), width > 600, label + ': local badge hidden only on mobile');
            assert.equal(await page.locator('.start-capabilities').count(), 0, label + ': no decorative feature list');
            assert.equal(await page.locator('#processNote').count(), 0, label + ': no redundant cancellation notice');
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
