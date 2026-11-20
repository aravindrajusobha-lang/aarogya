import React, { useEffect, useState } from 'react';
import { AuthUser } from './AuthPanel';
import { AiOralHealthEngine } from './AiEngine/AiOralHealthEngine';
import { LanguageCode } from '../i18n';

interface FieldWorkerPatient {
  patientId: string;
  fullName: string;
  ageEstimated: number;
  gender: string;
  villageName: string;
  mandal: string;
  hospitalId?: string;
  flow?: {
    aiScreening?: { status: string };
    screening?: string;
    referral?: string;
    appointment?: string;
  };
}

interface FieldWorkerAiScreeningProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  currentLang: LanguageCode;
  onGoToPatients: () => void;
  initialPatientId?: string;
}

export const FieldWorkerAiScreening: React.FC<FieldWorkerAiScreeningProps> = ({
  accessToken,
  currentUser,
  currentLang,
  onGoToPatients,
  initialPatientId,
}) => {
  const [patients, setPatients] = useState<FieldWorkerPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      setLoadError('Sign in to load patients in your authorized scope.');
      return;
    }

    let active = true;
    const loadPatients = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch('/api/v1/patients', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || 'Unable to load your authorized patients.');
        }
        if (active) setPatients(payload.data?.patients || []);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your authorized patients.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPatients();
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    if (initialPatientId && patients.some((patient) => patient.patientId === initialPatientId)) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId, patients]);

  const selectedPatient = patients.find((patient) => patient.patientId === selectedPatientId);

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h2 style={{ margin: 0 }}>AI Screening for My Patients</h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
          Choose a patient from your authorized list. Ask for consent before taking or analyzing screening photos.
        </p>
      </header>

      {loading && <p role="status">Loading your authorized patient list...</p>}
      {loadError && <p role="alert" style={{ color: 'var(--color-status-danger)' }}>{loadError}</p>}

      {!loading && !loadError && patients.length === 0 && (
        <div>
          <p>No patients are available in your assigned scope yet. Register or open a patient from My Patients first.</p>
          <button type="button" className="btn btn-primary" onClick={onGoToPatients}>Open My Patients</button>
        </div>
      )}

      {patients.length > 0 && (
        <>
          <div className="form-group">
            <label htmlFor="field-worker-screening-patient" className="form-label">Patient profile</label>
            <select
              id="field-worker-screening-patient"
              className="form-select"
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              required
            >
              <option value="">Select a patient</option>
              {patients.map((patient) => (
                <option key={patient.patientId} value={patient.patientId}>
                  {patient.fullName} · {patient.patientId}
                </option>
              ))}
            </select>
          </div>

          {selectedPatient && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 14, border: '1px solid var(--color-border)', borderRadius: 10 }}>
                <div><strong>{selectedPatient.fullName}</strong> · {selectedPatient.patientId}</div>
                <div>{selectedPatient.ageEstimated} yrs · {selectedPatient.gender}</div>
                <div>{selectedPatient.villageName}, {selectedPatient.mandal}</div>
                <div>Check-up: {(selectedPatient.flow?.screening || 'not_started').replace(/_/g, ' ')}</div>
                <div>AI review: {(selectedPatient.flow?.aiScreening?.status || 'not_started').replace(/_/g, ' ')}</div>
                <div>Referral: {(selectedPatient.flow?.referral || 'not_referred').replace(/_/g, ' ')}</div>
                <div>Appointment: {(selectedPatient.flow?.appointment || 'not_booked').replace(/_/g, ' ')}</div>
              </div>

              <AiOralHealthEngine
                key={selectedPatient.patientId}
                patientId={selectedPatient.patientId}
                patientName={selectedPatient.fullName}
                hospitalId={selectedPatient.hospitalId || currentUser?.hospitalId}
                userRole={currentUser?.role?.toLowerCase() || ''}
                token={accessToken || ''}
                currentLang={currentLang}
                onClose={() => setSelectedPatientId('')}
              />
            </>
          )}
        </>
      )}
    </section>
  );
};
