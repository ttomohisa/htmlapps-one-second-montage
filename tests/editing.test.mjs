// Real application functions and event bindings run in a Node VM.
// Synthetic DOM/media seams deliberately do not claim browser, layout or codec coverage.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const path = process.env.MONTAGE_HTML || new URL('../src/index.template.html', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
function extract(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert(start >= 0, `Application function ${name} exists`);
  const lineEnd = source.indexOf('\n', start);
  if (source.slice(start, lineEnd).trimEnd().endsWith('}')) return source.slice(start, lineEnd);
  const end = source.indexOf('\n      }', start) + '\n      }'.length;
  assert(end > start, `${name} end`);
  return source.slice(start, end);
}
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
function makeItem(sequence, year = 2024) {
  return { sequence, kind: sequence % 2 ? 'video' : 'image', file: { name: `synthetic-${sequence}.mp4`, size: 100 + sequence, lastModified: Date.UTC(year, 5, 1) }, capturedAt: Date.UTC(year, 5, 1), clipStart: 2.125, autoClipStart: 1.25, autoSelection: 'highlight', duration: 8, adjusted: true, thumbUrl: `blob:synthetic-${sequence}` };
}
function harness({ items = [makeItem(0), makeItem(1, 2025), makeItem(2)], yearDividers = false, language = 'en' } = {}) {
  const elements = new Map(), timers = new Map(), revoked = [], rendered = [], disposed = [], announced = [];
  let now = 0, timerId = 0, first = true;
  const started = deferred(), resume = deferred(), importStarted = deferred(), importResume = deferred();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, dataset: {}, disabled: false, hidden: false, value: '', children: [], attrs: {}, listeners: {}, style: { removeProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute() {}, load() {}, focus() { document.activeElement = this; }, scrollIntoView() {}, append(...children) { this.children.push(...children); },
      addEventListener(k, fn) { (this.listeners[k] ??= []).push(fn); }, dispatch(type = 'click') { for (const fn of this.listeners[type] || []) fn({ preventDefault() {} }); }, click() { if (!this.disabled) this.dispatch(); },
      set textContent(value) { this.text = value; this.children = []; }, get textContent() { return this.text; }
    });
    return elements.get(id);
  }
  const state = { items, processing: false, importing: false, cancelRequested: false, outputBlob: null, outputUrl: '', outputInfo: null, outputStale: false, videosOnly: false, yearDividers, musicMode: 'none', musicVolume: .35, customMusicFile: null, aspectRatio: '16:9', fitMode: 'fit', backgroundMode: 'solid', quality: 'standard', sortMode: 'added', language };
  const document = { body: element('body'), activeElement: null, querySelector: () => null, querySelectorAll: () => [], createElement: type => type === 'canvas' ? canvas : element(`created-${elements.size}-${type}`) };
  const canvas = { width: 0, height: 0, getContext() { return {}; }, captureStream() { return { getTracks() { return [{ stop() {} }]; } }; } };
  class MediaRecorder {
    constructor() { this.events = {}; this.state = 'inactive'; }
    addEventListener(k, fn) { (this.events[k] ??= []).push(fn); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; for (const fn of this.events.dataavailable || []) fn({ data: new Blob(['synthetic']) }); for (const fn of this.events.stop || []) fn(); }
  }
  const ctx = vm.createContext({ state, console, Blob, DOMException, MediaRecorder, document, $: element,
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, due: now + delay }); return id; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: fn => fn(), matchMedia: () => ({ matches: true }), URL: { createObjectURL: () => 'blob:synthetic-output', revokeObjectURL: url => revoked.push(url) },
    renderFailures() {}, addFailure() {}, isImageFile: () => true, isVideoFile: () => false, createImageItem: async file => { importStarted.resolve(); await importResume.promise; if (state.cancelRequested) throw new DOMException('Cancelled', 'AbortError'); return { ...makeItem(3), file }; },
    renderThumbs() {}, renderSummary() { vm.runInContext('updateControls()', ctx); }, renderVideoFilter() {}, renderResultSummary() {}, announce: text => announced.push(text), revealProcess() {}, formatMediaDuration: String, formatBytes: String,
    chooseMimeType: () => 'video/mp4', showError: message => { throw Error(message); }, stopMusicPreview: async () => {}, outputConfig: () => ({ width: 1280, height: 720, bitrate: 5000000 }),
    prepareRenderEntry: async entry => ({ entry, dispose() { disposed.push(entry); } }),
    holdRenderer: async renderer => { rendered.push(renderer.entry.kind === 'year' ? `year:${renderer.entry.year}` : renderer.entry.item.sequence); if (first) { first = false; started.resolve(); await resume.promise; } },
    pauseRecorder: async () => {}, resumeRecorder: async () => {}, drawRenderer() {}, yieldToMain: async () => {}, wait: async () => {}, musicLabel: () => 'none', isLikelyMemoryError: () => false
  });
  const translationsStart = source.indexOf('      const translations = {');
  const translationsEnd = source.indexOf('\n      };', translationsStart) + '\n      };'.length;
  vm.runInContext(source.slice(translationsStart, translationsEnd) + '\nfunction t(key){return translations[state.language][key] || key;}', ctx);
  const names = ['counts', 'musicSignature', 'outputSignature', 'markOutputChanged', 'isBusy', 'updateControls', 'renderOutputState', 'setProcessing', 'setImporting', 'clearOutput', 'sortTimestamp', 'itemYear', 'buildRenderSequence', 'yearDividerCount', 'outputDuration', 'removeItem', 'createVideo', 'setProcessStatus', 'updateProgress', 'hideError', 'showToast', 'releaseItem', 'setManualOrder', 'renderSortControl', 'renderReorderList', 'renderAfterItemChange', 'moveItem', 'sortItems', 'requestCancel', 'cancelledError', 'isCancelledError', 'throwIfCancelled', 'addFiles'];
  for (const name of ['focusRenderedControl','restoreReorderFocus','restoreRemovalFocus']) if (source.includes('function '+name+'(')) names.push(name);
  if (source.includes('function reverseItems(')) names.push('reverseItems');
  vm.runInContext(source.split('\n').find(line => line.includes('const AppToast = (()=>')) + '\n' + names.map(extract).join('\n'), ctx);
  const reverseBinding = source.split('\n').find(line => line.includes("$('#reverseOrderButton').addEventListener"));
  if (reverseBinding) vm.runInContext(reverseBinding, ctx);
  const run = code => vm.runInContext(code, ctx);
  run('updateControls()');
  function tick(milliseconds) {
    const end = now + milliseconds;
    for (;;) { const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0]; if (!next) break; now = next[1].due; timers.delete(next[0]); next[1].fn(); }
    now = end;
  }
  return { state, element, document, run, tick, revoked, rendered, disposed, announced, started, resume, importStarted, importResume };
}

