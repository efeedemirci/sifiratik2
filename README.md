# SıfırTabak · Akıllı israf takibi (COP31 prototipi)

Otel büfe kazanlarının **gidiş** ve **dönüş** fotoğraflarını Groq vision modeliyle karşılaştırıp kalan yemeği hesaplayan web uygulaması. Üretim miktarları ElektraWeb PMS'ten gelir (şimdilik mock). Çalışan AI sonucunu onaylayıp **Kaydet**'e bastığında veri güncellenir.

## Hızlı başlat (kurulum gerektirmez)
`hazir/index.html` dosyasına çift tıklayın. Chrome ya da Edge'de açılır.

1. **Ayarlar** → Groq API anahtarını girin → **Bağlan ve modelleri getir** → görsel (vision) model seçin
2. **Kazan Analizi** → kazanı seçin (ya da QR fotoğrafıyla bulun) → gidiş fotoğrafı → **Gidişi kaydet**
3. Kazan dönünce → dönüş fotoğrafı → **AI ile analiz et** → gerekirse kaydırıcıyla düzeltin → **Kaydet**
4. **Gün Sonu Raporu** → **AI ile özetle**

API anahtarı girilmezse uygulama **simülasyon modunda** çalışır: AI yanıtları örnek değerlerle taklit edilir ve sonuçlar "Simülasyon" olarak işaretlenir.

## Geliştirme
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # hesap mantığı testleri
npm run build    # dist/
```

## QR etiketleri
Etiket içeriği `SA:K05` biçimindedir. Okuma tarayıcının yerleşik okuyucusuna bağlı değildir (Windows'ta da çalışır). Küçük ve eğik etiketler için QR önce bulunur, ardından her modülün ortalaması alınarak örneklenir ve ZXing hata düzeltmesiyle çözülür. `tests/fixtures/` içindeki gerçek kazan fotoğraflarıyla test edilir.

## Hesap mantığı
LLM gram tahmin etmez, sadece doluluk yüzdesi verir:

```
kalan_gram = başlangıç_gram (ElektraWeb) × (dönüş_% ÷ gidiş_%)
```

Çapraz kontrol: `kazan_hacmi × yemek_yoğunluğu × doluluk_%`. İki sonuç çok farklıysa kullanıcı uyarılır.

## Klasör yapısı
| Yol | Görev |
|---|---|
| `src/lib/calc.js` | Saf hesaplar (kalan, israf, CO₂, günlük toplam); `tests/` ile test edilir |
| `src/lib/groq.js` | Groq API: model listesi, gidiş/dönüş analizi, gün özeti, simülasyon |
| `src/lib/qrDecode.js` | Fotoğraftan QR okuma hattı (ZXing dedektörü + ortalamalı örnekleyici + jsQR); tarayıcıdan bağımsız |
| `src/lib/qr.js` | Kazan kodu ayıklama (`SA:K05` → `K-05`), fotoğraftan okuma, etiket SVG üretimi |
| `src/vendor/` | jsQR 1.4.0 ve zxing-js 0.23.0 QR alt kümesi (Apache-2.0) |
| `src/data/mockElektraweb.js` | **ElektraWeb mock'u.** Gerçek entegrasyonda yalnızca bu dosya değişir |
| `src/store/store.jsx` | Uygulama durumu, localStorage'a kayıt |
| `src/pages/*` | Ekranlar: Genel Bakış, Kazan Analizi, Rapor, Veri, QR Etiketleri, Ayarlar |

## Bilinen sınırlar
- API anahtarı tarayıcıda saklanıyor (prototip için). Üretimde küçük bir backend gerekli.
- Fontlar internetten yüklenir (internet yoksa sistem fontu kullanılır).
- CO₂ faktörleri demo amaçlı yaklaşık değerlerdir.
