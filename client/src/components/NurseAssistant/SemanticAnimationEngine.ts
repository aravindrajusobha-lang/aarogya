import { AnimationState, NurseExpression, NurseGesture } from './types';

export interface AnimationProfile {
  state: AnimationState;
  expression: NurseExpression;
  gesture: NurseGesture;
  headTilt: number; // in radians
  headPitch: number; // in radians
  eyeTrackingSpeed: number;
  breathingRate: number; // multiplier
  torsoSway: number;
  leftArmAngle: { x: number; y: number; z: number };
  rightArmAngle: { x: number; y: number; z: number };
  textureFrameIndex: number; // index in 9-expression bottom row
  bodyTurnAngle: number; // in radians (0 = front)
  defaultDurationMs: number;
}

export const ANIMATION_PROFILES: Record<AnimationState, AnimationProfile> = {
  greeting: {
    state: 'greeting',
    expression: 'smiling',
    gesture: 'wave',
    headTilt: 0.08,
    headPitch: -0.04,
    eyeTrackingSpeed: 0.08,
    breathingRate: 1.1,
    torsoSway: 0.02,
    leftArmAngle: { x: 0.1, y: 0.0, z: 0.05 },
    rightArmAngle: { x: -0.7, y: 0.2, z: 0.8 }, // waving right arm
    textureFrameIndex: 0, // warm smile
    bodyTurnAngle: 0.0,
    defaultDurationMs: 4000,
  },
  idle: {
    state: 'idle',
    expression: 'friendly',
    gesture: 'open_hand',
    headTilt: 0.0,
    headPitch: 0.0,
    eyeTrackingSpeed: 0.04,
    breathingRate: 1.0,
    torsoSway: 0.015,
    leftArmAngle: { x: 0.1, y: 0.0, z: 0.08 },
    rightArmAngle: { x: 0.1, y: 0.0, z: -0.08 },
    textureFrameIndex: 0, // friendly resting
    bodyTurnAngle: 0.0,
    defaultDurationMs: 0, // continuous
  },
  listening: {
    state: 'listening',
    expression: 'attentive',
    gesture: 'open_hand',
    headTilt: 0.06,
    headPitch: 0.05,
    eyeTrackingSpeed: 0.12,
    breathingRate: 0.9,
    torsoSway: 0.01,
    leftArmAngle: { x: 0.15, y: 0.05, z: 0.1 },
    rightArmAngle: { x: 0.15, y: -0.05, z: -0.1 },
    textureFrameIndex: 0,
    bodyTurnAngle: 0.0,
    defaultDurationMs: 0, // stays until speech ends
  },
  thinking: {
    state: 'thinking',
    expression: 'thoughtful',
    gesture: 'hand_to_chin',
    headTilt: -0.12,
    headPitch: -0.08,
    eyeTrackingSpeed: 0.02,
    breathingRate: 0.8,
    torsoSway: 0.01,
    leftArmAngle: { x: 0.4, y: 0.2, z: 0.3 }, // folded left arm
    rightArmAngle: { x: -0.9, y: 0.3, z: 0.4 }, // hand to chin
    textureFrameIndex: 2, // thinking face
    bodyTurnAngle: -0.05,
    defaultDurationMs: 4500,
  },
  explaining: {
    state: 'explaining',
    expression: 'professional',
    gesture: 'open_hand',
    headTilt: 0.04,
    headPitch: -0.02,
    eyeTrackingSpeed: 0.06,
    breathingRate: 1.2,
    torsoSway: 0.03,
    leftArmAngle: { x: -0.4, y: 0.3, z: 0.4 },
    rightArmAngle: { x: -0.5, y: -0.3, z: -0.5 },
    textureFrameIndex: 3, // explaining gesture
    bodyTurnAngle: 0.02,
    defaultDurationMs: 6000,
  },
  pointing: {
    state: 'pointing',
    expression: 'professional',
    gesture: 'point_right',
    headTilt: -0.05,
    headPitch: 0.0,
    eyeTrackingSpeed: 0.08,
    breathingRate: 1.0,
    torsoSway: 0.02,
    leftArmAngle: { x: 0.1, y: 0.1, z: 0.1 },
    rightArmAngle: { x: -0.85, y: -0.4, z: -0.8 }, // pointing right
    textureFrameIndex: 4, // pointing / emphasizing
    bodyTurnAngle: 0.1,
    defaultDurationMs: 5000,
  },
  happy: {
    state: 'happy',
    expression: 'smiling',
    gesture: 'thumbs_up',
    headTilt: 0.1,
    headPitch: -0.06,
    eyeTrackingSpeed: 0.06,
    breathingRate: 1.25,
    torsoSway: 0.04,
    leftArmAngle: { x: 0.1, y: 0.0, z: 0.1 },
    rightArmAngle: { x: -0.6, y: -0.2, z: -0.4 },
    textureFrameIndex: 1, // winking confident smile
    bodyTurnAngle: 0.0,
    defaultDurationMs: 4500,
  },
  warning: {
    state: 'warning',
    expression: 'concerned',
    gesture: 'gentle_warning',
    headTilt: -0.04,
    headPitch: 0.06,
    eyeTrackingSpeed: 0.05,
    breathingRate: 1.1,
    torsoSway: 0.015,
    leftArmAngle: { x: 0.2, y: 0.0, z: 0.1 },
    rightArmAngle: { x: -0.75, y: -0.1, z: -0.3 }, // raised caution palm
    textureFrameIndex: 7, // concerned warning
    bodyTurnAngle: 0.0,
    defaultDurationMs: 7000,
  },
  demonstrating: {
    state: 'demonstrating',
    expression: 'smiling',
    gesture: 'open_hand',
    headTilt: 0.05,
    headPitch: -0.03,
    eyeTrackingSpeed: 0.07,
    breathingRate: 1.15,
    torsoSway: 0.025,
    leftArmAngle: { x: -0.3, y: 0.4, z: 0.5 }, // holding clipboard
    rightArmAngle: { x: -0.6, y: -0.4, z: -0.6 }, // open demo gesture
    textureFrameIndex: 3,
    bodyTurnAngle: 0.08,
    defaultDurationMs: 6500,
  },
  empathetic: {
    state: 'empathetic',
    expression: 'calm',
    gesture: 'hands_on_chest',
    headTilt: 0.08,
    headPitch: 0.04,
    eyeTrackingSpeed: 0.04,
    breathingRate: 0.9,
    torsoSway: 0.015,
    leftArmAngle: { x: -0.5, y: 0.4, z: 0.4 }, // hand over chest
    rightArmAngle: { x: -0.5, y: -0.4, z: -0.4 }, // hand over chest
    textureFrameIndex: 5, // gentle empathetic / surprise
    bodyTurnAngle: 0.0,
    defaultDurationMs: 5000,
  },
  success: {
    state: 'success',
    expression: 'smiling',
    gesture: 'thumbs_up',
    headTilt: 0.08,
    headPitch: -0.05,
    eyeTrackingSpeed: 0.08,
    breathingRate: 1.3,
    torsoSway: 0.04,
    leftArmAngle: { x: 0.1, y: 0.0, z: 0.1 },
    rightArmAngle: { x: -0.7, y: -0.1, z: -0.5 }, // thumbs-up gesture
    textureFrameIndex: 6, // thumbs-up celebrate
    bodyTurnAngle: 0.0,
    defaultDurationMs: 5000,
  },
  error: {
    state: 'error',
    expression: 'concerned',
    gesture: 'open_hand',
    headTilt: -0.08,
    headPitch: 0.05,
    eyeTrackingSpeed: 0.05,
    breathingRate: 0.95,
    torsoSway: 0.015,
    leftArmAngle: { x: 0.2, y: 0.1, z: 0.15 },
    rightArmAngle: { x: 0.2, y: -0.1, z: -0.15 },
    textureFrameIndex: 7, // concerned
    bodyTurnAngle: 0.0,
    defaultDurationMs: 5000,
  },
};