// Removing the markup or either localized label must fail these contract checks.
test('reverse-all native button is outside the rebuilt list and has both translations', () => {
  assert.match(source, /<button[^>]*id="reverseOrderButton"[^>]*type="button"[^>]*data-i18n="reverseAll"/);
  const dialog = source.match(/<dialog[^>]*id="reorderDialog"[\s\S]*?<\/dialog>/)[0];
  assert.match(dialog, /id="reverseOrderButton"/);
  assert.match(dialog, /<div class="reorder-list" id="reorderList"><\/div>/);
  for (const [language, label] of [['en', 'Reverse all items'], ['ja', '全素材を逆順にする']]) assert.equal(harness({ language }).run("t('reverseAll')"), label);
});

test('reverse preserves exact items, file data, edited clip ranges, output and focus; twice restores freshness', () => {
  const h = harness(), originals = [...h.state.items], before = JSON.stringify(originals), blob = new Blob(['existing']);
  h.state.outputBlob = blob; h.state.outputUrl = 'blob:kept'; h.state.outputInfo = { signature: h.run('outputSignature()') };
  const info = h.state.outputInfo;
  h.element('#outputFilename').value = 'My edited montage';
  h.element('#reverseOrderButton').focus();
  h.element('#reverseOrderButton').click();
  assert.deepEqual(h.state.items, [...originals].reverse());
  h.state.items.forEach((item, index) => { assert.equal(item, originals[originals.length - 1 - index]); assert.equal(item.file, originals[originals.length - 1 - index].file); });
  assert.equal(h.state.sortMode, 'manual'); assert.equal(h.state.outputStale, true);
  assert.equal(h.state.outputBlob, blob); assert.equal(h.state.outputInfo, info); assert.equal(h.state.outputUrl, 'blob:kept');
  assert.equal(h.element('#outputFilename').value, 'My edited montage'); assert.equal(h.document.activeElement, h.element('#reverseOrderButton'));
  assert.equal(h.element('#sortSelect').value, 'manual');
  h.element('#reverseOrderButton').click();
  assert.deepEqual(h.state.items, originals); assert.equal(JSON.stringify(originals), before); assert.equal(h.state.outputStale, false); assert.deepEqual(h.revoked, []);
});

