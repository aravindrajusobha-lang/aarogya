import React, { useState } from 'react';
import { Icon } from '../icons';
import { Translate } from '../lib';

export interface Credentials { doctorId?: string; loginId: string; temporaryPassword: string }

/* ---------- Credentials dialog (shown once) ---------- */
export const CredentialsDialog: React.FC<{ t: Translate; credentials: Credentials; doctorName: string; reset?: boolean; onClose: () => void }> = ({ t, credentials, doctorName, reset, onClose }) => {
  const [copied, setCopied] = useState('');
  const copy = async (key: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { /* clipboard unavailable */ } };
  const all = `${doctorName}\n${credentials.doctorId ? `${t('admin.doctorId')}: ${credentials.doctorId}\n` : ''}${t('admin.loginId')}: ${credentials.loginId}\n${t('admin.credentials.password')}: ${credentials.temporaryPassword}`;
  const rows: Array<[string, string, string]> = [...(credentials.doctorId ? [['id', t('admin.doctorId'), credentials.doctorId] as [string, string, string]] : []), ['login', t('admin.loginId'), credentials.loginId], ['pw', t('admin.credentials.password'), credentials.temporaryPassword]];
  return (
    <div className="adp-root adp-dialog-backdrop" role="presentation">
      <div className="adp-dialog" role="dialog" aria-modal="true" aria-labelledby="adp-cred-title">
        <h2 id="adp-cred-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="adp-quick-icon" style={{ width: 40, height: 40 }}><Icon.check size={20} /></span>{reset ? t('admin.credentials.resetTitle') : t('admin.credentials.title')}</h2>
        <p style={{ color: 'var(--adp-text-2)', marginTop: 8 }}><strong>{doctorName}</strong> — {t('admin.credentials.body')}</p>
        <div className="adp-cred-list">
          {rows.map(([key, label, value]) => (
            <div key={key} className="adp-cred-row">
              <div><small>{label}</small><code>{value}</code></div>
              <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => void copy(key, value)}>{copied === key ? t('admin.credentials.copied') : t('admin.credentials.copy')}</button>
            </div>
          ))}
        </div>
        <p className="adp-muted" style={{ marginTop: 12 }}>{t('admin.credentials.loginHint')}</p>
        <div className="adp-dialog-actions" style={{ marginTop: 16 }}>
          <button type="button" className="adp-btn adp-btn-outline" onClick={() => void copy('all', all)}>{copied === 'all' ? t('admin.credentials.copied') : t('admin.credentials.copyAll')}</button>
          <button type="button" className="adp-btn adp-btn-primary" onClick={onClose}>{t('admin.credentials.done')}</button>
        </div>
      </div>
    </div>
  );
};

