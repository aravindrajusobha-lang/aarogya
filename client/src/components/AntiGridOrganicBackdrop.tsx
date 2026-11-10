import React from 'react';

/**
 * AntiGridOrganicBackdrop
 * 
 * Faithfully recreates the ambient organic visual language from:
 * https://bbdirector.com/wp-content/uploads/2026/01/Anti-Grid-organic-layouts.png
 * 
 * Features:
 * - Fluid, overlapping translucent organic blobs in terracotta amber, deep twilight slate, and misty jade.
 * - Continuous thin wire contour lines (looping bezier paths) weaving across the screen.
 * - Subtle geometric ring halos that add architectural rhythm to the organic flow.
 */
export const AntiGridOrganicBackdrop: React.FC = () => {
  return (
    <div className="anti-grid-organic-canvas" aria-hidden="true">
      <svg
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className="anti-grid-ambient-svg"
      >
        <defs>
          {/* Terracotta / Burnt Amber Radiant Gradient */}
          <linearGradient id="blobTerracotta" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#ea580c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#9a3412" stopOpacity="0.3" />
          </linearGradient>

          {/* Deep Twilight Slate Navy Gradient */}
          <linearGradient id="blobTwilight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312e81" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#1e1b4b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.6" />
          </linearGradient>

          {/* Misty Mountain Teal / Jade Gradient */}
          <linearGradient id="blobTealMist" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#059669" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#042f2e" stopOpacity="0.4" />
          </linearGradient>

          {/* Soft Filter Glow */}
          <filter id="softOrganicBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>

        {/* --- Large Organic Fluid Blobs (from reference image) --- */}
        {/* Top-Right Terracotta Blob */}
        <path
          d="M920 -80 C1120 -120, 1480 40, 1460 280 C1440 480, 1200 460, 1020 380 C860 300, 800 120, 920 -80 Z"
          fill="url(#blobTerracotta)"
          filter="url(#softOrganicBlur)"
        />

        {/* Top-Left Twilight Slate Wave */}
        <path
          d="M-100 -40 C140 -80, 480 60, 440 280 C400 440, 180 520, -60 480 C-220 440, -280 180, -100 -40 Z"
          fill="url(#blobTwilight)"
          filter="url(#softOrganicBlur)"
        />

        {/* Central Undulating Mountain Contour Wave */}
        <path
          d="M-80 480 Q320 320, 720 540 T1520 420 L1520 980 L-80 980 Z"
          fill="url(#blobTwilight)"
          opacity="0.35"
        />

        {/* Bottom-Right Terracotta Ambient Pool */}
        <path
          d="M980 620 C1140 560, 1420 640, 1400 840 C1380 980, 1160 1020, 960 940 C820 880, 840 680, 980 620 Z"
          fill="url(#blobTerracotta)"
          filter="url(#softOrganicBlur)"
        />

        {/* Bottom-Left Misty Mountain Teal Blob */}
        <path
          d="M-60 680 C120 620, 380 720, 360 920 C340 1040, 80 1080, -80 1020 C-180 980, -160 760, -60 680 Z"
          fill="url(#blobTealMist)"
          filter="url(#softOrganicBlur)"
        />

        {/* --- Continuous Thin Wire Contour Lines (from reference image) --- */}
        {/* Upper Looping Wire Path */}
        <path
          d="M120 180 C260 80, 460 110, 480 260 C500 420, 240 440, 200 320 C160 220, 320 160, 480 180"
          stroke="rgba(251, 146, 60, 0.4)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 2"
        />

        {/* Central Flowing Sinusoidal Wave Line */}
        <path
          d="M-40 580 C280 420, 520 720, 860 480 C1140 280, 1380 460, 1500 380"
          stroke="rgba(251, 146, 60, 0.45)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Secondary White/Misty Contour Wire */}
        <path
          d="M-20 620 C320 480, 600 760, 920 540 C1180 360, 1400 520, 1480 440"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Architectural Rings & Floating Circles (as in reference image) */}
        <circle cx="860" cy="320" r="140" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.2" fill="none" />
        <circle cx="1180" cy="420" r="60" stroke="rgba(251, 146, 60, 0.35)" strokeWidth="1.4" fill="none" />
        <circle cx="280" cy="740" r="100" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
};
