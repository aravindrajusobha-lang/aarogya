import mongoose, { Schema, Document } from 'mongoose';

export interface ISubcenter extends Document {
  name: string;
  district?: string;
  mandal?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubcenterSchema = new Schema<ISubcenter>(
  {
    name: { type: String, required: true },
    district: { type: String },
    mandal: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const Subcenter =
  mongoose.models.Subcenter || mongoose.model<ISubcenter>('Subcenter', SubcenterSchema);

