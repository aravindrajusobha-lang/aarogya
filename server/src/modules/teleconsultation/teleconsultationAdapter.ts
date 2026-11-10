export interface IVideoAdapterResponse {
  status: 'BLOCKED';
  channelType: 'video' | 'voice' | 'photo_stream';
  adapterName: string;
  isSimulation: true;
  blockedReason: string;
  uiIndicator: {
    badgeText: string;
    variant: 'blocked_stub';
    showCallControls: false;
  };
}

export interface ITeleconsultationAdapter {
  initiateVideoSession(consultationId: string): Promise<IVideoAdapterResponse>;
  initiateVoiceSession(consultationId: string): Promise<IVideoAdapterResponse>;
}

/**
 * Simulation Video Adapter returning explicit BLOCKED stub.
 * No fake call screens or simulated video streaming are provided until real WebRTC/SIP gateways exist.
 */
export class SimulationBlockedVideoAdapter implements ITeleconsultationAdapter {
  async initiateVideoSession(consultationId: string): Promise<IVideoAdapterResponse> {
    return {
      status: 'BLOCKED',
      channelType: 'video',
      adapterName: 'SIMULATION_BLOCKED_STUB',
      isSimulation: true,
      blockedReason:
        'Live video streaming is BLOCKED pending real WebRTC/SIP telecommunication adapter integration. Live call screens are disabled.',
      uiIndicator: {
        badgeText: 'BLOCKED - Real-time video adapter not configured',
        variant: 'blocked_stub',
        showCallControls: false,
      },
    };
  }

  async initiateVoiceSession(consultationId: string): Promise<IVideoAdapterResponse> {
    return {
      status: 'BLOCKED',
      channelType: 'voice',
      adapterName: 'SIMULATION_BLOCKED_STUB',
      isSimulation: true,
      blockedReason:
        'Live voice streaming is BLOCKED pending real telecommunications carrier adapter integration.',
      uiIndicator: {
        badgeText: 'BLOCKED - Real-time voice adapter not configured',
        variant: 'blocked_stub',
        showCallControls: false,
      },
    };
  }
}

export const videoAdapter = new SimulationBlockedVideoAdapter();