export class SemanticAnimationEngine {
  private currentState: AnimationState = 'idle';
  private currentProfile: AnimationProfile = ANIMATION_PROFILES.idle;
  private fallbackTimer: any = null;
  private listeners: Array<(profile: AnimationProfile) => void> = [];

  constructor() {
    this.currentProfile = ANIMATION_PROFILES.idle;
  }

  public getState(): AnimationState {
    return this.currentState;
  }

  public getProfile(): AnimationProfile {
    return this.currentProfile;
  }

  public subscribe(callback: (profile: AnimationProfile) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentProfile);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public setCallbacks(callbacks: {
    onStateChange?: (state: AnimationState, expr: NurseExpression, gest: NurseGesture) => void;
    onResetToIdle?: () => void;
  }): void {
    this.subscribe((profile) => {
      callbacks.onStateChange?.(profile.state, profile.expression, profile.gesture);
      if (profile.state === 'idle') {
        callbacks.onResetToIdle?.();
      }
    });
  }

  public triggerState(
    targetState: AnimationState,
    customExpression?: NurseExpression,
    customGesture?: NurseGesture,
    durationMs?: number
  ): void {
    this.transitionTo(targetState, durationMs, customExpression, customGesture);
  }

  public resetToIdle(): void {
    this.transitionTo('idle');
  }

  public transitionTo(
    targetState: AnimationState,
    durationMs?: number,
    customExpression?: NurseExpression,
    customGesture?: NurseGesture
  ): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    const baseProfile = ANIMATION_PROFILES[targetState] || ANIMATION_PROFILES.idle;
    this.currentState = targetState;
    this.currentProfile = {
      ...baseProfile,
      expression: customExpression || baseProfile.expression,
      gesture: customGesture || baseProfile.gesture,
    };

    // Notify all visual and 3D rig listeners
    this.notifyListeners();

    // Determine auto-revert to idle
    const duration = durationMs !== undefined ? durationMs : baseProfile.defaultDurationMs;
    if (duration > 0 && targetState !== 'idle' && targetState !== 'listening') {
      this.fallbackTimer = setTimeout(() => {
        this.transitionTo('idle');
      }, duration);
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentProfile);
      } catch (err) {
        console.error('Error in animation listener:', err);
      }
    }
  }

  public destroy(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.listeners = [];
  }
}
