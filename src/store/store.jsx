import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { getElektrawebSnapshot, KAZANLAR, YEMEKLER } from '../data/mockElektraweb.js';

const VERI_KEY = 'sifirtabak:veri:v1';
const AYAR_KEY = 'sifirtabak:ayarlar:v1';

const varsayilanAyarlar = { apiKey: '', visionModel: 'qwen/qwen3.8-27b', textModel: 'qwen/qwen3.8-27b', simulasyon: false, hizliMod: false };

function yukle() {
  try {
    const v = JSON.parse(localStorage.getItem(VERI_KEY));
    if (v && v.snapshot && v.snapshot.tarih) return v;
  } catch { /* yok say */ }
  return { snapshot: getElektrawebSnapshot(), kazanlar: KAZANLAR, yemekler: YEMEKLER };
}
function ayarYukle() {
  try {
    const a = { ...varsayilanAyarlar, ...JSON.parse(localStorage.getItem(AYAR_KEY)) };
    if (!a.visionModel) a.visionModel = varsayilanAyarlar.visionModel;
    return a;
  } catch {
    return varsayilanAyarlar;
  }
}

function kaydiGuncelle(state, id, fn) {
  return {
    ...state,
    veri: {
      ...state.veri,
      snapshot: {
        ...state.veri.snapshot,
        uretim: state.veri.snapshot.uretim.map((r) => (r.id === id ? fn(r) : r)),
      },
    },
  };
}

function reducer(state, a) {
  switch (a.type) {
    case 'gidisKaydet':
      return kaydiGuncelle(state, a.id, (r) => ({ ...r, durum: 'bufede', gidis: a.gidis, donus: null, sonuc: null }));
    case 'donusKaydet':
      return kaydiGuncelle(state, a.id, (r) => ({
        ...r,
        durum: 'dondu',
        ornek: false,
        gidis: { ...r.gidis, dolulukPct: a.sonuc.gidisPct },
        donus: a.donus,
        sonuc: a.sonuc,
      }));
    case 'kayitGuncelle':
      return kaydiGuncelle(state, a.id, (r) => ({ ...r, ...a.alanlar }));
    case 'kayitSifirla':
      return kaydiGuncelle(state, a.id, (r) => ({ ...r, durum: 'hazir', gidis: null, donus: null, sonuc: null, ornek: false }));
    case 'yemekGuncelle':
      return { ...state, veri: { ...state.veri, yemekler: state.veri.yemekler.map((y) => (y.id === a.id ? { ...y, ...a.alanlar } : y)) } };
    case 'gunuSifirla':
      return { ...state, veri: { snapshot: getElektrawebSnapshot(), kazanlar: KAZANLAR, yemekler: YEMEKLER } };
    case 'ayarKaydet':
      return { ...state, ayarlar: { ...state.ayarlar, ...a.ayarlar } };
    default:
      return state;
  }
}

/** localStorage'a yazar; kota dolarsa en eski fotoğrafları atıp tekrar dener. */
function guvenliYaz(veri) {
  let v = veri;
  for (let deneme = 0; deneme < 30; deneme++) {
    try {
      localStorage.setItem(VERI_KEY, JSON.stringify(v));
      return;
    } catch {
      const u = v.snapshot.uretim;
      const idx = u.findIndex((r) => r.gidis?.foto || r.donus?.foto);
      if (idx < 0) return;
      const r = u[idx];
      const temiz = {
        ...r,
        gidis: r.gidis ? { ...r.gidis, foto: undefined } : null,
        donus: r.donus ? { ...r.donus, foto: undefined } : null,
      };
      v = { ...v, snapshot: { ...v.snapshot, uretim: u.map((x, i) => (i === idx ? temiz : x)) } };
    }
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => ({ veri: yukle(), ayarlar: ayarYukle() }));

  useEffect(() => guvenliYaz(state.veri), [state.veri]);
  useEffect(() => {
    try {
      localStorage.setItem(AYAR_KEY, JSON.stringify(state.ayarlar));
    } catch { /* yok say */ }
  }, [state.ayarlar]);

  const value = useMemo(() => {
    const { kazanlar, yemekler, snapshot } = state.veri;
    const kazan = (id) => kazanlar.find((k) => k.id === id);
    const yemek = (id) => yemekler.find((y) => y.id === id);
    return {
      ...state,
      kazan,
      yemek,
      dispatch,
      simulasyonAktif: state.ayarlar.simulasyon || !state.ayarlar.apiKey,
      kayitlar: snapshot.uretim,
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
