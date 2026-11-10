import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 20: Repository Secret Scanner & Hygiene Verification', () => {
  const repoRoot = path.resolve(__dirname, '../../');

  // Ignored directories and files
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.gemini',
    'coverage',
    'scratch',
    '.system_generated',
    '.venv',
    'venv',
    '__pycache__',
    'dist',
    'build',
  ]);

  const ignoredFiles = new Set([
    'package-lock.json',
    '.env.example',
    '.env.production.example',
  ]);

  function getTrackedFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          results.push(...getTrackedFiles(path.join(dir, entry.name)));
        }
      } else if (entry.isFile()) {
        if (!ignoredFiles.has(entry.name)) {
          results.push(path.join(dir, entry.name));
        }
      }
    }
    return results;
  }

  const allFiles = getTrackedFiles(repoRoot);

  it('No raw private keys are stored in the repository', () => {
    const privateKeyRegex = /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/;
    const violations: { file: string; line: number }[] = [];

    for (const file of allFiles) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico') || file.endsWith('.dat')) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (privateKeyRegex.test(line)) {
          violations.push({ file: path.relative(repoRoot, file), line: index + 1 });
        }
      });
    }

    expect(violations, `Found private keys in: ${JSON.stringify(violations)}`).toEqual([]);
  }, 15000);

  it('No active cloud provider credentials or tokens (AWS, GCP, GitHub)', () => {
    const awsKeyRegex = /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/;
    const gcpKeyRegex = /AIza[0-9A-Za-z\\-_]{35}/;
    const githubTokenRegex = /gh[pousr]_[A-Za-z0-9_]{36,255}/;

    const violations: { file: string; match: string }[] = [];

    for (const file of allFiles) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico') || file.endsWith('.dat')) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');
      if (awsKeyRegex.test(content)) {
        violations.push({ file: path.relative(repoRoot, file), match: 'AWS Access Key' });
      }
      if (gcpKeyRegex.test(content)) {
        violations.push({ file: path.relative(repoRoot, file), match: 'GCP API Key' });
      }
      if (githubTokenRegex.test(content)) {
        violations.push({ file: path.relative(repoRoot, file), match: 'GitHub Token' });
      }
    }

    expect(violations, `Found cloud credentials in: ${JSON.stringify(violations)}`).toEqual([]);
  });

  it('No production .env or .env.production files exist in the repository root or subfolders', () => {
    const forbiddenEnvFiles = [
      path.join(repoRoot, '.env.production'),
      path.join(repoRoot, 'server', '.env.production'),
      path.join(repoRoot, 'client', '.env.production'),
    ];

    for (const file of forbiddenEnvFiles) {
      expect(fs.existsSync(file), `Forbidden production env file found: ${file}`).toBe(false);
    }
  });

  it('.gitignore correctly ignores all sensitive extensions and secrets', () => {
    const gitignorePath = path.join(repoRoot, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    expect(gitignoreContent).toContain('.env');
    expect(gitignoreContent).toContain('.env.production');
    expect(gitignoreContent).toContain('*.pem');
    expect(gitignoreContent).toContain('*.key');
    expect(gitignoreContent).toContain('*.crt');
  });

  it('Patient data models and seed data contain no real patient records or unmasked Aadhaar', () => {
    const patientSeedFile = path.join(repoRoot, 'server', 'src', 'modules', 'seed', 'masterSeed.ts');
    const content = fs.readFileSync(patientSeedFile, 'utf-8');

    // Verify all seeded patients use masked Aadhaar format (XXXX-XXXX-NNNN)
    const rawAadhaarPattern = /aadhaarNumber:\s*['"]\d{12}['"]/;
    expect(rawAadhaarPattern.test(content)).toBe(false);

    // Verify all seeded patients have simulation: true and no Aadhaar numbers
    expect(content).toContain("simulation: true");
    expect(content).not.toContain("aadhaarNumber");
  });
});