test('reverse includes filtered-out photos and recomputes year dividers from the new whole order', () => {
  const h = harness({ items: [makeItem(0), makeItem(1), makeItem(2, 2025), makeItem(3, 2026)], yearDividers: true });
  h.state.videosOnly = true; h.element('#reverseOrderButton').click();
  assert.deepEqual(h.state.items.map(i => i.sequence), [3, 2, 1, 0]); assert.equal(h.state.videosOnly, true);
  assert.deepEqual(Array.from(h.run('buildRenderSequence()'), e => e.kind === 'year' ? `year:${e.year}` : e.item.sequence), ['year:2026', 3, 'year:2025', 2, 'year:2024', 1, 0]);
  assert.equal(h.run('outputDuration()'), 7);
});

for (const length of [0, 1]) test(`reverse is disabled and handler no-op for ${length} items`, () => {
  const h = harness({ items: Array.from({ length }, (_, i) => makeItem(i)) });
  assert.equal(h.element('#reverseOrderButton').disabled, true); h.element('#reverseOrderButton').dispatch(); assert.equal(h.state.sortMode, 'added');
});
for (const phase of ['Processing', 'Importing']) test(`reverse and Undo reject native and synthetic activation during ${phase}`, () => {
  const h = harness(); h.run('removeItem(1)'); const remaining = [...h.state.items];
  h.run(`set${phase}(true)`);
  assert.equal(h.element('#reverseOrderButton').disabled, true); assert.equal(h.element('#appToastAction').disabled, true);
  h.element('#reverseOrderButton').click(); h.element('#reverseOrderButton').dispatch(); h.element('#appToastAction').click(); h.element('#appToastAction').dispatch();
  assert.deepEqual(h.state.items, remaining); assert.equal(h.state.sortMode, 'added');
  h.tick(3000); h.run(`set${phase}(false)`);
  assert.equal(h.element('#appToastAction').disabled, false); h.element('#appToastAction').click(); assert.deepEqual(h.state.items.map(i => i.sequence), [0, 1, 2]);
  h.element('#appToastAction').dispatch(); h.tick(6000); assert.equal(h.state.items.length, 3); assert.deepEqual(h.revoked, []);
});
for (const phase of ['Processing', 'Importing']) test(`Undo expires normally during ${phase} without resurrecting or leaking the item`, () => {
  const h = harness(); h.run('removeItem(1)'); h.run(`set${phase}(true)`); h.tick(5000);
  h.element('#appToastAction').dispatch(); assert.deepEqual(h.state.items.map(i => i.sequence), [0, 2]);
  h.tick(600); assert.deepEqual(h.revoked, ['blob:synthetic-1']);
  h.run(`set${phase}(false)`); h.element('#appToastAction').click(); h.element('#appToastAction').dispatch(); h.tick(6000);
  assert.deepEqual(h.state.items.map(i => i.sequence), [0, 2]); assert.deepEqual(h.revoked, ['blob:synthetic-1']);
});

