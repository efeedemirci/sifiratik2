import { useState } from 'react';
import { LuPrinter, LuSparkles, LuTriangleAlert } from 'react-icons/lu';
import { useStore } from '../store/store.jsx';
import { DurumBadge, KaynakBadge, Spinner, WasteBars } from '../components/ui.jsx';
import { aggregateDay, fmtGram, fmtPct } from '../lib/calc.js';
import { simulateSummary, summarizeDay } from '../lib/groq.js';

export default function Report() {
  const { kayitlar, veri, yemek, ayarlar, simulasyonAktif } = useStore();
  const agg = aggregateDay(kayitlar, veri.yemekler);
  const [ai, setAi] = useState(null);
  const [yuk, setYuk] = useState(false);
  const [hata, setHata] = useState('');

  const ozetle = async () => {
    setYuk(true);
    setHata('');
    const veriOzet = {
      tarih: veri.snapshot.tarih,
      otel: veri.snapshot.otel,
      toplam: agg.toplam,
      yemekler: agg.yemekler.map(({ ad, uretilenGram, kalanGram, israfPct, olculenKazan, kazanSayisi }) => ({ ad, uretilenGram, kalanGram, israfPct, olculenKazan, kazanSayisi })),
    };
    try {
      setAi(simulasyonAktif ? await simulateSummary(veriOzet) : await summarizeDay(ayarlar, veriOzet));
    } catch (e) {
      setHata(e.message);
    } finally {
      setYuk(false);
    }
  };

  const olculen = kayitlar.filter((r) => r.durum === 'dondu').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Gün Sonu Raporu</h1>
          <p>{new Date(veri.snapshot.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · {olculen}/{kayitlar.length} kazan ölçüldü</p>
        </div>
        <button className="btn btn-ghost" onClick={() => window.print()}><LuPrinter /> Yazdır / PDF</button>
      </div>

      <div className="card hero-ai" style={{ marginBottom: 18 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2>AI gün özeti</h2>
            {!ai && !yuk && <p style={{ marginTop: 6 }}>Günün ölçümlerini Groq ile yorumlatın; yarın için somut öneriler alın.</p>}
            {yuk && <p style={{ marginTop: 6 }}>Veri yorumlanıyor…</p>}
            {ai && (
              <div className="fade-in" style={{ marginTop: 8 }}>
                <p style={{ color: '#fff', fontWeight: 600 }}>{ai.ozet}</p>
                {ai.oneriler.length > 0 && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
                    {ai.oneriler.map((o) => <li key={o} style={{ color: '#d1fae5' }}>{o}</li>)}
                  </ul>
                )}
              </div>
            )}
            {hata && <div className="alert alert-danger" style={{ marginTop: 10 }}><LuTriangleAlert /><span>{hata}</span></div>}
          </div>
          <button className="btn btn-ghost no-print" onClick={ozetle} disabled={yuk || olculen === 0}>
            {yuk ? <Spinner /> : <LuSparkles />} {ai ? 'Yeniden özetle' : 'AI ile özetle'}
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        {[
          ['Üretilen', fmtGram(agg.toplam.uretilenGram)],
          ['Tüketilen', fmtGram(agg.toplam.tuketilenGram)],
          ['Kalan (israf)', fmtGram(agg.toplam.kalanGram)],
          ['İsraf oranı', fmtPct(agg.toplam.israfPct)],
        ].map(([k, v]) => (
          <div className="card" key={k}>
            <div className="small muted" style={{ fontWeight: 700 }}>{k}</div>
            <div style={{ fontFamily: 'var(--f-head)', fontWeight: 900, fontSize: '1.6rem' }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h2>Yemek bazında</h2></div>
        <WasteBars yemekler={agg.yemekler} />
      </div>

      <div className="card">
        <div className="card-head"><h2>Kazan bazında</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kazan</th><th>Yemek</th><th>Öğün</th><th>Durum</th>
                <th className="num">Başlangıç</th><th className="num">Gidiş → Dönüş</th><th className="num">Kalan</th><th className="num">İsraf</th><th>Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((r) => (
                <tr key={r.id}>
                  <td><a href={`#/analiz/${r.id}`} style={{ fontWeight: 800, color: 'var(--c-primary-600)' }}>{r.kazanId}</a></td>
                  <td>{yemek(r.yemekId)?.ad}</td>
                  <td>{r.ogun}</td>
                  <td><DurumBadge durum={r.durum} /></td>
                  <td className="num">{fmtGram(r.baslangicGram)}</td>
                  <td className="num">{r.sonuc ? `%${r.sonuc.gidisPct} → %${r.sonuc.donusPct}` : '—'}</td>
                  <td className="num" style={{ fontWeight: 800, color: r.sonuc ? 'var(--c-accent)' : undefined }}>{r.sonuc ? fmtGram(r.sonuc.kalanGram) : '—'}{r.sonuc?.minGram != null && <div className="muted small" style={{ fontWeight: 600 }}>{fmtGram(r.sonuc.minGram)} – {fmtGram(r.sonuc.maxGram)}</div>}</td>
                  <td className="num">{r.sonuc ? fmtPct(r.sonuc.israfPct) : '—'}</td>
                  <td>{r.sonuc && <KaynakBadge kaynak={r.sonuc.kaynak} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
