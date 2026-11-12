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

export async function availableDoctorSlots(doctorId: string, date: string) {
  const { Appointment } = await import('../appointment/appointmentModel.js');
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);
  const slots = await DoctorSlot.find({ doctorId, startTime: { $gte: start, $lt: end } }).sort({ startTime: 1 }).lean();
  const bookings = await Appointment.find({ destinationHospitalId: { $in: slots.map(s => s.hospitalId) }, status: { $in: ['requested', 'confirmed', 'rescheduled', 'checked_in'] }, slotStartTime: { $lt: end }, slotEndTime: { $gt: start } }).lean();
  return slots.map(s => ({ startTime: s.startTime, endTime: s.endTime, isAvailable: new Date(s.startTime).getTime() > Date.now() && !bookings.some(b => new Date(b.slotStartTime) < new Date(s.endTime) && new Date(b.slotEndTime) > new Date(s.startTime)) }));
}
