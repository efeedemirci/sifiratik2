// Fotoğraftan QR okuma hattı (tarayıcı ve node'da aynı çalışır, saf JS).
// Neden bu kadar adım? Kamera masaya bakarken QR karede küçük (~4 px/modül) ve bulanık kalıyor.
// Tek bir okuyucu çoğu zaman başarısız oluyor; önce QR'ın yeri bulunur, bölge büyütülür ve
// farklı ön işlemelerle iki ayrı okuyucu (jsQR + ZXing) denenir.
import jsQR from '../vendor/jsqr.js';
import { BinaryBitmap, DecodeHintType, Decoder, Detector, HybridBinarizer, PerspectiveTransform, QRCodeReader, RGBLuminanceSource } from '../vendor/zxing-qr.js';

// ---------- Görüntü yardımcıları (gri tonlama, tek kanal) ----------
export function rgbaToGray(rgba, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}

function crop(src, w, x, y, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch);
  for (let r = 0; r < ch; r++) out.set(src.subarray((y + r) * w + x, (y + r) * w + x + cw), r * cw);
  return out;
}

function resize(src, w, h, nw, nh) {
  const out = new Uint8ClampedArray(nw * nh);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), dy = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), dx = fx - x0;
      const a = src[y0 * w + x0], b = src[y0 * w + x1], c = src[y1 * w + x0], d = src[y1 * w + x1];
      out[y * nw + x] = (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
    }
  }
  return out;
}

function blur(src, w, h, r) {
  if (r <= 0) return src;
  const tmp = new Float32Array(w * h), out = new Uint8ClampedArray(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / n;
      s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function otsu(src) {
  const hist = new Uint32Array(256);
  for (const v of src) hist[v]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = src.length - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] > t ? 255 : 0;
  return out;
}

function grayToRgba(g) {
  const out = new Uint8ClampedArray(g.length * 4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { out[j] = out[j + 1] = out[j + 2] = g[i]; out[j + 3] = 255; }
  return out;
}

// ---------- Okuyucular ----------
const zxHints = new Map([[DecodeHintType.TRY_HARDER, true]]);

function zxingDecode(g, w, h) {
  try {
    return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(g, w, h))), zxHints).getText();
  } catch {
    return null;
  }
}

function jsqrDecode(g, w, h) {
  try {
    return jsQR(grayToRgba(g), w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
  } catch {
    return null;
  }
}


// ---------- Bulanık QR için ortalamalı örnekleyici ----------
// ZXing her modülü tek pikselden okur; bulanık/küçük QR'da bu bit hatası verir.
// Burada her modülün içinden 9 noktanın ortalaması alınır ve eşik, modül değerlerinin
// histogramından (Otsu) bulunup çevresinde birkaç farklı değer denenir.
function bilinear(g, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return 255;
  const x0 = x | 0, y0 = y | 0, dx = x - x0, dy = y - y0, i = y0 * w + x0;
  return (g[i] * (1 - dx) + g[i + 1] * dx) * (1 - dy) + (g[i + w] * (1 - dx) + g[i + w + 1] * dx) * dy;
}

function otsuDeger(vals) {
  const hist = new Uint32Array(256);
  for (const v of vals) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = vals.length - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return t;
}

function ornekleyerekCoz(g, w, h) {
  let sonuc;
  try {
    const bm = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(g, w, h))).getBlackMatrix();
    sonuc = new Detector(bm).detect(zxHints);
  } catch {
    return null;
  }
  const p = sonuc.getPoints(); // [solAlt, solÜst, sağÜst, (hizalama)]
  const boyut0 = sonuc.getBits().getWidth();
  const [bl, tl, tr, al] = p;
  for (const boyut of [boyut0, boyut0 + 4, boyut0 - 4]) {
    if (boyut < 21 || (boyut - 17) % 4 !== 0) continue;
    const d3 = boyut - 3.5;
    let brX, brY, sBr;
    if (al && boyut >= 25) { brX = al.getX(); brY = al.getY(); sBr = d3 - 3; }
    else { brX = tr.getX() - tl.getX() + bl.getX(); brY = tr.getY() - tl.getY() + bl.getY(); sBr = d3; }
    // Hizalama deseni yoksa sağ-alt köşe paralelkenar varsayımıyla tahmin edilir; eğik etikette
    // bu tutmaz. Köşeyi modül adımlarıyla kaydırıp her konumu dene (hata düzeltme doğrular).
    const ux = (tr.getX() - tl.getX()) / (d3 - 3.5), uyx = (tr.getY() - tl.getY()) / (d3 - 3.5);
    const vx = (bl.getX() - tl.getX()) / (d3 - 3.5), vy = (bl.getY() - tl.getY()) / (d3 - 3.5);
    const kaydirmalar = [];
    for (let a = -2; a <= 2; a += 0.5) for (let b = -2; b <= 2; b += 0.5) kaydirmalar.push([a, b]);
    kaydirmalar.sort((m, n) => Math.hypot(m[0], m[1]) - Math.hypot(n[0], n[1]));
    const nokta = new Float32Array(2);
    const degerler = new Float32Array(boyut * boyut);
    for (const [a, b] of kaydirmalar) {
      const kx = brX + a * ux + b * vx, ky = brY + a * uyx + b * vy;
      const tf = PerspectiveTransform.quadrilateralToQuadrilateral(3.5, 3.5, d3, 3.5, sBr, sBr, 3.5, d3, tl.getX(), tl.getY(), tr.getX(), tr.getY(), kx, ky, bl.getX(), bl.getY());
      for (let i = 0; i < boyut; i++) for (let j = 0; j < boyut; j++) {
        let s = 0;
        for (const oy of [-0.22, 0, 0.22]) for (const ox of [-0.22, 0, 0.22]) {
          nokta[0] = j + 0.5 + ox; nokta[1] = i + 0.5 + oy;
          tf.transformPoints(nokta);
          s += bilinear(g, w, h, nokta[0], nokta[1]);
        }
        degerler[i * boyut + j] = s / 9;
      }
      const t0 = otsuDeger(degerler);
      for (const d of [0, -10, 10, -20, 20]) {
        const esik = t0 + d;
        const matris = [];
        for (let i = 0; i < boyut; i++) {
          const satir = [];
          for (let j = 0; j < boyut; j++) satir.push(degerler[i * boyut + j] < esik);
          matris.push(satir);
        }
        try {
          return new Decoder().decodeBooleanArray(matris, zxHints).getText();
        } catch { /* sonraki deneme */ }
      }
    }
  }
  return null;
}

