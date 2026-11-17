import { useEffect, useState } from 'react';
import { LuChartColumn, LuDatabase, LuLayoutDashboard, LuLeaf, LuQrCode, LuScanLine, LuSettings } from 'react-icons/lu';
import { useStore } from './store/store.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Analysis from './pages/Analysis.jsx';
import Report from './pages/Report.jsx';
import Data from './pages/Data.jsx';
import Labels from './pages/Labels.jsx';
import Settings from './pages/Settings.jsx';

const SAYFALAR = [
  { yol: 'genel', ad: 'Genel Bakış', kisa: 'Özet', ikon: LuLayoutDashboard, C: Dashboard },
  { yol: 'analiz', ad: 'Kazan Analizi', kisa: 'Analiz', ikon: LuScanLine, C: Analysis },
  { yol: 'rapor', ad: 'Gün Sonu Raporu', kisa: 'Rapor', ikon: LuChartColumn, C: Report },
  { yol: 'veri', ad: 'ElektraWeb Verisi', kisa: 'Veri', ikon: LuDatabase, C: Data },
  { yol: 'etiket', ad: 'QR Etiketleri', kisa: 'QR', ikon: LuQrCode, C: Labels },
  { yol: 'ayarlar', ad: 'Ayarlar', kisa: 'Ayarlar', ikon: LuSettings, C: Settings },
];

function useHash() {
  const oku = () => window.location.hash.replace(/^#\/?/, '');
  const [h, setH] = useState(oku);
  useEffect(() => {
    const f = () => { setH(oku()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

export default function App() {
  const hash = useHash();
  const [yol, param] = hash.split('/');
  const aktif = SAYFALAR.find((s) => s.yol === yol) || SAYFALAR[0];
  const { simulasyonAktif, veri } = useStore();
  const Sayfa = aktif.C;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Ana menü">
        <div className="brand">
          <div className="brand-logo"><LuLeaf size={22} /></div>
          <div>
            <b>SıfırTabak</b>
            <small>Akıllı israf takibi</small>
          </div>
        </div>
        {SAYFALAR.map((s) => (
          <a key={s.yol} href={`#/${s.yol}`} className={`nav-link ${aktif.yol === s.yol ? 'active' : ''}`} aria-current={aktif.yol === s.yol ? 'page' : undefined}>
            <s.ikon aria-hidden="true" /> {s.ad}
          </a>
        ))}
        <div className="sidebar-foot">
          <b style={{ color: 'var(--c-fg)' }}>{veri.snapshot.otel.ad}</b>
          <div>{veri.snapshot.kaynak}</div>
          <div style={{ marginTop: 8 }}>
            {simulasyonAktif ? <span className="badge badge-sim">Simülasyon modu</span> : <span className="badge badge-ai">Groq bağlı</span>}
          </div>
        </div>
      </aside>

      <main className="main" key={aktif.yol}>
        <div className="fade-in">
          <Sayfa param={param} />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Alt menü">
        {SAYFALAR.filter((s) => s.yol !== 'etiket').map((s) => (
          <a key={s.yol} href={`#/${s.yol}`} className={aktif.yol === s.yol ? 'active' : ''} aria-current={aktif.yol === s.yol ? 'page' : undefined}>
            <s.ikon aria-hidden="true" />
            {s.kisa}
          </a>
        ))}
      </nav>
    </div>
  );
}
