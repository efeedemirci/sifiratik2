# SıfırTabak Prototip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kazan gidiş/dönüş fotoğraflarından Groq vision ile israf ölçen, ElektraWeb (mock) verisini onaylı kayıtla güncelleyen web uygulaması.

**Architecture:** Backend'siz React SPA. Saf hesap mantığı `src/lib/calc.js`'te (node testli), veri katmanı `src/data` + `src/store` (localStorage), Groq erişimi `src/lib/groq.js`. Hash tabanlı yönlendirme.

**Tech Stack:** React 18/19, Vite (geliştirme), esbuild (hazır derleme), el yazımı CSS (tasarım tokenları), react-icons (Lucide seti).

**Spec:** Proje dokümanı `SifirTabak-tasarim.md`

## Global Constraints
- LLM gram tahmin etmez; doluluk % verir. `kalan_gram = baslangic_gram × (donus_% / gidis_%)`
- LLM sonucu çalışan **Kaydet**'e basmadan veriyi değiştirmez
- API key ve model adı uygulama içinden (Ayarlar) girilir; model adı koda gömülmez
- Groq yanıtı yoksa/bozuksa akış tıkanmaz: elle düzeltme + simülasyon modu
- Arayüz dili Türkçe; dokunma hedefleri ≥ 44px

## Review Focus
- Dönüş doluluğu gidişten büyük gelirse → kalan = başlangıç ile sınırlanır (test: calc)
- Gidiş doluluğu 0 / eksik → hesap hata döner, Kaydet pasif (test: calc)
- Groq JSON dışı metin döndürürse → metinden JSON ayıklanır, olmazsa anlaşılır hata (test: parseModelJson)
- Büyük fotoğraf (10 MB+) → 1024px JPEG'e sıkıştırılır
- localStorage dolarsa → fotoğraflar kayıttan atılır, sonuçlar korunur

### Task 1: Hesap mantığı + mock veri
**Files:** `src/lib/calc.js`, `src/data/mockElektraweb.js`, `tests/calc.test.mjs`
**Produces:** `computeResult({baslangicGram,gidisPct,donusPct}) -> {ok,kalanGram,tuketilenGram,israfPct,error?}`, `crossCheck({hacimL,yogunlukGL,gidisPct,donusPct,kalanGram}) -> {tahminiKalanGram,uyumsuz}`, `co2Kg(gram,faktor)`, `aggregateDay(kayitlar,yemekler)`, `parseModelJson(text)`
- [ ] Testleri yaz (2000 g, %90→%27 ⇒ 600 g kalan, %30 israf; clamp; sıfır gidiş hatası; JSON ayıklama) → çalıştır, FAIL
- [ ] Uygula → `node --test tests/` PASS

### Task 2: Store
**Files:** `src/store/store.jsx` — `useStore()` → `{state, actions:{gidisKaydet, donusKaydet, kayitGuncelle, gunuSifirla, ayarKaydet}}`

### Task 3: Groq
**Files:** `src/lib/groq.js` (`listModels`, `analyzeGidis`, `analyzeDonus`, `summarizeDay`, `simulate*`), `src/lib/image.js` (`compressImage(file)->dataURL`), `src/lib/qr.js` (`detectQr(dataURL)`, `qrImageUrl(text)`)

### Task 4: Ekranlar
**Files:** `src/pages/{Dashboard,Analysis,Report,Data,Labels,Settings}.jsx`, `src/components/*`, `src/styles.css`

### Task 5: Derleme ve doğrulama
- [ ] `node build.mjs` → `hazir/` klasörü; playwright ile Groq mock'lanarak uçtan uca akış + ekran görüntüleri
