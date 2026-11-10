import crypto from 'crypto';
import { logger } from '../../config/logger.js';

export interface ISignalPayload {
  senderId: string;
  senderRole: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'joined' | 'leave';
  data: any;
  timestamp: number;
}

export interface IVideoRoom {
  consultationId: string;
  createdAt: number;
  participants: Map<string, { userId: string; role: string; lastSeen: number }>;
  signals: ISignalPayload[];
}

// In-memory room manager for active video consultations
const activeRooms = new Map<string, IVideoRoom>();

// Clean idle rooms every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of activeRooms.entries()) {
    if (now - room.createdAt > 3600000) {
      activeRooms.delete(id);
    }
  }
}, 120000).unref();

export class VideoSignalingService {
  /**
   * Join or create an active consultation video room
   */
  static joinRoom(consultationId: string, userId: string, role: string) {
    let room = activeRooms.get(consultationId);
    if (!room) {
      room = {
        consultationId,
        createdAt: Date.now(),
        participants: new Map(),
        signals: [],
      };
      activeRooms.set(consultationId, room);
    }

    room.participants.set(userId, { userId, role, lastSeen: Date.now() });

    logger.info({ consultationId, userId, role }, 'Participant joined video consultation room');

    return {
      consultationId,
      roomToken: `room_token_${crypto.randomUUID().slice(0, 12)}`,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      activeParticipants: Array.from(room.participants.values()),
    };
  }

  /**
   * Post WebRTC signaling message (Offer, Answer, ICE Candidate)
   */
  static postSignal(consultationId: string, senderId: string, senderRole: string, type: 'offer' | 'answer' | 'ice-candidate' | 'joined' | 'leave', data: any) {
    let room = activeRooms.get(consultationId);
    if (!room) {
      this.joinRoom(consultationId, senderId, senderRole);
      room = activeRooms.get(consultationId)!;
    }

    const signal: ISignalPayload = {
      senderId,
      senderRole,
      type,
      data,
      timestamp: Date.now(),
    };

    room.signals.push(signal);
    // Keep last 40 signals
    if (room.signals.length > 40) {
      room.signals = room.signals.slice(-40);
    }

    return { success: true, timestamp: signal.timestamp };
  }

  /**
   * Poll signals destined for a participant (signals where senderId != recipientId)
   */
  static getSignals(consultationId: string, recipientId: string, sinceTimestamp: number = 0) {
    const room = activeRooms.get(consultationId);
    if (!room) {
      return { signals: [], participantsCount: 0 };
    }

    // Update recipient heartbeat
    if (room.participants.has(recipientId)) {
      room.participants.get(recipientId)!.lastSeen = Date.now();
    }

    const pending = room.signals.filter(
      (s) => s.senderId !== recipientId && s.timestamp > sinceTimestamp
    );

    return {
      signals: pending,
      participantsCount: room.participants.size,
    };
  }

  /**
   * Leave and close room
   */
  static leaveRoom(consultationId: string, userId: string) {
    const room = activeRooms.get(consultationId);
    if (room) {
      room.participants.delete(userId);
      this.postSignal(consultationId, userId, 'user', 'leave', { userId });
      if (room.participants.size === 0) {
        activeRooms.delete(consultationId);
      }
    }
    return { success: true };
  }
}

