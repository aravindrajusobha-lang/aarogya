import { User } from '../auth/userModel.js';

export interface SuggestDoctorsInput {
  symptomText?: string;
  conditionCategory?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  location?: { district?: string; mandal?: string; village?: string; latitude?: number; longitude?: number };
  limit?: number;
}

const CATEGORY_TO_SPECIALTY: Record<string, string[]> = {
  'mouth ulcer': ['Oral Medicine', 'Dentist', 'Dental Surgeon'],
  'white or red patch': ['Oral Medicine', 'Oral & Maxillofacial Surgeon', 'Oncologist'],
  'swelling or lump': ['Oral & Maxillofacial Surgeon', 'ENT', 'Oncologist'],
  'dental infection': ['Dentist', 'Dental Surgeon'],
  'gum problem': ['Periodontist', 'Dentist'],
  'general check': ['Dentist', 'Medical Officer'],
};

const RED_FLAG_TERMS = ['heavy bleeding', 'difficulty breathing', 'trouble breathing', 'difficulty swallowing', 'trouble swallowing', 'fast-growing swelling', 'rapid swelling'];

export function detectRedFlags(text = ''): string[] {
  const q = String(text).toLowerCase();
  return RED_FLAG_TERMS.filter((t) => q.includes(t));
}

export function inferCategory(text = '', fallback?: string): string {
  if (fallback) return fallback;
  const q = String(text).toLowerCase();
  if (q.includes('ulcer') || q.includes('sore')) return 'mouth ulcer';
  if (q.includes('white') || q.includes('red patch') || q.includes('patch')) return 'white or red patch';
  if (q.includes('swelling') || q.includes('lump')) return 'swelling or lump';
  if (q.includes('tooth') || q.includes('infection') || q.includes('pain while chewing')) return 'dental infection';
  if (q.includes('gum') || q.includes('bleeding gum')) return 'gum problem';
  return 'general check';
}

export function inferDoctorType(category: string): string {
  const map: Record<string, string> = {
    'mouth ulcer': 'Oral medicine specialist / Dentist',
    'white or red patch': 'Oral medicine specialist or Oral surgeon / Oncologist',
    'swelling or lump': 'Oral & Maxillofacial Surgeon / ENT / Oncologist',
    'dental infection': 'Dentist',
    'gum problem': 'Dentist / Periodontist',
    'general check': 'Dentist / Medical Officer',
  };
  return map[category] || 'Dentist / Medical Officer';
}

export async function suggestDoctors(input: SuggestDoctorsInput) {
  const category = inferCategory(input.symptomText || '', input.conditionCategory);
  const doctorType = inferDoctorType(category);
  const specialties = CATEGORY_TO_SPECIALTY[category] || ['Dentist', 'Medical Officer'];
  const district = input.location?.district;
  const redFlags = detectRedFlags(input.symptomText || '');
  const urgent = redFlags.length > 0 || input.riskLevel === 'high';

  const baseQuery: any = {
    role: { $in: ['medical_officer', 'specialist_doctor', 'doctor', 'chief_medical_officer'] },
  };

  let doctors: any[] = [];
  try {
    doctors = await User.find(baseQuery).limit(50).lean();
  } catch {
    doctors = [];
  }

  const scored = doctors
    .map((d) => {
      const spec = String(d.specialization || d.specialty || d.department || d.role || '').toLowerCase();
      const match = specialties.some((s) => spec.includes(s.toLowerCase().split(/[\s/]/)[0])) ? 2 : spec ? 1 : 0;
      const active = d.isActive === false || d.status === 'inactive' ? -2 : 1;
      const verified = d.isVerified === false ? 0 : 1;
      const docDistrict = String(d.location?.district || d.district || d.assignedDistrict || '').toLowerCase();
      const sameDistrict = district && docDistrict && docDistrict === district.toLowerCase() ? 2 : 0;
      return { d, score: match * 10 + verified * 3 + active * 2 + sameDistrict };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit || 3);

  const suggestions = scored.map((x) => {
    const d = x.d as any;
    const docDistrict = d.location?.district || d.district || d.assignedDistrict;
    return {
      doctorId: d.userId || String(d._id || ''),
      name: d.fullName || d.name || d.username || 'Available Doctor',
      specialization: d.specialization || d.specialty || d.department || specialties[0],
      hospital: d.hospitalName || d.facilityName || d.hospitalId || 'Assigned Facility',
      distance: district && docDistrict && String(docDistrict).toLowerCase() === String(district).toLowerCase() ? 'Nearby (same district)' : 'Available in network',
      nextAvailability: d.nextAvailability || d.availability || 'Next available slot',
    };
  });

  if (suggestions.length === 0) {
    suggestions.push({
      doctorId: 'LET_ADMIN_DECIDE',
      name: 'Let admin decide',
      specialization: doctorType,
      hospital: 'Nearest appropriate facility',
      distance: district ? `Nearest available for ${district}` : 'To be assigned',
      nextAvailability: 'Admin will assign',
    } as any);
  }

  return {
    category,
    doctorType,
    suggestions: suggestions.slice(0, 3),
    urgent,
    redFlags,
    disclaimer: 'This is a care navigation suggestion. A qualified clinician makes personal care decisions.',
    fallbackUsed: doctors.length === 0 || scored.length === 0,
  };
}
