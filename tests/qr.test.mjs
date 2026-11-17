import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeQrGray } from '../src/lib/qrDecode.js';
import { kazanKoduAyikla } from '../src/lib/qr.js';

const dir = new URL('./fixtures/', import.meta.url);
const yukle = (ad) => {
  const f = readdirSync(dir).find((x) => x.startsWith(ad) && x.endsWith('.gray.gz'));
  const [w, h] = f.match(/(\d+)x(\d+)/).slice(1).map(Number);
  return [new Uint8ClampedArray(gunzipSync(readFileSync(new URL(f, dir)))), w, h];
};

test('gerçek kazan fotoğrafı (%60 dolu, köfte) → SA:K05', async () => {
  const r = await decodeQrGray(...yukle('yuzde60_K05'));
  assert.equal(r?.text, 'SA:K05');
});

test('gerçek kazan fotoğrafı (boş dönüş) → SA:K05', async () => {
  const r = await decodeQrGray(...yukle('bos_K05'));
  assert.equal(r?.text, 'SA:K05');
});

test('QR içermeyen bölge → null (yanlış kod üretmez)', async () => {
  const [g, w] = yukle('yuzde60_K05');
  const cw = 500, ch = 400, x0 = 160, y0 = 260;
  const parca = new Uint8ClampedArray(cw * ch);
  for (let y = 0; y < ch; y++) parca.set(g.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + cw), y * cw);
  assert.equal(await decodeQrGray(parca, cw, ch), null);
});

test('kazan kodu ayıklama', () => {
  assert.equal(kazanKoduAyikla('SA:K05'), 'K-05');
  assert.equal(kazanKoduAyikla('SIFIRTABAK:K-12'), 'K-12');
  assert.equal(kazanKoduAyikla('sa:k7'), 'K-07');
  assert.equal(kazanKoduAyikla('merhaba'), null);
});
