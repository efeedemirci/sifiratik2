// SıfırTabak — saf hesap mantığı (UI'dan bağımsız, node ile test edilir)

const clampPct = (v) => Math.min(100, Math.max(0, Number(v)));

/**
 * LLM'in verdiği doluluk yüzdelerinden kalan miktarı hesaplar.
 * Gram, ElektraWeb'deki başlangıç gramına oranlanarak bulunur.
 */
export function computeResult({ baslangicGram, gidisPct, donusPct }) {
  const b = Number(baslangicGram);
  const g = Number(gidisPct);
  const d = Number(donusPct);
  if (!Number.isFinite(b) || b <= 0) return { ok: false, error: 'Başlangıç miktarı geçersiz.' };
  if (!Number.isFinite(g) || g <= 0) return { ok: false, error: 'Gidiş doluluğu 0 olamaz.' };
  if (!Number.isFinite(d) || d < 0) return { ok: false, error: 'Dönüş doluluğu geçersiz.' };
  const oran = Math.min(1, clampPct(d) / clampPct(g));
  const kalanGram = Math.round(b * oran);
  return {
    ok: true,
    kalanGram,
    tuketilenGram: b - kalanGram,
    israfPct: Math.round((kalanGram / b) * 1000) / 10,
  };
}

/**
 * Hata payı ile kalan miktarın aralığı. Hata payları yüzde puanıdır (ör. %55 ± 10).
 * En az kalan: gidiş üst sınırda, dönüş alt sınırda; en çok kalan: tersi.
 */
export function computeRange({ baslangicGram, gidisPct, gidisHata = 0, donusPct, donusHata = 0 }) {
  const orta = computeResult({ baslangicGram, gidisPct, donusPct });
  if (!orta.ok) return orta;
  const b = Number(baslangicGram);
  const oran = (g, d) => (g <= 0 ? 1 : Math.min(1, Math.max(0, d) / g));
  const minGram = Math.round(b * oran(Math.min(100, gidisPct + gidisHata), donusPct - donusHata));
  const maxGram = Math.round(b * oran(Math.max(1, gidisPct - gidisHata), Math.min(100, donusPct + donusHata)));
  return { ...orta, minGram, maxGram, artiEksiGram: Math.round((maxGram - minGram) / 2) };
}

/** Kazan hacmi × yoğunluk ile ikinci (bağımsız) tahmin. Büyük farkta uyarı. */
export function crossCheck({ hacimL, yogunlukGL, gidisPct, donusPct, kalanGram }) {
  const tamGram = Number(hacimL) * Number(yogunlukGL);
  const tahminiKalanGram = Math.round(tamGram * (clampPct(donusPct) / 100));
  const tahminiBaslangicGram = Math.round(tamGram * (clampPct(gidisPct) / 100));
  const fark = Math.abs(tahminiKalanGram - kalanGram);
  const olcek = Math.max(tahminiKalanGram, kalanGram, 1);
  return {
    tahminiKalanGram,
    tahminiBaslangicGram,
    uyumsuz: fark > 300 && fark / olcek > 0.35,
  };
}

export function co2Kg(gram, faktorKgPerKg) {
  return Math.round((gram / 1000) * faktorKgPerKg * 100) / 100;
}

/** Günün kayıtlarını yemek bazında toplar. İsraf % yalnızca dönüşü ölçülmüş kazanlar üzerinden. */
export function aggregateDay(kayitlar, yemekler) {
  const byId = new Map(yemekler.map((y) => [y.id, y]));
  const grup = new Map();
  for (const k of kayitlar) {
    const y = byId.get(k.yemekId) || { id: k.yemekId, ad: k.yemekId, co2Faktor: 0 };
    if (!grup.has(y.id)) {
      grup.set(y.id, { id: y.id, ad: y.ad, kategori: y.kategori, uretilenGram: 0, olculenUretimGram: 0, kalanGram: 0, tuketilenGram: 0, kazanSayisi: 0, olculenKazan: 0, co2Kg: 0 });
    }
    const g = grup.get(y.id);
    g.uretilenGram += k.baslangicGram;
    g.kazanSayisi += 1;
    if (k.durum === 'dondu' && k.sonuc) {
      g.olculenKazan += 1;
      g.olculenUretimGram += k.baslangicGram;
      g.kalanGram += k.sonuc.kalanGram;
      g.tuketilenGram += k.sonuc.tuketilenGram;
      g.co2Kg += (k.sonuc.kalanGram / 1000) * (y.co2Faktor || 0);
    }
  }
  const liste = [...grup.values()].map((g) => ({
    ...g,
    co2Kg: Math.round(g.co2Kg * 100) / 100,
    israfPct: g.olculenUretimGram ? Math.round((g.kalanGram / g.olculenUretimGram) * 1000) / 10 : null,
  }));
  const toplam = liste.reduce(
    (t, g) => ({
      uretilenGram: t.uretilenGram + g.uretilenGram,
      olculenUretimGram: t.olculenUretimGram + g.olculenUretimGram,
      kalanGram: t.kalanGram + g.kalanGram,
      tuketilenGram: t.tuketilenGram + g.tuketilenGram,
      co2Kg: Math.round((t.co2Kg + g.co2Kg) * 100) / 100,
    }),
    { uretilenGram: 0, olculenUretimGram: 0, kalanGram: 0, tuketilenGram: 0, co2Kg: 0 },
  );
  toplam.israfPct = toplam.olculenUretimGram ? Math.round((toplam.kalanGram / toplam.olculenUretimGram) * 1000) / 10 : null;
  liste.sort((a, b) => b.kalanGram - a.kalanGram);
  return { yemekler: liste, toplam };
}

/** Model yanıtından JSON nesnesini ayıklar (kod bloğu ya da metin içinde olsa da). */
export function parseModelJson(text) {
  if (typeof text !== 'string') throw new Error('Model yanıtı boş.');
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(text.slice(s, e + 1));
      } catch { /* aşağıda hata */ }
    }
    throw new Error('Model yanıtı JSON formatında değil.');
  }
}

export const fmtGram = (g) =>
  g == null ? '—' : g >= 1000 ? `${(g / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg` : `${Math.round(g).toLocaleString('tr-TR')} g`;
export const fmtPct = (p) => (p == null ? '—' : `%${p.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`);
