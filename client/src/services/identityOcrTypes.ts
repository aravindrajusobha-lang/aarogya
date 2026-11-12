export type IdentityDocumentKind = 'aadhaar' | 'abha';
export type IdentityFieldSource = 'QR' | 'OCR' | 'MANUAL';

export interface ExtractedIdentityFields {
  fullName?: string;
  dob?: string;
  yearOfBirth?: number;
  ageEstimated?: number;
  gender?: 'male' | 'female' | 'transgender' | 'other';
  genderDisplay?: string;
  guardianName?: string;
  address?: string;
  village?: string;
  mandal?: string;
  habitation?: string;
  pincode?: string;
  maskedIdentity?: string;
  aadhaarNumber?: string;
  aadhaarValid?: boolean;
  fieldSources?: Partial<Record<keyof ExtractedIdentityFields, IdentityFieldSource>>;
  qualityError?: string;
}
