import mongoose, { Schema, Document } from 'mongoose';

export type TeleconsultationStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

// --------------------------------------------------------------------------
// Entity 1: Teleconsultation Session Master Record
// --------------------------------------------------------------------------
export interface ITeleconsultationDocument extends Document {
  consultationId: string;
  patientId: string;
  patientName?: string;
  requestedBy: string;
  requesterRole: string;
  hospitalId: string;
  assignedClinicianId: string;
  assignedClinicianName?: string;
  assignedClinicianRole: string;
  screeningCaseId?: string;
  appointmentId?: string;
  status: TeleconsultationStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  channelConfig: {
    videoStatus: 'BLOCKED';
    voiceStatus: 'BLOCKED';
    textChatStatus: 'ACTIVE';
  };
  release?: {
    isReleased: boolean;
    releasedAt?: Date;
    releasedBy?: string;
    patientSummaryMessage?: string;
    recommendedAction?: string;
  };
  isUrgent?: boolean;
  urgencyDetails?: {
    urgencyReason: string;
    symptomDurationDays?: number;
    doctorNotificationDispatched: boolean;
    urgentStatus: 'REQUESTED' | 'ACKNOWLEDGED' | 'TRIAGED' | 'RESOLVED';
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    emergencyInstructions: string[];
    hospitalEmergencyContact: string;
  };
  cancellation?: {
    cancelledBy: string;
    reason: string;
    cancelledAt: Date;
  };
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const TeleconsultationSchema = new Schema<ITeleconsultationDocument>(
  {
    consultationId: {
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
      trim: true,
    },
    requestedBy: {
      type: String,
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      required: true,
    },
    hospitalId: {
      type: String,
      required: true,
      index: true, // Key index for cross-hospital scoping
    },
    assignedClinicianId: {
      type: String,
      required: true,
      index: true, // Only assigned clinician writes notes
    },
    assignedClinicianName: {
      type: String,
      trim: true,
    },
    assignedClinicianRole: {
      type: String,
      required: true,
      default: 'medical_officer',
    },
    screeningCaseId: {
      type: String,
      index: true,
    },
    appointmentId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'REQUESTED',
      index: true,
    },
    scheduledAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    channelConfig: {
      videoStatus: { type: String, default: 'BLOCKED', immutable: true },
      voiceStatus: { type: String, default: 'BLOCKED', immutable: true },
      textChatStatus: { type: String, default: 'ACTIVE', immutable: true },
    },
    release: {
      isReleased: { type: Boolean, default: false },
      releasedAt: { type: Date },
      releasedBy: { type: String },
      patientSummaryMessage: { type: String },
      recommendedAction: { type: String },
    },
    isUrgent: { type: Boolean, default: false, index: true },
    urgencyDetails: {
      urgencyReason: { type: String },
      symptomDurationDays: { type: Number },
      doctorNotificationDispatched: { type: Boolean, default: false },
      urgentStatus: {
        type: String,
        enum: ['REQUESTED', 'ACKNOWLEDGED', 'TRIAGED', 'RESOLVED'],
        default: 'REQUESTED',
      },
      acknowledgedBy: { type: String },
      acknowledgedAt: { type: Date },
      emergencyInstructions: [{ type: String }],
      hospitalEmergencyContact: { type: String, default: '108 (Free Emergency Ambulance) / CHC Paderu: +91 8935-254108' },
    },
    cancellation: {
      cancelledBy: { type: String },
      reason: { type: String },
      cancelledAt: { type: Date },
    },
    simulation: {
      type: Boolean,
      default: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

TeleconsultationSchema.index({ hospitalId: 1, status: 1 });
TeleconsultationSchema.index({ assignedClinicianId: 1, status: 1 });
TeleconsultationSchema.index({ patientId: 1, status: 1 });

export const Teleconsultation =
  mongoose.models.Teleconsultation ||
  mongoose.model<ITeleconsultationDocument>('Teleconsultation', TeleconsultationSchema);

// --------------------------------------------------------------------------
// Entity 2: Clinical Consultation Notes (Immutable & Versioned with SHA-256)
// --------------------------------------------------------------------------
export interface INoteAmendment {
  version: number;
  noteText: string;
  hash: string;
  amendedBy: string;
  amendedAt: Date;
  amendmentReason: string;
}

export interface IConsultationNoteDocument extends Document {
  noteId: string;
  consultationId: string;
  clinicianId: string;
  clinicianName: string;
  clinicianRole: string;
  currentVersion: number;
  originalNoteText: string;
  originalHash: string;
  currentNoteText: string;
  currentHash: string;
  notesHistory: INoteAmendment[];
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationNoteSchema = new Schema<IConsultationNoteDocument>(
  {
    noteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    consultationId: {
      type: String,
      required: true,
      index: true,
    },
    clinicianId: {
      type: String,
      required: true,
      index: true,
    },
    clinicianName: {
      type: String,
      required: true,
    },
    clinicianRole: {
      type: String,
      required: true,
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    originalNoteText: {
      type: String,
      required: true,
    },
    originalHash: {
      type: String,
      required: true,
    },
    currentNoteText: {
      type: String,
      required: true,
    },
    currentHash: {
      type: String,
      required: true,
    },
    notesHistory: [
      {
        version: { type: Number, required: true },
        noteText: { type: String, required: true },
        hash: { type: String, required: true },
        amendedBy: { type: String, required: true },
        amendedAt: { type: Date, default: Date.now },
        amendmentReason: { type: String, required: true },
      },
    ],
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const ConsultationNote =
  mongoose.models.ConsultationNote ||
  mongoose.model<IConsultationNoteDocument>('ConsultationNote', ConsultationNoteSchema);

// --------------------------------------------------------------------------
// Entity 3: Staff-Only Text Discussion Messages
// --------------------------------------------------------------------------
export interface IConsultationMessageDocument extends Document {
  messageId: string;
  consultationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  messageText: string;
  createdAt: Date;
}

const ConsultationMessageSchema = new Schema<IConsultationMessageDocument>(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    consultationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
    },
    messageText: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ConsultationMessage =
  mongoose.models.ConsultationMessage ||
  mongoose.model<IConsultationMessageDocument>('ConsultationMessage', ConsultationMessageSchema);
