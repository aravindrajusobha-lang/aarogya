import {describe,expect,it} from 'vitest';
import {offlinePayload} from '../../mobile/src/offline/payload';
const id='758ba197-4bc8-45d5-b0d5-ec08a5ea8bd8';
describe('Native offline payload privacy and replay contract',()=>{
 it('excludes card digits, QR payloads, images and derived identifiers',()=>{
  const result=offlinePayload('patient_registration',id,{fullName:'Synthetic Example',consentObtained:true,originalAddressText:'Near Old Mango Tree, Dumbriguda',aadhaarNumber:'must-never-leave-memory',maskedAadhaar:'9012',aadhaarHash:'not-permitted',qrPayload:'private',cardImage:'base64',photoBase64:'private'});
  expect(result).toEqual({fullName:'Synthetic Example',originalAddressText:'Near Old Mango Tree, Dumbriguda',consentObtained:true});
 });
 it('preserves verbatim landmark text including whitespace',()=>{const address='  Near Old Mango Tree, Dumbriguda\nHouse beside PHC ';expect(offlinePayload('patient_registration',id,{originalAddressText:address,consentObtained:true}).originalAddressText).toBe(address)});
 it('requires UUID v4 so replay protection cannot silently receive a non-UUID identifier',()=>{expect(()=>offlinePayload('appointment_request','wrong-id',{consentGiven:true})).toThrow('UUID v4')});
 it('rejects registration without explicit consent',()=>{expect(()=>offlinePayload('patient_registration',id,{consentObtained:false})).toThrow('consent')});
 it('keeps only appointment contract fields and requires sharing consent',()=>{expect(()=>offlinePayload('appointment_request',id,{})).toThrow('consent');expect(offlinePayload('appointment_request',id,{patientId:'SYNTHETIC-01',consentGiven:true,accessToken:'do-not-store',image:'do-not-store'})).toEqual({patientId:'SYNTHETIC-01',consentGiven:true})});
});
