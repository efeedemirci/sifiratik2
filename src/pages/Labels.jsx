import { LuPrinter } from 'react-icons/lu';
import { useStore } from '../store/store.jsx';
import { qrMetni, qrSvg } from '../lib/qr.js';

export default function Labels() {
  const { veri } = useStore();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>QR Etiketleri</h1>
          <p>Yazdırıp kazanların yan yüzüne yapıştırın. Kamera kazanı masada çektiğinde QR otomatik okunur ve seçilen kazanla karşılaştırılır.</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}><LuPrinter /> Yazdır</button>
      </div>
      <div className="labels">
        {veri.kazanlar.map((k) => (
          <div className="label-card" key={k.id}>
            <div className="qr" role="img" aria-label={`${k.id} QR kodu`} dangerouslySetInnerHTML={{ __html: qrSvg(qrMetni(k.id)) }} />
            <div className="kod">{k.id}</div>
            <small>{k.ad} · {k.hacimL} L</small>
            <div className="mono small muted" style={{ marginTop: 4 }}>{qrMetni(k.id)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
