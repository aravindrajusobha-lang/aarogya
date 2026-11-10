import mongoose, { Schema, Document } from 'mongoose';

export interface IPatientHistory {
  timestamp: Date;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}

export interface IPatient extends Document {
  patientId: string;
  fullName: string;
  name?: string;
  gender: 'male' | 'female' | 'other';
  ageEstimated: number;
  age?: number;
  phone?: string;
  guardianName?: string;
  subcenter?: mongoose.Types.ObjectId;
  villageId: string;
  villageName: string;
  mandal: string;
  district: string;
  originalAddressText: string;
  emergencyContact?: string;
  caregiverDetails?: string;
  maskedAadhaar?: string;
  registrationMethod?: 'aadhaar_assisted' | 'manual' | 'health_worker_assisted';
  consentObtained?: boolean;
  hospitalId: string;
  registeredBy: string;
  registeredAt: Date;
  isDuplicateCandidate: boolean;
  duplicateReviewStatus: 'none' | 'pending_review' | 'confirmed_distinct' | 'merged_manual';
  duplicateCandidateOf?: string;
  matchScore?: number;
  matchReasons: string[];
  history: IPatientHistory[];
  clientMutationId?: string;
  simulation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PatientHistorySchema = new Schema<IPatientHistory>(
  {
    timestamp: { type: Date, default: Date.now },
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const PatientSchema = new Schema<IPatient>(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true, index: true },
    name: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    ageEstimated: { type: Number, required: true, min: 1, max: 120 },
    age: { type: Number, min: 1, max: 120 },
    phone: { type: String, trim: true, sparse: true, index: true },
    guardianName: { type: String, trim: true },
    subcenter: { type: Schema.Types.ObjectId, ref: 'Subcenter' },
    villageId: { type: String, required: true, index: true },
    villageName: { type: String, required: true },
    mandal: { type: String, required: true, index: true },
    district: { type: String, default: 'Alluri Sitharama Raju' },
    originalAddressText: { type: String, required: true },
    emergencyContact: { type: String, trim: true },
    caregiverDetails: { type: String, trim: true },
    maskedAadhaar: { type: String, trim: true },
    registrationMethod: {
      type: String,
      enum: ['aadhaar_assisted', 'manual', 'health_worker_assisted'],
      default: 'manual',
    },
    consentObtained: { type: Boolean, default: true },
    hospitalId: { type: String, required: true, index: true },
    registeredBy: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now },
    isDuplicateCandidate: { type: Boolean, default: false, index: true },
    duplicateReviewStatus: {
      type: String,
      enum: ['none', 'pending_review', 'confirmed_distinct', 'merged_manual'],
      default: 'none',
      index: true,
    },
    duplicateCandidateOf: { type: String, sparse: true },
    matchScore: { type: Number },
    matchReasons: { type: [String], default: [] },
    history: { type: [PatientHistorySchema], default: [] },
    clientMutationId: { type: String, unique: true, sparse: true, index: true },
    simulation: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Seamless sync between fullName/name and ageEstimated/age
PatientSchema.pre('validate', function (next) {
  if (!this.name && this.fullName) {
    this.name = this.fullName;
  }
  if (!this.fullName && this.name) {
    this.fullName = this.name;
  }
  if (!this.age && this.ageEstimated) {
    this.age = this.ageEstimated;
  }
  if (!this.ageEstimated && this.age) {
    this.ageEstimated = this.age;
  }
  next();
});

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
