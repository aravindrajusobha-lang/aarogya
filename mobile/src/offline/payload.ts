export type MutationType='patient_registration'|'appointment_request';
const registration=['fullName','gender','ageEstimated','phone','villageName','mandal','district','originalAddressText','hospitalId','registrationMethod','consentObtained','clientMutationId'];
const appointment=['patientId','patientName','destinationHospitalId','destinationHospitalName','slotStartTime','slotEndTime','durationMinutes','appointmentType','consentGiven'];
/** Keep only the existing sync contract. Identity-card content never enters the outbox. */
export function offlinePayload(type:MutationType,id:string,payload:Record<string,unknown>):Record<string,unknown>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new Error('A UUID v4 mutation ID is required.');
 if(type==='patient_registration'&&payload.consentObtained!==true)throw new Error('Registration consent must be recorded before saving offline.');
 if(type==='appointment_request'&&payload.consentGiven!==true)throw new Error('Appointment sharing consent is required before saving offline.');
 const allowed=type==='patient_registration'?registration:appointment;
 return Object.fromEntries(allowed.filter(key=>payload[key]!==undefined).map(key=>[key,payload[key]]));
}
