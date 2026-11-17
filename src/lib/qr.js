// QR: kazan etiketi "SA:K05" biçiminde (SA = SıfırAtık). Eski "SIFIRTABAK:K-05" biçimi de okunur.
import { decodeQrGray, rgbaToGray } from './qrDecode.js';
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from '../vendor/zxing-qr.js';

export const qrMetni = (kazanId) => `SA:${kazanId.replace('-', '')}`;

/** QR metninden kazan kodu çıkarır: "SA:K05" → "K-05". */
export function kazanKoduAyikla(metin) {
  if (!metin) return null;
  const m = String(metin).toUpperCase().match(/K-?(\d{1,3})/);
  return m ? `K-${m[1].padStart(2, '0')}` : null;
}

/** Fotoğraftan (dataURL) kazan kodunu okur. Bulamazsa null. */
export async function detectQr(dataUrl) {
  try {
    const im = new Image();
    im.src = dataUrl;
    await im.decode();
    const s = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(im, 0, 0, w, h);
    const r = await decodeQrGray(rgbaToGray(ctx.getImageData(0, 0, w, h).data, w, h), w, h);
    const id = kazanKoduAyikla(r?.text);
    if (id) return id;
    // Son çare: tarayıcının yerleşik okuyucusu (Android/macOS Chrome'da var)
    if ('BarcodeDetector' in window) {
      const kodlar = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(im);
      for (const k of kodlar) {
        const id2 = kazanKoduAyikla(k.rawValue);
        if (id2) return id2;
      }
    }
  } catch { /* okunamadı */ }
  return null;
}

/** Etiket için QR'ı yerelde SVG olarak üretir (internet gerekmez). */
export function qrSvg(metin, boyut = 180) {
  const hints = new Map([[EncodeHintType.MARGIN, 2]]);
  const m = new QRCodeWriter().encode(metin, BarcodeFormat.QR_CODE, 0, 0, hints);
  const n = m.getWidth();
  let yol = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m.get(x, y)) yol += `M${x} ${y}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${boyut}" height="${boyut}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${yol}" fill="#000"/></svg>`;
}
