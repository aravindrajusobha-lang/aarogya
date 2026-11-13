import mongoose, { Schema } from 'mongoose';

/** Facility operations data kept by each facility's admin: wards/beds, medicine stock, equipment. */

export const WARD_TYPES = ['general', 'emergency', 'maternity', 'pediatric', 'surgical', 'icu', 'isolation', 'dental', 'other'] as const;
export const MEDICINE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'gel', 'mouthwash', 'drops', 'other'] as const;
export const STOCK_REASONS = ['received', 'dispensed', 'expired', 'damaged', 'adjustment'] as const;
export const EQUIPMENT_CATEGORIES = ['dental', 'diagnostic', 'surgical', 'life_support', 'sterilization', 'imaging', 'other'] as const;

const WardSchema = new Schema({
  wardId: { type: String, required: true, unique: true, index: true },
  hospitalId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  wardType: { type: String, enum: WARD_TYPES, default: 'general' },
  totalBeds: { type: Number, required: true, min: 0, max: 5000 },
  occupiedBeds: { type: Number, required: true, min: 0, max: 5000, default: 0 },
  notes: { type: String, maxlength: 500 },
  updatedBy: { type: String, required: true },
}, { timestamps: true });
WardSchema.index({ hospitalId: 1, name: 1 }, { unique: true });

const MedicineSchema = new Schema({
  itemId: { type: String, required: true, unique: true, index: true },
  hospitalId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 160 },
  form: { type: String, enum: MEDICINE_FORMS, default: 'tablet' },
  strength: { type: String, maxlength: 60 },
  unit: { type: String, maxlength: 30, default: 'units' },
  stock: { type: Number, required: true, min: 0, default: 0 },
  reorderLevel: { type: Number, required: true, min: 0, default: 0 },
  batchNo: { type: String, maxlength: 60 },
  expiryDate: { type: Date },
  updatedBy: { type: String, required: true },
}, { timestamps: true });
MedicineSchema.index({ hospitalId: 1, name: 1, strength: 1 }, { unique: true });

const StockMovementSchema = new Schema({
  movementId: { type: String, required: true, unique: true },
  itemId: { type: String, required: true, index: true },
  hospitalId: { type: String, required: true, index: true },
  change: { type: Number, required: true, immutable: true },
  reason: { type: String, enum: STOCK_REASONS, required: true, immutable: true },
  note: { type: String, maxlength: 300, immutable: true },
  balanceAfter: { type: Number, required: true, immutable: true },
  by: { type: String, required: true, immutable: true },
  byName: { type: String, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const EquipmentSchema = new Schema({
  equipmentId: { type: String, required: true, unique: true, index: true },
  hospitalId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 160 },
  category: { type: String, enum: EQUIPMENT_CATEGORIES, default: 'other' },
  quantity: { type: Number, required: true, min: 0, max: 10000 },
  functionalCount: { type: Number, required: true, min: 0, max: 10000 },
  lastServicedAt: { type: Date },
  notes: { type: String, maxlength: 500 },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

export const FacilityWard = mongoose.models.FacilityWard || mongoose.model('FacilityWard', WardSchema);
export const FacilityMedicine = mongoose.models.FacilityMedicine || mongoose.model('FacilityMedicine', MedicineSchema);
export const FacilityStockMovement = mongoose.models.FacilityStockMovement || mongoose.model('FacilityStockMovement', StockMovementSchema);
export const FacilityEquipment = mongoose.models.FacilityEquipment || mongoose.model('FacilityEquipment', EquipmentSchema);
