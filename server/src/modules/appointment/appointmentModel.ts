import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'rescheduled'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
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

export interface IAppointmentDocument extends Document {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  destinationHospitalId: string;
  destinationHospitalName?: string;
  department: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  slotStartTime: Date;
  slotEndTime: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  type: AppointmentType;
  reason?: string;
  requestedBy: IAppointmentRequester;
  confirmedBy?: IAppointmentConfirmation;
  cancellation?: IAppointmentCancellation;
  reschedulingHistory: IReschedulingRecord[];
  idempotencyKey?: string;
  clientRequestId?: string;
  offlineQueued: boolean;
  notificationId?: string;
  notes?: string;
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
    durationMinutes: {
      type: Number,
      required: true,
      default: 20,
    },
    status: {
      type: String,
      enum: [
        'requested',
        'confirmed',
        'rescheduled',
        'checked_in',
        'completed',
        'cancelled',
        'no_show',
      ],
      default: 'requested',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'screening_review',
        'clinical_consultation',
        'specialist_referral',
        'routine_follow_up',
        'biopsy_procedure',
      ],
      default: 'clinical_consultation',
    },
    reason: {
      type: String,
    },
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
  },
  {
    timestamps: true,
  }
);

// Compound partial unique index to prevent double bookings on active slots
AppointmentSchema.index(
  { destinationHospitalId: 1, slotStartTime: 1, slotEndTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['requested', 'confirmed', 'checked_in'] },
    },
  }
);

export const Appointment =
  mongoose.models.Appointment ||
  mongoose.model<IAppointmentDocument>('Appointment', AppointmentSchema);
