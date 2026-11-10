import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('Added & Merged Mongoose Models', () => {
  it('should load User model and validate both new and merged fields', async () => {
    const User = require('../../models/User.js');
    expect(User).toBeDefined();

    const userInstance = new User({
      name: 'Dr. Ravi Varma',
      employeeId: 'EMP-DOC-991',
      password: 'SamplePassword123!',
      roles: ['DOCTOR'],
      district: 'Alluri Sitharama Raju',
      mandals: ['Paderu', 'Araku Valley'],
      permissions: ['teleconsult:write', 'screening:review'],
      isActive: true,
    });

    await userInstance.validate();
    expect(userInstance.name).toBe('Dr. Ravi Varma');
    expect(userInstance.fullName).toBe('Dr. Ravi Varma');
    expect(userInstance.employeeId).toBe('EMP-DOC-991');
    expect(userInstance.userId).toBe('EMP-DOC-991');
    expect(userInstance.roles).toContain('DOCTOR');
    expect(userInstance.isActive).toBe(true);
  });

  it('should load Subcenter model and validate schema', async () => {
    const Subcenter = require('../../models/Subcenter.js');
    expect(Subcenter).toBeDefined();

    const subcenter = new Subcenter({
      name: 'Dumbriguda Tribal Subcenter',
      district: 'Alluri Sitharama Raju',
      mandal: 'Dumbriguda',
      isActive: true,
    });

    await subcenter.validate();
    expect(subcenter.name).toBe('Dumbriguda Tribal Subcenter');
    expect(subcenter.isActive).toBe(true);
  });

  it('should load Hospital model and validate schema', async () => {
    const Hospital = require('../../models/Hospital.js');
    expect(Hospital).toBeDefined();

    const hospital = new Hospital({
      name: 'Community Health Centre Paderu',
      district: 'Alluri Sitharama Raju',
      mandal: 'Paderu',
      isActive: true,
    });

    await hospital.validate();
    expect(hospital.name).toBe('Community Health Centre Paderu');
    expect(hospital.isActive).toBe(true);
  });

  it('should load Patient model and validate schema with subcenter & registeredBy references', async () => {
    const Patient = require('../../models/Patient.js');
    expect(Patient).toBeDefined();

    const dummySubcenterId = new mongoose.Types.ObjectId();
    const dummyUserId = new mongoose.Types.ObjectId();

    const patient = new Patient({
      name: 'Somanna Korra',
      age: 48,
      gender: 'male',
      phone: '9848022338',
      district: 'Alluri Sitharama Raju',
      mandal: 'Paderu',
      subcenter: dummySubcenterId,
      registeredBy: dummyUserId,
    });

    await patient.validate();
    expect(patient.name).toBe('Somanna Korra');
    expect(patient.fullName).toBe('Somanna Korra');
    expect(patient.age).toBe(48);
    expect(patient.subcenter.toString()).toBe(dummySubcenterId.toString());
  });
});
