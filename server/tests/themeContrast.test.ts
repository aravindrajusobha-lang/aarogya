import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB hex code (#RRGGBB)
 */
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '').trim();
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates contrast ratio between two luminance values (L1 >= L2)
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Theme Contrast & WCAG Compliance Check', () => {
  const themeCssPath = path.resolve(__dirname, '../../client/src/styles/theme.css');
  const cssContent = fs.readFileSync(themeCssPath, 'utf-8');

  // Parse CSS variables from light and dark sections
  function parseVariables(blockRegex: RegExp): Record<string, string> {
    const match = cssContent.match(blockRegex);
    if (!match) return {};
    const block = match[1];
    const vars: Record<string, string> = {};
    const lines = block.split('\n');
    for (const line of lines) {
      const varMatch = line.match(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/);
      if (varMatch) {
        vars[`--${varMatch[1]}`] = varMatch[2];
      }
    }
    return vars;
  }

  const lightVars = parseVariables(/\[data-theme="light"\]\s*\{([^}]+)\}/);
  const darkVars = parseVariables(/\[data-theme="dark"\]\s*\{([^}]+)\}/);

  it('contains all required CSS variable roles in both light and dark themes', () => {
    const requiredRoles = [
      '--bg',
      '--surface',
      '--surface-2',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--border',
      '--accent',
      '--accent-text',
      '--success-bg',
      '--success-text',
      '--warning-bg',
      '--warning-text',
      '--danger-bg',
      '--danger-text',
      '--info-bg',
      '--info-text',
      '--btn-primary-bg',
      '--btn-primary-text',
      '--bar-track',
      '--bar-fill',
    ];

    for (const role of requiredRoles) {
      expect(lightVars[role], `Missing ${role} in light theme`).toBeDefined();
      expect(darkVars[role], `Missing ${role} in dark theme`).toBeDefined();
    }
  });

  describe('Light Theme Contrast Ratios (WCAG AA/AAA)', () => {
    it('primary text against surface meets WCAG AAA (>= 7:1)', () => {
      const cr = getContrastRatio(lightVars['--text-primary'], lightVars['--surface']);
      expect(cr).toBeGreaterThanOrEqual(7.0);
    });

    it('secondary text against surface meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--text-secondary'], lightVars['--surface']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('muted text against surface meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--text-muted'], lightVars['--surface']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('accent text against accent background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--accent-text'], lightVars['--accent']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('success text against success background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--success-text'], lightVars['--success-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('warning text against warning background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--warning-text'], lightVars['--warning-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('danger text against danger background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--danger-text'], lightVars['--danger-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('info text against info background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--info-text'], lightVars['--info-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('primary button text against button background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(lightVars['--btn-primary-text'], lightVars['--btn-primary-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Dark Theme Contrast Ratios (WCAG AA/AAA)', () => {
    it('primary text against surface meets WCAG AAA (>= 7:1)', () => {
      const cr = getContrastRatio(darkVars['--text-primary'], darkVars['--surface']);
      expect(cr).toBeGreaterThanOrEqual(7.0);
    });

    it('secondary text against surface meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--text-secondary'], darkVars['--surface']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('muted text against surface meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--text-muted'], darkVars['--surface']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('accent text against accent background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--accent-text'], darkVars['--accent']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('success text against success background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--success-text'], darkVars['--success-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('warning text against warning background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--warning-text'], darkVars['--warning-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('danger text against danger background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--danger-text'], darkVars['--danger-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('info text against info background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--info-text'], darkVars['--info-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });

    it('primary button text against button background meets WCAG AA (>= 4.5:1)', () => {
      const cr = getContrastRatio(darkVars['--btn-primary-text'], darkVars['--btn-primary-bg']);
      expect(cr).toBeGreaterThanOrEqual(4.5);
    });
  });
});

