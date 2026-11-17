// ElektraWeb PMS'ten gelecek verinin mock'u.
// Gerçek entegrasyonda yalnızca bu modül (ve getElektrawebSnapshot) değişecek.

export const OTEL = {
  ad: 'Demo Resort Antalya',
  konsept: 'Her Şey Dahil',
  odaSayisi: 420,
};

// Kazanlar: QR kodu = "SIFIRTABAK:<kod>"
export const KAZANLAR = [
  { id: 'K-01', ad: 'GN 1/1 · 100 mm', hacimL: 14 },
  { id: 'K-02', ad: 'GN 1/1 · 100 mm', hacimL: 14 },
  { id: 'K-03', ad: 'GN 1/1 · 150 mm', hacimL: 21 },
  { id: 'K-04', ad: 'GN 1/1 · 65 mm', hacimL: 9 },
  { id: 'K-05', ad: 'GN 1/1 · 65 mm', hacimL: 9 },
  { id: 'K-06', ad: 'GN 1/2 · 100 mm', hacimL: 6.5 },
  { id: 'K-07', ad: 'GN 1/3 · 100 mm', hacimL: 3.5 },
  { id: 'K-08', ad: 'Çorba kazanı 20 L', hacimL: 20 },
  { id: 'K-09', ad: 'GN 1/1 · 100 mm', hacimL: 14 },
  { id: 'K-10', ad: 'GN 1/2 · 65 mm', hacimL: 4 },
  { id: 'K-11', ad: 'GN 1/1 · 65 mm', hacimL: 9 },
  { id: 'K-12', ad: 'Çorba kazanı 15 L', hacimL: 15 },
];

// yogunlukGL: pişmiş yemeğin yaklaşık yoğunluğu (g/L)
// co2Faktor: israf edilen 1 kg yemek başına yaklaşık kg CO₂e (demo amaçlı kaba değerler)
export const YEMEKLER = [
  { id: 'pilav', ad: 'Pirinç pilavı', kategori: 'Ana yemek yanı', yogunlukGL: 650, co2Faktor: 2.7 },
  { id: 'bulgur', ad: 'Bulgur pilavı', kategori: 'Ana yemek yanı', yogunlukGL: 600, co2Faktor: 1.6 },
  { id: 'mercimek', ad: 'Mercimek çorbası', kategori: 'Çorba', yogunlukGL: 1020, co2Faktor: 0.9 },
  { id: 'ezogelin', ad: 'Ezogelin çorbası', kategori: 'Çorba', yogunlukGL: 1020, co2Faktor: 0.9 },
  { id: 'kurufasulye', ad: 'Kuru fasulye', kategori: 'Ana yemek', yogunlukGL: 950, co2Faktor: 1.3 },
  { id: 'tavuksote', ad: 'Tavuk sote', kategori: 'Ana yemek', yogunlukGL: 800, co2Faktor: 5.5 },
  { id: 'kofte', ad: 'Izgara köfte', kategori: 'Ana yemek', yogunlukGL: 700, co2Faktor: 14 },
  { id: 'makarna', ad: 'Fırın makarna', kategori: 'Ana yemek yanı', yogunlukGL: 750, co2Faktor: 1.8 },
  { id: 'patates', ad: 'Fırın patates', kategori: 'Ana yemek yanı', yogunlukGL: 600, co2Faktor: 0.6 },
  { id: 'imambayildi', ad: 'İmam bayıldı', kategori: 'Zeytinyağlı', yogunlukGL: 700, co2Faktor: 1.4 },
  { id: 'sutlac', ad: 'Fırın sütlaç', kategori: 'Tatlı', yogunlukGL: 1050, co2Faktor: 2.2 },
];

export const OGUNLER = ['Kahvaltı', 'Öğle', 'Akşam'];

const bugun = () => new Date().toISOString().slice(0, 10);

/** ElektraWeb'den "çekilen" günlük snapshot. */
export function getElektrawebSnapshot() {
  const tarih = bugun();
  const uretim = [
    ['Öğle', 'K-08', 'mercimek', 18000],
    ['Öğle', 'K-01', 'pilav', 8000],
    ['Öğle', 'K-03', 'kurufasulye', 17600],
    ['Öğle', 'K-04', 'tavuksote', 6300],
    ['Öğle', 'K-06', 'imambayildi', 4000],
    ['Öğle', 'K-10', 'sutlac', 3700],
    ['Akşam', 'K-12', 'ezogelin', 13500],
    ['Akşam', 'K-02', 'bulgur', 7400],
    ['Akşam', 'K-05', 'kofte', 5500],
    ['Akşam', 'K-09', 'makarna', 9200],
    ['Akşam', 'K-11', 'patates', 4800],
    ['Akşam', 'K-07', 'pilav', 2000],
  ].map(([ogun, kazanId, yemekId, baslangicGram], i) => ({
    id: `UR-${tarih.replaceAll('-', '')}-${String(i + 1).padStart(2, '0')}`,
    tarih,
    ogun,
    kazanId,
    yemekId,
    baslangicGram,
    durum: 'hazir',
    gidis: null,
    donus: null,
    sonuc: null,
  }));

  // Başlangıç miktarları kazanın ~%88 doluluğuna denk gelecek şekilde seçildi.
  // Gösterim için öğle servisinden 3 kazan önceden ölçülmüş gelir (örnek veri)
  const ornek = [
    [0, 88, 31],
    [1, 92, 40],
    [2, 85, 12],
  ];
  for (const [idx, g, d] of ornek) {
    const r = uretim[idx];
    const kalanGram = Math.round(r.baslangicGram * (d / g));
    r.durum = 'dondu';
    r.ornek = true;
    r.gidis = { saat: '11:40', dolulukPct: g, kaynak: 'ornek' };
    r.donus = { saat: '14:35', dolulukPct: d, kaynak: 'ornek' };
    r.sonuc = {
      gidisPct: g,
      donusPct: d,
      kalanGram,
      tuketilenGram: r.baslangicGram - kalanGram,
      israfPct: Math.round((kalanGram / r.baslangicGram) * 1000) / 10,
      kaynak: 'ornek',
    };
  }
  // Bir kazan büfede (gidişi kaydedilmiş, dönüşü bekleniyor)
  uretim[3].durum = 'bufede';
  uretim[3].gidis = { saat: '11:45', dolulukPct: 90, kaynak: 'ornek' };

  return {
    kaynak: 'ElektraWeb PMS (mock)',
    cekilmeZamani: new Date().toISOString(),
    otel: { ...OTEL, doluOda: 371, misafir: 812 },
    tarih,
    uretim,
  };
}
