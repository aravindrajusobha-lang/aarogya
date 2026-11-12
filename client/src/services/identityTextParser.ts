import { IdentityDocumentKind, ExtractedIdentityFields } from './identityOcrTypes';
import { isValidAadhaarNumber } from './aadhaarQr';

function firstLabeledValue(lines: string[], label: RegExp): string | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(label);
    if (!match) continue;
    const inlineValue = (match[1] || '').trim().replace(/^[:\-–\s]+/, '');
    if (inlineValue) return inlineValue;
    const nextValue = lines[index + 1]?.trim();
    if (nextValue && !/^(?:dob|date of birth|gender|address|आधार|abha)\b/i.test(nextValue)) return nextValue;
  }
  return undefined;
}

function estimateAge(dob: string | undefined): number | undefined {
  if (!dob) return undefined;
  const year = Number(dob.match(/(?:^|\/|-)(\d{4})$/)?.[1] || dob.match(/^\d{4}$/)?.[0]);
  if (!year || year < 1900 || year > new Date().getFullYear()) return undefined;
  return new Date().getFullYear() - year;
}

function birthYear(dob: string | undefined): number | undefined {
  const year = Number(dob?.match(/(?:^|\/|-)(\d{4})$/)?.[1] || dob?.match(/^\d{4}$/)?.[0]);
  return year >= 1900 && year <= new Date().getFullYear() ? year : undefined;
}

function addressDetails(address: string | undefined, text: string) {
  const source = `${address || ''}\n${text}`;
  const valueAfter = (pattern: RegExp) => source.match(pattern)?.[1]?.trim().replace(/[,.\s]+$/, '');
  const village = valueAfter(/(?:Village|Vill\.?|ग्राम)\s*[:\-–]?\s*([^,\n]+)/i);
  return {
    village,
    mandal: valueAfter(/(?:Mandal|Sub[-\s]?District|Tehsil|Taluk|तहसील|मंडल)\s*[:\-–]?\s*([^,\n]+)/i),
    habitation: valueAfter(/(?:Landmark|Habitation|Locality|ల్యాండ్‌మార్క్|స్థలం)\s*[:\-–]?\s*([^,\n]+)/i) || village,
    pincode: source.match(/\b([1-9]\d{5})\b/)?.[1],
  };
}

const NON_NAME_LINE = /(?:government of india|भारत सरकार|aadhaar|uidai|unique identification|\bvid\b|\ba4\b|\bpage\b|enrolment|enrollment|dob|date of birth|year of birth|gender|male|female|transgender|address|भारत|सरकार|पहचान|आधार|जन्म|लिंग)/i;

