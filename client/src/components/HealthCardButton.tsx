import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import './HealthCardButton.css';

interface HealthCardButtonProps { patient: any; language?: string; }

const token = () => { try { return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || ''; } catch { return localStorage.getItem('aarogya_token') || ''; } };
const patientCardId = (id?: string) => /^AD-\d{4}-\d{6}$/.test(String(id || '')) ? String(id) : String(id || 'AD-DEMO-000000');
const age = (patient: any) => patient.ageEstimated || patient.age || (patient.yearOfBirth ? new Date().getFullYear() - Number(patient.yearOfBirth) : '—');
const maskedPhone = (phone?: string) => phone ? `•••• ${String(phone).replace(/\D/g, '').slice(-4)}` : '—';

export const HealthCardButton: React.FC<HealthCardButtonProps> = ({ patient, language = 'en' }) => {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const id = patientCardId(patient?.patientId);
  const labels = language === 'te' ? { card: 'హెల్త్ కార్డ్', download: 'డౌన్‌లోడ్' } : language === 'hi' ? { card: 'स्वास्थ्य कार्ड', download: 'डाउनलोड' } : language === 'or' ? { card: 'ସ୍ୱାସ୍ଥ୍ୟ କାର୍ଡ', download: 'ଡାଉନଲୋଡ୍' } : { card: 'Health Card', download: 'Download' };

  useEffect(() => { void QRCode.toDataURL(id, { errorCorrectionLevel: 'M', margin: 1, width: 180 }).then(setQr); }, [id]);
  const audit = async (format: string) => {
    if (!patient?.patientId) return;
    await fetch(`/api/v1/patients/${encodeURIComponent(patient.patientId)}?healthCardDownload=${format}`, { headers: { Authorization: `Bearer ${token()}` } }).catch(() => undefined);
  };
  const save = (href: string, fileName: string) => { const link = document.createElement('a'); link.href = href; link.download = fileName; link.click(); };
  const downloadPng = async () => {
    if (!frontRef.current) return; setBusy('png');
    try { await audit('png'); save(await toPng(frontRef.current, { pixelRatio: 2, cacheBust: true }), `${id}-health-card.png`); } finally { setBusy(null); }
  };
  const downloadPdf = async () => {
    if (!frontRef.current || !backRef.current) return; setBusy('pdf');
    try {
      await audit('pdf');
      const [front, back] = await Promise.all([toPng(frontRef.current, { pixelRatio: 2 }), toPng(backRef.current, { pixelRatio: 2 })]);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] });
      pdf.addImage(front, 'PNG', 0, 0, 85.6, 53.98); pdf.addPage([85.6, 53.98], 'landscape'); pdf.addImage(back, 'PNG', 0, 0, 85.6, 53.98); pdf.save(`${id}-health-card.pdf`);
    } finally { setBusy(null); }
  };
  const common = <div className="health-card-brand"><img src="/brand/aarogya-mark.png" alt="Aarogya-Drishti emblem" /><span><strong>AAROGYA DRISHTI</strong><small>ITDA Paderu Tribal Health Initiative</small></span></div>;
  return <div className="health-card-control"><button type="button" className="dash-btn dash-btn-outline" onClick={() => setOpen(true)}>{labels.card}</button>{open && <div className="health-card-modal" role="dialog" aria-modal="true" aria-label={labels.card}><div className="health-card-dialog"><button type="button" className="health-card-close" aria-label="Close health card" onClick={() => setOpen(false)}>×</button><div className="health-card-print-area"><article className="health-card health-card-front" ref={frontRef}><header>{common}</header><div className="health-card-body"><div><span>Patient ID</span><b>{id}</b><h2>{patient?.fullName || patient?.name || 'Patient'}</h2><p>{age(patient)} years · {patient?.gender || '—'}</p><p>{patient?.villageName || patient?.village || '—'} · {patient?.mandal || '—'}</p></div>{qr && <img src={qr} alt={`QR code for patient ID ${id}`} />}</div><footer>Demo health card - not a medical record</footer></article><article className="health-card health-card-back" ref={backRef}><header>{common}</header><dl><div><dt>District</dt><dd>{patient?.district || 'Alluri Sitharama Raju'}</dd></div><div><dt>PHC</dt><dd>{patient?.phcName || patient?.hospitalName || 'Assigned health facility'}</dd></div><div><dt>Mobile</dt><dd>{maskedPhone(patient?.phone)}</dd></div><div><dt>Registered</dt><dd>{new Date(patient?.registeredAt || patient?.createdAt || Date.now()).toLocaleDateString()}</dd></div></dl><footer>Demo health card - not a medical record</footer></article></div><div className="health-card-actions"><button type="button" className="dash-btn dash-btn-outline" disabled={busy !== null} onClick={() => void downloadPng()}>{busy === 'png' ? 'Preparing…' : `${labels.download} PNG`}</button><button type="button" className="dash-btn dash-btn-primary" disabled={busy !== null} onClick={() => void downloadPdf()}>{busy === 'pdf' ? 'Preparing…' : `${labels.download} PDF`}</button></div></div></div>}</div>;
};