for (const yearDividers of [false, true]) for (const action of ['none', 'before', 'during']) test(`gated renderer remains consistent: Undo ${action}, year dividers ${yearDividers}`, async () => {
  const h = harness({ yearDividers }); h.run('removeItem(1)');
  if (action === 'before') h.element('#appToastAction').click();
  const creating = h.run('createVideo()'); await h.started.promise;
  if (action === 'during') h.element('#appToastAction').dispatch();
  h.resume.resolve(); await creating;
  assert.equal(h.state.processing, false); assert(h.state.outputBlob);
  assert.equal(h.state.outputInfo.total, action === 'before' ? 3 : 2);
  assert.equal(h.state.outputInfo.images + h.state.outputInfo.videos, h.state.outputInfo.total);
  assert.equal(h.state.outputInfo.duration, h.rendered.length); assert.equal(h.state.outputInfo.duration, h.run('outputDuration()'));
  assert.equal(h.state.outputInfo.signature, h.run('outputSignature()')); assert.equal(h.state.outputStale, false);
  assert.equal(h.rendered.includes(1), action === 'before');
  if (action === 'during') { const blob = h.state.outputBlob; h.element('#appToastAction').click(); assert.equal(h.state.items.length, 3); assert.equal(h.state.outputStale, true); assert.equal(h.state.outputBlob, blob); }
});

test('cancelled rendering retains unexpired Undo and normal renderer disposal', async () => {
  const h = harness(); h.run('removeItem(1)'); const creating = h.run('createVideo()'); await h.started.promise;
  h.run('requestCancel()'); h.resume.resolve(); await creating;
  assert.equal(h.state.processing, false); assert.equal(h.state.outputBlob, null); assert(h.disposed.length > 0);
  h.element('#appToastAction').click(); assert.deepEqual(h.state.items.map(i => i.sequence), [0, 1, 2]); h.tick(6000); assert.deepEqual(h.revoked, []);
});

for (const cancel of [false, true]) test(`import ${cancel ? 'cancellation' : 'completion'} preserves unexpired Undo`, async () => {
  const h = harness(); h.run('removeItem(1)');
  const importing = h.run("addFiles([{ name: 'new.jpg', size: 1, lastModified: 1 }])"); await h.importStarted.promise;
  assert.equal(h.element('#appToastAction').disabled, true);
  h.element('#appToastAction').dispatch(); assert.deepEqual(h.state.items.map(i => i.sequence), [0, 2]);
  if (cancel) h.run('requestCancel()');
  h.importResume.resolve(); await importing;
  assert.equal(h.state.importing, false); assert.equal(h.element('#appToastAction').disabled, false);
  h.element('#appToastAction').click(); assert.deepEqual(h.state.items.map(i => i.sequence), cancel ? [0, 1, 2] : [0, 1, 2, 3]);
  h.tick(6000); assert.deepEqual(h.revoked, []);
});

test('remove Undo callback itself rejects busy work without consuming recovery', () => {
  const h = harness();
  h.run(`let undoCallback; const originalShowToast = showToast; showToast = (message, options = {}) => { if (options.onAction) undoCallback = options.onAction; originalShowToast(message, options); }; removeItem(1); setProcessing(true); undoCallback();`);
  assert.deepEqual(h.state.items.map(i => i.sequence), [0, 2]);
  h.run('setProcessing(false); undoCallback()'); assert.deepEqual(h.state.items.map(i => i.sequence), [0, 1, 2]); h.tick(6000); assert.deepEqual(h.revoked, []);
});