function parseAadhaarOcrText(text: string): ExtractedIdentityFields {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /\p{L}/u.test(line));
  const joined = lines.join('\n');
  const dobIndex = lines.findIndex((line) => /(?:DOB|Date\s*of\s*Birth|Year\s*of\s*Birth|జనన\s*తేదీ|जन्म\s*तिथि)/i.test(line));
  const dobLine = dobIndex >= 0 ? lines[dobIndex] : '';
  const dob = dobLine.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4})\b/)?.[1]
    || joined.match(/(?:Year\s*of\s*Birth|YOB|జనన\s*తేదీ|जन्म\s*तिथि)\s*[:\-–]?\s*(\d{4})/i)?.[1];
  let name: string | undefined;
  for (let index = dobIndex - 1; index >= 0 && dobIndex >= 0; index -= 1) {
    const candidate = lines[index].replace(/[^\p{L}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (candidate.replace(/\s/g, '').length < 3 || NON_NAME_LINE.test(candidate)) continue;
    name = candidate;
    break;
  }

  const genderLine = lines.find((line) => /\b(male|female|transgender)\b|పురుషుడు|స్త్రీ|మహిళ|पुरुष|महिला/i.test(line))
    || lines.find((line) => /^(?:m|f|t)$/i.test(line));
  const genderValue = genderLine?.match(/\b(male|female|transgender|m|f|t)\b|పురుషుడు|స్త్రీ|మహిళ|पुरुष|महिला/i)?.[0]?.toLowerCase();
  const gender: ExtractedIdentityFields['gender'] = /^(?:male|m|పురుషుడు|पुरुष)$/.test(genderValue || '') ? 'male'
    : /^(?:female|f|స్త్రీ|మహిళ|महिला)$/.test(genderValue || '') ? 'female'
      : /^(?:transgender|t)$/.test(genderValue || '') ? 'transgender' : undefined;
  const genderDisplay = gender === 'transgender' ? 'Transgender' : gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : undefined;

  const aadhaarMatch = joined.match(/\b([2-9]\d{3})[\s-]?([0-9]{4})[\s-]?([0-9]{4})\b/);
  const aadhaarDigits = aadhaarMatch?.slice(1).join('');
  const aadhaarValid = aadhaarDigits ? isValidAadhaarNumber(aadhaarDigits) : undefined;
  const maskedIdentity = aadhaarDigits ? `XXXX-XXXX-${aadhaarDigits.slice(-4)}` : undefined;

  const pincodeMatches = Array.from(joined.matchAll(/\b([1-9]\d{5})\b/g)).map((match) => match[1]);
  const pincode = pincodeMatches.find((value) => !aadhaarDigits?.includes(value));
  const addressStart = joined.search(/(?:Address\s*[:\-–]?|(?:S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)\s*[:\-–]?)/i);
  let address = addressStart >= 0 ? joined.slice(addressStart).replace(/^(?:Address\s*[:\-–]?|(?:S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)\s*[:\-–]?)/i, '').trim() : undefined;
  if (address) {
    if (pincode) address = address.slice(0, address.indexOf(pincode) >= 0 ? address.indexOf(pincode) : address.length);
    address = address.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '').replace(/[\s,;]+$/g, '').trim() || undefined;
  }

  const addressParts = (address || '').split(/[,\n]+/).map((part) => part.trim()).filter(Boolean);
  const districtIndex = addressParts.findIndex((part) => /\b(?:dist\.?|district)\b/i.test(part));
  const beforeDistrict = districtIndex >= 0 ? addressParts.slice(0, districtIndex) : addressParts;
  const mandalIndex = beforeDistrict.findIndex((part) => /\b(?:mandal|mdl)\b/i.test(part));
  const resolvedMandalIndex = mandalIndex >= 0 ? mandalIndex : beforeDistrict.length > 1 ? beforeDistrict.length - 1 : -1;
  const mandal = resolvedMandalIndex >= 0 ? beforeDistrict[resolvedMandalIndex].replace(/\b(?:mandal|mdl)\b\s*/i, '').trim() : undefined;
  const village = resolvedMandalIndex > 0 ? beforeDistrict[resolvedMandalIndex - 1] : beforeDistrict[0];
  const landmark = joined.match(/(?:Landmark|Near|ల్యాండ్‌మార్క్|पास)\s*[:\-–]?\s*([^,\n]+)/i)?.[1]?.trim();
  const yearOfBirth = Number(dob?.match(/\d{4}/)?.[0]);
  const validYear = yearOfBirth >= 1900 && yearOfBirth <= new Date().getFullYear() ? yearOfBirth : undefined;

  const fields: ExtractedIdentityFields = {
    fullName: name,
    dob,
    yearOfBirth: validYear,
    ageEstimated: validYear ? new Date().getFullYear() - validYear : undefined,
    gender,
    genderDisplay,
    address,
    village,
    mandal,
    habitation: landmark,
    pincode,
    maskedIdentity,
    aadhaarNumber: aadhaarDigits,
    aadhaarValid,
    fieldSources: {},
  };
  Object.keys(fields).forEach((key) => {
    if (key !== 'fieldSources' && fields[key as keyof ExtractedIdentityFields] !== undefined) {
      fields.fieldSources![key as keyof ExtractedIdentityFields] = 'OCR';
    }
  });
  return fields;
}

