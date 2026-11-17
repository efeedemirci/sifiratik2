import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { LuCircleCheck, LuImagePlus, LuLoaderCircle, LuTriangleAlert, LuCamera } from 'react-icons/lu';
import { fmtGram, fmtPct } from '../lib/calc.js';

export function StatCard({ icon: Icon, tone = 'green', value, label, sub }) {
  return (
    <div className={`card stat tone-${tone}`}>
      <div className="ico" aria-hidden="true"><Icon /></div>
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

const DURUM = {
  hazir: ['Hazır', 'badge-hazir'],
  bufede: ['Büfede', 'badge-bufede'],
  dondu: ['Döndü', 'badge-dondu'],
};
export function DurumBadge({ durum }) {
  const [t, c] = DURUM[durum] || DURUM.hazir;
  return <span className={`badge ${c}`}><span className="dot" />{t}</span>;
}

export function KaynakBadge({ kaynak }) {
  if (kaynak === 'simulasyon') return <span className="badge badge-sim">Simülasyon</span>;
  if (kaynak === 'ai') return <span className="badge badge-ai">Groq AI</span>;
  if (kaynak === 'elle') return <span className="badge badge-hazir">Elle düzeltildi</span>;
  if (kaynak === 'ornek') return <span className="badge badge-hazir">Örnek veri</span>;
  return null;
}

export const Spinner = () => <LuLoaderCircle className="spin" aria-hidden="true" />;

/** Kazan doluluk görseli */
export function Pot({ pct, green = false, label, pay }) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="pot" role="img" aria-label={`${label || 'Doluluk'}: ${pct == null ? 'bilinmiyor' : `%${p}${pay ? ` artı eksi ${pay}` : ''}`}`}>
      {pay ? <div className="band" style={{ bottom: `${Math.max(0, p - pay)}%`, height: `${Math.min(100, p + pay) - Math.max(0, p - pay)}%` }} /> : null}
      <div className={`fill ${green ? 'green' : ''}`} style={{ height: `${p}%` }} />
      <span>{pct == null ? '?' : `%${Math.round(p)}`}{pay ? <small style={{ fontSize: '0.75rem', fontWeight: 800, marginLeft: 2 }}>±{pay}</small> : null}</span>
    </div>
  );
}

/** Fotoğraf yükleme alanı (tıklama, sürükle-bırak, mobilde kamera) */
export function PhotoDrop({ value, onFile, title, tag, disabled }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const sec = (f) => f && onFile(f);
  return (
    <div
      className={`drop ${drag ? 'drag' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${title} yükle`}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) sec(e.dataTransfer.files?.[0]); }}
    >
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { sec(e.target.files?.[0]); e.target.value = ''; }} />
      {tag && <span className="tag">{tag}</span>}
      {value ? (
        <>
          <img src={value} alt={title} />
          {!disabled && <span className="change btn btn-ghost btn-sm"><LuCamera /> Değiştir</span>}
        </>
      ) : (
        <div className="hint">
          <LuImagePlus aria-hidden="true" />
          <b style={{ color: 'var(--c-fg)' }}>{title}</b>
          <span className="small">Tıkla, sürükle-bırak ya da kamerayla çek</span>
        </div>
      )}
    </div>
  );
}

/** Yemek bazında tüketilen / kalan / ölçülmemiş çubukları */
export function WasteBars({ yemekler, limit }) {
  const liste = limit ? yemekler.slice(0, limit) : yemekler;
  if (!liste.length) return <div className="empty">Henüz veri yok.</div>;
  return (
    <>
      <div className="bars">
        {liste.map((y) => {
          const t = y.uretilenGram || 1;
          const bekleyen = y.uretilenGram - y.olculenUretimGram;
          return (
            <div className="bar-row" key={y.id}>
              <div className="bar-top">
                <b>{y.ad}</b>
                <span>
                  {fmtGram(y.kalanGram)} kaldı · {fmtPct(y.israfPct)} israf · {y.olculenKazan}/{y.kazanSayisi} kazan
                </span>
              </div>
              <div className="bar-track" aria-label={`${y.ad}: ${fmtGram(y.tuketilenGram)} tüketildi, ${fmtGram(y.kalanGram)} kaldı, ${fmtGram(bekleyen)} ölçülmedi`}>
                <div className="eaten" style={{ width: `${(y.tuketilenGram / t) * 100}%` }} />
                <div className="left" style={{ width: `${(y.kalanGram / t) * 100}%` }} />
                <div className="pending" style={{ width: `${(bekleyen / t) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 16 }}>
        <span><i style={{ background: '#16a34a' }} />Tüketilen</span>
        <span><i style={{ background: '#ea580c' }} />Kalan (israf)</span>
        <span><i style={{ background: '#e7e5e4' }} />Henüz ölçülmedi</span>
      </div>
    </>
  );
}

// ---- Toast ----
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const show = useCallback((text, type = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, text, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'err' ? <LuTriangleAlert /> : <LuCircleCheck />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
