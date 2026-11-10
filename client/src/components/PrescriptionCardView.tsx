import React from 'react';
import { LanguageCode } from '../i18n';

export interface PrescriptionCardViewProps {
  prescription: any;
  currentLang?: LanguageCode;
  onClose: () => void;
}

export const PrescriptionCardView: React.FC<PrescriptionCardViewProps> = ({
  prescription,
  currentLang: _currentLang = 'te',
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  if (!prescription) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(5, 10, 20, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '14px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* NON-PRINT TOP ACTIONS */}
        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            background: '#0f172a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 700 }}>
            📄 ప్రిస్క్రిప్షన్ ప్రింట్ & కాపీ (Official Medical Prescription)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#10b981',
                border: 'none',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🖨️ ముద్రించండి (Print)
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              ✕ మూసివేయి (Close)
            </button>
          </div>
        </div>

        {/* PRINTABLE RX SHEET */}
        <div
          style={{
            padding: '30px',
            overflowY: 'auto',
            flex: 1,
            fontFamily: "'Segoe UI', 'Noto Sans Telugu', Tahoma, Geneva, Verdana, sans-serif",
          }}
        >
          {/* HOSPITAL HEADER */}
          <div
            style={{
              borderBottom: '2px solid #047857',
              paddingBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '2rem' }}>🌿</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#065f46', fontWeight: 800 }}>
                    {prescription.hospitalName || 'Community Health Centre (CHC) Paderu'}
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                    ITDA Paderu Agency • Alluri Sitharama Raju District • Government of Andhra Pradesh
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857' }}>
                {prescription.doctorName || 'Dr. K. Somasekhar (MO)'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {prescription.doctorSpecialty || 'Dental Surgeon & Oral Medicine'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Reg: APMC/2026/PAD/4891</div>
            </div>
          </div>

          {/* PATIENT INFO BAR */}
          <div
            style={{
              margin: '16px 0',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>రోగి పేరు (Patient):</span>
              <strong style={{ color: '#0f172a' }}>{prescription.patientName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>రోగి గుర్తింపు (Patient ID):</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                {prescription.patientId}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>చీటీ సంఖ్య (Rx ID):</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                {prescription.prescriptionId}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>జారీ తేదీ (Date):</span>
              <span style={{ color: '#334155' }}>
                {new Date(prescription.createdAt || Date.now()).toLocaleDateString('te-IN')}
              </span>
            </div>
          </div>

          {/* CLINICAL OBSERVATIONS & DIAGNOSIS */}
          <div style={{ marginBottom: '18px', fontSize: '0.85rem' }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>క్లినికల్ పరిశీలనలు (Observations): </span>
              <span style={{ color: '#1e293b' }}>{prescription.clinicalObservations}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontWeight: 600 }}>రోగనిర్ధారణ అభిప్రాయం (Diagnosis): </span>
              <strong style={{ color: '#b91c1c' }}>{prescription.diagnosisImpression}</strong>
            </div>
          </div>

          {/* MEDICINES TABLE */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                color: '#065f46',
                fontFamily: 'serif',
                marginBottom: '8px',
              }}
            >
              ℞
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '8px 10px', color: '#334155' }}>#</th>
                  <th style={{ padding: '8px 10px', color: '#334155' }}>మందు పేరు (Medicine)</th>
                  <th style={{ padding: '8px 10px', color: '#334155' }}>మోతాదు (Dosage)</th>
                  <th style={{ padding: '8px 10px', color: '#334155' }}>సమయం (Frequency)</th>
                  <th style={{ padding: '8px 10px', color: '#334155' }}>రోజులు (Days)</th>
                  <th style={{ padding: '8px 10px', color: '#334155' }}>వివరణ (Instructions)</th>
                </tr>
              </thead>
              <tbody>
                {(prescription.medicines || []).map((m: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{i + 1}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#0f172a' }}>{m.medicineName}</td>
                    <td style={{ padding: '10px 8px', color: '#0369a1', fontWeight: 600 }}>{m.dosage}</td>
                    <td style={{ padding: '10px 8px', color: '#b45309', fontWeight: 600 }}>{m.frequency}</td>
                    <td style={{ padding: '10px 8px', color: '#4338ca', fontWeight: 600 }}>{m.durationDays} రోజులు</td>
                    <td style={{ padding: '10px 8px', color: '#475569', fontSize: '0.78rem' }}>{m.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ADVICE & FOLLOW-UP */}
          <div
            style={{
              padding: '14px',
              background: '#fefce8',
              borderRadius: '8px',
              border: '1px solid #fef08a',
              marginBottom: '24px',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ fontWeight: 700, color: '#854d0e', marginBottom: '4px' }}>
              💡 జాగ్రత్తలు & జీవనశైలి మార్గదర్శకాలు (Special Instructions):
            </div>
            <ul style={{ margin: '0 0 8px 18px', padding: 0, color: '#713f12' }}>
              {(prescription.dietaryLifestyleAdvice || []).map((adv: string, i: number) => (
                <li key={i}>{adv}</li>
              ))}
            </ul>
            {prescription.followUpDate && (
              <div style={{ color: '#047857', fontWeight: 700, marginTop: '6px' }}>
                📅 తదుపరి పరీక్ష తేదీ (Follow-up Date):{' '}
                {new Date(prescription.followUpDate).toLocaleDateString('te-IN')} (లేదా లక్షణాలు పెరిగితే వెంటనే)
              </div>
            )}
          </div>

          {/* DOCTOR SIGNATURE & OFFICIAL SEAL */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              paddingTop: '20px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              <div>⚠️ SIMULATION SYSTEM — DEMO DATA ONLY — NOT FOR REAL CLINICAL USE</div>
              <div>Aarogya-Drishti Digital Health Record • Cryptographically Validated</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '36px' }}>✍️ <em>K. Somasekhar</em></div>
              <div style={{ borderTop: '1.5px solid #0f172a', paddingTop: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                వైద్య అధికారి సంతకం (Medical Officer)
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>CHC Paderu Outpost</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
