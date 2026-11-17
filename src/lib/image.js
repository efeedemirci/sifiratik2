// Yüklenen fotoğrafı Groq limitleri ve localStorage için küçültür (en uzun kenar 1024 px, JPEG).
export function compressImage(file, maxSide = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Lütfen bir fotoğraf dosyası seçin.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, maxSide / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * s);
      c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Fotoğraf okunamadı.'));
    };
    im.src = url;
  });
}
