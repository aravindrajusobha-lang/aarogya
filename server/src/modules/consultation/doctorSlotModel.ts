import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  doctorId: { type: String, required: true },
  hospitalId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  mutationId: { type: String, required: true, unique: true },
}, { timestamps: true });
schema.index({ doctorId: 1, startTime: 1 }, { unique: true });
export const DoctorSlot = mongoose.models.DoctorSlot || mongoose.model('DoctorSlot', schema);

export type SlotStatus = 'available' | 'booked' | 'past';
const ACTIVE_BOOKING = ['requested', 'confirmed', 'rescheduled', 'checked_in', 'completed'];

/** Slots between [from, to) for one doctor, each marked available / booked / past (bookings of THIS doctor only). */
export async function doctorSlotsWithStatus(doctorId: string, from: Date, to: Date) {
  const { Appointment } = await import('../appointment/appointmentModel.js');
  const slots: any[] = await DoctorSlot.find({ doctorId, startTime: { $gte: from, $lt: to } }).sort({ startTime: 1 }).lean();
  const bookings: any[] = await Appointment.find({ assignedDoctorId: doctorId, status: { $in: ACTIVE_BOOKING }, slotStartTime: { $lt: to }, slotEndTime: { $gt: from } })
    .select('appointmentId patientName patientId slotStartTime slotEndTime status consultationMode').lean();
  const now = Date.now();
  return slots.map((s) => {
    const booking = bookings.find((b) => new Date(b.slotStartTime) < new Date(s.endTime) && new Date(b.slotEndTime) > new Date(s.startTime));
    const status: SlotStatus = booking ? 'booked' : new Date(s.startTime).getTime() <= now ? 'past' : 'available';
    return { slotId: String(s._id), startTime: s.startTime, endTime: s.endTime, durationMinutes: Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000), status, isAvailable: status === 'available', booking };
  });
}

export async function availableDoctorSlots(doctorId: string, date: string) {
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);
  // Patients see every slot of the day with its status, but never who booked it.
  return (await doctorSlotsWithStatus(doctorId, start, end)).map(({ booking: _booking, ...slot }) => slot);
}
