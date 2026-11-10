import mongoose, { Schema, Document } from 'mongoose';

export type BiopsyStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'COLLECTED'
  | 'SENT_TO_LAB'
  | 'RESULT_RECEIVED'
  | 'RECOLLECTION_REQUIRED'
  | 'CANCELLED';

export interface IAttachmentAmendment {
  version: number;
  amendedFileId: string;
  amendedSha256: string;
  amendedBy: string;
  amendedAt: Date;
  reason: string;
}

export interface IBiopsyAttachment {
  originalFileId: string;
  originalSha256: string;
  currentFileId: string;
  currentSha256: string;
  version: number;
  amendmentHistory: IAttachmentAmendment[];
}

export interface IBiopsyDocument extends Document {
  biopsyId: string;
  patientId: string;
  patientName?: string;
  hospitalId: string;
  screeningCaseId?: string;
  status: BiopsyStatus;
  anatomicalLocation: string;
  procedureDate?: Date;
  requestingDoctorId: string;
  requestingDoctorName?: string;
  scheduledHospitalId?: string;
  collectionDetails?: {
    collectedAt: Date;
    collectedBy: string;
    specimenBarcode: string;
    fixative: string;
    tissueType: string;
  };
  transitDetails?: {
    dispatchedAt: Date;
    dispatchedBy: string;
    destinationLabName: string;
    courierTrackingId?: string;
  };
  recollectionDetails?: {
    flaggedAt: Date;
    flaggedBy: string;
    reason: string;
    cycleCount: number;
  };
  labAttachment?: IBiopsyAttachment;
  findingsId?: string;
  releaseId?: string;
  cancellation?: {
    cancelledBy: string;
    reason: string;
    cancelledAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BiopsySchema = new Schema<IBiopsyDocument>(
  {
    biopsyId: {
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
    hospitalId: {
      type: String,
      required: true,
      index: true,
    },
    screeningCaseId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'SCHEDULED',
        'COLLECTED',
        'SENT_TO_LAB',
        'RESULT_RECEIVED',
        'RECOLLECTION_REQUIRED',
        'CANCELLED',
      ],
      default: 'REQUESTED',
      index: true,
    },
    anatomicalLocation: {
      type: String,
      required: true,
    },
    procedureDate: {
      type: Date,
    },
    requestingDoctorId: {
      type: String,
      required: true,
    },
    requestingDoctorName: {
      type: String,
    },
    scheduledHospitalId: {
      type: String,
    },
    collectionDetails: {
      collectedAt: { type: Date },
      collectedBy: { type: String },
      specimenBarcode: { type: String },
      fixative: { type: String, default: '10% Neutral Buffered Formalin' },
      tissueType: { type: String },
    },
    transitDetails: {
      dispatchedAt: { type: Date },
      dispatchedBy: { type: String },
      destinationLabName: { type: String },
      courierTrackingId: { type: String },
    },
    recollectionDetails: {
      flaggedAt: { type: Date },
      flaggedBy: { type: String },
      reason: { type: String },
      cycleCount: { type: Number, default: 0 },
    },
    labAttachment: {
      originalFileId: { type: String },
      originalSha256: { type: String },
      currentFileId: { type: String },
      currentSha256: { type: String },
      version: { type: Number, default: 1 },
      amendmentHistory: [
        {
          version: { type: Number, required: true },
          amendedFileId: { type: String, required: true },
          amendedSha256: { type: String, required: true },
          amendedBy: { type: String, required: true },
          amendedAt: { type: Date, default: Date.now },
          reason: { type: String, required: true },
        },
      ],
    },
    findingsId: {
      type: String,
      index: true,
    },
    releaseId: {
      type: String,
      index: true,
    },
    cancellation: {
      cancelledBy: { type: String },
      reason: { type: String },
      cancelledAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

export const Biopsy =
  mongoose.models.Biopsy || mongoose.model<IBiopsyDocument>('Biopsy', BiopsySchema);
export const BiopsyRecord = Biopsy;

// --------------------------------------------------------------------------
// Separate Entity 2: Biopsy Findings (Entered strictly by qualified staff)
// --------------------------------------------------------------------------
export interface IBiopsyFindingsDocument extends Document {
  findingsId: string;
  biopsyId: string;
  patientId: string;
  hospitalId: string;
  pathologistId: string;
  pathologistName: string;
  specimenAdequacy: string;
  grossDescription: string;
  microscopicObservations: string;
  pathologistImpression: string;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BiopsyFindingsSchema = new Schema<IBiopsyFindingsDocument>(
  {
    findingsId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    biopsyId: {
      type: String,
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    hospitalId: {
      type: String,
      required: true,
      index: true,
    },
    pathologistId: {
      type: String,
      required: true,
    },
    pathologistName: {
      type: String,
      required: true,
    },
    specimenAdequacy: {
      type: String,
      required: true,
    },
    grossDescription: {
      type: String,
      required: true,
    },
    microscopicObservations: {
      type: String,
      required: true,
    },
    pathologistImpression: {
      type: String,
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const BiopsyFindings =
  mongoose.models.BiopsyFindings ||
  mongoose.model<IBiopsyFindingsDocument>('BiopsyFindings', BiopsyFindingsSchema);

// --------------------------------------------------------------------------
// Separate Entity 3: Result Release (Gated patient disclosure)
// --------------------------------------------------------------------------
export interface IBiopsyResultReleaseDocument extends Document {
  releaseId: string;
  biopsyId: string;
  findingsId: string;
  patientId: string;
  hospitalId: string;
  releasedBy: string;
  releasedByName?: string;
  reviewerNotes: string;
  patientSummaryMessage: string;
  recommendedAction: string;
  status: 'released';
  releasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BiopsyResultReleaseSchema = new Schema<IBiopsyResultReleaseDocument>(
  {
    releaseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    biopsyId: {
      type: String,
      required: true,
      index: true,
    },
    findingsId: {
      type: String,
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    hospitalId: {
      type: String,
      required: true,
      index: true,
    },
    releasedBy: {
      type: String,
      required: true,
    },
    releasedByName: {
      type: String,
    },
    reviewerNotes: {
      type: String,
      default: '',
    },
    patientSummaryMessage: {
      type: String,
      required: true,
    },
    recommendedAction: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['released'],
      default: 'released',
    },
    releasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const BiopsyResultRelease =
  mongoose.models.BiopsyResultRelease ||
  mongoose.model<IBiopsyResultReleaseDocument>(
    'BiopsyResultRelease',
    BiopsyResultReleaseSchema
  );
