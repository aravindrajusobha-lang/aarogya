export const theme = {
  colors: {
    bg: '#F4F8F5', surface: '#FFFFFF', surfaceAlt: '#F7FAF8', border: '#E2EBE5',
    text: '#13261B', textSecondary: '#4B5D52', textMuted: '#74857A',
    primary: '#1F8A4C', primaryStrong: '#176D3B', primarySoft: '#E3F3E8', primaryTint: '#C9E9D3',
    accent: '#F59E0B', danger: '#C0392B', dangerSoft: '#FDECEA', warning: '#B45309', warningSoft: '#FEF3C7',
    darkBg: '#0D1611', darkSurface: '#142019', darkText: '#E6F1EA'
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 12, lg: 16, full: 999 },
  type: { small: 12, body: 16, title: 22, display: 30 },
  shadow: { color: '#102818', opacity: 0.07, radius: 9, offset: { width: 0, height: 4 }, elevation: 2 }
} as const;

