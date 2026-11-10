import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface AppointmentManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'rescheduled'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface AppointmentRecord {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  destinationHospitalId: string;
  destinationHospitalName?: string;
  department: string;
  slotStartTime: string;
  slotEndTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  type: string;
  reason?: string;
  requestedBy: {
    userId: string;
    role: string;
    name?: string;
  };
  confirmedBy?: {
    userId: string;
    role: string;
    name?: string;
    confirmedAt: string;
  };
  cancellation?: {
    cancelledBy: string;
    reason: string;
    cancelledAt: string;
  };
  reschedulingHistory?: Array<{
    previousSlotStart: string;
    previousSlotEnd: string;
    newSlotStart: string;
    newSlotEnd: string;
    rescheduledBy: string;
    reason?: string;
  }>;
  idempotencyKey?: string;
  offlineQueued?: boolean;
}

export interface SlotView {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  existingAppointmentId?: string;
}

export const AppointmentManager: React.FC<AppointmentManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Slot query state
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
    currentUser?.hospitalId || 'hosp_paderu_dh'
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<SlotView[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);

  // New Appointment Form State
  const [showBookModal, setShowBookModal] = useState<boolean>(false);
  const [patientId, setPatientId] = useState<string>('PAT-PAD-2026-0042');
  const [patientName, setPatientName] = useState<string>('Somulu Killo');
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('');
  const [consultType, setConsultType] = useState<string>('clinical_consultation');
  const [reason, setReason] = useState<string>('Frontline oral visual inspection follow-up');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    `offline_batch_${Date.now()}`
  );

  // Reschedule & Cancel Modal State
  const [activeAppointment, setActiveAppointment] = useState<AppointmentRecord | null>(null);
  const [rescheduleSlotTime, setRescheduleSlotTime] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('Tribal agency transit delay');
  const [cancelReason, setCancelReason] = useState<string>('Patient requested appointment cancellation');

  const fetchAppointments = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const url =
        filterStatus === 'all'
          ? '/api/v1/appointments'
          : `/api/v1/appointments?status=${filterStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAppointments(json.data.appointments || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    if (!accessToken) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/appointments/slots?date=${selectedDate}T10:00:00.000Z&hospitalId=${selectedHospitalId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const json = await res.json();
      if (json.success && json.data) {
        setAvailableSlots(json.data.slots || []);
        if (json.data.slots && json.data.slots.length > 0 && !selectedSlotTime) {
          const firstAvail = json.data.slots.find((s: SlotView) => s.isAvailable);
          if (firstAvail) setSelectedSlotTime(firstAvail.startTime);
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [accessToken, filterStatus]);

  useEffect(() => {
    fetchSlots();
  }, [accessToken, selectedDate, selectedHospitalId]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!selectedSlotTime) {
      setMessage({ text: 'Please select an available consultation slot', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientId,
          patientName,
          destinationHospitalId: selectedHospitalId,
          slotStartTime: selectedSlotTime,
          type: consultType,
          reason,
          idempotencyKey: idempotencyKey || undefined,
          offlineQueued: Boolean(idempotencyKey),
        }),
      });

      const json = await res.json();
      if (json.success) {
        const replayMsg = json.data.idempotentReplay ? ' (Idempotent replay detected)' : '';
        setMessage({
          text: `Appointment booked successfully! Status: REQUESTED${replayMsg}. SMS & Email shown as BLOCKED stubs.`,
          type: 'success',
        });
        setShowBookModal(false);
        await fetchAppointments();
        await fetchSlots();
      } else {
        setMessage({ text: json.error?.message || 'Booking failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (aptId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/appointments/${aptId}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          text: 'Appointment confirmed by destination facility! Status changed to CONFIRMED.',
          type: 'success',
        });
        await fetchAppointments();
      } else {
        setMessage({
          text: `Confirmation Denied (${json.error?.code}): ${json.error?.message}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleReschedule = async (aptId: string) => {
    if (!accessToken) return;
    if (!rescheduleSlotTime) {
      setMessage({ text: 'Please select a new time slot', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`/api/v1/appointments/${aptId}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          newSlotStartTime: rescheduleSlotTime,
          reason: rescheduleReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Appointment successfully rescheduled!', type: 'success' });
        setActiveAppointment(null);
        await fetchAppointments();
        await fetchSlots();
      } else {
        setMessage({ text: json.error?.message || 'Reschedule failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCancel = async (aptId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/appointments/${aptId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Appointment successfully cancelled.', type: 'success' });
        setActiveAppointment(null);
        await fetchAppointments();
        await fetchSlots();
      } else {
        setMessage({ text: json.error?.message || 'Cancellation failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner (Reference: Flash Card Study App panel) */}
      <div className="card hero progress-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>
              <span className="eyebrow-dot" style={{ background: 'var(--coral)' }} />
              <span>HOSPITAL APPOINTMENTS • ఆసుపత్రి అపాయింట్‌మెంట్లు</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--slate)' }}>
              OPD Appointments & Slot Governance
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '820px', margin: 0, lineHeight: 1.5 }}>
              ACID-compliant time slot booking across ITDA Paderu hospital network (District Hospital, Area Hospital, CHCs, and PHCs). 
              Confirmation restricted to destination facility officers. Self-confirmation is strictly blocked.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="button-outline"
              onClick={() => {
                fetchAppointments();
                fetchSlots();
              }}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh Slots
            </button>
            <button
              type="button"
              className="button-coral"
              onClick={() => setShowBookModal(true)}
              style={{ fontSize: '0.85rem' }}
            >
              + Book New Slot
            </button>
          </div>
        </div>
      </div>

      {!accessToken && (
        <LoginRequiredView
          moduleTitle="OPD Appointments Scheduling"
          moduleDescription="Sign in with demo credentials to view available hospital time slots, schedule specialist consultations, and confirm patient bookings."
          onLoginAsAsha={onRequireLogin ? () => onRequireLogin('asha') : undefined}
          onLoginAsDoctor={onRequireLogin ? () => onRequireLogin('doctor') : undefined}
          onGoToAuth={onGoToAuth}
        />
      )}

      {/* Action Notification Banner */}
      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header and Slot Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Consultation Appointments</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Outpatient department scheduling with transactional conflict protection (09:00 - 16:00, Mon-Sat)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="confirmed">Confirmed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setShowBookModal(true)}
          >
            ➕ Book Appointment
          </button>

          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.85rem' }}
            onClick={() => {
              fetchAppointments();
              fetchSlots();
            }}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* OPD Slots Inspector */}
      <div
        className="card"
        style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Facility 20-Min OPD Slot Availability
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
            >
              <option value="hosp_paderu_dh">Paderu District Hospital</option>
              <option value="hosp_araku_chc">Araku Valley CHC</option>
              <option value="hosp_chintapalli_chc">Chintapalli CHC</option>
            </select>
            <input
              type="date"
              className="form-input"
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {slotsLoading ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Loading slots...</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {availableSlots.map((slot, idx) => {
              const startStr = new Date(slot.startTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endStr = new Date(slot.endTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={idx}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    border: slot.isAvailable ? '1px solid #10b981' : '1px solid #d1d5db',
                    backgroundColor: slot.isAvailable ? '#ecfdf5' : '#f3f4f6',
                    color: slot.isAvailable ? '#065f46' : '#6b7280',
                    cursor: slot.isAvailable ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  onClick={() => {
                    if (slot.isAvailable) {
                      setSelectedSlotTime(slot.startTime);
                      setShowBookModal(true);
                    }
                  }}
                  title={slot.isAvailable ? 'Click to book this slot' : 'Slot already booked'}
                >
                  <span style={{ fontWeight: 600 }}>{startStr} - {endStr}</span>
                  <span style={{ fontSize: '0.65rem' }}>{slot.isAvailable ? '✓ Open' : '✕ Booked'}</span>
                </div>
              );
            })}
            {availableSlots.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: '#991b1b', padding: '8px' }}>
                No outpatient slots on Sundays or selected date. Facility OPD is closed.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <section className="card" style={{ border: '2px solid var(--color-brand-accent)' }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Book Consultation Appointment</h3>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              onClick={() => setShowBookModal(false)}
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleBookAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Patient ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Patient Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Destination Facility</label>
                <select
                  className="form-select"
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                >
                  <option value="hosp_paderu_dh">Paderu District Hospital</option>
                  <option value="hosp_araku_chc">Araku Valley CHC</option>
                  <option value="hosp_chintapalli_chc">Chintapalli CHC</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Selected 20-Min Slot</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedSlotTime ? new Date(selectedSlotTime).toLocaleString() : ''}
                  placeholder="Select from slot inspector"
                  readOnly
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Consultation Type</label>
                <select
                  className="form-select"
                  value={consultType}
                  onChange={(e) => setConsultType(e.target.value)}
                >
                  <option value="clinical_consultation">Clinical Consultation</option>
                  <option value="screening_review">Screening Review</option>
                  <option value="specialist_referral">Specialist Referral</option>
                  <option value="routine_follow_up">Routine Follow-up</option>
                  <option value="biopsy_procedure">Biopsy Procedure</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Idempotency / Offline Queue Key</label>
                <input
                  type="text"
                  className="form-input"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  placeholder="Unique client token for replay protection"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Clinical Reason / Operational Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowBookModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Submitting...' : '💾 Submit Appointment Request'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Appointments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {appointments.map((apt) => {
          const slotStartStr = new Date(apt.slotStartTime).toLocaleString();
          const slotEndStr = new Date(apt.slotEndTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={apt.appointmentId}
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {apt.patientName ? `${apt.patientName} (${apt.patientId})` : apt.patientId}
                    </span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          apt.status === 'confirmed'
                            ? '#10b981'
                            : apt.status === 'requested'
                            ? '#f59e0b'
                            : apt.status === 'rescheduled'
                            ? '#3b82f6'
                            : apt.status === 'checked_in'
                            ? '#8b5cf6'
                            : apt.status === 'completed'
                            ? '#6b7280'
                            : '#ef4444',
                        color: '#fff',
                      }}
                    >
                      {apt.status.toUpperCase()}
                    </span>
                    <span className="badge badge-real">{apt.appointmentId}</span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Destination Facility: <strong>{apt.destinationHospitalName || apt.destinationHospitalId}</strong> | Department: <strong>{apt.department}</strong> | Type: <strong>{apt.type}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                  <div>Slot Time: <strong>{slotStartStr} – {slotEndStr}</strong> ({apt.durationMinutes} mins)</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    Requested By: {apt.requestedBy.name || apt.requestedBy.userId} ({apt.requestedBy.role})
                  </div>
                </div>
              </div>

              {/* Reason & Confirmation details */}
              <div style={{ fontSize: '0.82rem', display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--color-text-secondary)' }}>
                {apt.reason && <div>📝 Reason: {apt.reason}</div>}
                {apt.confirmedBy && (
                  <div>
                    ✓ Confirmed by: <strong>{apt.confirmedBy.name || apt.confirmedBy.userId}</strong> ({new Date(apt.confirmedBy.confirmedAt).toLocaleDateString()})
                  </div>
                )}
                {apt.cancellation && (
                  <div style={{ color: '#ef4444' }}>
                    ✕ Cancelled by {apt.cancellation.cancelledBy}: {apt.cancellation.reason}
                  </div>
                )}
              </div>

              {/* Phase 5 Simulation Notification Status Bar */}
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 600 }}>Multi-Channel Dispatch:</span>
                <span>📱 In-App: <strong style={{ color: '#10b981' }}>Delivered</strong></span>
                <span>✉️ SMS: <strong style={{ color: '#d97706' }}>BLOCKED STUB (Simulation)</strong></span>
                <span>📧 Email: <strong style={{ color: '#d97706' }}>BLOCKED STUB (Simulation)</strong></span>
              </div>

              {/* Actions Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                {(apt.status === 'requested' || apt.status === 'rescheduled') && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '4px 12px', backgroundColor: '#10b981' }}
                    onClick={() => handleConfirm(apt.appointmentId)}
                  >
                    ✓ Confirm Appointment
                  </button>
                )}

                {(apt.status === 'requested' || apt.status === 'confirmed') && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    onClick={() => {
                      setActiveAppointment(apt);
                      setRescheduleSlotTime('');
                    }}
                  >
                    🔄 Reschedule
                  </button>
                )}

                {(apt.status === 'requested' || apt.status === 'confirmed' || apt.status === 'rescheduled') && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '4px 10px', color: '#ef4444' }}
                    onClick={() => setActiveAppointment(apt)}
                  >
                    ⚠️ Cancel
                  </button>
                )}
              </div>

              {/* Expandable Reschedule / Cancel Panel */}
              {activeAppointment?.appointmentId === apt.appointmentId && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    border: '1px solid var(--color-border)',
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Reschedule Appointment</div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      type="datetime-local"
                      className="form-input"
                      style={{ fontSize: '0.8rem' }}
                      value={rescheduleSlotTime}
                      onChange={(e) => setRescheduleSlotTime(new Date(e.target.value).toISOString())}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8rem', flex: 1 }}
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      placeholder="Reschedule reason..."
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => handleReschedule(apt.appointmentId)}
                    >
                      Confirm Reschedule
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#dc2626' }}>Cancel Appointment</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.8rem', flex: 1 }}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Cancellation reason..."
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', color: '#dc2626' }}
                        onClick={() => handleCancel(apt.appointmentId)}
                      >
                        Confirm Cancellation
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => setActiveAppointment(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {appointments.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            No consultation appointments found for this filter.
          </div>
        )}
      </div>
    </div>
  );
};
