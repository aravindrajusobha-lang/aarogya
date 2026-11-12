import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  messageId: { type: String, required: true, unique: true },
  appointmentId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  role: { type: String, required: true },
  text: { type: String, required: true, immutable: true },
  sha256: { type: String, required: true, immutable: true },
}, { timestamps: true });
export const ConsultationChat = mongoose.models.ConsultationChat || mongoose.model('ConsultationChat', schema);
