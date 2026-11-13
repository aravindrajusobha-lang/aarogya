import React from 'react';

type IconProps = { size?: number; className?: string };
const make = (paths: React.ReactNode) => ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths}</svg>
);

export const Icon = {
  home: make(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>),
  calendar: make(<><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" /></>),
  history: make(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4.5h4.5" /><path d="M12 7.5V12l3 2" /></>),
  pill: make(<><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>),
  file: make(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  bell: make(<><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  user: make(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  logout: make(<><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>),
  camera: make(<><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>),
  video: make(<><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /></>),
  clinic: make(<><path d="M4 21V8l8-5 8 5v13" /><path d="M10 21v-5h4v5M12 8v4M10 10h4" /></>),
  arrow: make(<path d="M5 12h14M13 6l6 6-6 6" />),
  chevron: make(<path d="m9 6 6 6-6 6" />),
  menu: make(<path d="M4 7h16M4 12h16M4 17h16" />),
  x: make(<path d="M6 6l12 12M18 6 6 18" />),
  check: make(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  clock: make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  repeat: make(<><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" /></>),
  shield: make(<><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.4 7.5 9.5 4.3-1.1 7.5-5 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></>),
  alert: make(<><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.01" /></>),
  stethoscope: make(<><path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M10 12v3a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></>),
  users: make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  scan: make(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></>),
  share: make(<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></>),
  phone: make(<><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>),
  play: make(<path d="M7 4.5v15l12-7.5z" />),
  stop: make(<rect x="6" y="6" width="12" height="12" rx="2" />),
};

/** High-resolution mark cropped from the supplied full logo artwork. */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <img className="adp-brand-badge" src="/brand/aarogya-mark.png" alt="" aria-hidden="true" width={size} height={size} style={{ display: 'block', flex: 'none', objectFit: 'contain' }} />
);
