import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseAadhaarQrPayload, isValidAadhaarNumber } from '../../client/src/services/aadhaarQr';
import { parseIdentityOcrText } from '../../client/src/services/identityTextParser';

const validSyntheticAadhaar = Array.from({ length: 10 }, (_, digit) => `23456789012${digit}`)
  .find(isValidAadhaarNumber)!;

describe('On-device Aadhaar OCR parsing', () => {
  it('parses legacy XML QR attributes into patient fields', () => {
    const qr = `<PrintLetterBarcodeData uid="${validSyntheticAadhaar}" name="Rani Sample" gender="F" yob="1990" co="C/O Sample" house="1-2" street="Main Road" loc="Vankachinta" vtc="Vankachinta" subdist="Paderu" dist="ASR" state="AP" pc="531024" lm="Near School"/>`;
    const fields = parseAadhaarQrPayload(qr);

    expect(fields).toMatchObject({
      fullName: 'Rani Sample',
      gender: 'female',
      yearOfBirth: 1990,
      village: 'Vankachinta',
      mandal: 'Paderu',
      pincode: '531024',
      habitation: 'Near School',
      maskedIdentity: `XXXX-XXXX-${validSyntheticAadhaar.slice(-4)}`,
      aadhaarValid: true,
    });
    expect(fields?.address).toContain('C/O Sample');
    expect(fields?.fieldSources?.fullName).toBe('QR');
  });

  it('decodes numeric gzip secure QR payloads', () => {
    const values = ['REF123456', 'Rani Sample', '1990', 'F', 'C/O Sample', 'ASR', 'Near School', '1-2', 'Vankachinta', '531024', 'Paderu PO', 'AP', 'Main Road', 'Paderu', 'Vankachinta'];
    const chunks = values.flatMap((value, index) => index < values.length - 1 ? [Buffer.from(value), Buffer.from([255])] : [Buffer.from(value)]);
    const compressed = gzipSync(Buffer.concat(chunks));
    const numericPayload = BigInt(`0x${compressed.toString('hex')}`).toString(10);
    const fields = parseAadhaarQrPayload(numericPayload);

    expect(fields).toMatchObject({
      fullName: 'Rani Sample',
      gender: 'female',
      yearOfBirth: 1990,
      village: 'Vankachinta',
      mandal: 'Paderu',
      pincode: '531024',
      habitation: 'Near School',
      maskedIdentity: 'XXXX-XXXX-3456',
    });
  });

  it('parses front and back OCR text while rejecting A4 page noise as a name', () => {
    const text = [
      'Government of India',
      'A4 page',
      'Rani Sample',
      'DOB: 04/09/1990',
      'Female',
      `Aadhaar: ${validSyntheticAadhaar.slice(0, 4)} ${validSyntheticAadhaar.slice(4, 8)} ${validSyntheticAadhaar.slice(8)}`,
      'Address: C/O Sample, House 1-2, Vankachinta Village, Paderu Mandal, ASR District, 531024',
      'Landmark: Near School',
    ].join('\n');
    const fields = parseIdentityOcrText(text, 'aadhaar');

    expect(fields).toMatchObject({
      fullName: 'Rani Sample',
      gender: 'female',
      yearOfBirth: 1990,
      village: 'Vankachinta Village',
      mandal: 'Paderu',
      pincode: '531024',
      habitation: 'Near School',
      aadhaarValid: true,
    });
    expect(parseIdentityOcrText('A4 page', 'aadhaar').fullName).toBeUndefined();
  });

  it('rejects invalid checksum and Aadhaar prefixes', () => {
    expect(isValidAadhaarNumber(validSyntheticAadhaar)).toBe(true);
    expect(isValidAadhaarNumber(`1${validSyntheticAadhaar.slice(1)}`)).toBe(false);
    expect(isValidAadhaarNumber('234567890123')).toBe(false);
  });
});