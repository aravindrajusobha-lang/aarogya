import React, { useState, useEffect, useRef } from 'react';
import { LanguageCode } from '../i18n';

export interface LiveVideoConsultationModalProps {
  consultationId: string;
  patientName: string;
  doctorName?: string;
  doctorSpecialty?: string;
  hospitalName?: string;
  userRole: 'patient' | 'doctor' | 'medical_officer' | 'asha';
  currentLang?: LanguageCode;
  onClose: () => void;
  onOpenPrescriptionModal?: (consultationId: string, patientName: string) => void;
}

export const LiveVideoConsultationModal: React.FC<LiveVideoConsultationModalProps> = ({
  consultationId,
  patientName,
  doctorName = 'Dr. K. Somasekhar (MO)',
  doctorSpecialty = 'Dental Surgeon & Oral Medicine',
  hospitalName = 'CHC Paderu Outpost',
  userRole,
  currentLang = 'te',
  onClose,
  onOpenPrescriptionModal,
}) => {
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'waiting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const pollTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const lastSignalTsRef = useRef<number>(0);

  // Translations
  const t = {
    title: {
      te: 'ప్రత్యక్ష వీడియో సంప్రదింపు (Live Video Consultation)',
      en: 'Live Telemedicine Video Consultation',
      hi: 'लाइव टेलीमेडिसिन वीडियो परामर्श',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Live Video Consultation',
    waitingDoctor: {
      te: 'వైద్యుడు కనెక్ట్ అవ్వడానికి వేచి చూస్తున్నారు...',
      en: 'Waiting for Doctor to join the secure consultation room...',
      hi: 'डॉक्टर के जुड़ने की प्रतीक्षा की जा रही है...',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Waiting for Doctor...',
    connected: {
      te: '🟢 లైవ్ సంప్రదింపు కొనసాగుతోంది',
      en: '🟢 Live Consultation Active',
      hi: '🟢 लाइव परामर्श जारी है',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Connected',
    endCall: {
      te: 'కాల్ ముగించండి',
      en: 'End Consultation',
      hi: 'परामर्श समाप्त करें',
    }[currentLang as 'te' | 'en' | 'hi'] || 'End Call',
    writePrescription: {
      te: '💊 మందుల చీటీ రాయండి',
      en: '💊 Prescribe Medicines',
      hi: '💊 दवाई का पर्चा लिखें',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Write Prescription',
    patientLabel: {
      te: 'రోగి:',
      en: 'Patient:',
      hi: 'रोगी:',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Patient:',
    doctorLabel: {
      te: 'వైద్యులు:',
      en: 'Doctor:',
      hi: 'डॉक्टर:',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Doctor:',
  };

  useEffect(() => {
    initLocalMediaAndPeer();

    return () => {
      cleanup();
    };
  }, []);

  // Duration timer when connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [connectionStatus]);

  const cleanup = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }

    // Notify backend
    try {
      const token = localStorage.getItem('aarogya_token') || '';
      fetch(`/api/v1/teleconsultation/rooms/${consultationId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    } catch {}
  };

  const initLocalMediaAndPeer = async () => {
    try {
      // 1. Get user media (mic + cam)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });
      } catch {
        // Fallback: video only or muted
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // 2. Initialize RTCPeerConnection with STUN
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote track
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
          setConnectionStatus('connected');
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('ice-candidate', event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionStatus('waiting');
        }
      };

      // 3. Join room on backend
      const token = localStorage.getItem('aarogya_token') || '';
      const joinRes = await fetch(`/api/v1/teleconsultation/rooms/${consultationId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (joinRes.ok) {
        const json = await joinRes.json();
        const participants = json.data?.activeParticipants || [];

        // If another participant already in room, create offer (caller role)
        if (participants.length > 1) {
          createAndSendOffer(pc);
        } else {
          setConnectionStatus('waiting');
        }
      }

      // 4. Start polling for incoming signals
      startSignalPolling(pc);
    } catch (err: any) {
      console.warn('WebRTC Initialization warning:', err);
      setCameraError('కెమెరా లేదా మైక్రోఫోన్ అనుమతి లభించలేదు. (Camera/Mic access not granted)');
      setConnectionStatus('waiting');
    }
  };

  const sendSignal = async (type: string, data: any) => {
    try {
      const token = localStorage.getItem('aarogya_token') || '';
      await fetch(`/api/v1/teleconsultation/rooms/${consultationId}/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, data }),
      });
    } catch {}
  };

  const createAndSendOffer = async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', offer);
      setConnectionStatus('connecting');
    } catch (err) {
      console.warn('Create offer error:', err);
    }
  };

  const startSignalPolling = (pc: RTCPeerConnection) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('aarogya_token') || '';
        const res = await fetch(
          `/api/v1/teleconsultation/rooms/${consultationId}/signal?since=${lastSignalTsRef.current}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const json = await res.json();
          const signals: any[] = json.data?.signals || [];

          for (const s of signals) {
            if (s.timestamp > lastSignalTsRef.current) {
              lastSignalTsRef.current = s.timestamp;
            }

            if (s.type === 'offer' && pc.signalingState !== 'closed') {
              await pc.setRemoteDescription(new RTCSessionDescription(s.data));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal('answer', answer);
              setConnectionStatus('connected');
            } else if (s.type === 'answer' && pc.signalingState !== 'closed') {
              await pc.setRemoteDescription(new RTCSessionDescription(s.data));
              setConnectionStatus('connected');
            } else if (s.type === 'ice-candidate' && s.data && pc.signalingState !== 'closed') {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(s.data));
              } catch {}
            } else if (s.type === 'leave') {
              setConnectionStatus('waiting');
            }
          }
        }
      } catch {}
    }, 1500);
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => (track.enabled = !track.enabled));
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 10, 20, 0.94)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          background: 'var(--surface)',
          borderRadius: '18px',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* TOP BAR */}
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🩺</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{t.title}</strong>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background:
                    connectionStatus === 'connected'
                      ? 'var(--success-bg)'
                      : 'var(--warning-bg)',
                  color: connectionStatus === 'connected' ? 'var(--success-text)' : 'var(--warning-text)',
                  border: `1px solid ${connectionStatus === 'connected' ? 'var(--success-text)' : 'var(--warning-text)'}`,
                  fontWeight: 700,
                }}
              >
                {connectionStatus === 'connected' ? t.connected : t.waitingDoctor}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {t.patientLabel} <strong style={{ color: 'var(--text-primary)' }}>{patientName}</strong> • {t.doctorLabel}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{doctorName}</strong> ({doctorSpecialty}, {hospitalName})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {connectionStatus === 'connected' && (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  background: 'var(--surface-2)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                ⏱️ {formatSeconds(callDuration)}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
              }}
            >
              ✕ మూసివేయి (Close)
            </button>
          </div>
        </div>

        {/* VIDEO DISPLAY AREA */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '460px',
            background: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Remote Video Stream (Main Stage) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: connectionStatus === 'connected' ? 'block' : 'none',
            }}
          />

          {/* Waiting Lobby Placeholder */}
          {connectionStatus !== 'connected' && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '2px dashed #10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem',
                  animation: 'pulse 2s infinite',
                }}
              >
                📡
              </div>
              <h4 style={{ color: '#f8fafc', margin: '0 0 8px', fontSize: '1.1rem' }}>
                {t.waitingDoctor}
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '420px' }}>
                పాడేరు కమ్యూనిటీ హెల్త్ సెంటర్ వైద్యునికి కనెక్షన్ సందేశం పంపబడింది. దయచేసి లైన్‌లో ఉండండి.
              </p>
              {cameraError && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    fontSize: '0.8rem',
                  }}
                >
                  ⚠️ {cameraError}
                </div>
              )}
            </div>
          )}

          {/* Local User Picture-in-Picture Box */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              width: '170px',
              height: '120px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid #10b981',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              background: '#0f172a',
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror effect
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '4px',
                left: '6px',
                background: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                color: '#ffffff',
              }}
            >
              {userRole === 'doctor' || userRole === 'medical_officer' ? 'Doctor (You)' : 'Patient (You)'}
            </div>
          </div>
        </div>

        {/* BOTTOM CALL CONTROLS */}
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Audio / Video Toggles */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={toggleAudio}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: isAudioMuted ? '1px solid var(--danger-text)' : '1px solid var(--border)',
                background: isAudioMuted ? 'var(--danger-bg)' : 'var(--surface-2)',
                color: isAudioMuted ? 'var(--danger-text)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isAudioMuted ? '🔇 మైక్ ఆఫ్ (Muted)' : '🎤 మైక్ ఆన్ (Mute)'}
            </button>

            <button
              onClick={toggleVideo}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: isVideoDisabled ? '1px solid var(--danger-text)' : '1px solid var(--border)',
                background: isVideoDisabled ? 'var(--danger-bg)' : 'var(--surface-2)',
                color: isVideoDisabled ? 'var(--danger-text)' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isVideoDisabled ? '🚫 కెమెరా ఆఫ్ (Video Off)' : '📹 కెమెరా ఆన్ (Video On)'}
            </button>
          </div>

          {/* Clinician Actions or End Call */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {(userRole === 'doctor' || userRole === 'medical_officer') && onOpenPrescriptionModal && (
              <button
                onClick={() => onOpenPrescriptionModal(consultationId, patientName)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--btn-primary-bg)',
                  background: 'var(--success-bg)',
                  color: 'var(--success-text)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {t.writePrescription}
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🛑 {t.endCall}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

