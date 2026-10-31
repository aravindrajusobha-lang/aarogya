import { describe, it, expect } from 'vitest';
import en from '../src/i18n/locales/en.json';
import te from '../src/i18n/locales/te.json';
import hi from '../src/i18n/locales/hi.json';

function extractAllKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(extractAllKeyPaths(value as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }

  return keys.sort();
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((curr: any, k) => (curr ? curr[k] : undefined), obj);
}

describe('i18n Key Parity & Completeness', () => {
  const enKeys = extractAllKeyPaths(en);
  const teKeys = extractAllKeyPaths(te);
  const hiKeys = extractAllKeyPaths(hi);

  it('guarantees identical key count across English, Telugu, and Hindi', () => {
    expect(teKeys.length).toBe(enKeys.length);
    expect(hiKeys.length).toBe(enKeys.length);
  });

  it('guarantees 100% key match between English and Telugu', () => {
    const missingInTe = enKeys.filter((k) => !teKeys.includes(k));
    const extraInTe = teKeys.filter((k) => !enKeys.includes(k));

    expect(missingInTe).toEqual([]);
    expect(extraInTe).toEqual([]);
  });

  it('guarantees 100% key match between English and Hindi', () => {
    const missingInHi = enKeys.filter((k) => !hiKeys.includes(k));
    const extraInHi = hiKeys.filter((k) => !enKeys.includes(k));

    expect(missingInHi).toEqual([]);
    expect(extraInHi).toEqual([]);
  });

  it('ensures no empty translations exist in any dictionary', () => {
    enKeys.forEach((key) => {
      const enVal = getValueByPath(en, key);
      const teVal = getValueByPath(te, key);
      const hiVal = getValueByPath(hi, key);

      expect(typeof enVal).toBe('string');
      expect((enVal as string).trim().length).toBeGreaterThan(0);

      expect(typeof teVal).toBe('string');
      expect((teVal as string).trim().length).toBeGreaterThan(0);

      expect(typeof hiVal).toBe('string');
      expect((hiVal as string).trim().length).toBeGreaterThan(0);
    });
  });
});
