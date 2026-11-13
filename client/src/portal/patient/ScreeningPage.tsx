import React, { useEffect, useRef, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { Card, Empty, Notice, PageHeader, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { accessToken, api, fmtDateTime, newMutationId, Translate, useApi } from '../lib';

export interface ModelCard {
  validated: boolean; disclaimer: string;
  modelVersion?: string; datasetDescription?: string; sampleSize?: number; evaluatedAt?: string;
  accuracy?: number; sensitivity?: number; specificity?: number; notes?: string;
}
export interface ScreeningSummary {
  screeningId: string; createdAt: string; reanalysisOf: string | null; imageRef: string | null;
  analysisSource: 'detailed' | 'basic'; analyzedBy: string | null; lowConfidence: boolean;
  riskLevel: 'low' | 'moderate' | 'high'; summary: string | null; observedCondition: string | null;
  findingType: string | null; findingTypeLabel: string | null; anatomicalSite: string | null;
  visualFindings: string[]; imageObservation: string | null;
  possibleConditions: string[]; possibleCauses: string[]; reasons: string[]; warningSigns: string[];
  thingsToAvoid: string[]; whatToTellDoctor: string[]; whenToSeekReview: string[];
  confidence: number | null; imageQuality: { ok: boolean; reason: string | null } | null;
  nextStep: { urgency: 'routine' | 'soon' | 'urgent'; withinDays: number; text: string; suggestedDoctorType: string | null; facility: string | null; reason: string | null };
  modelVersion: string | null;
  clinicianReview: { status: string; reviewedAt: string | null; impression: string | null };
  label: string; disclaimer: string; modelCard: ModelCard;
}
export interface ScreeningListItem { screeningId: string; createdAt: string; riskLevel?: 'low' | 'moderate' | 'high'; clinicianReviewStatus?: string }

const pct = (value?: number | null) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '—');
const RISK_TONE = { low: 'green', moderate: 'amber', high: 'red' } as const;

/* ---------- Small building blocks ---------- */
const Ring: React.FC<{ value: number }> = ({ value }) => {
  const r = 30; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(1, value));
  const color = v >= 0.75 ? 'var(--adp-primary)' : v >= 0.5 ? '#f59e0b' : '#e5484d';
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${Math.round(v * 100)}%`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--adp-border)" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="43" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--adp-text)">{Math.round(v * 100)}%</text>
    </svg>
  );
};

const Section: React.FC<{ icon: keyof typeof Icon; title: string; children: React.ReactNode; wide?: boolean }> = ({ icon, title, children, wide }) => {
  const IconCmp = Icon[icon];
  return <section className={`adp-panel${wide ? ' adp-panel-wide' : ''}`}><h3><IconCmp size={18} />{title}</h3>{children}</section>;
};

const Bullets: React.FC<{ items: string[] }> = ({ items }) => <ul className="adp-bullets">{items.map((item) => <li key={item}>{item}</li>)}</ul>;

/** Loads the private screening photo with the user's token (never a public URL). */
export const PrivatePhoto: React.FC<{ fileId: string; alt: string }> = ({ fileId, alt }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = ''; let alive = true;
    fetch(`/api/v1/storage/files/${encodeURIComponent(fileId)}`, { headers: { Authorization: `Bearer ${accessToken()}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('photo unavailable'))))
      .then((blob) => { if (alive && blob.type.startsWith('image/')) { url = URL.createObjectURL(blob); setSrc(url); } })
      .catch(() => { /* photo is optional */ });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [fileId]);
  return src ? <img className="adp-result-photo" src={src} alt={alt} /> : null;
};

