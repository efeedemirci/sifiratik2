import { useEffect, useMemo, useRef, useState } from 'react';
import { LuArrowLeft, LuCircleCheck, LuInfo, LuQrCode, LuRotateCcw, LuSave, LuSparkles, LuTriangleAlert } from 'react-icons/lu';
import { useStore } from '../store/store.jsx';
import { DurumBadge, KaynakBadge, PhotoDrop, Pot, Spinner, useToast } from '../components/ui.jsx';
import { compressImage } from '../lib/image.js';
import { detectQr, kazanKoduAyikla } from '../lib/qr.js';
import { analyzeDonus, analyzeFoto, simulateDonus, simulateFoto } from '../lib/groq.js';
import { computeRange, crossCheck, fmtGram, fmtPct } from '../lib/calc.js';

function useMenu(kayit) {
  const { kayitlar, yemek } = useStore();
  return [...new Set(kayitlar.filter((r) => r.ogun === kayit.ogun).map((r) => yemek(r.yemekId)?.ad).filter(Boolean))];
}

const Pay = ({ v }) => (v ? <span className="muted" style={{ fontWeight: 700 }}> ±{v}</span> : null);

const saat = () => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function Analysis({ param }) {
  const { kayitlar, kazan, yemek } = useStore();
  const secili = kayitlar.find((r) => r.id === param);
  if (!secili) return <KazanSec />;
  return <KayitAnaliz key={secili.id + secili.durum} kayit={secili} kazan={kazan(secili.kazanId)} yemek={yemek(secili.yemekId)} />;
}

