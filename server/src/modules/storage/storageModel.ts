import mongoose, { Schema, Document } from 'mongoose';

export interface IStoredFile extends Document {
  fileId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storedPath: string;
  uploadedBy: string;
  uploaderRole: string;
  accessScopes: string[];
  simulation: true;
  createdAt: Date;
}

const StoredFileSchema = new Schema<IStoredFile>(
  {
    fileId: { type: String, required: true, unique: true, index: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    sha256Hash: { type: String, required: true },
    storedPath: { type: String, required: true },
    uploadedBy: { type: String, required: true, index: true },
    uploaderRole: { type: String, required: true },
    accessScopes: { type: [String], default: ['storage:read_clinical'], index: true },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const StoredFile =
  mongoose.models.StoredFile || mongoose.model<IStoredFile>('StoredFile', StoredFileSchema);