/* ---------- Result view ---------- */
export const ScreeningResultView: React.FC<{ t: Translate; lang: LanguageCode; summary: ScreeningSummary; onBook: () => void; onOpenResult?: (id: string) => void }> = ({ t, lang, summary, onBook, onOpenResult }) => {
  const level = summary.riskLevel;
  const levelIndex = level === 'low' ? 0 : level === 'moderate' ? 1 : 2;
  const card = summary.modelCard;
  const detailed = summary.analysisSource === 'detailed';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mutationId = useRef(newMutationId());
  const watchFor = [...summary.warningSigns, ...summary.whenToSeekReview];

  const rerun = async () => {
    setBusy(true); setError('');
    try {
      const data = await api<{ screeningId: string }>(`/api/ai/screenings/${encodeURIComponent(summary.screeningId)}/reanalyze`, { method: 'POST', body: JSON.stringify({ clientId: mutationId.current, language: lang }) });
      onOpenResult?.(data.screeningId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
      mutationId.current = newMutationId();
    } finally { setBusy(false); }
  };

  return (
    <div className="adp-result">
      {/* Header */}
      <Card>
        <div className="adp-result-top">
          {summary.imageRef && <PrivatePhoto fileId={summary.imageRef} alt={t('result.photo')} />}
          <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
            <div className="adp-result-head">
              <div>
                <h2 style={{ fontSize: '1.3rem' }}>{summary.reanalysisOf ? t('result.newResult') : t('result.title')}</h2>
                <p style={{ color: 'var(--adp-text-3)', fontSize: '.85rem' }}>{fmtDateTime(summary.createdAt, lang)} · {summary.screeningId}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusPill tone={detailed ? 'green' : 'gray'}>{detailed ? t('result.analyzedDetailed') : t('result.analyzedBasic')}</StatusPill>
                <span className="adp-tag-demo"><Icon.alert size={14} />{t('common.demoAi')}</span>
              </div>
            </div>

            <div className={`adp-severity adp-severity-${level}`}>
              <div className="adp-severity-top">
                <div><small>{t('result.severity')}</small><strong>{t(`result.${level}`)}</strong></div>
                <p style={{ maxWidth: 420, color: 'var(--adp-text-2)', fontWeight: 600 }}>{t(`result.${level}Hint`)}</p>
              </div>
              <div className="adp-meter" aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} className={index <= levelIndex ? `on-${level}` : ''} />)}</div>
              <div className="adp-meter-labels" aria-hidden="true"><span>{t('result.low')}</span><span>{t('result.moderate')}</span><span>{t('result.high')}</span></div>
            </div>
          </div>
        </div>

        {!detailed && (
          <div className="adp-basic-warning" role="status">
            <Icon.alert size={22} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>{t('result.basicTitle')}</strong>
              <p>{t('result.basicBody', { c: pct(summary.confidence) })}</p>
              {error && <p style={{ color: 'var(--adp-red)', marginTop: 6 }}>{error}</p>}
            </div>
            {summary.imageRef && onOpenResult && (
              <button type="button" className="adp-btn adp-btn-primary" disabled={busy} onClick={() => void rerun()}>
                <Icon.scan size={18} />{busy ? t('result.rerunning') : t('result.rerun')}
              </button>
            )}
          </div>
        )}

        {summary.summary && (
          <div className="adp-summary">
            <h3>{t('result.summary')}</h3>
            <p>{summary.summary}</p>
          </div>
        )}
      </Card>

      {summary.imageQuality && !summary.imageQuality.ok && <Notice tone="warn">{t('result.imageQuality')}{summary.imageQuality.reason ? `: ${summary.imageQuality.reason}` : ''}</Notice>}

      {/* Details */}
      <div className="adp-result-grid">
        {detailed && (
          <Section icon="scan" title={t('result.whatSeen')}>
            <dl className="adp-kv" style={{ marginBottom: 12 }}>
              {summary.findingTypeLabel && <><dt>{t('result.findingType')}</dt><dd>{summary.findingTypeLabel}</dd></>}
              {summary.anatomicalSite && <><dt>{t('result.site')}</dt><dd>{summary.anatomicalSite}</dd></>}
            </dl>
            {summary.visualFindings.length > 0 ? <Bullets items={summary.visualFindings} /> : summary.observedCondition ? <p>{summary.observedCondition}</p> : null}
            {summary.imageObservation && <p className="adp-muted" style={{ marginTop: 10 }}>{summary.imageObservation}</p>}
          </Section>
        )}

        {summary.possibleConditions.length > 0 && (
          <Section icon="stethoscope" title={t('result.possibleConditions')}>
            <div className="adp-chips">{summary.possibleConditions.map((item) => <span key={item} className="adp-chip">{item}</span>)}</div>
            <p className="adp-muted" style={{ marginTop: 10 }}>{t('result.possibleConditionsNote')}</p>
          </Section>
        )}

        {(summary.possibleCauses.length > 0 || summary.reasons.length > 0) && (
          <Section icon="alert" title={t('result.whyFlagged')}>
            {summary.possibleCauses.length > 0 && <><p className="adp-subhead">{t('result.causes')}</p><Bullets items={summary.possibleCauses} /></>}
            {summary.reasons.length > 0 && <><p className="adp-subhead" style={{ marginTop: 10 }}>{t('result.reportedFactors')}</p><Bullets items={summary.reasons} /></>}
          </Section>
        )}

        {watchFor.length > 0 && (
          <Section icon="bell" title={t('result.warning')}>
            <Bullets items={Array.from(new Set(watchFor)).slice(0, 6)} />
          </Section>
        )}

        {(summary.whatToTellDoctor.length > 0 || summary.thingsToAvoid.length > 0) && (
          <Section icon="file" title={t('result.beforeVisit')}>
            {summary.whatToTellDoctor.length > 0 && <><p className="adp-subhead">{t('result.tellDoctor')}</p><Bullets items={summary.whatToTellDoctor} /></>}
            {summary.thingsToAvoid.length > 0 && <><p className="adp-subhead" style={{ marginTop: 10 }}>{t('result.avoid')}</p><Bullets items={summary.thingsToAvoid} /></>}
          </Section>
        )}

        <Section icon="check" title={t('result.confidence')}>
          <div className="adp-gauge">
            {summary.confidence !== null ? <Ring value={summary.confidence} /> : <strong>—</strong>}
            <div>
              <p>{t('result.confidenceHint')}</p>
              {summary.analyzedBy && <p className="adp-muted" style={{ marginTop: 6 }}>{t('result.analysedBy', { m: summary.analyzedBy })}</p>}
            </div>
          </div>
        </Section>

        <Section icon="shield" title={t('result.modelAccuracy')}>
          {card?.validated ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="adp-metrics">
                <div className="adp-metric"><small>{t('result.accuracy')}</small><strong>{pct(card.accuracy)}</strong></div>
                {typeof card.sensitivity === 'number' && <div className="adp-metric"><small>{t('result.sensitivity')}</small><strong>{pct(card.sensitivity)}</strong></div>}
                {typeof card.specificity === 'number' && <div className="adp-metric"><small>{t('result.specificity')}</small><strong>{pct(card.specificity)}</strong></div>}
              </div>
              <p className="adp-muted">{t('result.measuredOn', { n: card.sampleSize ?? '?', dataset: card.datasetDescription ?? '' })} · {card.modelVersion} · {card.evaluatedAt}</p>
            </div>
          ) : (
            <div>
              <StatusPill tone="gray">{t('result.notValidated')}</StatusPill>
              <p className="adp-muted" style={{ marginTop: 8 }}>{t('result.notValidatedHint')}</p>
            </div>
          )}
        </Section>
      </div>

      {/* Next step */}
      <div className="adp-next">
        <div style={{ minWidth: 0 }}>
          <strong>{t('result.nextStep')}: {t('result.withinDays', { d: summary.nextStep.withinDays })}</strong>
          <p>{summary.nextStep.text}</p>
          <div className="adp-next-meta">
            {summary.nextStep.suggestedDoctorType && <span><Icon.stethoscope size={16} />{t('result.suggestedDoctor')}: {summary.nextStep.suggestedDoctorType}</span>}
            {summary.nextStep.facility && <span><Icon.clinic size={16} />{t('result.facility')}: {summary.nextStep.facility}</span>}
          </div>
        </div>
        <button type="button" className="adp-btn" onClick={onBook}><Icon.calendar size={18} />{t('result.bookNow')}</button>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong>{t('result.clinicianReview')}:</strong>
          {summary.clinicianReview.status === 'PENDING'
            ? <StatusPill tone="amber">{t('result.reviewPending')}</StatusPill>
            : <StatusPill tone="green">{t('result.reviewDone')}</StatusPill>}
          {summary.clinicianReview.impression && <span style={{ color: 'var(--adp-text-2)' }}>{summary.clinicianReview.impression}</span>}
          {summary.reanalysisOf && onOpenResult && <button type="button" className="adp-link" style={{ marginLeft: 'auto' }} onClick={() => onOpenResult(summary.reanalysisOf!)}>{t('result.viewOriginal')}</button>}
        </div>
      </Card>

      <p className="adp-disclaimer"><Icon.alert size={18} />{t('result.disclaimer')}</p>
    </div>
  );
};

