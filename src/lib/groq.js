// Groq API istemcisi (OpenAI uyumlu uç). Tarayıcıdan doğrudan çağrılır.
import { parseModelJson } from './calc.js';

const BASE = 'https://api.groq.com/openai/v1';

async function istek(apiKey, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Groq hatası (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg += `: ${j.error.message}`;
    } catch { /* yok say */ }
    if (res.status === 401) msg = 'API anahtarı geçersiz (401). Ayarlar\'dan kontrol edin.';
    if (res.status === 429) msg = 'Groq istek limiti doldu (429). Biraz bekleyip tekrar deneyin.';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const VISION_IPUCU = /(vision|llama-4|scout|maverick|llava|qwen.*(vl|2\.5-vl|3\.[5-9])|muse|gemma-3|pixtral|kimi.*vl)/i;
export const muhtemelVision = (id) => VISION_IPUCU.test(id);

/** Groq'taki güncel model listesi. */
export async function listModels(apiKey) {
  const j = await istek(apiKey, '/models');
  return (j.data || [])
    .filter((m) => m.active !== false)
    .filter((m) => !/whisper|tts|guard|orpheus|playai/i.test(m.id))
    .map((m) => ({ id: m.id, sahip: m.owned_by, baglam: m.context_window, vision: muhtemelVision(m.id) }))
    .sort((a, b) => Number(b.vision) - Number(a.vision) || a.id.localeCompare(b.id));
}

// Qwen3.x gibi "düşünen" modeller. Varsayılan: modelin kendi ayarı (önceki demoda doğru sonuç veren
// yapı). "Hızlı mod" açılırsa düşünme kapatılır.
export const dusunebilir = (model) => /qwen\/?qwen3|qwen3[.-]/i.test(model || '');

async function sohbet(ayarlar, model, messages, secenek = { json: true, dusunme: true }) {
  const body = { model, messages, temperature: 0 };
  if (secenek.json) body.response_format = { type: 'json_object' };
  if (secenek.dusunme && dusunebilir(model) && ayarlar.hizliMod) body.reasoning_effort = 'none';
  try {
    const j = await istek(ayarlar.apiKey, '/chat/completions', body);
    const icerik = (j.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!icerik && j.choices?.[0]?.finish_reason === 'length') throw new Error('Model yanıtı token sınırına takıldı, tekrar deneyin.');
    return icerik;
  } catch (e) {
    if (e.status === 400) {
      if (body.reasoning_effort) return sohbet(ayarlar, model, messages, { ...secenek, dusunme: false });
      if (secenek.json) return sohbet(ayarlar, model, messages, { ...secenek, json: false });
    }
    throw e;
  }
}

const img = (dataUrl) => ({ type: 'image_url', image_url: { url: dataUrl } });

// Aynı fotoğraf + aynı soru → aynı sonuç (demo tutarlılığı ve hız). Önbellek tarayıcıda tutulur.
const ONBELLEK_KEY = 'sifirtabak:ai-onbellek:v2';
function ozet(str) {
  let h1 = 0x811c9dc5, h2 = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = (Math.imul(h2, 31) + c) | 0;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${str.length.toString(36)}`;
}
function onbellekOku(k) {
  try {
    return JSON.parse(localStorage.getItem(ONBELLEK_KEY) || '{}')[k] || null;
  } catch {
    return null;
  }
}
function onbellekYaz(k, v) {
  try {
    const o = JSON.parse(localStorage.getItem(ONBELLEK_KEY) || '{}');
    o[k] = v;
    const anahtarlar = Object.keys(o);
    if (anahtarlar.length > 200) delete o[anahtarlar[0]];
    localStorage.setItem(ONBELLEK_KEY, JSON.stringify(o));
  } catch { /* yok say */ }
}

const GUVEN = { 'yüksek': 0.9, yuksek: 0.9, orta: 0.6, 'düşük': 0.3, dusuk: 0.3 };

/**
 * Tek fotoğraf analizi (önceki demodaki kanıtlanmış soru yapısı).
 * asama: 'gidis' | 'donus'. Döner: {yemekTespiti, uyumlu, kazanKodu, dolulukPct, hataPayi, guven, gerekce, kaynak, onbellek}
 */
export async function analyzeFoto(ayarlar, { foto, asama, yemek, menu }) {
  const menuListe = [...new Set([yemek.ad, ...(menu || [])])];
  const prompt =
    `Fotoğraf, otel büfesinde kullanılan bir servis kazanını (GN küvet) gösteriyor; kazan ${asama === 'gidis' ? 'büfeye ÇIKMADAN önce' : 'büfeden mutfağa GERİ DÖNDÜKTEN sonra'} masaya konup çekildi. ` +
    `Bu öğünün menüsü: ${menuListe.join(', ')}. Kayıtta bu kazanda "${yemek.ad}" olmalı. ` +
    '1) Kazandaki yemeği SADECE bu menüden seç; menüde yoksa yemek="bilinmiyor". ' +
    '2) Kazanın servis için tamamen dolu hâline göre yemeğin yüzde kaçının kazanda BULUNDUĞUNU 0-100 arasında, 5\'in katı olarak ver. ' +
    'Sadece kaplanan alana değil, yemeğin kalınlığına/yığılma yüksekliğine ve kazan kenarındaki boş duvara da bak. ' +
    '3) hata_payi: tahminin kaç yüzde puanı sapabileceği (5-25); açı, yansıma, gölge veya yemeğin üst üste yığılması belirsizlik yaratıyorsa artır. ' +
    '4) Kazan üzerinde "SA:K05" gibi bir QR/etiket kodu okunuyorsa kazan_kodu alanına yaz, okunmuyorsa null. ' +
    '5) Gerekçeyi Türkçe, 1-2 cümle, gördüğün somut ipuçlarıyla yaz. ' +
    'Cevabı SADECE şu JSON biçiminde ver: {"yemek": "...", "doluluk_yuzde": 50, "hata_payi": 10, "guven": "yüksek|orta|düşük", "kazan_kodu": null, "gerekce": "..."}';

  const k = ozet(`${ayarlar.visionModel}|${ayarlar.hizliMod ? 'h' : 'd'}|${prompt}|${foto}`);
  const eski = onbellekOku(k);
  if (eski) return { ...eski, onbellek: true };

  const raw = await sohbet(ayarlar, ayarlar.visionModel, [{ role: 'user', content: [{ type: 'text', text: prompt }, img(foto)] }]);
  const j = parseModelJson(raw);
  const yemekAdi = String(j.yemek ?? 'bilinmiyor');
  const sonuc = {
    yemekTespiti: yemekAdi,
    uyumlu: yemekAdi.toLocaleLowerCase('tr') === yemek.ad.toLocaleLowerCase('tr'),
    kazanKodu: j.kazan_kodu || null,
    dolulukPct: sayi(j.doluluk_yuzde),
    hataPayi: Math.max(5, Math.min(25, sayi(j.hata_payi) ?? 10)),
    guven: GUVEN[String(j.guven ?? '').toLocaleLowerCase('tr')] ?? (Number.isFinite(Number(j.guven)) ? sayi(j.guven, 0, 1) : 0.6),
    gerekce: String(j.gerekce ?? ''),
    kaynak: 'ai',
  };
  if (sonuc.dolulukPct == null) throw new Error('Model doluluk yüzdesi vermedi, tekrar deneyin.');
  onbellekYaz(k, sonuc);
  return sonuc;
}

/** Dönüş: dönüş fotoğrafı analiz edilir; gidiş AI ile ölçülmemişse gidiş fotoğrafı da aynı soruyla ölçülür. */
export async function analyzeDonus(ayarlar, { kayit, yemek, menu, donusFoto }) {
  const gidisAi = kayit.gidis?.analiz?.kaynak === 'ai' && kayit.gidis?.kaynak !== 'elle';
  const [donus, gidis] = await Promise.all([
    analyzeFoto(ayarlar, { foto: donusFoto, asama: 'donus', yemek, menu }),
    !gidisAi && kayit.gidis?.foto ? analyzeFoto(ayarlar, { foto: kayit.gidis.foto, asama: 'gidis', yemek, menu }) : null,
  ]);
  return {
    ...donus,
    donusPct: donus.dolulukPct,
    donusHata: donus.hataPayi,
    gidisPct: gidis ? gidis.dolulukPct : kayit.gidis?.dolulukPct ?? 90,
    gidisHata: gidis ? gidis.hataPayi : kayit.gidis?.hataPayi ?? 10,
    gidisAnaliz: gidis,
  };
}

/** Gün sonu özet (metin modeli). */
export async function summarizeDay(ayarlar, ozet) {
  const model = ayarlar.textModel || ayarlar.visionModel;
  const raw = await sohbet(
    ayarlar,
    model,
    [
      {
        role: 'system',
        content:
          'Sen bir otel mutfağı için gıda israfı danışmanısın. Verilen günlük ölçüm verisini Türkçe, kısa ve uygulanabilir şekilde yorumla. Sadece verideki sayıları kullan, uydurma.',
      },
      {
        role: 'user',
        content: `Günün ölçüm verisi (JSON):\n${JSON.stringify(ozet)}\n\nJSON şeması: {"ozet": string (2-3 cümle), "oneriler": string[] (en fazla 3, her biri tek cümle, somut kazan/yemek adıyla)}`,
      },
    ],
  );
  const j = parseModelJson(raw);
  return { ozet: String(j.ozet ?? ''), oneriler: Array.isArray(j.oneriler) ? j.oneriler.map(String).slice(0, 3) : [] };
}

function sayi(v, min = 0, max = 100) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

// ---- Simülasyon modu (API anahtarı yokken ya da demo güvencesi için) ----
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));

export async function simulateFoto({ asama, yemek }) {
  await bekle(900);
  return {
    yemekTespiti: yemek.ad,
    uyumlu: true,
    kazanKodu: null,
    dolulukPct: asama === 'gidis' ? 5 * rnd(15, 19) : 5 * rnd(0, 9),
    hataPayi: 10,
    guven: 0.5,
    gerekce: 'Simülasyon: gerçek analiz yapılmadı, örnek değer üretildi.',
    kaynak: 'simulasyon',
  };
}

export async function simulateDonus({ kayit, yemek }) {
  const d = await simulateFoto({ asama: 'donus', yemek });
  return { ...d, donusPct: d.dolulukPct, donusHata: 10, gidisPct: kayit.gidis?.dolulukPct ?? 85, gidisHata: kayit.gidis?.hataPayi ?? 10 };
}

export async function simulateSummary(ozet) {
  await bekle(800);
  const ilk = ozet.yemekler?.[0];
  return {
    ozet: `Simülasyon özeti: Bugün ölçülen kazanlarda toplam ${Math.round((ozet.toplam?.kalanGram ?? 0) / 100) / 10} kg yemek döndü.${ilk ? ` En fazla dönen yemek ${ilk.ad}.` : ''}`,
    oneriler: ilk ? [`${ilk.ad} için yarınki üretimi dönen miktar kadar azaltmayı değerlendirin.`] : [],
  };
}
