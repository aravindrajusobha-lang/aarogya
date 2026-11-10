import mongoose, { Schema, Document } from 'mongoose';

export interface IVillage extends Document {
  villageId: string;
  villageName: string;
  nameTe?: string;
  mandal: string;
  panchayat: string;
  tribalHabitation: string;
  hospitalId: string;
  censusCode: string;
  populationEstimated: number;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  healthcareAccessLevel?: 'good' | 'moderate' | 'difficult' | 'remote_cutoff';
  nearestFacilityDistanceKm?: number;
  nearestFacilityType?: 'District_Hospital' | 'Area_Hospital' | 'CHC' | 'PHC';
  nearestFacilityName?: string;
  lastCampDate?: string | null;
  campCount?: number;
  screeningCoveragePercent?: number;
  verifiedByGovt?: boolean;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const VillageSchema = new Schema<IVillage>(
  {
    villageId: { type: String, required: true, unique: true, index: true },
    villageName: { type: String, required: true, trim: true, index: true },
    nameTe: { type: String, trim: true },
    mandal: { type: String, required: true, index: true },
    panchayat: { type: String, required: true, index: true },
    tribalHabitation: { type: String, required: true },
    hospitalId: { type: String, required: true, index: true },
    censusCode: { type: String, required: true },
    populationEstimated: { type: Number, default: 500 },
    gpsCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    healthcareAccessLevel: {
      type: String,
      enum: ['good', 'moderate', 'difficult', 'remote_cutoff'],
      default: 'moderate',
    },
    nearestFacilityDistanceKm: { type: Number, default: 5 },
    nearestFacilityType: { type: String, default: 'PHC' },
    nearestFacilityName: { type: String, default: '' },
    lastCampDate: { type: String, default: null },
    campCount: { type: Number, default: 0 },
    screeningCoveragePercent: { type: Number, default: 0 },
    verifiedByGovt: { type: Boolean, default: true },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Village =
  mongoose.models.Village || mongoose.model<IVillage>('Village', VillageSchema);
