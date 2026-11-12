import mongoose, { Schema, Document } from 'mongoose';

export interface ITreatmentPlan extends Document {
  treatmentPlanId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  prescriptionId: string;
  clinicianAssessment: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  medicines: ITreatmentMedicine[];
  procedures: ITreatmentProcedure[];
  followUps: ITreatmentFollowUp[];
  milestones: ITreatmentMilestone[];
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITreatmentMedicine {
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  timing: string[];
  durationDays: number;
  instructions: string;
  startDate: Date;
  endDate?: Date;
}

export interface ITreatmentProcedure {
  procedureId: string;
  name: string;
  description: string;
  scheduledDate: Date;
  completedDate?: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
  hospitalId: string;
  doctorId: string;
}

export interface ITreatmentFollowUp {
  followUpId: string;
  type: 'clinical' | 'lab' | 'imaging' | 'teleconsultation';
  scheduledDate: Date;
  completedDate?: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
  appointmentId?: string;
}

export interface ITreatmentMilestone {
  milestoneId: string;
  title: string;
  description: string;
  targetDate: Date;
  achievedDate?: Date;
  status: 'pending' | 'achieved' | 'missed';
  metric?: string;
}

const TreatmentPlanSchema = new Schema<ITreatmentPlan>({
  treatmentPlanId: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true },
  doctorName: { type: String, required: true },
  hospitalId: { type: String, required: true, index: true },
  prescriptionId: { type: String, required: true },
  clinicianAssessment: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed', 'paused', 'cancelled'], default: 'active', index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  medicines: [{
    medicineId: { type: String, required: true },
    medicineName: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    timing: [{ type: String }],
    durationDays: { type: Number, required: true },
    instructions: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
  }],
  procedures: [{
    procedureId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    hospitalId: { type: String },
    doctorId: { type: String },
  }],
  followUps: [{
    followUpId: { type: String, required: true },
    type: { type: String, enum: ['clinical', 'lab', 'imaging', 'teleconsultation'] },
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    notes: { type: String },
    appointmentId: { type: String },
  }],
  milestones: [{
    milestoneId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    targetDate: { type: Date, required: true },
    achievedDate: { type: Date },
    status: { type: String, enum: ['pending', 'achieved', 'missed'], default: 'pending' },
    metric: { type: String },
  }],
  simulation: { type: Boolean, default: true, immutable: true },
}, { timestamps: true });

export const TreatmentPlan = mongoose.models.TreatmentPlan || mongoose.model<ITreatmentPlan>('TreatmentPlan', TreatmentPlanSchema);
