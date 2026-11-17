import { useState } from 'react';
import { LuRefreshCw, LuRotateCcw } from 'react-icons/lu';
import { useStore } from '../store/store.jsx';
import { DurumBadge, useToast } from '../components/ui.jsx';
import { fmtGram } from '../lib/calc.js';

export default function Data() {
  const { veri, kayitlar, kazan, yemek, dispatch } = useStore();
  const toast = useToast();
  const [sekme, setSekme] = useState('uretim');

  const sifirla = () => {
    if (window.confirm('Bugünün tüm ölçümleri silinip ElektraWeb verisi yeniden çekilecek. Emin misiniz?')) {
      dispatch({ type: 'gunuSifirla' });
      toast('ElektraWeb verisi yeniden çekildi.');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ElektraWeb Verisi</h1>
          <p>{veri.snapshot.kaynak} · son çekim {new Date(veri.snapshot.cekilmeZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button className="btn btn-ghost" onClick={sifirla}><LuRefreshCw /> Veriyi yeniden çek (günü sıfırla)</button>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
        {[['uretim', 'Günlük üretim'], ['yemek', 'Menü / yemekler'], ['kazan', 'Kazanlar']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={sekme === k} className={sekme === k ? 'on' : ''} onClick={() => setSekme(k)}>{t}</button>
        ))}
      </div>

      <div className="card">
        {sekme === 'uretim' && (
          <>
            <p className="small muted" style={{ marginBottom: 12 }}>Başlangıç miktarları ElektraWeb'den gelir. Demo için düzenleyebilirsiniz; kalan miktarlar yalnızca analiz ekranındaki <b>Kaydet</b> ile güncellenir.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Kayıt</th><th>Öğün</th><th>Kazan</th><th>Yemek</th><th className="num">Başlangıç (g)</th><th className="num">Kalan</th><th>Durum</th><th /></tr></thead>
                <tbody>
                  {kayitlar.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.id}</td>
                      <td>{r.ogun}</td>
                      <td>{r.kazanId} <span className="muted small">({kazan(r.kazanId)?.hacimL} L)</span></td>
                      <td>
                        <select className="input input-sm" value={r.yemekId} disabled={r.durum !== 'hazir'} onChange={(e) => dispatch({ type: 'kayitGuncelle', id: r.id, alanlar: { yemekId: e.target.value } })} aria-label="Yemek">
                          {veri.yemekler.map((y) => <option key={y.id} value={y.id}>{y.ad}</option>)}
                        </select>
                      </td>
                      <td className="num">
                        <input className="input input-sm" style={{ width: 110, textAlign: 'right' }} type="number" min="100" step="100" value={r.baslangicGram} disabled={r.durum === 'dondu'}
                          onChange={(e) => dispatch({ type: 'kayitGuncelle', id: r.id, alanlar: { baslangicGram: Math.max(1, Number(e.target.value) || 0) } })} aria-label="Başlangıç gram" />
                      </td>
                      <td className="num" style={{ fontWeight: 800 }}>{r.sonuc ? fmtGram(r.sonuc.kalanGram) : '—'}</td>
                      <td><DurumBadge durum={r.durum} /></td>
                      <td>{r.durum !== 'hazir' && <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'kayitSifirla', id: r.id })} aria-label={`${r.kazanId} ölçümünü sıfırla`}><LuRotateCcw /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {sekme === 'yemek' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Yemek</th><th>Kategori</th><th className="num">Yoğunluk (g/L)</th><th className="num">CO₂e (kg/kg)</th></tr></thead>
              <tbody>
                {veri.yemekler.map((y) => (
                  <tr key={y.id}>
                    <td style={{ fontWeight: 700 }}>{y.ad}</td>
                    <td>{y.kategori}</td>
                    <td className="num"><input className="input input-sm" style={{ width: 100, textAlign: 'right' }} type="number" value={y.yogunlukGL} onChange={(e) => dispatch({ type: 'yemekGuncelle', id: y.id, alanlar: { yogunlukGL: Number(e.target.value) || 0 } })} aria-label={`${y.ad} yoğunluk`} /></td>
                    <td className="num"><input className="input input-sm" style={{ width: 90, textAlign: 'right' }} type="number" step="0.1" value={y.co2Faktor} onChange={(e) => dispatch({ type: 'yemekGuncelle', id: y.id, alanlar: { co2Faktor: Number(e.target.value) || 0 } })} aria-label={`${y.ad} CO2 faktörü`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sekme === 'kazan' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Kod</th><th>Tip</th><th className="num">Hacim</th><th>Bugünkü yemek</th></tr></thead>
              <tbody>
                {veri.kazanlar.map((k) => {
                  const r = kayitlar.find((x) => x.kazanId === k.id);
                  return (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 800 }}>{k.id}</td>
                      <td>{k.ad}</td>
                      <td className="num">{k.hacimL} L</td>
                      <td>{r ? `${yemek(r.yemekId)?.ad} · ${r.ogun}` : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
