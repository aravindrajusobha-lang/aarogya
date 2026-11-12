import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'system_admin' | 'admin' | 'medical_officer' | 'anm' | 'asha' | 'patient';

export interface IWebAuthnCredential {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceType?: string;
  createdAt: Date;
}

export interface IUser extends Document {
  userId: string;
  username: string;
  role: UserRole;
  fullName: string;
  // Merged: Requested user schema fields
  name?: string;
  employeeId?: string;
  password?: string;
  roles?: string[];
  district?: string;
  mandals?: string[];
  permissions?: string[];
  isActive?: boolean;
  phone?: string;
  patientId?: string;
  yearOfBirth?: number;
  gender?: 'male' | 'female' | 'transgender' | 'other';
  address?: string;
  village?: string;
  mandal?: string;
  pincode?: string;
  hospitalId?: string;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  webauthnCredentials: IWebAuthnCredential[];
  webauthnChallenge?: string;
  lockout: {
    failedAttempts: number;
    lockedUntil?: Date | null;
    lastFailedAt?: Date | null;
  };
  mustChangePassword?: boolean;
  verificationStatus?: 'pending_verification' | 'verified' | 'rejected' | 'UNVERIFIED' | 'VERIFIED';
  verificationDetails?: {
    verifiedBy?: string;
    verifiedAt?: Date;
    qualificationDocuments?: Array<{
      documentId: string;
      documentType: string;
      fileUrl: string;
      sha256Hash: string;
      uploadedAt: Date;
    }>;
    councilRegistrationNumber?: string;
    specialization?: string;
    experienceYears?: number;
    rejectionReason?: string;
  };
  // Extended Patient Profile Fields (Module 3)
  medicalHistory?: string;
  allergies?: string[];
  currentMedications?: string[];
  habits?: {
    tobacco?: boolean;
    alcohol?: boolean;
    arecaNut?: boolean;
    smoking?: boolean;
    other?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  insurance?: {
    provider?: string;
    policyNumber?: string;
    validUntil?: Date;
  };
  preferredLanguage?: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
  profileCompleteness?: number;
  profileConsentAt?: Date;
  status: 'active' | 'suspended' | 'locked';
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const WebAuthnCredentialSchema = new Schema<IWebAuthnCredential>(
  {
    credentialId: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: [{ type: String }],
    deviceType: { type: String, default: 'singleDevice' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ['system_admin', 'admin', 'medical_officer', 'anm', 'asha', 'patient'],
      index: true,
    },
    fullName: { type: String, required: true },
    // Merged: Requested user schema fields
    name: { type: String },
    employeeId: { type: String, unique: true, sparse: true, index: true },
    password: { type: String, select: false },
    roles: [{ type: String, enum: ['SUPER_ADMIN', 'DISTRICT_ADMIN', 'DOCTOR', 'HEALTH_WORKER'] }],
    district: { type: String },
    mandals: [{ type: String }],
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    phone: { type: String },
    patientId: { type: String, index: true },
    yearOfBirth: { type: Number, min: 1900, max: new Date().getFullYear() },
    gender: { type: String, enum: ['male', 'female', 'transgender', 'other'] },
    address: { type: String, trim: true },
    village: { type: String, trim: true },
    mandal: { type: String, trim: true },
    pincode: { type: String, match: /^[1-9]\d{5}$/ },
    hospitalId: { type: String, index: true },
    passwordHash: { type: String, required: true },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    webauthnCredentials: [WebAuthnCredentialSchema],
    webauthnChallenge: { type: String },
    lockout: {
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
      lastFailedAt: { type: Date, default: null },
    },
    mustChangePassword: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['pending_verification', 'verified', 'rejected', 'UNVERIFIED', 'VERIFIED'],
      default: 'verified',
    },
    verificationDetails: {
      verifiedBy: { type: String },
      verifiedAt: { type: Date },
      qualificationDocuments: [
        {
          documentId: { type: String },
          documentType: { type: String },
          fileUrl: { type: String },
          sha256Hash: { type: String },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      councilRegistrationNumber: { type: String },
      specialization: { type: String },
      experienceYears: { type: Number },
      rejectionReason: { type: String },
    },
    // Extended Patient Profile Fields (Module 3)
    medicalHistory: { type: String, default: '' },
    allergies: { type: [String], default: [] },
    currentMedications: { type: [String], default: [] },
    habits: {
      tobacco: { type: Boolean, default: false },
      alcohol: { type: Boolean, default: false },
      arecaNut: { type: Boolean, default: false },
      smoking: { type: Boolean, default: false },
      other: { type: String, default: '' },
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' },
    },
    insurance: {
      provider: { type: String, default: '' },
      policyNumber: { type: String, default: '' },
      validUntil: { type: Date },
    },
    preferredLanguage: { type: String, enum: ['en', 'te', 'hi', 'ta', 'kn', 'ml'], default: 'te' },
    profileCompleteness: { type: Number, default: 0, min: 0, max: 100 },
    profileConsentAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'suspended', 'locked'],
      default: 'active',
    },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to seamlessly sync fullName/name and userId/employeeId
UserSchema.pre('validate', function (next) {
  if (!this.name && this.fullName) {
    this.name = this.fullName;
  }
  if (!this.fullName && this.name) {
    this.fullName = this.name;
  }
  if (!this.employeeId && this.userId) {
    this.employeeId = this.userId;
  }
  if (!this.userId && this.employeeId) {
    this.userId = this.employeeId;
  }
  next();
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
