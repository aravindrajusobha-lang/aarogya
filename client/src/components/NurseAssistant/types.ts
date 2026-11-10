import { LanguageCode } from '../../i18n';

export type AnimationState =
  | 'greeting'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'explaining'
  | 'pointing'
  | 'happy'
  | 'warning'
  | 'demonstrating'
  | 'empathetic'
  | 'success'
  | 'error';

export type NurseExpression =
  | 'friendly'
  | 'thoughtful'
  | 'professional'
  | 'concerned'
  | 'smiling'
  | 'winking'
  | 'attentive'
  | 'calm';

export type NurseGesture =
  | 'wave'
  | 'open_hand'
  | 'point_left'
  | 'point_right'
  | 'thumbs_up'
  | 'hand_to_chin'
  | 'hands_on_chest'
  | 'gentle_warning';

export interface NurseAiResponse {
  answerText: string;
  speechText: string;
  language: LanguageCode;
  intent: string;
  animation: AnimationState;
  expression: NurseExpression;
  gesture: NurseGesture;
  topic: string;
  duration?: 'auto' | number;
  highlight?: string | null;
  navigateTo?: string | null;
  data?: any;
  suggestedActions?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  speechText?: string;
  lang: LanguageCode;
  timestamp: string;
  animation?: AnimationState;
  expression?: NurseExpression;
  gesture?: NurseGesture;
  topic?: string;
  highlight?: string | null;
  navigateTo?: string | null;
  suggestedActions?: string[];
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetTab: string;
  highlightSelector?: string;
  animation: AnimationState;
  expression: NurseExpression;
  gesture: NurseGesture;
}
