import { PrescriptionModal } from './PrescriptionModal';
import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { EndConsultationDialog } from '../portal/doctor/EndConsultationDialog';
import { makeT } from '../portal/lib';
import type { LanguageCode } from '../i18n';

const storedLang = (): LanguageCode => { try { const v = localStorage.getItem('aarogya_language'); return (v === 'te' || v === 'hi' ? v : 'en') as LanguageCode; } catch { return 'en'; } };

const accessToken = () => {
  try { return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || ''; }
  catch { return localStorage.getItem('aarogya_token') || ''; }
};

interface JoinedRoom { startedAt?: string | null; patientId: string; patientName: string; doctorName: string; consultationId: string; appointmentId: string; role: string; peerPresent: boolean; iceServers: RTCIceServer[]; }

export const LiveAppointmentRoom: React.FC<{ appointmentId: string; role: 'patient' | 'doctor'; onClose: () => void }> = ({ appointmentId, role, onClose }) => {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const socket = useRef<Socket | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const roleRef = useRef(role);
  const offerStarted = useRef(false);
  const mounted = useRef(true);
  const [state, setState] = useState('Allow camera and microphone access to join the appointment room.');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [roomInfo, setRoomInfo] = useState<JoinedRoom | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [prescribe, setPrescribe] = useState(false);
  const starting = useRef(false);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Array<{ captureId: string; preview: string; screeningId?: string; summary?: any; impression?: string; clinicianNotes?: string; approved?: boolean; busy?: boolean }>>([]);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureNote, setCaptureNote] = useState('');
  const [notice, setNotice] = useState('');
  const tt = makeT(storedLang());

  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    socket.current?.emit('consultation:leave');
    socket.current?.disconnect();
    peer.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
  }; }, []);

  const transmitOffer = async () => {
    if (offerStarted.current || !peer.current || !socket.current) return;
    offerStarted.current = true;
    const offer = await peer.current.createOffer();
    await peer.current.setLocalDescription(offer);
    socket.current.emit('webrtc:signal', { type: 'offer', data: offer });
  };

  const startRoom = async () => {
    if (starting.current || joined) return; starting.current = true;
    socket.current?.disconnect(); peer.current?.close(); stream.current?.getTracks().forEach(t => t.stop()); offerStarted.current = false; pendingIce.current = [];
    setError(''); setState('Requesting local camera and microphone access…');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone require HTTPS (or localhost) in a supported browser.');
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 960 }, height: { ideal: 540 } } });
      if (!mounted.current) { localStream.getTracks().forEach(t => t.stop()); return; }
      stream.current = localStream;
      if (localVideo.current) localVideo.current.srcObject = localStream;
      const nextSocket = io(window.location.origin, { autoConnect: false, auth: { token: accessToken() }, transports: ['websocket', 'polling'] });
      socket.current = nextSocket;
      nextSocket.on('consultation:chat-history', setMessages);
      nextSocket.on('consultation:chat-message', (item: any) => setMessages(previous => previous.some(m => m.messageId === item.messageId) ? previous : [...previous, item]));
      nextSocket.on('connect', () => nextSocket.emit('consultation:join', { appointmentId }));
      nextSocket.on('connect_error', (connectError) => { setError(connectError.message || 'The secure consultation connection failed.'); setState('Could not join room.'); stream.current?.getTracks().forEach(t => t.stop()); nextSocket.disconnect(); });
      nextSocket.on('consultation:error', (payload: { message?: string }) => { setError(payload?.message || 'This appointment cannot enter the room.'); setState('Room access denied.'); if (!peer.current) { stream.current?.getTracks().forEach(t => t.stop()); nextSocket.disconnect(); } });
      nextSocket.on('consultation:joined', (info: JoinedRoom) => {
        setRoomInfo(info);
        roleRef.current = info.role === 'patient' ? 'patient' : 'doctor';
        const iceServers = info.iceServers?.length ? info.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }];
        const connection = new RTCPeerConnection({ iceServers });
        peer.current = connection;
        localStream.getTracks().forEach((track) => connection.addTrack(track, localStream));
        connection.ontrack = (event) => { if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]; };
        connection.onicecandidate = (event) => { if (event.candidate) nextSocket.emit('webrtc:signal', { type: 'ice-candidate', data: event.candidate.toJSON() }); };
        connection.onconnectionstatechange = () => {
          const connectedNow = connection.connectionState === 'connected';
          setConnected(connectedNow);
          setState(connectedNow ? 'Secure live call connected.' : connection.connectionState === 'failed' ? 'Connection failed. Check network or TURN configuration.' : 'Waiting for the other participant…');
        };
        setJoined(true); setPeerReady(Boolean(info.peerPresent));
        setState(info.peerPresent ? 'Both participants are in the private room.' : 'Waiting for the other participant…');
        if (roleRef.current === 'doctor' && info.peerPresent) void transmitOffer();
      });
      nextSocket.on('consultation:participant-ready', () => { setPeerReady(true); setState('The other participant joined. Connecting…'); if (roleRef.current === 'doctor') void transmitOffer(); });
      nextSocket.on('consultation:capture-notice', () => { setNotice(tt('capture.patientNotice')); window.setTimeout(() => setNotice(''), 8000); });
      nextSocket.on('consultation:participant-left', () => { offerStarted.current = false; setPeerReady(false); setConnected(false); setState('The other participant left the room.'); });
      nextSocket.on('webrtc:signal', async (signal: { type: 'offer' | 'answer' | 'ice-candidate'; data: RTCSessionDescriptionInit | RTCIceCandidateInit }) => {
        const connection = peer.current;
        if (!connection) return;
        try {
          if (signal.type === 'offer') {
            await connection.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
            const answer = await connection.createAnswer(); await connection.setLocalDescription(answer);
            nextSocket.emit('webrtc:signal', { type: 'answer', data: answer });
          } else if (signal.type === 'answer') await connection.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));
          else if (connection.remoteDescription) await connection.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
          else pendingIce.current.push(signal.data as RTCIceCandidateInit);
          if (connection.remoteDescription) { for (const candidate of pendingIce.current.splice(0)) await connection.addIceCandidate(new RTCIceCandidate(candidate)); }
        } catch { setError('Unable to complete the secure media connection.'); }
      });
      nextSocket.connect();
    } catch (mediaError: any) {
      stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
      const name = mediaError?.name;
      const message = name === 'NotAllowedError' ? 'Camera or microphone permission was denied. Allow both permissions in your browser and try again.' : name === 'NotFoundError' ? 'No camera or microphone was found on this device.' : name === 'NotReadableError' ? 'Camera or microphone is busy in another application. Close it and try again.' : mediaError instanceof Error ? mediaError.message : 'Camera or microphone access was not available.';
      setError(message); setState('Camera and microphone are required for this live call.');
    } finally { starting.current = false; }
  };

  const toggleCamera = () => { const next = !cameraOn; setCameraOn(next); stream.current?.getVideoTracks().forEach((track) => { track.enabled = next; }); };
  const toggleMic = () => { const next = !micOn; setMicOn(next); stream.current?.getAudioTracks().forEach((track) => { track.enabled = next; }); };

  const saveNotes = async (): Promise<boolean> => {
    if (role !== 'doctor' || (!notes.trim() && !followUp.trim())) return true;
    setSaving(true); setError('');
    const combined = [notes.trim() ? `Consultation notes:\n${notes.trim()}` : '', followUp.trim() ? `Follow-up recommendation:\n${followUp.trim()}` : ''].filter(Boolean).join('\n\n');
    try {
      const response = await fetch(`/api/v1/consultations/${encodeURIComponent(appointmentId)}/notes`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken()}` }, body: JSON.stringify({ notes: combined, clientMutationId: crypto.randomUUID() }) });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Clinical note could not be saved.');
      setState('Clinical note saved with a SHA-256 version history.');
      return true;
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Clinical note could not be saved.'); return false; }
    finally { setSaving(false); }
  };

  const finishAppointment = async () => {
    if (role !== 'doctor') return;
    if ((notes.trim() || followUp.trim()) && !(await saveNotes())) return;
    setSessionStartedAt(roomInfo?.startedAt || null);
    setShowEnd(true);
  };

  const captureFrame = async () => {
    const video = remoteVideo.current;
    if (role !== 'doctor' || !video || !video.videoWidth) { setError(tt('capture.noVideo')); return; }
    setCaptureBusy(true); setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('capture failed'))), 'image/jpeg', 0.92));
      const form = new FormData();
      form.append('clientId', crypto.randomUUID());
      if (captureNote.trim()) form.append('note', captureNote.trim());
      form.append('image', blob, 'consultation-capture.jpg');
      const response = await fetch(`/api/v1/consultation-sessions/${encodeURIComponent(appointmentId)}/captures`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken()}` }, body: form });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Capture could not be saved.');
      const captureId = payload.data.capture.captureId as string;
      setCaptures((prev) => [{ captureId, preview: URL.createObjectURL(blob) }, ...prev]);
      setCaptureNote('');
      socket.current?.emit('consultation:capture-notice', { captureId });
      setState(tt('capture.saved'));
    } catch (captureError) { setError(captureError instanceof Error ? captureError.message : 'Capture could not be saved.'); }
    finally { setCaptureBusy(false); }
  };

  const analyseCapture = async (captureId: string) => {
    setCaptures((prev) => prev.map((c) => (c.captureId === captureId ? { ...c, busy: true } : c)));
    try {
      const response = await fetch(`/api/v1/consultation-sessions/captures/${encodeURIComponent(captureId)}/analyze`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken()}` } });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Analysis failed.');
      setCaptures((prev) => prev.map((c) => (c.captureId === captureId ? { ...c, busy: false, screeningId: payload.data.screeningId, summary: payload.data.summary, impression: payload.data.summary?.summary || payload.data.summary?.observedCondition || '', clinicianNotes: '' } : c)));
    } catch (analysisError) {
      setCaptures((prev) => prev.map((c) => (c.captureId === captureId ? { ...c, busy: false } : c)));
      setError(analysisError instanceof Error ? analysisError.message : 'Analysis failed.');
    }
  };

  const reviewCapture = async (capture: (typeof captures)[number], status: 'CONFIRMED' | 'OVERRIDDEN') => {
    if (!capture.screeningId || !capture.impression?.trim()) return;
    setCaptures(prev => prev.map(c => c.captureId === capture.captureId ? { ...c, busy: true } : c));
    try {
      const response = await fetch(`/api/ai/screenings/${encodeURIComponent(capture.screeningId)}/review`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status, finalImpression: capture.impression.trim(), notes: capture.clinicianNotes || '' }) });
      const body = await response.json();
      if (!response.ok || !body?.success) throw new Error(body?.error?.message || 'Review could not be saved.');
      setCaptures(prev => prev.map(c => c.captureId === capture.captureId ? { ...c, busy: false, approved: true } : c));
    } catch (e) { setCaptures(prev => prev.map(c => c.captureId === capture.captureId ? { ...c, busy: false } : c)); setError(e instanceof Error ? e.message : 'Review could not be saved.'); }
  };

  const regenerateCapture = async (capture: (typeof captures)[number]) => {
    if (!capture.screeningId) return;
    setCaptures(prev => prev.map(c => c.captureId === capture.captureId ? { ...c, busy: true } : c));
    try {
      const response = await fetch(`/api/ai/screenings/${encodeURIComponent(capture.screeningId)}/reanalyze`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: crypto.randomUUID(), language: storedLang() }) });
      const body = await response.json();
      if (!response.ok || !body?.success) throw new Error(body?.error?.message || 'Regeneration failed.');
      const detailed = await fetch(`/api/ai/screenings/${encodeURIComponent(body.data.screeningId)}/summary`, { headers: { Authorization: `Bearer ${accessToken()}` } });
      const report = await detailed.json(); if (!detailed.ok || !report?.success) throw new Error(report?.error?.message || 'Report could not be loaded.');
      setCaptures(prev => prev.map(c => c.captureId === capture.captureId ? { ...c, busy: false, screeningId: body.data.screeningId, summary: report.data, impression: report.data.summary || report.data.observedCondition || '', clinicianNotes: '', approved: false } : c));
    } catch (e) { setCaptures(prev => prev.map(c => c.captureId === capture.captureId ? { ...c, busy: false } : c)); setError(e instanceof Error ? e.message : 'Regeneration failed.'); }
  };

  const onSessionEnded = () => {
    setShowEnd(false);
    socket.current?.emit('consultation:leave');
    setState('Appointment completed.');
    onClose();
  };

  const leaveRoom = () => {
    socket.current?.emit('consultation:leave'); socket.current?.disconnect(); socket.current = null;
    peer.current?.close(); peer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    onClose();
  };

  return <main className="live-appointment-room" aria-labelledby="live-appointment-title">
    <header className="live-room-header">
      <div className="live-room-heading"><span className="live-room-eyebrow">PRIVATE APPOINTMENT ROOM</span><h1 id="live-appointment-title">Secure video consultation</h1><p>Appointment <strong>{appointmentId}</strong></p></div>
      <div className={`live-room-status ${connected ? 'connected' : ''}`} aria-live="polite"><span className="live-room-status-dot" />{state}</div>
    </header>
    {error && <p className="live-appointment-error" role="alert">{error}</p>}
    {notice && <p className="live-capture-notice" role="status">{notice}</p>}
    <div className="live-room-layout">
      <section className="live-room-stage" aria-label="Video call">
        <div className="live-remote-video"><video ref={remoteVideo} autoPlay playsInline aria-label="Other appointment participant" />{!peerReady && <div className="live-video-waiting"><span className="live-video-avatar">{role === 'patient' ? 'DR' : 'PT'}</span><strong>{connected ? 'Connected' : 'Waiting for the other participant'}</strong><span>Keep this window open while the other participant joins.</span></div>}<span className="live-video-label">{role === 'patient' ? roomInfo?.doctorName || 'Assigned doctor' : roomInfo?.patientName || 'Patient'}</span></div>
        <div className="live-local-video"><video ref={localVideo} autoPlay muted playsInline aria-label="Your camera preview" /><span>You</span></div>
      </section>
      <aside className="live-room-sidebar">
        <section className="live-room-card live-room-call-card"><div className="live-room-card-heading"><div><span>CONSULTATION</span><h2>{role === 'doctor' ? 'Doctor controls' : 'Join your doctor'}</h2></div><span className={`live-room-badge ${joined ? 'is-live' : ''}`}>{connected ? 'Connected' : joined ? 'In room' : 'Not started'}</span></div><p>{joined ? state : role === 'doctor' ? 'Start the appointment room when you are ready.' : 'Your doctor must start the room before you can join.'}</p><div className="live-appointment-controls">{!joined && <button type="button" className="live-control-primary" onClick={() => void startRoom()}>{role === 'doctor' ? 'Start consultation' : 'Join live call'}</button>}{joined && <><button type="button" aria-pressed={cameraOn} onClick={toggleCamera}>{cameraOn ? 'Turn camera off' : 'Turn camera on'}</button><button type="button" aria-pressed={micOn} onClick={toggleMic}>{micOn ? 'Mute microphone' : 'Unmute microphone'}</button></>}{role === 'doctor' && joined && <button type="button" className="live-control-danger" disabled={saving} onClick={() => void finishAppointment()}>{saving ? 'Saving…' : 'End consultation'}</button>}<button type="button" className="live-control-quiet" onClick={leaveRoom}>{role === 'doctor' ? 'Leave room' : 'Leave call'}</button></div></section>
        {joined && <section className="live-room-card live-room-chat"><div className="live-room-card-heading"><div><span>MESSAGES</span><h2>Consultation chat</h2></div></div><div className="live-room-chat-log" role="log" aria-live="polite">{messages.length ? messages.map(item => <p key={item.messageId}><strong>{item.role === 'patient' ? 'Patient' : 'Doctor'}</strong><span>{item.text}</span></p>) : <p className="live-room-empty">Messages shared here are visible to both participants.</p>}</div><form onSubmit={event => { event.preventDefault(); if (message.trim()) { socket.current?.emit('consultation:chat', { messageId: crypto.randomUUID(), text: message.trim() }); setMessage(''); } }}><label className="sr-only" htmlFor="live-consult-message">Message</label><input id="live-consult-message" value={message} maxLength={2000} onChange={e => setMessage(e.target.value)} placeholder="Write a message…" /><button type="submit" disabled={!message.trim()}>Send</button></form>{role === 'doctor' && roomInfo?.patientId && <button className="live-room-prescribe" onClick={() => setPrescribe(true)}>Issue prescription</button>}</section>}
        {role === 'doctor' && joined && <section className="live-room-card live-room-capture">
          <div className="live-room-card-heading"><div><span>DOCTOR ONLY</span><h2>{tt('capture.take')}</h2></div><a className="live-room-record-link" href={`#/doctor/patients?id=${encodeURIComponent(roomInfo?.patientId || '')}`} target="_blank" rel="noreferrer">{tt('records.open')}</a></div>
          <label htmlFor="capture-note">{tt('capture.note')}<input id="capture-note" value={captureNote} maxLength={300} onChange={(e) => setCaptureNote(e.target.value)} /></label>
          <button type="button" className="live-control-primary" disabled={captureBusy || !peerReady} onClick={() => void captureFrame()}>{captureBusy ? tt('capture.taking') : tt('capture.take')}</button>
          {captures.length > 0 && <><h3 className="live-capture-heading">{tt('capture.list')}</h3><div className="live-capture-grid">{captures.map((c) => <figure key={c.captureId}><img src={c.preview} alt="Captured patient image" /><figcaption>{c.summary ? <><strong>DEMO AI screening support</strong><p>{c.summary.summary || c.summary.observedCondition || 'The image is ready for clinician review.'}</p><p>Observed: {c.summary.findingTypeLabel || 'Review required'} · Confidence: {c.summary.confidence == null ? '—' : `${Math.round(c.summary.confidence * 100)}%`}</p>{(c.summary.visualFindings || []).map((finding: string, i: number) => <p key={i}>• {finding}</p>)}<p>Suggested follow-up: {c.summary.nextStep?.text || 'Clinician review required'}</p><label>Clinician assessment<textarea rows={3} maxLength={2000} value={c.impression || ''} onChange={e => setCaptures(prev => prev.map(item => item.captureId === c.captureId ? { ...item, impression: e.target.value } : item))} /></label><label>Clinical notes<textarea rows={2} maxLength={2000} value={c.clinicianNotes || ''} onChange={e => setCaptures(prev => prev.map(item => item.captureId === c.captureId ? { ...item, clinicianNotes: e.target.value } : item))} /></label>{c.approved ? <strong>Clinician review saved to patient records</strong> : <><button type="button" disabled={c.busy} onClick={() => void reviewCapture(c, c.impression === (c.summary.summary || c.summary.observedCondition || '') ? 'CONFIRMED' : 'OVERRIDDEN')}>Approve and save review</button><button type="button" disabled={c.busy} onClick={() => void regenerateCapture(c)}>Regenerate analysis</button></>}</> : <button type="button" disabled={c.busy} onClick={() => void analyseCapture(c.captureId)}>{c.busy ? tt('capture.analysing') : tt('capture.analyse')}</button>}</figcaption></figure>)}</div></>}
        </section>}
        {role === 'doctor' && <section className="live-room-card live-room-clinical-notes"><div className="live-room-card-heading"><div><span>DOCTOR ONLY</span><h2>Consultation notes</h2></div></div><label htmlFor="appointment-consultation-notes">Clinical notes<textarea id="appointment-consultation-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={9000} /></label><label htmlFor="appointment-followup">Follow-up recommendation<textarea id="appointment-followup" value={followUp} onChange={(event) => setFollowUp(event.target.value)} rows={3} maxLength={3000} /></label><button type="button" disabled={saving || (!notes.trim() && !followUp.trim())} onClick={() => void saveNotes()}>{saving ? 'Saving…' : 'Save versioned note'}</button><p>Notes are saved separately from DEMO AI screening support.</p></section>}
      </aside>
    </div>
    {showEnd && <EndConsultationDialog t={makeT(storedLang())} appointmentId={appointmentId} patientName={roomInfo?.patientName} startedAt={sessionStartedAt} onClose={() => setShowEnd(false)} onEnded={onSessionEnded} />}
    {prescribe && roomInfo && <PrescriptionModal patientId={roomInfo.patientId} patientName={roomInfo.patientName} doctorName={roomInfo.doctorName} consultationId={roomInfo.consultationId} onClose={() => setPrescribe(false)} />}
  </main>;
};
