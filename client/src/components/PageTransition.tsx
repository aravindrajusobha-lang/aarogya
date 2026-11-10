import React, { useEffect, useState } from 'react';
import '../styles/pageTransitions.css';

export interface PageTransitionProps {
  routeKey: string;
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ routeKey, children }) => {
  const [showScanline, setShowScanline] = useState(false);

  useEffect(() => {
    // Instant reset to top without scroll animation (In-Place Switch)
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }

    // Trigger high-tech scanline beam during dashboard/page switch
    setShowScanline(true);
    const timer = setTimeout(() => setShowScanline(false), 460);
    return () => clearTimeout(timer);
  }, [routeKey]);

  return (
    <>
      {showScanline && <div className="page-scanline" key={`scanline-${routeKey}`} />}
      <div key={routeKey} className="route-transition-wrapper">
        {children}
      </div>
    </>
  );
};

export default PageTransition;

