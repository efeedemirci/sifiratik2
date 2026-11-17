import { LuArrowRight, LuChefHat, LuLeaf, LuScanLine, LuSoup, LuTriangleAlert } from 'react-icons/lu';
import { useStore } from '../store/store.jsx';
import { DurumBadge, StatCard, WasteBars } from '../components/ui.jsx';
import { aggregateDay, fmtGram, fmtPct } from '../lib/calc.js';

export default function Dashboard() {
  const { kayitlar, veri, yemek } = useStore();
  const { yemekler, toplam } = aggregateDay(kayitlar, veri.yemekler);
  const sayi = (d) => kayitlar.filter((r) => r.durum === d).length;
  const bufede = kayitlar.filter((r) => r.durum === 'bufede');
  const otel = veri.snapshot.otel;
  const tarih = new Date(veri.snapshot.tarih).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Günaydın, mutfak ekibi</h1>
          <p>{tarih} · {otel.ad} · {otel.doluOda}/{otel.odaSayisi} oda dolu, {otel.misafir} misafir</p>
        </div>
        <a className="btn btn-primary btn-lg" href="#/analiz"><LuScanLine /> Kazan analizi başlat</a>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard icon={LuChefHat} tone="blue" value={fmtGram(toplam.uretilenGram)} label="Bugün üretilen" sub={`${kayitlar.length} kazan · ElektraWeb`} />
        <StatCard icon={LuSoup} tone="orange" value={fmtGram(toplam.kalanGram)} label="Büfeden dönen (israf)" sub={`${sayi('dondu')} kazan ölçüldü`} />
        <StatCard icon={LuTriangleAlert} tone="amber" value={fmtPct(toplam.israfPct)} label="Ölçülen israf oranı" sub="Ölçülen kazanlar üzerinden" />
        <StatCard icon={LuLeaf} tone="green" value={`${toplam.co2Kg.toLocaleString('tr-TR')} kg`} label="CO₂e karşılığı" sub="Yaklaşık emisyon faktörleriyle" />
      </div>

      <div className="grid grid-main">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Yemek bazında durum</h2>
              <p>En çok dönen yemekler üstte</p>
            </div>
            <a href="#/rapor" className="btn btn-ghost btn-sm">Tam rapor <LuArrowRight /></a>
          </div>
          <WasteBars yemekler={yemekler} limit={6} />
        </div>

        <div className="stack">
          <div className="card">
            <h2 style={{ marginBottom: 14 }}>Kazan durumu</h2>
            <div className="grid grid-2" style={{ gap: 10, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[['hazir', 'Hazır'], ['bufede', 'Büfede'], ['dondu', 'Döndü']].map(([d, t]) => (
                <div key={d} style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 16, background: '#fffdf8', border: '1px solid var(--c-border)' }}>
                  <div style={{ fontFamily: 'var(--f-head)', fontWeight: 900, fontSize: '1.7rem' }}>{sayi(d)}</div>
                  <div className="small muted" style={{ fontWeight: 700 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Dönüşü beklenenler</h2>
              <span className="badge badge-bufede">{bufede.length}</span>
            </div>
            {bufede.length === 0 ? (
              <p className="muted small">Büfede bekleyen kazan yok.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {bufede.map((r) => (
                  <a key={r.id} href={`#/analiz/${r.id}`} className="kazan-tile" style={{ textDecoration: 'none', color: 'inherit', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div className="kod">{r.kazanId} · <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{yemek(r.yemekId)?.ad}</span></div>
                      <div className="meta">Çıkış {r.gidis?.saat} · {fmtGram(r.baslangicGram)}</div>
                    </div>
                    <DurumBadge durum={r.durum} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