/* ---------- Result loader page ---------- */
export const ScreeningResultPage: React.FC<{ t: Translate; lang: LanguageCode; screeningId: string; onBook: () => void; onBack: () => void; onOpenResult: (id: string) => void }> = ({ t, lang, screeningId, onBook, onBack, onOpenResult }) => {
  const { data, error, loading, reload } = useApi<ScreeningSummary>(`/api/ai/screenings/${encodeURIComponent(screeningId)}/summary`, [screeningId]);
  return (
    <>
      <button type="button" className="adp-link" onClick={onBack}>← {t('common.back')}</button>
      {loading ? <Skeleton rows={3} /> : error ? <><Notice tone="error">{error}</Notice><button type="button" className="adp-btn adp-btn-outline" onClick={() => void reload()}>{t('common.retry')}</button></>
        : data ? <ScreeningResultView t={t} lang={lang} summary={data} onBook={onBook} onOpenResult={onOpenResult} /> : null}
    </>
  );
};

/* ---------- History list (also used on Records page) ---------- */
export const ScreeningHistory: React.FC<{ t: Translate; lang: LanguageCode; patientId?: string; onOpen: (id: string) => void; limit?: number }> = ({ t, lang, patientId, onOpen, limit }) => {
  const { data, error, loading } = useApi<ScreeningListItem[]>(patientId ? `/api/ai/screenings?patientId=${encodeURIComponent(patientId)}` : null, [patientId]);
  const items = (data || []).slice(0, limit || 100);
  if (loading) return <Skeleton rows={2} />;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!items.length) return <Empty icon="scan">{t('screening.noHistory')}</Empty>;
  return (
    <div className="adp-list">
      {items.map((item) => (
        <button key={item.screeningId} type="button" className="adp-quick-item" onClick={() => onOpen(item.screeningId)}>
          <span className="adp-quick-icon"><Icon.scan size={22} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{fmtDateTime(item.createdAt, lang)}</strong>
            <small>{item.clinicianReviewStatus === 'PENDING' ? t('result.reviewPending') : t('result.reviewDone')}</small>
          </span>
          {item.riskLevel && <StatusPill tone={RISK_TONE[item.riskLevel]}>{t(`result.${item.riskLevel}`)}</StatusPill>}
          <Icon.chevron size={18} />
        </button>
      ))}
    </div>
  );
};

