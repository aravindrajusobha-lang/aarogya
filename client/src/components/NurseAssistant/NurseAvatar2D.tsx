import React, { useState, useEffect } from 'react';
import { AnimationState, NurseExpression, NurseGesture } from './types';

export interface NurseAvatar2DProps {
  animationState: AnimationState;
  expression?: NurseExpression;
  gesture?: NurseGesture;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  width?: number | string;
  height?: number | string;
  mode?: 'portrait' | 'full';
  className?: string;
  onCanvasClick?: () => void;
}

// 9 Emotional gesture busts on bottom row of official reference sheet (1024x682)
// Bottom half begins at Y: 341px (50%) to 682px (100%)
// Width of each bust is 1024 / 9 = ~113.78px (11.111%)
const EXPRESSION_FRAMES: Record<string, { xPercent: number; yPercent: number; label: string; emoji: string }> = {
  // Frame 0: Warm Smile with hands together (Greeting / Default)
  greeting: { xPercent: 0, yPercent: 100, label: 'Greeting', emoji: '👋' },
  smiling: { xPercent: 0, yPercent: 100, label: 'Welcoming', emoji: '😊' },
  friendly: { xPercent: 0, yPercent: 100, label: 'Friendly', emoji: '✨' },

  // Frame 1: Cheerful eyes-closed smile (Happy / Success)
  happy: { xPercent: 12.5, yPercent: 100, label: 'Happy', emoji: '🌟' },
  success: { xPercent: 12.5, yPercent: 100, label: 'Success', emoji: '✅' },

  // Frame 2: Hand-to-chin thoughtful pose (Thinking)
  thinking: { xPercent: 25, yPercent: 100, label: 'Thinking', emoji: '🤔' },
  thoughtful: { xPercent: 25, yPercent: 100, label: 'Reviewing', emoji: '💭' },

  // Frame 3: Open hand explaining forward (Explaining / Demonstrating)
  explaining: { xPercent: 37.5, yPercent: 100, label: 'Explaining', emoji: '🗣️' },
  demonstrating: { xPercent: 37.5, yPercent: 100, label: 'Demonstrating', emoji: '🩺' },

  // Frame 4: Pointing finger upward / forward (Pointing / Guiding)
  pointing: { xPercent: 50, yPercent: 100, label: 'Guiding', emoji: '👉' },

  // Frame 5: Hands covering mouth / concerned (Warning / Caution)
  warning: { xPercent: 62.5, yPercent: 100, label: 'Warning', emoji: '⚠️' },
  error: { xPercent: 62.5, yPercent: 100, label: 'Attention', emoji: '❗' },

  // Frame 6: Thumbs up with winking eye (Encouraging)
  winking: { xPercent: 75, yPercent: 100, label: 'Great Job', emoji: '👍' },
  thumbs_up: { xPercent: 75, yPercent: 100, label: 'Confirmed', emoji: '👍' },

  // Frame 7: Attentive listening pose (Listening)
  listening: { xPercent: 87.5, yPercent: 100, label: 'Listening', emoji: '👂' },
  attentive: { xPercent: 87.5, yPercent: 100, label: 'Attentive', emoji: '📝' },

  // Frame 8: Eyes closed calm / peaceful (Calm / Empathetic)
  calm: { xPercent: 100, yPercent: 100, label: 'Calm', emoji: '🌸' },
  empathetic: { xPercent: 100, yPercent: 100, label: 'Caring', emoji: '💙' },
  idle: { xPercent: 0, yPercent: 100, label: 'Ready', emoji: '👩‍⚕️' },
};

// 8 Full body turnaround poses on top row (0% Y)
// Width of each full body is 1024 / 8 = 128px (12.5%)
const FULL_BODY_FRAMES: Record<string, { xPercent: number }> = {
  front: { xPercent: 0 },
  three_quarter_left: { xPercent: 14.28 },
  side_left: { xPercent: 28.57 },
  back: { xPercent: 42.85 },
  side_right: { xPercent: 57.14 },
  three_quarter_right: { xPercent: 71.42 },
  presenting: { xPercent: 100 },
};

