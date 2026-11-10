import mongoose, { Schema, Document } from 'mongoose';

export type CampStatus = 'draft' | 'published' | 'ongoing' | 'in_progress' | 'completed' | 'cancelled';

export interface ICampLocation {
  address: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ICamp extends Document {
  campId: string;
  name: string;
  hospitalId: string;
  villageId: string;
  villageName?: string;
  mandal?: string;
  targetPopulation: number;
  startDate: Date;
  endDate: Date;
  status: CampStatus;
  leadMoId: string;
  leadMoName?: string;
  assignedWorkerIds: string[];
  location: ICampLocation;
  screeningCount: number;
  abnormalFindingsCount: number;
  referralsCount: number;
  notes?: string;
  publishedAt?: Date;
  publishedBy?: string;
  startedAt?: Date;
  startedBy?: string;
  completedAt?: Date;
  completedBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const CampSchema = new Schema<ICamp>(
  {
    campId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    hospitalId: { type: String, required: true, index: true },
    villageId: { type: String, required: true, index: true },
    villageName: { type: String },
    mandal: { type: String },
    targetPopulation: { type: Number, required: true, default: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'ongoing', 'in_progress', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    leadMoId: { type: String, required: true, index: true },
    leadMoName: { type: String },
    assignedWorkerIds: [{ type: String }],
    location: {
      address: { type: String, required: true },
      gpsCoordinates: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
    },
    screeningCount: { type: Number, default: 0 },
    abnormalFindingsCount: { type: Number, default: 0 },
    referralsCount: { type: Number, default: 0 },
    notes: { type: String },
    publishedAt: { type: Date },
    publishedBy: { type: String },
    startedAt: { type: Date },
    startedBy: { type: String },
    completedAt: { type: Date },
    completedBy: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: String },
    cancellationReason: { type: String },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CampSchema.index({ hospitalId: 1, status: 1 });
CampSchema.index({ villageId: 1, status: 1 });

export const Camp = mongoose.model<ICamp>('Camp', CampSchema);