/* ------------------------------------------------------------------ */
function KazanSec() {
  const { kayitlar, kazan, yemek } = useStore();
  const toast = useToast();
  const [filtre, setFiltre] = useState('aktif');
  const [qrYukleniyor, setQrYukleniyor] = useState(false);
  const qrRef = useRef(null);

  const liste = useMemo(
    () => kayitlar.filter((r) => (filtre === 'aktif' ? r.durum !== 'dondu' : filtre === 'hepsi' ? true : r.durum === filtre)),
    [kayitlar, filtre],
  );

  const qrIleBul = async (file) => {
    setQrYukleniyor(true);
    try {
      const foto = await compressImage(file);
      const kod = await detectQr(foto);
      if (!kod) {
        toast('Fotoğrafta QR kod okunamadı. QR görünür olacak şekilde tekrar çekin ya da kazanı listeden seçin.', 'err');
        return;
      }
      const r = kayitlar.find((x) => x.kazanId === kod && x.durum !== 'dondu') || kayitlar.find((x) => x.kazanId === kod);
      if (!r) {
        toast(`${kod} için bugün üretim kaydı yok.`, 'err');
        return;
      }
      sessionStorage.setItem(`sifirtabak:onfoto:${r.id}`, foto);
      toast(`${kod} bulundu: ${yemek(r.yemekId)?.ad}`);
      window.location.hash = `#/analiz/${r.id}`;
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setQrYukleniyor(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kazan Analizi</h1>
          <p>Kazanı seç, büfeye gidiş ve dönüş fotoğraflarını yükle; AI kalan miktarı hesaplasın.</p>
        </div>
        <div className="row">
          <input ref={qrRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { e.target.files?.[0] && qrIleBul(e.target.files[0]); e.target.value = ''; }} />
          <button className="btn btn-primary btn-lg" onClick={() => qrRef.current?.click()} disabled={qrYukleniyor}>
            {qrYukleniyor ? <Spinner /> : <LuQrCode />} QR ile kazan bul
          </button>
        </div>
      </div>


      <div className="card">
        <div className="card-head">
          <h2>Bugünün kazanları</h2>
          <div className="tabs" role="tablist" aria-label="Durum filtresi">
            {[['aktif', 'Bekleyenler'], ['hazir', 'Hazır'], ['bufede', 'Büfede'], ['dondu', 'Döndü'], ['hepsi', 'Hepsi']].map(([k, t]) => (
              <button key={k} role="tab" aria-selected={filtre === k} className={filtre === k ? 'on' : ''} onClick={() => setFiltre(k)}>{t}</button>
            ))}
          </div>
        </div>
        {liste.length === 0 ? (
          <div className="empty">Bu filtrede kazan yok.</div>
        ) : (
          <div className="kazan-grid">
            {liste.map((r) => (
              <a key={r.id} href={`#/analiz/${r.id}`} className="kazan-tile" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="kod">{r.kazanId}</span>
                  <DurumBadge durum={r.durum} />
                </div>
                <span className="yemek">{yemek(r.yemekId)?.ad}</span>
                <span className="meta">{r.ogun} · {fmtGram(r.baslangicGram)} · {kazan(r.kazanId)?.ad}</span>
                {r.sonuc && <span className="meta" style={{ color: 'var(--c-accent)', fontWeight: 700 }}>{fmtGram(r.sonuc.kalanGram)} kaldı ({fmtPct(r.sonuc.israfPct)})</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
function Adimlar({ durum }) {
  const a = durum === 'hazir' ? 1 : durum === 'bufede' ? 2 : 3;
  const s = (n, t) => <div className={`step ${a === n ? 'on' : a > n ? 'ok' : ''}`}><i>{a > n ? '✓' : n}</i>{t}</div>;
  return <div className="steps">{s(1, 'Gidiş fotoğrafı')}{s(2, 'Dönüş fotoğrafı')}{s(3, 'Kaydedildi')}</div>;
}

function KayitKarti({ kayit, kazan, yemek }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <p className="small muted">ElektraWeb kaydı · {kayit.id}</p>
          <h2>{yemek?.ad}</h2>
        </div>
        <DurumBadge durum={kayit.durum} />
      </div>
      <div className="grid grid-2" style={{ gap: 10 }}>
        <Bilgi k="Kazan" v={`${kazan?.id} · ${kazan?.ad}`} />
        <Bilgi k="Öğün" v={kayit.ogun} />
        <Bilgi k="Başlangıç miktarı" v={fmtGram(kayit.baslangicGram)} vurgu />
        <Bilgi k="Kazan hacmi" v={`${kazan?.hacimL} L`} />
      </div>
    </div>
  );
}
const Bilgi = ({ k, v, vurgu }) => (
  <div style={{ padding: 12, borderRadius: 14, background: '#fffdf8', border: '1px solid var(--c-border)' }}>
    <div className="small muted" style={{ fontWeight: 700 }}>{k}</div>
    <div style={{ fontWeight: 800, fontSize: vurgu ? '1.25rem' : '1rem', fontFamily: vurgu ? 'var(--f-head)' : undefined }}>{v}</div>
  </div>
);

function KayitAnaliz({ kayit, kazan, yemek }) {
  return (
    <>
      <div className="page-head">
        <div>
          <a href="#/analiz" className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }}><LuArrowLeft /> Kazan listesi</a>
          <h1>{kazan?.id} · {yemek?.ad}</h1>
        </div>
      </div>
      <Adimlar durum={kayit.durum} />
      <div className="grid grid-main">
        <div className="stack">
          {kayit.durum === 'hazir' && <GidisAdimi kayit={kayit} kazan={kazan} yemek={yemek} />}
          {kayit.durum === 'bufede' && <DonusAdimi kayit={kayit} kazan={kazan} yemek={yemek} />}
          {kayit.durum === 'dondu' && <Tamamlandi kayit={kayit} />}
        </div>
        <div className="stack">
          <KayitKarti kayit={kayit} kazan={kazan} yemek={yemek} />
          <div className="card small muted">
            <b style={{ color: 'var(--c-fg)' }}>Hesap nasıl yapılıyor?</b>
            <p style={{ marginTop: 6 }}>
              AI gram tahmin etmez; iki fotoğraftaki <b>doluluk yüzdesini</b> karşılaştırır. Kalan miktar, ElektraWeb'deki başlangıç miktarına oranlanır:
            </p>
            <p className="mono" style={{ marginTop: 8, color: 'var(--c-fg)' }}>kalan = başlangıç × (dönüş % ÷ gidiş %)</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Uyarılar ---------------- */
function AiUyarilari({ analiz, kazan, yemek }) {
  if (!analiz) return null;
  const u = [];
  if (analiz.uyumlu === false) u.push(`Kayıtta "${yemek.ad}" var, fotoğrafta "${analiz.yemekTespiti}" görünüyor. Doğru kazanı seçtiğinizden emin olun.`);
  const aiKod = kazanKoduAyikla(analiz.kazanKodu);
  if (aiKod && aiKod !== kazan.id) u.push(`Fotoğraftaki etiket "${analiz.kazanKodu}" okundu, seçili kazan ${kazan.id}.`);
  if (analiz.guven != null && analiz.guven < 0.5 && analiz.kaynak === 'ai') u.push('AI bu tahminden pek emin değil; değeri kontrol edip gerekirse düzeltin.');
  return u.map((t) => (
    <div key={t} className="alert alert-warn"><LuTriangleAlert /><span>{t}</span></div>
  ));
}

function useAnaliz() {
  const { ayarlar, simulasyonAktif } = useStore();
  const [yukleniyor, setY] = useState(false);
  const [hata, setHata] = useState('');
  const calistir = async (gercek, sahte) => {
    setY(true);
    setHata('');
    try {
      if (!simulasyonAktif && !ayarlar.visionModel) throw new Error('Ayarlar\'dan bir görsel (vision) model seçin.');
      return simulasyonAktif ? await sahte() : await gercek(ayarlar);
    } catch (e) {
      setHata(e.message || 'Analiz başarısız.');
      return null;
    } finally {
      setY(false);
    }
  };
  return { yukleniyor, hata, calistir, simulasyonAktif };
}

function QrDurum({ durum, kazan }) {
  if (durum === 'okunuyor') return <div className="alert alert-info" style={{ marginTop: 12 }}><Spinner /><span>Fotoğraftaki QR okunuyor…</span></div>;
  if (durum === 'yok') return <div className="alert alert-warn" style={{ marginTop: 12 }}><LuTriangleAlert /><span>Fotoğrafta QR okunamadı; kazanın {kazan.id} olduğundan emin olun.</span></div>;
  if (!durum) return null;
  if (durum !== kazan.id) return <div className="alert alert-danger" style={{ marginTop: 12 }}><LuTriangleAlert /><span>Fotoğraftaki QR kodu {durum}, ama seçili kazan {kazan.id}! Yanlış kazan olabilir.</span></div>;
  return <div className="alert alert-ok" style={{ marginTop: 12 }}><LuCircleCheck /><span>QR doğrulandı: {durum}</span></div>;
}

async function qrOku(foto, setQr) {
  setQr('okunuyor');
  setQr((await detectQr(foto)) || 'yok');
}

/* ---------------- 1. Gidiş ---------------- */
function GidisAdimi({ kayit, kazan, yemek }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [foto, setFoto] = useState(() => sessionStorage.getItem(`sifirtabak:onfoto:${kayit.id}`) || null);
  const [analiz, setAnaliz] = useState(null);
  const [doluluk, setDoluluk] = useState(90);
  const [payi, setPayi] = useState(10);
  const menu = useMenu(kayit);
  const [elle, setElle] = useState(false);
  const [qrKod, setQrKod] = useState(null);
  useEffect(() => { if (foto) qrOku(foto, setQrKod); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { yukleniyor, hata, calistir, simulasyonAktif } = useAnaliz();

  useEffect(() => sessionStorage.removeItem(`sifirtabak:onfoto:${kayit.id}`), [kayit.id]);

  const fotoSec = async (file) => {
    try {
      const f = await compressImage(file);
      setFoto(f);
      setAnaliz(null);
      qrOku(f, setQrKod);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const analizEt = async () => {
    const r = await calistir((a) => analyzeFoto(a, { foto, asama: 'gidis', yemek, menu }), () => simulateFoto({ asama: 'gidis', yemek }));
    if (r) {
      setAnaliz(r);
      if (r.dolulukPct != null) setDoluluk(r.dolulukPct);
      setPayi(r.hataPayi ?? 10);
      setElle(false);
    }
  };

  const kaydet = () => {
    dispatch({
      type: 'gidisKaydet',
      id: kayit.id,
      gidis: { foto, saat: saat(), dolulukPct: doluluk, hataPayi: payi, analiz, kaynak: elle || !analiz ? 'elle' : analiz.kaynak },
    });
    toast(`${kazan.id} büfeye çıktı olarak kaydedildi.`);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>1 · Büfeye gidiş</h2>
          <p>Kazanı masaya koyup büfeye çıkmadan önceki halini çekin.</p>
        </div>
        {simulasyonAktif && <span className="badge badge-sim">Simülasyon</span>}
      </div>
      <PhotoDrop value={foto} onFile={fotoSec} title="Gidiş fotoğrafı" tag={<span className="badge badge-bufede">GİDİŞ</span>} />
      <QrDurum durum={qrKod} kazan={kazan} />

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-accent" onClick={analizEt} disabled={!foto || yukleniyor}>
          {yukleniyor ? <Spinner /> : <LuSparkles />} {yukleniyor ? 'Analiz ediliyor…' : 'AI ile kontrol et'}
        </button>
        <span className="small muted">İsteğe bağlı: yemek ve doluluk kontrolü</span>
      </div>
      {hata && <div className="alert alert-danger" style={{ marginTop: 12 }}><LuTriangleAlert /><span>{hata} Değeri aşağıdan elle girip devam edebilirsiniz.</span></div>}

      {analiz && (
        <div className="stack fade-in" style={{ marginTop: 16, gap: 10 }}>
          <AiUyarilari analiz={analiz} kazan={kazan} yemek={yemek} />
          <div className="row small"><KaynakBadge kaynak={analiz.kaynak} /> <span className="muted">Tespit: <b style={{ color: 'var(--c-fg)' }}>{analiz.yemekTespiti || '—'}</b>{analiz.guven != null && ` · güven ${Math.round(analiz.guven * 100)}%`}</span></div>
          {analiz.gerekce && <p className="small muted">“{analiz.gerekce}”{analiz.onbellek && ' · (aynı fotoğraf daha önce analiz edildi, önbellekten)'}</p>}
        </div>
      )}

      <div className="row" style={{ marginTop: 18, alignItems: 'center', gap: 20 }}>
        <div style={{ width: 130 }}><Pot pct={doluluk} pay={payi} green label="Gidiş doluluğu" /></div>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>Gidiş doluluğu: %{doluluk}<Pay v={payi} /></span>
          <input className="slider" type="range" min="5" max="100" value={doluluk} onChange={(e) => { setDoluluk(Number(e.target.value)); setElle(true); }} />
          <small>{analiz ? 'AI değeri; gerekirse düzeltin.' : 'AI kullanmadan da tahmini değerle kaydedebilirsiniz.'}</small>
        </label>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <div className="spacer" />
        <button className="btn btn-primary btn-lg" onClick={kaydet} disabled={!foto}>
          <LuSave /> Gidişi kaydet
        </button>
      </div>
    </div>
  );
}

/* ---------------- 2. Dönüş ---------------- */
function DonusAdimi({ kayit, kazan, yemek }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [foto, setFoto] = useState(() => sessionStorage.getItem(`sifirtabak:onfoto:${kayit.id}`) || null);
  const [analiz, setAnaliz] = useState(null);
  const [gidisPct, setGidisPct] = useState(kayit.gidis?.dolulukPct ?? 90);
  const [gidisHata, setGidisHata] = useState(kayit.gidis?.hataPayi ?? 10);
  const [donusPct, setDonusPct] = useState(null);
  const [donusHata, setDonusHata] = useState(10);
  const menu = useMenu(kayit);
  const [qrKod, setQrKod] = useState(null);
  useEffect(() => { if (foto) qrOku(foto, setQrKod); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [elle, setElle] = useState(false);
  const { yukleniyor, hata, calistir, simulasyonAktif } = useAnaliz();

  useEffect(() => sessionStorage.removeItem(`sifirtabak:onfoto:${kayit.id}`), [kayit.id]);

  const fotoSec = async (file) => {
    try {
      const f = await compressImage(file);
      setFoto(f);
      setAnaliz(null);
      qrOku(f, setQrKod);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const analizEt = async () => {
    const r = await calistir(
      (a) => analyzeDonus(a, { kayit, yemek, menu, donusFoto: foto }),
      () => simulateDonus({ kayit, yemek }),
    );
    if (r) {
      setAnaliz(r);
      if (r.gidisPct != null) setGidisPct(r.gidisPct);
      if (r.donusPct != null) setDonusPct(r.donusPct);
      setGidisHata(r.gidisHata ?? 10);
      setDonusHata(r.donusHata ?? 10);
      setElle(false);
    }
  };

  const sonuc = donusPct == null ? null : computeRange({ baslangicGram: kayit.baslangicGram, gidisPct, gidisHata, donusPct, donusHata });
  const capraz = sonuc?.ok ? crossCheck({ hacimL: kazan.hacimL, yogunlukGL: yemek.yogunlukGL, gidisPct, donusPct, kalanGram: sonuc.kalanGram }) : null;

  const kaydet = () => {
    if (!sonuc?.ok) return;
    const kaynak = elle || !analiz ? 'elle' : analiz.kaynak;
    dispatch({
      type: 'donusKaydet',
      id: kayit.id,
      donus: { foto, saat: saat(), dolulukPct: donusPct, hataPayi: donusHata, analiz, kaynak },
      sonuc: {
        gidisPct, donusPct, gidisHata, donusHata,
        kalanGram: sonuc.kalanGram, tuketilenGram: sonuc.tuketilenGram, israfPct: sonuc.israfPct,
        minGram: sonuc.minGram, maxGram: sonuc.maxGram, artiEksiGram: sonuc.artiEksiGram, kaynak,
      },
    });
    toast(`Kaydedildi: ${yemek.ad} için ${fmtGram(sonuc.kalanGram)} kaldı.`);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>2 · Büfeden dönüş</h2>
          <p>Kazan döndüğünde aynı masada tekrar çekin. AI her iki fotoğrafı aynı ölçütle değerlendirir.</p>
        </div>
        {simulasyonAktif && <span className="badge badge-sim">Simülasyon</span>}
      </div>

      <div className="photo-pair">
        {kayit.gidis?.foto ? (
          <div className="drop" style={{ cursor: 'default' }}>
            <span className="tag badge badge-bufede">GİDİŞ · {kayit.gidis.saat}</span>
            <img src={kayit.gidis.foto} alt="Gidiş fotoğrafı" />
          </div>
        ) : (
          <div className="drop" style={{ cursor: 'default' }}>
            <div className="hint"><LuInfo /><span className="small">Gidiş fotoğrafı yok.<br />Kayıtlı gidiş doluluğu: %{kayit.gidis?.dolulukPct ?? '—'}</span></div>
          </div>
        )}
        <PhotoDrop value={foto} onFile={fotoSec} title="Dönüş fotoğrafı" tag={<span className="badge badge-dondu">DÖNÜŞ</span>} />
      </div>
      <QrDurum durum={qrKod} kazan={kazan} />

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-accent btn-lg" onClick={analizEt} disabled={!foto || yukleniyor}>
          {yukleniyor ? <Spinner /> : <LuSparkles />} {yukleniyor ? 'Fotoğraflar karşılaştırılıyor…' : 'AI ile analiz et'}
        </button>
        {donusPct == null && <button className="btn btn-ghost" onClick={() => { setDonusPct(30); setElle(true); }}>Elle gir</button>}
      </div>
      {hata && <div className="alert alert-danger" style={{ marginTop: 12 }}><LuTriangleAlert /><span>{hata} İsterseniz “Elle gir” ile devam edebilirsiniz.</span></div>}

      {donusPct != null && (
        <div className="stack fade-in" style={{ marginTop: 20 }}>
          <AiUyarilari analiz={analiz} kazan={kazan} yemek={yemek} />
          {analiz && (
            <div className="row small"><KaynakBadge kaynak={analiz.kaynak} /><span className="muted">Tespit: <b style={{ color: 'var(--c-fg)' }}>{analiz.yemekTespiti || '—'}</b>{analiz.guven != null && ` · güven ${Math.round(analiz.guven * 100)}%`}</span></div>
          )}
          {analiz?.gerekce && <p className="small muted">“{analiz.gerekce}”{analiz.onbellek && ' · (aynı fotoğraf daha önce analiz edildi, önbellekten)'}</p>}

          <div className="grid grid-2">
            <div>
              <Pot pct={gidisPct} pay={gidisHata} green label="Gidiş" />
              <label className="field" style={{ marginTop: 10 }}>
                <span>Gidiş: %{gidisPct}<Pay v={gidisHata} /></span>
                <input className="slider" type="range" min="1" max="100" value={gidisPct} onChange={(e) => { setGidisPct(Number(e.target.value)); setElle(true); }} />
              </label>
            </div>
            <div>
              <Pot pct={donusPct} pay={donusHata} label="Dönüş" />
              <label className="field" style={{ marginTop: 10 }}>
                <span>Dönüş: %{donusPct}<Pay v={donusHata} /></span>
                <input className="slider" type="range" min="0" max="100" value={donusPct} onChange={(e) => { setDonusPct(Number(e.target.value)); setElle(true); }} />
              </label>
            </div>
          </div>

          {sonuc?.ok ? (
            <div className="result-big">
              <div><small>Başlangıç</small><b>{fmtGram(kayit.baslangicGram)}</b></div>
              <div><small>Tüketilen</small><b>{fmtGram(sonuc.tuketilenGram)}</b></div>
              <div className="waste">
                <small>Kalan · israf {fmtPct(sonuc.israfPct)}</small>
                <b>{fmtGram(sonuc.kalanGram)}</b>
                <small>Hata payıyla aralık: {fmtGram(sonuc.minGram)} – {fmtGram(sonuc.maxGram)}</small>
              </div>
            </div>
          ) : (
            <div className="alert alert-danger"><LuTriangleAlert /><span>{sonuc?.error}</span></div>
          )}
          {donusPct > gidisPct && <div className="alert alert-warn"><LuTriangleAlert /><span>Dönüş doluluğu gidişten yüksek görünüyor; kalan miktar başlangıçla sınırlandı.</span></div>}
          {capraz?.uyumsuz && (
            <div className="alert alert-info">
              <LuInfo />
              <span>Kazan hacmi ve yemek yoğunluğuna göre kalan miktar ~{fmtGram(capraz.tahminiKalanGram)} olmalıydı. Fark büyük; fotoğrafı ya da ElektraWeb kaydını kontrol edin.</span>
            </div>
          )}

          <div className="row">
            {elle && <span className="badge badge-hazir">Elle düzeltildi</span>}
            <div className="spacer" />
            <button className="btn btn-primary btn-lg" onClick={kaydet} disabled={!sonuc?.ok}>
              <LuSave /> Kaydet ve veriyi güncelle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 3. Tamamlandı ---------------- */
function Tamamlandi({ kayit }) {
  const { dispatch } = useStore();
  const s = kayit.sonuc;
  const sonraki = useStore().kayitlar.find((r) => r.durum !== 'dondu');
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Kaydedildi</h2>
          <p>ElektraWeb verisi bu ölçümle güncellendi.</p>
        </div>
        <KaynakBadge kaynak={s.kaynak} />
      </div>
      <div className="photo-pair" style={{ marginBottom: 16 }}>
        {[['GİDİŞ', kayit.gidis, true], ['DÖNÜŞ', kayit.donus, false]].map(([t, x, g]) => (
          <div key={t} className="drop" style={{ cursor: 'default', minHeight: 200 }}>
            <span className={`tag badge ${g ? 'badge-bufede' : 'badge-dondu'}`}>{t} · {x?.saat}</span>
            {x?.foto ? <img src={x.foto} alt={`${t} fotoğrafı`} /> : <div style={{ width: 130 }}><Pot pct={x?.dolulukPct} green={g} /></div>}
          </div>
        ))}
      </div>
      <div className="result-big">
        <div><small>Gidiş → Dönüş</small><b>%{s.gidisPct} → %{s.donusPct}</b>{s.gidisHata != null && <small>±{s.gidisHata} / ±{s.donusHata} puan</small>}</div>
        <div><small>Tüketilen</small><b>{fmtGram(s.tuketilenGram)}</b></div>
        <div className="waste">
          <small>Kalan · israf {fmtPct(s.israfPct)}</small>
          <b>{fmtGram(s.kalanGram)}</b>
          {s.minGram != null && <small>Aralık: {fmtGram(s.minGram)} – {fmtGram(s.maxGram)}</small>}
        </div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'kayitSifirla', id: kayit.id })}><LuRotateCcw /> Yeniden ölç</button>
        <div className="spacer" />
        {sonraki ? (
          <a className="btn btn-primary" href={`#/analiz/${sonraki.id}`}>Sıradaki kazan: {sonraki.kazanId}</a>
        ) : (
          <a className="btn btn-primary" href="#/rapor">Gün sonu raporu</a>
        )}
      </div>
    </div>
  );
}
