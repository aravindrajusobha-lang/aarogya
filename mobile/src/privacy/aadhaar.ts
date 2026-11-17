/**
 * Aadhaar validation is deliberately device-only.  Never add a network call,
 * persistence call, log statement, hash, suffix, or upload to this module.
 */
const D = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,1,6,7,3,9,5,8],[8,9,1,6,0,4,3,5,7,2],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,0,9,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,1,6,7,3,9,5,8],[8,9,1,6,0,4,3,5,7,2],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,0,9,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];

export function aadhaarDigits(value: string) { return value.replace(/\D/g, '').slice(0, 12); }
export function formatAadhaar(value: string) { return aadhaarDigits(value).replace(/(\d{4})(?=\d)/g, '$1 '); }
export function isValidAadhaar(value: string) {
  const digits = aadhaarDigits(value);
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let checksum = 0;
  [...digits].reverse().forEach((raw, index) => { checksum = D[checksum][P[index % 8][Number(raw)]]; });
  return checksum === 0;
}
