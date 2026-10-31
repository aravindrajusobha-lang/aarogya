import React from 'react';

export const SimulationBanner: React.FC = () => {
  return (
    <div className="simulation-banner" role="alert" aria-label="Simulation Notice">
      <span className="banner-icon">⚠️</span>
      <span>SIMULATION SYSTEM — DEMO DATA ONLY — NOT FOR CLINICAL USE</span>
      <span className="banner-tag">[AAROHAN 2026 ITDA PADERU]</span>
    </div>
  );
};
