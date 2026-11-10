import React from 'react';
import { LanguageCode } from '../i18n';
import { OralAnatomyExplorer3D, OralAnatomicalPart } from './OralAnatomyExplorer3D';
import '../styles/oral3DAnimation.css';

export interface Oral3DHealthcareAnimationProps {
  currentLang?: LanguageCode;
  initialTheme?: 'blueprint' | 'cyber' | 'clinical';
  onLayerSelect?: (layerId: string) => void;
  compact?: boolean;
  onNavigateScreening?: () => void;
}

/**
 * Oral3DHealthcareAnimation (Phase 21 Upgrade)
 * Replaces old single-tooth implant animation with the futuristic
 * 3D Human Oral Anatomy & Health Explorer (Matches User Design Target).
 */
export const Oral3DHealthcareAnimation: React.FC<Oral3DHealthcareAnimationProps> = ({
  currentLang = 'te',
  onLayerSelect,
  compact = false,
  onNavigateScreening,
}) => {
  return (
    <OralAnatomyExplorer3D
      currentLang={currentLang}
      compact={compact}
      onSelectPart={(part: OralAnatomicalPart) => {
        if (onLayerSelect) onLayerSelect(part.id);
      }}
      onNavigateScreening={onNavigateScreening}
    />
  );
};

export default Oral3DHealthcareAnimation;