export const NurseAvatar2D: React.FC<NurseAvatar2DProps> = ({
  animationState,
  expression,
  gesture,
  isSpeaking,
  isListening,
  isThinking,
  width = '100%',
  height = '100%',
  mode = 'portrait',
  className = '',
  onCanvasClick,
}) => {
  const [viewMode, setViewMode] = useState<'portrait' | 'full'>(mode);
  const [blinkActive, setBlinkActive] = useState<boolean>(false);

  // Periodic natural eye blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkActive(true);
      setTimeout(() => setBlinkActive(false), 160);
    }, 3800 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Determine emotional sprite frame
  const frameKey =
    animationState === 'warning' || animationState === 'error'
      ? 'warning'
      : animationState === 'thinking'
      ? 'thinking'
      : animationState === 'listening'
      ? 'listening'
      : animationState === 'pointing'
      ? 'pointing'
      : animationState === 'explaining' || animationState === 'demonstrating'
      ? 'explaining'
      : animationState === 'happy' || animationState === 'success'
      ? 'happy'
      : expression && EXPRESSION_FRAMES[expression]
      ? expression
      : gesture && EXPRESSION_FRAMES[gesture]
      ? gesture
      : EXPRESSION_FRAMES[animationState]
      ? animationState
      : 'greeting';

  const currentFrame = EXPRESSION_FRAMES[frameKey] || EXPRESSION_FRAMES.greeting;

  // Full body frame selection
  const fullBodyKey =
    animationState === 'pointing' || animationState === 'explaining'
      ? 'presenting'
      : animationState === 'thinking'
      ? 'three_quarter_left'
      : 'front';

  const currentFullBody = FULL_BODY_FRAMES[fullBodyKey] || FULL_BODY_FRAMES.front;

  return (
    <div
      className={`nurse-2d-viewport-wrapper ${className} state-${animationState} ${isSpeaking ? 'is-speaking' : ''} ${isListening ? 'is-listening' : ''} ${isThinking ? 'is-thinking' : ''}`}
      style={{
        position: 'relative',
        width: width || '100%',
        height: height || '100%',
        minHeight: height ? undefined : '260px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 35%, rgba(6, 78, 59, 0.45) 0%, rgba(15, 23, 42, 0.95) 85%)',
        borderRadius: '14px',
        border: '1.5px solid rgba(52, 211, 153, 0.35)',
        boxShadow: isSpeaking
          ? '0 0 20px rgba(52, 211, 153, 0.5), inset 0 0 15px rgba(6, 78, 59, 0.4)'
          : isListening
          ? '0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 15px rgba(127, 29, 29, 0.4)'
          : '0 8px 24px rgba(0, 0, 0, 0.45), inset 0 0 15px rgba(6, 78, 59, 0.25)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onCanvasClick}
      title="Drishti AI • 2D Animated Nurse Assistant"
    >
      {/* Ambient Glow Aura */}
      <div
        className="nurse-2d-glow-aura"
        style={{
          position: 'absolute',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: isSpeaking
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, transparent 70%)'
            : isListening
            ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, transparent 70%)'
            : isThinking
            ? 'radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, transparent 70%)',
          animation: 'nursePulseGlow 3s infinite ease-in-out',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Animated 2D Character Sprite Viewport */}
      <div
        className={`nurse-2d-sprite-container ${isSpeaking ? 'anim-speaking' : ''} ${isThinking ? 'anim-thinking' : 'anim-breathing'}`}
        style={{
          position: 'relative',
          width: viewMode === 'portrait' ? '180px' : '150px',
          height: viewMode === 'portrait' ? '190px' : '230px',
          borderRadius: viewMode === 'portrait' ? '50%' : '12px',
          overflow: 'hidden',
          border: viewMode === 'portrait' ? '3px solid rgba(52, 211, 153, 0.6)' : 'none',
          boxShadow: viewMode === 'portrait' ? '0 8px 25px rgba(0, 0, 0, 0.6)' : 'none',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
        }}
      >
        {/* Spritesheet mapped to official 1024x682 asset */}
        <div
          className="nurse-spritesheet-crop"
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: 'url(/assets/nurse/nurse-reference-sheet.png)',
            backgroundRepeat: 'no-repeat',
            // Portrait mode zooms into the 9 bottom-row emotion busts
            // Full mode zooms into top-row full body turnarounds
            backgroundSize: viewMode === 'portrait' ? '900% 200%' : '800% 200%',
            backgroundPosition:
              viewMode === 'portrait'
                ? `${currentFrame.xPercent}% 100%`
                : `${currentFullBody.xPercent}% 0%`,
            filter: blinkActive
              ? 'brightness(0.92) contrast(1.05)'
              : isThinking
              ? 'hue-rotate(-10deg) brightness(1.02)'
              : 'none',
            transform: isSpeaking
              ? 'scale(1.04)'
              : 'scale(1.0)',
            transition: 'background-position 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease, filter 0.15s ease',
          }}
        />

        {/* Eye-blink gentle shutter overlay */}
        {blinkActive && viewMode === 'portrait' && (
          <div
            style={{
              position: 'absolute',
              top: '42%',
              left: '32%',
              width: '36%',
              height: '8%',
              background: 'rgba(251, 208, 180, 0.85)',
              borderRadius: '4px',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Floating State Badge & Reaction Bubble */}
      <div
        className="nurse-2d-status-pill"
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(52, 211, 153, 0.4)',
          borderRadius: '20px',
          padding: '4px 10px',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: '#34d399',
          backdropFilter: 'blur(8px)',
          zIndex: 3,
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>{currentFrame.emoji}</span>
        <span>{currentFrame.label.toUpperCase()}</span>
        {isSpeaking && (
          <span className="speech-wave-indicator" style={{ display: 'inline-flex', gap: '2px', marginLeft: '4px' }}>
            <span style={{ width: '2px', height: '10px', background: '#34d399', animation: 'waveBarAnim 0.7s infinite' }} />
            <span style={{ width: '2px', height: '14px', background: '#34d399', animation: 'waveBarAnim 0.7s infinite 0.2s' }} />
            <span style={{ width: '2px', height: '8px', background: '#34d399', animation: 'waveBarAnim 0.7s infinite 0.4s' }} />
          </span>
        )}
      </div>

      {/* View Switcher Controls (Portrait vs Full Body) */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 3,
          display: 'flex',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewMode((prev) => (prev === 'portrait' ? 'full' : 'portrait'));
          }}
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            color: '#e2e8f0',
            fontSize: '0.68rem',
            padding: '3px 8px',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.15s ease',
          }}
          title={viewMode === 'portrait' ? 'Switch to Full Body View' : 'Switch to Portrait View'}
        >
          {viewMode === 'portrait' ? '👤 Portrait' : '🧍 Full Body'}
        </button>
      </div>
    </div>
  );
};

