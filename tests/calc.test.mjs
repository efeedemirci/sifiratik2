import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeResult, computeRange, crossCheck, co2Kg, aggregateDay, parseModelJson } from '../src/lib/calc.js';

test('pilav örneği: 2000 g, %90 → %27 ⇒ 600 g kalan, %30 israf', () => {
  const r = computeResult({ baslangicGram: 2000, gidisPct: 90, donusPct: 27 });
  assert.equal(r.ok, true);
  assert.equal(r.kalanGram, 600);
  assert.equal(r.tuketilenGram, 1400);
  assert.equal(r.israfPct, 30);
});

test('dönüş gidişten büyükse kalan başlangıçla sınırlanır', () => {
  const r = computeResult({ baslangicGram: 1500, gidisPct: 60, donusPct: 75 });
  assert.equal(r.ok, true);
  assert.equal(r.kalanGram, 1500);
  assert.equal(r.israfPct, 100);
});

test('gidiş doluluğu 0 veya eksikse hata', () => {
  assert.equal(computeResult({ baslangicGram: 2000, gidisPct: 0, donusPct: 10 }).ok, false);
  assert.equal(computeResult({ baslangicGram: 2000, gidisPct: undefined, donusPct: 10 }).ok, false);
});

test('boş dönen kazan ⇒ 0 israf', () => {
  const r = computeResult({ baslangicGram: 3000, gidisPct: 85, donusPct: 0 });
  assert.equal(r.kalanGram, 0);
  assert.equal(r.israfPct, 0);
});

test('çapraz kontrol büyük farkı işaretler', () => {
  const c = crossCheck({ hacimL: 10, yogunlukGL: 700, gidisPct: 90, donusPct: 50, kalanGram: 600 });
  assert.equal(c.tahminiKalanGram, 3500);
  assert.equal(c.uyumsuz, true);
  const c2 = crossCheck({ hacimL: 4, yogunlukGL: 600, gidisPct: 80, donusPct: 25, kalanGram: 600 });
  assert.equal(c2.uyumsuz, false);
});

test('co2 hesabı', () => {
  assert.equal(co2Kg(600, 2.5), 1.5);
});

test('günlük toplam yemek bazında birleşir', () => {
  const yemekler = [{ id: 'pilav', ad: 'Pilav', co2Faktor: 2 }];
  const kayitlar = [
    { yemekId: 'pilav', baslangicGram: 2000, durum: 'dondu', sonuc: { kalanGram: 600, tuketilenGram: 1400 } },
    { yemekId: 'pilav', baslangicGram: 1000, durum: 'bufede' },
  ];
  const a = aggregateDay(kayitlar, yemekler);
  assert.equal(a.toplam.uretilenGram, 3000);
  assert.equal(a.toplam.kalanGram, 600);
  assert.equal(a.toplam.olculenUretimGram, 2000);
  assert.equal(a.yemekler[0].israfPct, 30);
  assert.equal(a.toplam.co2Kg, 1.2);
});

test('model yanıtından JSON ayıklama', () => {
  assert.deepEqual(parseModelJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseModelJson('Sonuç:\n```json\n{"a":2}\n```'), { a: 2 });
  assert.throws(() => parseModelJson('json yok'));
});

test('hata payı: kalan gram aralığı', () => {
  // 5500 g köfte, gidiş %55±10, dönüş %10±5 → kalan 1000 g; aralık en az 5500×5/65, en çok 5500×15/45
  const r = computeRange({ baslangicGram: 5500, gidisPct: 55, gidisHata: 10, donusPct: 10, donusHata: 5 });
  assert.equal(r.kalanGram, 1000);
  assert.equal(r.minGram, 423);
  assert.equal(r.maxGram, 1833);
  assert.equal(r.artiEksiGram, 705);
});

test('hata payı: boş dönüşte alt sınır 0, oran 1 ile sınırlı', () => {
  const r = computeRange({ baslangicGram: 2000, gidisPct: 20, gidisHata: 15, donusPct: 10, donusHata: 15 });
  assert.equal(r.minGram, 0);
  assert.equal(r.maxGram, 2000);
});
