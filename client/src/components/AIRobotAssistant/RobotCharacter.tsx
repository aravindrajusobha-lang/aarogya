import React from 'react';

export type RobotState =
  | 'idle'
  | 'hover'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error';

interface RobotCharacterProps {
  state: RobotState;
  size?: number; // Size in px
  className?: string;
  onClick?: () => void;
  showTooltip?: boolean;
  tooltipText?: string;
}

export const RobotCharacter: React.FC<RobotCharacterProps> = ({
  state = 'idle',
  size = 72,
  className = '',
  onClick,
  showTooltip = false,
  tooltipText = 'Click to chat with Drishti AI',
}) => {
  return (
    <div
      className={`robot-character-wrapper robot-state-${state} ${className}`}
      onClick={onClick}
      role="img"
      aria-label={`AI Robotic Assistant (${state})`}
      style={{
        width: size,
        height: size,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {showTooltip && (
        <div className="robot-tooltip-bubble" aria-hidden="true">
          <span>{tooltipText}</span>
        </div>
      )}

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className="robot-svg-canvas"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Futuristic Cyan/Blue Visor Gradient */}
          <linearGradient id="robotHelmetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>

          {/* Cyan Glow Gradient */}
          <linearGradient id="robotCyanGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Electric Eye Matrix Glow */}
          <radialGradient id="eyeGlowRadial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="1" />
            <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
          </radialGradient>

          {/* Visor Screen Dark Gradient */}
          <linearGradient id="visorScreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#040b17" />
            <stop offset="100%" stopColor="#08182f" />
          </linearGradient>

          {/* Outer Ambient Aura Filter */}
          <filter id="neonCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Antenna Pulse Glow */}
          <filter id="antennaGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Floating Glow Halo */}
        <circle
          cx="60"
          cy="66"
          r="48"
          fill="none"
          stroke={
            state === 'error'
              ? 'rgba(239, 68, 68, 0.25)'
              : state === 'listening'
              ? 'rgba(56, 189, 248, 0.45)'
              : 'rgba(6, 182, 212, 0.2)'
          }
          strokeWidth="3"
          className="robot-ambient-halo"
        />

        {/* --- 1. ANTENNA & TRANSMISSION RINGS --- */}
        <g className="robot-antenna-assembly">
          {/* Animated Signal Waves (Listening / Speaking / Thinking) */}
          {(state === 'listening' || state === 'speaking' || state === 'thinking') && (
            <g className="antenna-signal-rings" filter="url(#antennaGlow)">
              <circle
                cx="60"
                cy="14"
                r="10"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                className="antenna-wave wave-1"
              />
              <circle
                cx="60"
                cy="14"
                r="16"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.2"
                className="antenna-wave wave-2"
              />
            </g>
          )}

          {/* Metallic Antenna Stem */}
          <rect
            x="58"
            y="18"
            width="4"
            height="14"
            rx="2"
            fill="#64748b"
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Antenna Tip Orb */}
          <circle
            cx="60"
            cy="14"
            r="6"
            fill={state === 'error' ? '#ef4444' : '#00f0ff'}
            filter="url(#antennaGlow)"
            className="antenna-bulb"
          />
          <circle cx="58" cy="12" r="2" fill="#ffffff" opacity="0.8" />
        </g>

        {/* --- 2. EAR PODS / AUDIO TRANSDUCERS (LEFT & RIGHT) --- */}
        <g className="robot-earpods">
          {/* Left Earpod */}
          <rect
            x="14"
            y="52"
            width="8"
            height="26"
            rx="4"
            fill="#334155"
            stroke="#0284c7"
            strokeWidth="1.5"
          />
          <rect x="12" y="58" width="4" height="14" rx="2" fill="#38bdf8" />

          {/* Right Earpod */}
          <rect
            x="98"
            y="52"
            width="8"
            height="26"
            rx="4"
            fill="#334155"
            stroke="#0284c7"
            strokeWidth="1.5"
          />
          <rect x="104" y="58" width="4" height="14" rx="2" fill="#38bdf8" />
        </g>

        {/* --- 3. ROBOT HEAD CHASSIS (FUTURISTIC HELMET) --- */}
        <g className="robot-head-chassis">
          {/* Outer Helmet Shell */}
          <rect
            x="20"
            y="30"
            width="80"
            height="72"
            rx="26"
            fill="url(#robotHelmetGrad)"
            stroke="#0284c7"
            strokeWidth="2.5"
          />

          {/* Top Chassis Bevel Highlight */}
          <path
            d="M 32 32 Q 60 27 88 32"
            fill="none"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="2"
          />

          {/* Cyber Neck Connector */}
          <rect x="48" y="102" width="24" height="8" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <line x1="54" y1="104" x2="54" y2="108" stroke="#06b6d4" strokeWidth="1.5" />
          <line x1="60" y1="104" x2="60" y2="108" stroke="#06b6d4" strokeWidth="1.5" />
          <line x1="66" y1="104" x2="66" y2="108" stroke="#06b6d4" strokeWidth="1.5" />
        </g>

        {/* --- 4. VISOR SCREEN (DIGITAL DISPLAY) --- */}
        <g className="robot-visor-screen">
          <rect
            x="28"
            y="42"
            width="64"
            height="50"
            rx="16"
            fill="url(#visorScreenGrad)"
            stroke="rgba(6, 182, 212, 0.4)"
            strokeWidth="1.5"
          />
          {/* Glass Visor Curved Reflection Highlight */}
          <path
            d="M 34 46 Q 60 43 82 48"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
          />
        </g>

        {/* --- 5. EXPRESSIVE GLOWING EYES & MOUTH (STATE-DRIVEN) --- */}
        <g className="robot-facial-expressions">
          {/* ============ IDLE / HOVER / LISTENING STATE ============ */}
          {(state === 'idle' || state === 'hover' || state === 'listening') && (
            <g className="eyes-idle-group" filter="url(#neonCyanGlow)">
              {/* Left Eye */}
              <g className="eye-left-anim">
                <rect
                  x="40"
                  y="53"
                  width="13"
                  height={state === 'listening' ? '16' : '14'}
                  rx="4"
                  fill="#00f0ff"
                  className="eye-rect eye-blink"
                />
                <circle cx="44" cy="56" r="2" fill="#ffffff" />
              </g>

              {/* Right Eye */}
              <g className="eye-right-anim">
                <rect
                  x="67"
                  y="53"
                  width="13"
                  height={state === 'listening' ? '16' : '14'}
                  rx="4"
                  fill="#00f0ff"
                  className="eye-rect eye-blink"
                />
                <circle cx="71" cy="56" r="2" fill="#ffffff" />
              </g>

              {/* Gentle Smiling Mouth Indicator */}
              <path
                d="M 52 76 Q 60 81 68 76"
                fill="none"
                stroke="#00f0ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="mouth-curve"
              />
            </g>
          )}

          {/* ============ THINKING STATE (Scanning / Puzzled) ============ */}
          {state === 'thinking' && (
            <g className="eyes-thinking-group" filter="url(#neonCyanGlow)">
              {/* Left Scanning Eye */}
              <circle cx="46" cy="59" r="6" fill="#38bdf8" className="thinking-orb-left" />
              <circle cx="46" cy="59" r="2" fill="#ffffff" />

              {/* Right Scanning Eye */}
              <circle cx="74" cy="59" r="6" fill="#38bdf8" className="thinking-orb-right" />
              <circle cx="74" cy="59" r="2" fill="#ffffff" />

              {/* Thinking Scanning Line */}
              <line
                x1="40"
                y1="59"
                x2="80"
                y2="59"
                stroke="rgba(56, 189, 248, 0.4)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="thinking-scan-beam"
              />

              {/* Small Inquisitive Mouth Dot */}
              <circle cx="60" cy="77" r="3" fill="#38bdf8" />
            </g>
          )}

          {/* ============ SPEAKING STATE (Audio Equalizer Wave) ============ */}
          {state === 'speaking' && (
            <g className="eyes-speaking-group" filter="url(#neonCyanGlow)">
              {/* Alert Bright Eyes */}
              <rect x="40" y="52" width="13" height="15" rx="4" fill="#00f0ff" />
              <circle cx="43" cy="55" r="2" fill="#ffffff" />

              <rect x="67" y="52" width="13" height="15" rx="4" fill="#00f0ff" />
              <circle cx="70" cy="55" r="2" fill="#ffffff" />

              {/* Dynamic Sound Wave Equalizer Mouth Bars */}
              <g className="speaking-audio-equalizer">
                <rect x="46" y="73" width="3" height="8" rx="1.5" fill="#38bdf8" className="eq-bar bar-1" />
                <rect x="52" y="71" width="3" height="12" rx="1.5" fill="#00f0ff" className="eq-bar bar-2" />
                <rect x="58.5" y="70" width="3" height="14" rx="1.5" fill="#ffffff" className="eq-bar bar-3" />
                <rect x="65" y="71" width="3" height="12" rx="1.5" fill="#00f0ff" className="eq-bar bar-4" />
                <rect x="71" y="73" width="3" height="8" rx="1.5" fill="#38bdf8" className="eq-bar bar-5" />
              </g>
            </g>
          )}

          {/* ============ SUCCESS STATE (Happy upward arcs ^ ^) ============ */}
          {state === 'success' && (
            <g className="eyes-success-group" filter="url(#neonCyanGlow)">
              {/* Happy Left Eye Arc */}
              <path
                d="M 38 61 Q 46 51 54 61"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Happy Right Eye Arc */}
              <path
                d="M 66 61 Q 74 51 82 61"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Cheerful Grin */}
              <path
                d="M 50 74 Q 60 83 70 74"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* ============ ERROR / WARNING STATE ============ */}
          {state === 'error' && (
            <g className="eyes-error-group" filter="url(#neonCyanGlow)">
              {/* Concerned Tilted Left Eye */}
              <line
                x1="40"
                y1="54"
                x2="52"
                y2="60"
                stroke="#f43f5e"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Concerned Tilted Right Eye */}
              <line
                x1="80"
                y1="54"
                x2="68"
                y2="60"
                stroke="#f43f5e"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Concerned Inverted Mouth */}
              <path
                d="M 53 79 Q 60 74 67 79"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