test('all inline application scripts parse without browser globals', () => {
  const scripts = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, attrs]) => !/type=["']application\//.test(attrs));
  assert(scripts.length > 0);
  for (const [, , script] of scripts) new vm.Script(script);
});

test('help markup and both languages explain reversal and temporary Undo unavailability', () => {
  assert.match(source.match(/<li data-i18n="helpStep2">(.*?)<\/li>/)[1], /全素材を逆順にする/);
  for (const language of ['ja', 'en']) {
    const h = harness({ language }), help = h.run("t('helpStep2')");
    assert.match(help, language === 'ja' ? /全素材を逆順にする/ : /Reverse all items/);
    assert.match(help, language === 'ja' ? /5秒.*読み込み・作成中/ : /5 seconds.*importing or creating/);
  }
});

for (const sortMode of ['name', 'date', 'manual']) test(`reverse uses the actual ${sortMode} order, including duplicate filenames`, () => {
  const h = harness({ items: [makeItem(3, 2025), makeItem(0, 2026), makeItem(1, 2024), makeItem(2, 2024)] });
  h.state.items.forEach(item => item.file.name = 'duplicate.mp4');
  if (sortMode === 'manual') h.run('setManualOrder()'); else h.run(`sortItems('${sortMode}')`);
  const before = [...h.state.items]; h.element('#reverseOrderButton').click();
  h.state.items.forEach((item, index) => assert.equal(item, before[before.length - 1 - index]));
  assert.equal(h.state.sortMode, 'manual');
});

test('expired Undo stays expired across rendering cancellation and its completion message', async () => {
  const h = harness(); h.run('removeItem(1)'); const creating = h.run('createVideo()'); await h.started.promise;
  h.tick(5600); h.run('requestCancel()'); h.resume.resolve(); await creating;
  h.element('#appToastAction').dispatch(); assert.deepEqual(h.state.items.map(i => i.sequence), [0, 2]); assert.deepEqual(h.revoked, ['blob:synthetic-1']);
});

test('replacing an Undo still releases only the abandoned removal', () => {
  const h = harness(); const removedFirst = h.state.items[0], removedSecond = h.state.items[1];
  h.run('removeItem(0); removeItem(0)'); h.element('#appToastAction').click(); h.element('#appToastAction').dispatch(); h.tick(5600);
  assert.equal(h.state.items[0], removedSecond); assert.equal(h.state.items.includes(removedFirst), false); assert.deepEqual(h.revoked, [removedFirst.thumbUrl]);
});

test('ordinary PR validation runs the editing suite with an explicit Node.js version', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/build-standalone.yml', import.meta.url), 'utf8');
  assert.match(workflow, /uses: actions\/setup-node@v\d+\s+with:\s+node-version: "22"/);
  assert.match(workflow, /- "tests\/\*\*"/); assert.match(workflow, /- "one-second-montage.html"/);
  assert.match(workflow, /run: \.\/scripts\/check-repository.ps1/);
  const check = fs.readFileSync(new URL('../scripts/check-repository.ps1', import.meta.url), 'utf8');
  assert.match(check, /& node \(Join-Path \$Root "scripts\\test-editing.mjs"\)/);
  assert.match(check, /if \(\$LASTEXITCODE -ne 0\) \{ throw "Editing regression tests failed\." \}/);
});

test('finishing an import does not restart the original five-second Undo window', async () => {
  const h = harness(); h.run('removeItem(1)');
  const importing = h.run("addFiles([{ name: 'new.jpg', size: 1, lastModified: 1 }])"); await h.importStarted.promise;
  h.tick(4000); h.importResume.resolve(); await importing;
  assert.equal(h.element('#appToastAction').hidden, false);
  h.tick(1000); h.element('#appToastAction').dispatch();
  assert.deepEqual(h.state.items.map(i => i.sequence), [0, 2, 3]); h.tick(600); assert.deepEqual(h.revoked, ['blob:synthetic-1']);
});