/** ZXing dedektörüyle QR'ın yerini bulur (çözemese bile). Döner: {x,y,w,h} ya da null */
export function locate(g, w, h) {
  try {
    const bm = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(g, w, h))).getBlackMatrix();
    const pts = new Detector(bm).detect(zxHints).getPoints();
    const xs = pts.map((p) => p.getX()), ys = pts.map((p) => p.getY());
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const size = Math.max(maxX - minX, maxY - minY);
    if (!Number.isFinite(size) || size < 8) return null;
    // Bulucu desen merkezlerinden QR'ın tamamına + sessiz bölgeye genişlet
    const m = size * 0.45;
    const x = Math.max(0, Math.floor(minX - m)), y = Math.max(0, Math.floor(minY - m));
    return { x, y, w: Math.min(w - x, Math.ceil(maxX - minX + 2 * m)), h: Math.min(h - y, Math.ceil(maxY - minY + 2 * m)) };
  } catch {
    return null;
  }
}

const bekle = () => new Promise((r) => setTimeout(r, 0));

/** Bir bölgeyi farklı ölçek/ön işlemelerle iki okuyucuyla dener. */
async function bolgeyiCoz(g, w, h, hedefler) {
  for (const hedef of hedefler) {
    const s = hedef / Math.max(w, h);
    const nw = Math.max(8, Math.round(w * s)), nh = Math.max(8, Math.round(h * s));
    const base = s === 1 ? g : resize(g, w, h, nw, nh);
    for (const r of [0, 1, 2]) {
      const b = blur(base, nw, nh, Math.round(r * Math.max(1, s / 2)));
      const ornek = ornekleyerekCoz(b, nw, nh);
      if (ornek) return ornek;
      for (const img of [b, otsu(b)]) {
        const t = jsqrDecode(img, nw, nh) || zxingDecode(img, nw, nh);
        if (t) return t;
      }
      await bekle();
    }
  }
  return null;
}

/**
 * Gri görüntüden QR metnini bulur.
 * @returns {Promise<{text: string, yontem: string} | null>}
 */
export async function decodeQrGray(g, w, h) {
  // 1) Tüm görüntü, doğrudan
  const direkt = zxingDecode(g, w, h) || ornekleyerekCoz(g, w, h) || jsqrDecode(g, w, h);
  if (direkt) return { text: direkt, yontem: 'tam görüntü' };

  // 2) QR'ın yerini bul → kırp → büyüterek dene
  const adaylar = [];
  const tam = locate(g, w, h);
  if (tam) adaylar.push(tam);
  // Yer bulunamazsa / çözülemezse üst üste binen parçalarda ara
  for (const f of [0.5, 0.34]) {
    const cw = Math.round(w * f), ch = Math.round(h * f), adim = f === 0.5 ? 3 : 5;
    for (let iy = 0; iy < adim; iy++) for (let ix = 0; ix < adim; ix++) {
      const x = Math.round(((w - cw) * ix) / (adim - 1)), y = Math.round(((h - ch) * iy) / (adim - 1));
      const parca = crop(g, w, x, y, cw, ch);
      const up = resize(parca, cw, ch, cw * 2, ch * 2);
      const yer = locate(up, cw * 2, ch * 2);
      if (yer) adaylar.push({ x: x + Math.floor(yer.x / 2), y: y + Math.floor(yer.y / 2), w: Math.ceil(yer.w / 2), h: Math.ceil(yer.h / 2) });
    }
    if (adaylar.length) break;
  }

  for (const a of adaylar) {
    const parca = crop(g, w, a.x, a.y, a.w, a.h);
    const t = await bolgeyiCoz(parca, a.w, a.h, [Math.max(a.w, a.h) * 3, Math.max(a.w, a.h) * 4, Math.max(a.w, a.h) * 2, Math.max(a.w, a.h) * 6]);
    if (t) return { text: t, yontem: 'bölge büyütme' };
  }
  return null;
}