function readQrFields(text: string): Partial<ExtractedIdentityFields> {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const entries = Object.entries(value as Record<string, unknown>);
    const find = (keys: string[]) => {
      const pair = entries.find(([key, field]) => keys.includes(key.toLowerCase()) && typeof field === 'string');
      return pair?.[1] as string | undefined;
    };
    const dob = find(['dob', 'dateofbirth', 'birthdate']);
    const genderRaw = find(['gender', 'sex'])?.toLowerCase();
    const gender = genderRaw === 'm' || genderRaw === 'male' ? 'male'
      : genderRaw === 'f' || genderRaw === 'female' ? 'female'
        : genderRaw ? 'other' : undefined;
    return {
      fullName: find(['name', 'fullname', 'patientname']),
      dob,
      yearOfBirth: birthYear(dob),
      ageEstimated: estimateAge(dob),
      gender,
      address: find(['address', 'fulladdress']),
    };
  } catch {
    return {};
  }
}

export function parseIdentityOcrText(text: string, kind: IdentityDocumentKind): ExtractedIdentityFields {
  if (kind === 'aadhaar') return parseAadhaarOcrText(text);

  return parseAbhaOcrText(text);
}

function parseAbhaOcrText(text: string): ExtractedIdentityFields {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const joined = lines.join('\n');
  const qrFields = readQrFields(text);

  const dob = firstLabeledValue(lines, /(?:DOB|Date\s*of\s*Birth|Year\s*of\s*Birth|Birth|जन्म\s*(?:तिथि|दिनांक)?)\s*[:\-–]?\s*(.*)$/i)
    || joined.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4})\b/)?.[1]
    || qrFields.dob;
  const name = qrFields.fullName;
  const genderText = firstLabeledValue(lines, /^(?:Gender|Sex|लिंग)\s*[:\-–]?\s*(.*)$/i)
    || lines.find((line) => /^(?:male|female|पुरुष|महिला)$/i.test(line));
  const gender = /^(?:m|male|पुरुष)$/i.test(genderText || '') ? 'male'
    : /^(?:f|female|महिला)$/i.test(genderText || '') ? 'female'
      : genderText ? 'other' : qrFields.gender;
  const guardianName = firstLabeledValue(lines, /^(?:Father'?s?\s*Name|Guardian(?:'s)?\s*Name|Husband'?s?\s*Name|पिता\s*का\s*नाम)\s*[:\-–]?\s*(.*)$/i);

  const addressLine = lines.findIndex((line) => /^(?:A\s*d\s*d\s*r\s*e\s*s\s*s|पता)\s*[:\-–]?/i.test(line));
  let address: string | undefined = qrFields.address;
  if (addressLine >= 0) {
    const firstLine = lines[addressLine].replace(/^(?:Address|पता)\s*[:\-–]?\s*/i, '').trim();
    const addressParts = firstLine ? [firstLine] : [];
    for (const line of lines.slice(addressLine + 1)) {
      if (/^(?:VID|Aadhaar|ABHA|Government of India|Unique Identification|भारतीय विशिष्ट पहचान|www\.)\b/i.test(line)) break;
      if (/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b|\b\d{14}\b/.test(line)) break;
      addressParts.push(line);
      if (addressParts.length >= 7) break;
    }
    address = addressParts.join(', ').trim() || address;
  }
  if (address) address = address.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, 'XXXX-XXXX-XXXX').replace(/\b\d{14}\b/g, '••••••••••••••');
  const locality = addressDetails(address, joined);

  let maskedIdentity: string | undefined;
  const labeledValue = joined.match(/(?:ABHA(?:\s*(?:ID|Number|No\.?))?\s*[:#\-]?\s*)([\d -]{12,24}|[\w.-]+@abdm)/i)?.[1];
  const digits = labeledValue?.replace(/\D/g, '') || joined.match(/\b(\d{14})\b/)?.[1];
  if (digits && digits.length >= 4) maskedIdentity = `ABHA ••••${digits.slice(-4)}`;

  const result: ExtractedIdentityFields = {
    fullName: name,
    dob,
    yearOfBirth: birthYear(dob),
    ageEstimated: estimateAge(dob),
    gender,
    guardianName,
    address,
    ...locality,
    maskedIdentity,
  };
  return result;
}
