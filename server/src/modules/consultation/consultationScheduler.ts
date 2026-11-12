import { Consultation } from './consultationModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { DailyAdapter } from './dailyAdapter.js';
import { logger } from '../../config/logger.js';

let timer: NodeJS.Timeout | undefined;
export function startConsultationScheduler() {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      const now = new Date();
      const expired = await Consultation.find({ status: { $in: ['LINK_SENT','WAITING','IN_CALL'] }, expiresAt: { $lte: now } }).limit(100);
      for (const item of expired) {
        const wasInCall = item.status === 'IN_CALL'; item.status = wasInCall ? 'COMPLETED' : 'MISSED'; item.endedAt = now;
        item.durationSeconds = item.startedAt ? Math.max(0, Math.floor((now.getTime() - item.startedAt.getTime()) / 1000)) : 0;
        await item.save(); if (item.roomName) await DailyAdapter.closeRoom(item.roomName);
        await Appointment.updateOne({ appointmentId: item.appointmentId }, { $set: { status: wasInCall ? 'completed' : 'no_show' } });
      }
    } catch (error) { logger.error({ event: 'consultation_expiry_sweep_failed', error: (error as Error).message }); }
  }, 5000);
  timer.unref();
}
export function stopConsultationScheduler() { if (timer) clearInterval(timer); timer = undefined; }
