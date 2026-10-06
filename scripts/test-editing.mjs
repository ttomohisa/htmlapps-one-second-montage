// Offline behavioral checks for editable source and every shipped HTML variant.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'montage-editing-'));
try {
  const loader = fs.readFileSync(path.join(root, 'dist/index.self-extract.html'), 'utf8');
  const payload = loader.match(/<script id="self-extract-payload" type="application\/octet-stream">([\s\S]*?)<\/script>/)?.[1];
  assert(payload, 'Self-extracting release contains its gzip payload');
  const decoded = gunzipSync(Buffer.from(payload.replace(/\s/g, ''), 'base64'));
  assert.deepEqual(decoded, fs.readFileSync(path.join(root, 'dist/index.html')), 'Self-extract restores readable release byte-for-byte');
  const restored = path.join(temporary, 'restored.html');
  fs.writeFileSync(restored, decoded);
  for (const input of ['src/index.template.html', 'one-second-montage.html', 'dist/index.html', restored]) {
    console.log(`\n[Editing regression] ${input === restored ? 'decoded self-extract HTML' : input}`);
    const result = spawnSync(process.execPath, ['--test', path.join(root, 'tests/editing.test.mjs')], { stdio: 'inherit', env: { ...process.env, MONTAGE_HTML: path.resolve(root, input) } });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = 1;
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
