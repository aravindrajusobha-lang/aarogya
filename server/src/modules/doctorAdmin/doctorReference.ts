/**
 * Reference lists for doctor onboarding.
 *
 * Oral departments follow the nine MDS specialties recognised by the Dental Council of India
 * (DCI MDS Course Regulations) plus general dentistry (BDS) and the medical departments that
 * commonly receive oral screening referrals. Qualification titles follow DCI / National Medical
 * Commission degree names; councils are the statutory registration bodies.
 */
export interface DepartmentOption {
  code: string;
  name: string;
  group: 'Dental (DCI MDS specialty)' | 'Dental (general)' | 'Medical';
  typicalQualification: string;
  /** Matching value in the Specialist registry (specialistModel SpecialistField). */
  specialistField: 'maxillofacial_surgery' | 'ent_head_neck' | 'pathology' | 'general_dental';
}

export const ORAL_DEPARTMENTS: DepartmentOption[] = [
  { code: 'oral_medicine_radiology', name: 'Oral Medicine & Radiology', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Oral Medicine & Radiology)', specialistField: 'general_dental' },
  { code: 'oral_maxillofacial_surgery', name: 'Oral & Maxillofacial Surgery', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Oral & Maxillofacial Surgery)', specialistField: 'maxillofacial_surgery' },
  { code: 'oral_pathology', name: 'Oral & Maxillofacial Pathology and Oral Microbiology', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Oral Pathology)', specialistField: 'pathology' },
  { code: 'periodontology', name: 'Periodontology', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Periodontology)', specialistField: 'general_dental' },
  { code: 'prosthodontics', name: 'Prosthodontics and Crown & Bridge', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Prosthodontics)', specialistField: 'general_dental' },
  { code: 'conservative_endodontics', name: 'Conservative Dentistry & Endodontics', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Conservative Dentistry & Endodontics)', specialistField: 'general_dental' },
  { code: 'orthodontics', name: 'Orthodontics & Dentofacial Orthopaedics', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Orthodontics)', specialistField: 'general_dental' },
  { code: 'pediatric_dentistry', name: 'Paediatric & Preventive Dentistry', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Paediatric Dentistry)', specialistField: 'general_dental' },
  { code: 'public_health_dentistry', name: 'Public Health Dentistry', group: 'Dental (DCI MDS specialty)', typicalQualification: 'MDS (Public Health Dentistry)', specialistField: 'general_dental' },
  { code: 'general_dentistry', name: 'General Dentistry', group: 'Dental (general)', typicalQualification: 'BDS', specialistField: 'general_dental' },
  { code: 'ent_head_neck', name: 'ENT / Head & Neck Surgery', group: 'Medical', typicalQualification: 'MS (ENT)', specialistField: 'ent_head_neck' },
  { code: 'general_medicine', name: 'General Medicine (Medical Officer)', group: 'Medical', typicalQualification: 'MBBS', specialistField: 'general_dental' },
];

export const QUALIFICATIONS = [
  'BDS', 'MDS', 'MBBS', 'MD', 'MS (ENT)', 'MS (General Surgery)', 'DNB', 'Diploma (Dental)', 'PG Diploma', 'Fellowship', 'PhD',
];

export const REGISTRATION_COUNCILS = [
  'Andhra Pradesh State Dental Council',
  'Telangana State Dental Council',
  'Andhra Pradesh Medical Council',
  'National Medical Commission (NMC)',
  'Dental Council of India (DCI)',
  'Other State Dental Council',
  'Other State Medical Council',
];

export const CONSULTATION_LANGUAGES = ['Telugu', 'English', 'Hindi', 'Odia', 'Koya', 'Kuvi', 'Adivasi Oriya'];

export const CONSULTATION_MODES = ['online', 'offline'] as const;

export const departmentByCode = (code: string) => ORAL_DEPARTMENTS.find((item) => item.code === code);
