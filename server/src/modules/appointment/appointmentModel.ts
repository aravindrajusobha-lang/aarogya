import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'rescheduled'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'no_show';

export type AppointmentType =
  | 'screening_review'
  | 'clinical_consultation'
  | 'specialist_referral'
  | 'routine_follow_up'
  | 'biopsy_procedure';

export interface IAppointmentRequester {
  userId: string;
  role: string;
  name?: string;
}

export interface IAppointmentConfirmation {
  userId: string;
  role: string;
  name?: string;
  confirmedAt: Date;
}

export interface IAppointmentCancellation {
  cancelledBy: string;
  reason: string;
  cancelledAt: Date;
}

export interface IReschedulingRecord {
  previousSlotStart: Date;
  previousSlotEnd: Date;
  newSlotStart: Date;
  newSlotEnd: Date;
  rescheduledBy: string;
  rescheduledAt: Date;
  reason?: string;
}

export interface IStatusHistoryEntry {
  status: string;
  changedBy: string;
  time: Date;
  note?: string;
}

export interface IAppointmentDocument extends Document {
  appointmentId: string;
  appointmentCode?: string;
  consultationMode?: 'online' | 'offline';
  patientId: string;
  patientName?: string;
  destinationHospitalId: string;
  destinationHospitalName?: string;
  hospitalId?: string;
  department: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  preferredDoctorId?: string;
  screeningId?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  conditionCategory?: string;
  suggestedDoctorType?: string;
  slotStartTime: Date;
  slotEndTime: Date;
  scheduledAt?: Date;
  durationMinutes: number;
  status: AppointmentStatus | string;
  type: AppointmentType | string;
  reason?: string;
  patientNote?: string;
  declineReason?: string;
  requestedBy: IAppointmentRequester;
  confirmedBy?: IAppointmentConfirmation;
  cancellation?: IAppointmentCancellation;
  reschedulingHistory: IReschedulingRecord[];
  statusHistory: IStatusHistoryEntry[];
  proposedReschedule?: {
    newSlotStart: Date;
    newSlotEnd?: Date;
    proposedBy: string;
    proposedAt: Date;
    reason?: string;
    status?: 'pending' | 'accepted' | 'declined';
  };
  idempotencyKey?: string;
  clientRequestId?: string;
  offlineQueued: boolean;
  notificationId?: string;
  notes?: string;
  consultationSummary?: string;
  visitDetails?: Record<string, any>;
  videoInvite?: {
    tokenHash: string;
    issuedBy: string;
    issuedAt: Date;
    expiresAt: Date;
    revokedAt?: Date;
  };
  video?: {
    url?: string;
    validFrom?: Date;
    validUntil?: Date;
    roomId?: string;
    provider?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointmentDocument>(
  {
    appointmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    appointmentCode: { type: String, index: true },
    consultationMode: { type: String, enum: ['online', 'offline'] },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    patientName: {
      type: String,
    },
    destinationHospitalId: {
      type: String,
      required: true,
      index: true,
    },
    destinationHospitalName: {
      type: String,
    },
    hospitalId: { type: String },
    department: {
      type: String,
      default: 'Oral Health OPD',
    },
    assignedDoctorId: {
      type: String,
      index: true,
    },
    assignedDoctorName: {
      type: String,
    },
    preferredDoctorId: { type: String },
    screeningId: { type: String },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
    conditionCategory: { type: String },
    suggestedDoctorType: { type: String },
    slotStartTime: {
      type: Date,
      required: true,
      index: true,
    },
    slotEndTime: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledAt: { type: Date },
    durationMinutes: {
      type: Number,
      required: true,
      default: 20,
    },
    status: {
      type: String,
      default: 'requested',
      index: true,
    },
    type: {
      type: String,
      default: 'clinical_consultation',
    },
    reason: {
      type: String,
    },
    patientNote: { type: String, maxlength: 2000 },
    declineReason: { type: String, maxlength: 1000 },
    requestedBy: {
      userId: { type: String, required: true },
      role: { type: String, required: true },
      name: { type: String },
    },
    confirmedBy: {
      userId: { type: String },
      role: { type: String },
      name: { type: String },
      confirmedAt: { type: Date },
    },
    cancellation: {
      cancelledBy: { type: String },
      reason: { type: String },
      cancelledAt: { type: Date },
    },
    reschedulingHistory: [
      {
        previousSlotStart: { type: Date, required: true },
        previousSlotEnd: { type: Date, required: true },
        newSlotStart: { type: Date, required: true },
        newSlotEnd: { type: Date, required: true },
        rescheduledBy: { type: String, required: true },
        rescheduledAt: { type: Date, default: Date.now },
        reason: { type: String },
      },
    ],
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        time: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    proposedReschedule: {
      newSlotStart: { type: Date },
      newSlotEnd: { type: Date },
      proposedBy: { type: String },
      proposedAt: { type: Date },
      reason: { type: String },
      status: { type: String },
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    clientRequestId: {
      type: String,
      sparse: true,
      index: true,
    },
    offlineQueued: {
      type: Boolean,
      default: false,
    },
    notificationId: {
      type: String,
    },
    notes: {
      type: String,
    },
    consultationSummary: { type: String },
    visitDetails: { type: Schema.Types.Mixed },
    videoInvite: {
      tokenHash: { type: String },
      issuedBy: { type: String },
      issuedAt: { type: Date },
      expiresAt: { type: Date },
      revokedAt: { type: Date },
    },
    video: {
      url: { type: String },
      validFrom: { type: Date },
      validUntil: { type: Date },
      roomId: { type: String },
      provider: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Compound partial unique index to prevent double bookings on active slots.
// Scoped per doctor: two doctors at one facility can see patients at the same time;
// OPD bookings without an assigned doctor (assignedDoctorId null) stay facility-wide.
export const APPOINTMENT_SLOT_INDEX_NAME = 'uniq_active_slot_per_doctor';
export const LEGACY_APPOINTMENT_SLOT_INDEX_NAME = 'destinationHospitalId_1_slotStartTime_1_slotEndTime_1';
AppointmentSchema.index(
  { destinationHospitalId: 1, assignedDoctorId: 1, slotStartTime: 1, slotEndTime: 1 },
  {
    name: APPOINTMENT_SLOT_INDEX_NAME,
    unique: true,
    partialFilterExpression: {
      status: { $in: ['requested', 'confirmed', 'checked_in'] },
    },
  }
);

export const Appointment =
  mongoose.models.Appointment ||
  mongoose.model<IAppointmentDocument>('Appointment', AppointmentSchema);
