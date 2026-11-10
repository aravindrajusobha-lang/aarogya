import React from 'react';
import { TourStep } from './types';
import { LanguageCode } from '../../i18n';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'step-welcome',
    title: 'Welcome to Aarogya-Drishti!',
    description:
      'I am Drishti, your clinical guide. I will guide you through our community oral mucosal screening and healthcare navigation platform engineered for remote tribal settlements across the Eastern Ghats.',
    targetTab: 'dashboard',
    animation: 'greeting',
    expression: 'smiling',
    gesture: 'wave',
  },
  {
    id: 'step-dashboard',
    title: 'Operations Dashboard & KPIs',
    description:
      'Track real-time healthcare metrics: active tribal habitations screened, completed clinical evaluations, scheduled outreach camps, and offline sync ledgers.',
    targetTab: 'dashboard',
    highlightSelector: '.kpi-summary-grid',
    animation: 'pointing',
    expression: 'professional',
    gesture: 'point_right',
  },
  {
    id: 'step-screening',
    title: 'Clinical Screening & Demo AI',
    description:
      'Frontline ASHA and ANM workers capture mucosal visual photos with SHA-256 cryptographic hashing. Our DEMO AI provides non-diagnostic risk support for Medical Officer review.',
    targetTab: 'screening',
    highlightSelector: '.header-quick-nav button:nth-child(2)',
    animation: 'demonstrating',
    expression: 'professional',
    gesture: 'open_hand',
  },
  {
    id: 'step-camps',
    title: 'Outreach Screening Camps',
    description:
      'Schedule and govern outreach screening camps across tribal mandals. All small-cohort aggregates (< 5) are automatically suppressed to guarantee beneficiary privacy.',
    targetTab: 'camps',
    highlightSelector: '.header-quick-nav button:nth-child(3)',
    animation: 'pointing',
    expression: 'thoughtful',
    gesture: 'point_right',
  },
  {
    id: 'step-patients',
    title: 'Patient Registry & Offline Sync',
    description:
      'Designed for zero cellular connectivity! Frontline workers record patients OTP-free into an AES-GCM-256 WebCrypto encrypted offline queue that syncs idempotently when online.',
    targetTab: 'patients',
    highlightSelector: '.header-quick-nav button:nth-child(4)',
    animation: 'explaining',
    expression: 'friendly',
    gesture: 'open_hand',
  },
  {
    id: 'step-map',
    title: 'ASR District 22-Mandal GIS Map',
    description:
      'Explore all 22 tribal mandals across Paderu and Rampachodavaram divisions, 450+ Gram Panchayats, village access difficulty ratings, and nearby hospital networks.',
    targetTab: 'asr-map',
    highlightSelector: '.header-quick-nav button:nth-child(5)',
    animation: 'happy',
    expression: 'smiling',
    gesture: 'thumbs_up',
  },
];

export interface OnboardingTourProps {
  isActive?: boolean;
  stepIndex?: number;
  currentStepIndex?: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  onNavigateTab?: (tabId: string) => void;
  currentLang?: LanguageCode;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isActive = true,
  stepIndex,
  currentStepIndex,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  onNavigateTab,
  currentLang = 'en',
}) => {
  if (!isActive) return null;

  const activeIndex = currentStepIndex !== undefined ? currentStepIndex : (stepIndex || 0);
  const currentStep = TOUR_STEPS[activeIndex] || TOUR_STEPS[0];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === TOUR_STEPS.length - 1;

  const handleStepAction = () => {
    onNavigateTab?.(currentStep.targetTab);
  };

  return (
    <div
      className="onboarding-tour-card"
      style={{
        background: 'var(--white)',
        border: '2px solid var(--coral)',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '0 12px 36px rgba(32, 41, 67, 0.2)',
        maxWidth: '460px',
        position: 'relative',
        zIndex: 1000,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.2rem' }}>👩‍⚕️</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Interactive App Tour ({currentLang.toUpperCase()}) • Step {activeIndex + 1} of {TOUR_STEPS.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--slate-soft)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
          title="Skip Tour"
        >
          Skip ✕
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{ height: '4px', background: 'var(--line)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((activeIndex + 1) / TOUR_STEPS.length) * 100}%`,
            background: 'var(--coral)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Title & Description */}
      <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: 'var(--slate)', margin: '0 0 6px 0', fontWeight: 600 }}>
        {currentStep.title}
      </h4>
      <p style={{ fontSize: '0.86rem', color: 'var(--slate-soft)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
        {currentStep.description}
      </p>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          onClick={handleStepAction}
          className="button-outline"
          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
        >
          👉 View {currentStep.targetTab.toUpperCase()}
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          {!isFirst && (
            <button
              type="button"
              onClick={onPrev}
              className="button-dark"
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={isLast ? onComplete : onNext}
            className="button-coral"
            style={{ fontSize: '0.78rem', padding: '5px 16px', fontWeight: 700 }}
          >
            {isLast ? 'Finish Tour ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};
