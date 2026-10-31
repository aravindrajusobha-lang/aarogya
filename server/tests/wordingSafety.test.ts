import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROHIBITED_PATTERNS = [
  /\bdiagnosis\b/i,
  /\bdiagnose\b/i,
  /\bcancer[- ]free\b/i,
  /\bcancer stage\b/i,
  /\bstage\s+[1-4ivx]+\b/i,
  /\bcurative\b/i,
  /\bchemotherapy\b/i,
  /\bradiation plan\b/i,
];

// Helper to recursively get all files
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'storage') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe('Clinical Safety Guardrail - Wording Scanner', () => {
  it('must not contain prohibited diagnostic, staging, or curative statements in server source files', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = getAllFiles(srcDir);

    const violations: { file: string; line: number; match: string }[] = [];

    files.forEach((file) => {
      // Exclude test utilities or non-source if any
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, index) => {
        PROHIBITED_PATTERNS.forEach((pattern) => {
          if (pattern.test(lineText)) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              match: lineText.trim(),
            });
          }
        });
      });
    });

    if (violations.length > 0) {
      console.error('CLINICAL SAFETY VIOLATIONS DETECTED:', violations);
    }

    expect(violations).toEqual([]);
  });

  it('must strictly enforce non-diagnostic screening language in all i18n dictionaries', () => {
    const localesDir = path.resolve(__dirname, '../src/i18n/locales');
    const files = fs.readdirSync(localesDir).map((f) => path.join(localesDir, f));

    const violations: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      PROHIBITED_PATTERNS.forEach((pattern) => {
        if (pattern.test(content)) {
          violations.push(`File ${path.basename(file)} contains prohibited term matching ${pattern}`);
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
