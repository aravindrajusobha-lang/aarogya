import mongoose, { Schema, Document } from 'mongoose';

export type StorageCategory =
  | 'patients/oral-images/'
  | 'patients/screening-reports/'
  | 'patients/medical-documents/'
  | 'patients/consultation-records/'
  | 'hospitals/documents/'
  | 'doctors/documents/';

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

  // Google Cloud Storage & Metadata Extensions
  storageProvider: 'gcs' | 'local' | 'cloudinary';
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: 'image' | 'raw';
  cloudinaryFormat?: string;
  gcsBucket?: string;
  gcsObjectPath?: string;
  category: StorageCategory | string;
  patientId?: string;
  screeningReferenceId?: string;
  uploadStatus: 'pending' | 'completed' | 'failed' | 'deleted';
  hospitalId?: string;
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

    // GCS Fields
    storageProvider: { type: String, enum: ['gcs', 'local', 'cloudinary'], default: 'local', index: true },
    // Cloudinary (private 'authenticated' delivery only)
    cloudinaryPublicId: { type: String, default: null },
    cloudinaryResourceType: { type: String, enum: ['image', 'raw', null], default: null },
    cloudinaryFormat: { type: String, default: null },
    gcsBucket: { type: String, default: null },
    gcsObjectPath: { type: String, default: null, index: true },
    category: {
      type: String,
      default: 'patients/oral-images/',
      index: true,
    },
    patientId: { type: String, default: null, index: true },
    screeningReferenceId: { type: String, default: null, index: true },
    uploadStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'deleted'],
      default: 'completed',
      index: true,
    },
    hospitalId: { type: String, default: null, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const StoredFile =
  mongoose.models.StoredFile || mongoose.model<IStoredFile>('StoredFile', StoredFileSchema);
