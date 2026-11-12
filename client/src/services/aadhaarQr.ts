import { ungzip } from 'pako';
import { ExtractedIdentityFields } from './identityOcrTypes';

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function isValidAadhaarNumber(value: string): boolean {
  if (!/^[2-9]\d{11}$/.test(value)) return false;
  let checksum = 0;
  const digits = value.split('').reverse().map(Number);
  digits.forEach((digit, index) => {
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[index % 8][digit]];
  });
  return VERHOEFF_INV[checksum] === 0;
}

function birthYear(value?: string): number | undefined {
  const match = value?.match(/(?:^|\D)(\d{4})(?:\D|$)/);
  const year = Number(match?.[1]);
  return year >= 1900 && year <= new Date().getFullYear() ? year : undefined;
}

function normalizeGender(value?: string): ExtractedIdentityFields['gender'] {
  const gender = value?.trim().toLowerCase();
  if (['m', 'male', 'पुरुष', 'పురుషుడు'].includes(gender || '')) return 'male';
  if (['f', 'female', 'స్త్రీ', 'महिला'].includes(gender || '')) return 'female';
  if (['t', 'transgender', 'ತೃತೀಯ లింగ', 'ట్రాన్స్‌జెండర్'].includes(gender || '')) return 'transgender';
  if (['other'].includes(gender || '')) return 'other';
  return undefined;
}

function displayGender(value?: string): string | undefined {
  const gender = value?.trim().toLowerCase();
  if (['m', 'male'].includes(gender || '')) return 'Male';
  if (['f', 'female'].includes(gender || '')) return 'Female';
  if (['t', 'transgender'].includes(gender || '')) return 'Transgender';
  return undefined;
}

function fromAttributes(attributes: Record<string, string>): ExtractedIdentityFields {
  const attr = (name: string) => attributes[name]?.trim() || undefined;
  const dob = attr('dob') || attr('yob');
  const uid = attr('uid') || attr('aadhaar') || attr('referenceid') || '';
  const digits = uid.replace(/\D/g, '');
  const addressParts = ['co', 'house', 'street', 'loc', 'vtc', 'subdist', 'dist', 'state']
    .map((key) => attr(key))
    .filter((part): part is string => Boolean(part));
  const address = attr('address') || addressParts.join(', ');
  const fields: ExtractedIdentityFields = {
    fullName: attr('name'),
    dob,
    yearOfBirth: birthYear(dob),
    gender: normalizeGender(attr('gender')),
    genderDisplay: displayGender(attr('gender')),
    address,
    village: attr('vtc') || attr('loc'),
    mandal: attr('subdist'),
    habitation: attr('lm'),
    pincode: attr('pc')?.match(/^[1-9]\d{5}$/)?.[0],
    fieldSources: {},
  };
  if (digits.length === 12) {
    fields.aadhaarNumber = digits;
    fields.aadhaarValid = isValidAadhaarNumber(digits);
    fields.maskedIdentity = `XXXX-XXXX-${digits.slice(-4)}`;
  } else if (digits.length >= 4) {
    fields.maskedIdentity = `XXXX-XXXX-${digits.slice(-4)}`;
  }
  Object.keys(fields).forEach((key) => {
    if (key !== 'fieldSources' && fields[key as keyof ExtractedIdentityFields] !== undefined) {
      fields.fieldSources![key as keyof ExtractedIdentityFields] = 'QR';
    }
  });
  return fields;
}

function parseXmlQr(payload: string): ExtractedIdentityFields | undefined {
  const trimmed = payload.trim();
  if (!trimmed.startsWith('<')) return undefined;
  const attributes: Record<string, string> = {};
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(trimmed, 'application/xml');
    if (parsed.querySelector('parsererror')) return undefined;
    for (const attribute of Array.from(parsed.documentElement.attributes)) {
      attributes[attribute.name.toLowerCase()] = attribute.value;
    }
  } else {
    const tag = trimmed.match(/^<[^>]+>/)?.[0];
    if (!tag) return undefined;
    const attributePattern = /([\w:-]+)\s*=\s*(["'])(.*?)\2/g;
    for (const match of tag.matchAll(attributePattern)) {
      attributes[match[1].toLowerCase()] = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }
  }
  if (!Object.keys(attributes).length) return undefined;
  return fromAttributes(attributes);
}

function numericPayloadBytes(payload: string): Uint8Array {
  const digits = payload.replace(/\s/g, '');
  if (!/^\d{40,}$/.test(digits)) throw new Error('Unsupported QR payload');
  let hex = BigInt(digits).toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function parseSecureQr(payload: string): ExtractedIdentityFields | undefined {
  try {
    const bytes = ungzip(numericPayloadBytes(payload));
    const values: string[] = [];
    let start = 0;
    for (let index = 0; index <= bytes.length; index += 1) {
      if (index === bytes.length || bytes[index] === 255) {
        values.push(new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(start, index)));
        start = index + 1;
      }
    }
    if (values.length < 15) return undefined;
    const [referenceId, name, dob, gender, careOf, district, landmark, house, location, pincode, postOffice, state, street, subDistrict, vtc] = values;
    const referenceDigits = referenceId.replace(/\D/g, '');
    const address = [careOf, house, street, location, vtc, subDistrict, district, postOffice, state]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
    const fields: ExtractedIdentityFields = {
      fullName: name.trim() || undefined,
      dob: dob.trim() || undefined,
      yearOfBirth: birthYear(dob),
      gender: normalizeGender(gender),
      genderDisplay: displayGender(gender),
      address: address || undefined,
      village: vtc.trim() || location.trim() || undefined,
      mandal: subDistrict.trim() || undefined,
      habitation: landmark.trim() || undefined,
      pincode: pincode.trim().match(/^[1-9]\d{5}$/)?.[0],
      maskedIdentity: referenceDigits.length >= 4 ? `XXXX-XXXX-${referenceDigits.slice(-4)}` : undefined,
      fieldSources: {},
    };
    Object.keys(fields).forEach((key) => {
      if (key !== 'fieldSources' && fields[key as keyof ExtractedIdentityFields] !== undefined) {
        fields.fieldSources![key as keyof ExtractedIdentityFields] = 'QR';
      }
    });
    return fields;
  } catch {
    return undefined;
  }
}

export function parseAadhaarQrPayload(payload: string): ExtractedIdentityFields | undefined {
  return parseXmlQr(payload) || parseSecureQr(payload);
}