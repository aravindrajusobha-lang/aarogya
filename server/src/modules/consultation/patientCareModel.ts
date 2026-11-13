import mongoose, { Schema } from 'mongoose';

const CareSchema = new Schema({
  patientId: { type: String, required: true, unique: true },
  doctorId: { type: String, required: true, index: true },
  version: { type: Number, required: true, default: 1 },
  simulation: { type: Boolean, default: true },
}, { timestamps: true });
const TransferSchema = new Schema({
  requestId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true, index: true },
  fromDoctorId: { type: String, required: true, index: true },
  toDoctorId: { type: String, required: true, index: true },
  assignmentVersion: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'superseded'], default: 'pending' },
  decidedAt: Date,
  simulation: { type: Boolean, default: true },
}, { timestamps: true });
TransferSchema.index({ patientId: 1, toDoctorId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
export const PatientCare = mongoose.model('PatientCare', CareSchema);
export const CareTransfer = mongoose.model('CareTransfer', TransferSchema);