/* ---------- Upload + analyse ---------- */
export const ScreeningPage: React.FC<{ t: Translate; lang: LanguageCode; patientId?: string; onOpenResult: (id: string) => void; onBook: () => void }> = ({ t, lang, patientId, onOpenResult }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clientId = useRef(newMutationId());

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    void video.play().then(() => setCameraReady(Boolean(video.videoWidth && video.videoHeight))).catch(() => setCameraError(t('screening.cameraPlayError')));
    return () => { video.srcObject = null; };
  }, [cameraStream, t]);
  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraReady(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('screening.cameraSecureContext'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraReady(false);
      setCameraStream(stream);
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      setCameraError(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? t('screening.cameraPermission')
        : name === 'NotFoundError' || name === 'DevicesNotFoundError'
          ? t('screening.cameraUnavailable')
          : name === 'NotReadableError' || name === 'TrackStartError'
            ? t('screening.cameraBusy')
            : t('screening.cameraStartError'));
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady || !video.videoWidth || !video.videoHeight) {
      setCameraError(t('screening.cameraNotReady'));
      return;
    }
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) { setCameraError(t('screening.cameraCaptureError')); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('capture');
      choose(new File([blob], `patient-screening-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
      stopCamera();
      setCameraError('');
    } catch {
      setCameraError(t('screening.cameraCaptureError'));
    }
  };

  const choose = (next: File | undefined) => {
    setError('');
    setCameraError('');
    if (!next) return;
    if (!next.type.startsWith('image/')) { setError(t('screening.photoRequired')); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next));
    clientId.current = newMutationId();
  };

  const analyse = async () => {
    if (!file) { setError(t('screening.photoRequired')); return; }
    if (!patientId) { setError(t('common.error')); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('image', file, file.name || 'oral-photo.jpg');
      form.append('patientId', patientId);
      form.append('consentGiven', 'true');
      form.append('clientId', clientId.current);
      form.append('language', lang);
      const result = await api<{ screeningId: string }>('/api/ai/analyze', { method: 'POST', body: form });
      onOpenResult(result.screeningId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={t('screening.title')} subtitle={t('screening.intro')} />
      <Card>
        <div className="adp-upload">
          {cameraStream ? (
            <div className="adp-dropzone adp-live-capture">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedData={() => setCameraReady(Boolean(videoRef.current?.videoWidth && videoRef.current?.videoHeight))}
                onPlaying={() => setCameraReady(Boolean(videoRef.current?.videoWidth && videoRef.current?.videoHeight))}
                aria-label={t('screening.liveCameraPreview')}
              />
              <span className="adp-live-badge"><span aria-hidden="true" />{cameraReady ? t('screening.cameraReady') : t('screening.cameraOpening')}</span>
            </div>
          ) : (
            <label className="adp-dropzone">
              <input type="file" accept="image/*" capture="environment" onChange={(e) => choose(e.target.files?.[0])} aria-label={t('screening.choosePhoto')} />
              {preview ? <img src={preview} alt="" /> : (
                <span style={{ display: 'grid', justifyItems: 'center', gap: 10, color: 'var(--adp-text-2)' }}>
                  <span className="adp-quick-icon" style={{ width: 64, height: 64 }}><Icon.camera size={30} /></span>
                  <strong>{t('screening.choosePhoto')}</strong>
                </span>
              )}
            </label>
          )}
          <canvas ref={canvasRef} className="adp-camera-canvas" aria-hidden="true" />
          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            {cameraStream ? (
              <div className="adp-camera-actions">
                <button type="button" className="adp-btn adp-btn-primary" disabled={!cameraReady || busy} onClick={() => void captureFromCamera()}>
                  <Icon.camera size={18} />{t('screening.capturePhoto')}
                </button>
                <button type="button" className="adp-btn adp-btn-outline" disabled={busy} onClick={stopCamera}>{t('screening.stopCamera')}</button>
              </div>
            ) : (
              <button type="button" className="adp-btn adp-btn-outline adp-camera-start" disabled={busy} onClick={() => void startCamera()}>
                <Icon.camera size={18} />{t('screening.useLiveCamera')}
              </button>
            )}
            {cameraError && <Notice tone="error">{cameraError}</Notice>}
            <ul className="adp-tips">
              <li><Icon.check size={18} />{t('screening.tip1')}</li>
              <li><Icon.check size={18} />{t('screening.tip2')}</li>
              <li><Icon.check size={18} />{t('screening.tip3')}</li>
            </ul>
            <p className="adp-consent-note"><Icon.shield size={18} />{t('screening.consent')}</p>
            {error && <Notice tone="error">{error}</Notice>}
            <button type="button" className="adp-btn adp-btn-primary adp-btn-block" disabled={busy || !file} onClick={() => void analyse()}>
              <Icon.scan size={18} />{busy ? t('screening.analyzing') : t('screening.analyze')}
            </button>
            {busy && <p className="adp-muted" role="status">{t('screening.wait')}</p>}
            <p className="adp-disclaimer"><Icon.alert size={18} />{t('result.disclaimer')}</p>
          </div>
        </div>
      </Card>
      <Card title={t('screening.history')} icon="history">
        <ScreeningHistory t={t} lang={lang} patientId={patientId} onOpen={onOpenResult} limit={5} />
      </Card>
    </>
  );
};
