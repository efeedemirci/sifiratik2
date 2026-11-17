import { useState } from 'react';
import { LuCircleCheck, LuEye, LuEyeOff, LuInfo, LuKeyRound, LuRefreshCw, LuSave, LuTriangleAlert } from 'react-icons/lu';
import { useStore } from '../store/store.jsx';
import { Spinner, useToast } from '../components/ui.jsx';
import { dusunebilir, listModels } from '../lib/groq.js';

export default function Settings() {
  const { ayarlar, dispatch, simulasyonAktif } = useStore();
  const toast = useToast();
  const [key, setKey] = useState(ayarlar.apiKey);
  const [goster, setGoster] = useState(false);
  const [modeller, setModeller] = useState([]);
  const [yuk, setYuk] = useState(false);
  const [durum, setDurum] = useState(null);

  const kaydetAnahtar = () => {
    dispatch({ type: 'ayarKaydet', ayarlar: { apiKey: key.trim() } });
    toast(key.trim() ? 'API anahtarı kaydedildi.' : 'API anahtarı silindi.');
  };

  const baglan = async () => {
    setYuk(true);
    setDurum(null);
    try {
      const m = await listModels(key.trim());
      setModeller(m);
      dispatch({ type: 'ayarKaydet', ayarlar: { apiKey: key.trim() } });
      const ilkVision = m.find((x) => x.vision);
      const yeni = {};
      if (!m.some((x) => x.id === ayarlar.visionModel) && ilkVision) yeni.visionModel = ilkVision.id;
      if (!m.some((x) => x.id === ayarlar.textModel)) yeni.textModel = (m.find((x) => /llama-3\.3-70b|gpt-oss-120b|qwen/i.test(x.id)) || m[0])?.id || '';
      if (Object.keys(yeni).length) dispatch({ type: 'ayarKaydet', ayarlar: yeni });
      const secili = yeni.visionModel || ayarlar.visionModel;
      setDurum({ ok: true, text: `Bağlantı başarılı · ${m.length} model bulundu · görsel model: ${secili}` });
    } catch (e) {
      setDurum({ ok: false, text: e.message === 'Failed to fetch' ? 'Groq\'a ulaşılamadı (internet bağlantısı veya tarayıcı engeli).' : e.message });
    } finally {
      setYuk(false);
    }
  };

  const secenekler = (sadeceVision) => {
    const liste = modeller.length ? modeller : [];
    const mevcut = sadeceVision ? ayarlar.visionModel : ayarlar.textModel;
    const ids = new Set(liste.map((m) => m.id));
    return (
      <>
        <option value="">— Model seçin —</option>
        {mevcut && !ids.has(mevcut) && <option value={mevcut}>{mevcut} (kayıtlı)</option>}
        {sadeceVision && liste.some((m) => m.vision) && (
          <optgroup label="Görsel destekli (muhtemel)">
            {liste.filter((m) => m.vision).map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
          </optgroup>
        )}
        <optgroup label={sadeceVision ? 'Diğer modeller' : 'Tüm modeller'}>
          {liste.filter((m) => !sadeceVision || !m.vision).map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
        </optgroup>
      </>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ayarlar</h1>
          <p>Groq bağlantısı ve model seçimi</p>
        </div>
      </div>

      <div className="grid grid-main">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Groq API anahtarı</h2>
                <p>console.groq.com → API Keys bölümünden alınır.</p>
              </div>
              <LuKeyRound size={26} color="var(--c-primary)" aria-hidden="true" />
            </div>
            <label className="field">
              API Key
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input mono" type={goster ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_..." autoComplete="off" spellCheck="false" />
                <button className="btn btn-ghost" style={{ minWidth: 46, padding: 0 }} onClick={() => setGoster(!goster)} aria-label={goster ? 'Anahtarı gizle' : 'Anahtarı göster'}>
                  {goster ? <LuEyeOff /> : <LuEye />}
                </button>
              </div>
              <small>Anahtar yalnızca bu tarayıcıda (localStorage) saklanır.</small>
            </label>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={baglan} disabled={!key.trim() || yuk}>
                {yuk ? <Spinner /> : <LuRefreshCw />} Bağlan ve modelleri getir
              </button>
              <button className="btn btn-ghost" onClick={kaydetAnahtar}><LuSave /> Sadece kaydet</button>
            </div>
            {durum && (
              <div className={`alert ${durum.ok ? 'alert-ok' : 'alert-danger'}`} style={{ marginTop: 14 }}>
                {durum.ok ? <LuCircleCheck /> : <LuTriangleAlert />}<span>{durum.text}</span>
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 14 }}>Modeller</h2>
            {!modeller.length && <p className="small muted" style={{ marginBottom: 12 }}>Listeyi doldurmak için önce “Bağlan ve modelleri getir”e basın.</p>}
            <div className="stack" style={{ gap: 14 }}>
              <label className="field">
                Görsel analiz modeli (vision)
                <select className="input" value={ayarlar.visionModel} onChange={(e) => dispatch({ type: 'ayarKaydet', ayarlar: { visionModel: e.target.value } })}>
                  {secenekler(true)}
                </select>
                <small>Kazan fotoğraflarını analiz eder. Fotoğraf desteklemeyen bir model seçilirse analiz hata verir.</small>
              </label>
              <label className="field">
                …veya model adını elle yazın
                <input className="input mono" value={ayarlar.visionModel} onChange={(e) => dispatch({ type: 'ayarKaydet', ayarlar: { visionModel: e.target.value.trim(), textModel: ayarlar.textModel === ayarlar.visionModel ? e.target.value.trim() : ayarlar.textModel } })} placeholder="qwen/qwen3.8-27b" spellCheck="false" />
                <small>Groq'taki model kimliği birebir yazılmalı (büyük/küçük harf dahil).</small>
              </label>
              {dusunebilir(ayarlar.visionModel) && (
                <label className="switch">
                  <input type="checkbox" checked={!!ayarlar.hizliMod} onChange={(e) => dispatch({ type: 'ayarKaydet', ayarlar: { hizliMod: e.target.checked } })} />
                  <span>
                    Hızlı mod <small className="muted" style={{ fontWeight: 500 }}>(modelin düşünmesini kapatır; daha hızlı ama doluluk tahmini daha az isabetli olabilir. Önerilen: kapalı)</small>
                  </span>
                </label>
              )}
              <label className="field">
                Metin modeli (gün sonu özeti)
                <select className="input" value={ayarlar.textModel} onChange={(e) => dispatch({ type: 'ayarKaydet', ayarlar: { textModel: e.target.value } })}>
                  {secenekler(false)}
                </select>
                <small>Boş bırakılırsa görsel model kullanılır.</small>
              </label>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>Simülasyon modu</h2>
            <p className="small muted" style={{ marginBottom: 12 }}>
              API anahtarı yokken ya da internet kesildiğinde demo durmasın diye AI yanıtları örnek değerlerle taklit edilir. Simülasyon sonuçları raporda ayrıca işaretlenir.
            </p>
            <label className="switch">
              <input type="checkbox" checked={ayarlar.simulasyon} onChange={(e) => dispatch({ type: 'ayarKaydet', ayarlar: { simulasyon: e.target.checked } })} />
              Simülasyonu zorla
            </label>
            <div style={{ marginTop: 10 }}>
              {simulasyonAktif ? <span className="badge badge-sim">Şu an: Simülasyon</span> : <span className="badge badge-ai">Şu an: Groq AI</span>}
            </div>
          </div>
          <div className="card small">
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <LuInfo size={20} color="var(--c-info)" style={{ flex: 'none', marginTop: 2 }} aria-hidden="true" />
              <p className="muted">
                Prototip, Groq'a doğrudan tarayıcıdan bağlanır. Gerçek otel kurulumunda anahtar küçük bir sunucu katmanında tutulacak.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
