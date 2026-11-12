import { User } from '../auth/userModel.js';
import { hashPassword } from '../auth/tokenService.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { Village } from '../reference/villageModel.js';
import { Specialist } from '../specialist/specialistModel.js';
import { Patient } from '../patient/patientModel.js';
import { ScreeningCase } from '../screening/screeningCaseModel.js';
import { Camp } from '../camp/campModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { Biopsy } from '../biopsy/biopsyModel.js';
import { Referral } from '../referral/referralModel.js';
import { Teleconsultation } from '../teleconsultation/teleconsultationModel.js';
import { SyncLedger } from '../patient/syncLedgerModel.js';
import { HealthWorkerAssignment } from '../assignment/assignmentModel.js';
import { logger } from '../../config/logger.js';
import { ASR_VILLAGES_SEED, ASR_HEALTHCARE_FACILITIES } from '../reference/asrGeographyData.js';

export async function runMasterSeed(): Promise<void> {
  logger.info({ event: 'master_seed_started', notice: 'Initializing Part 3 Demo Seed Data for ITDA Paderu & Alluri Sitharama Raju District' });

  // 1. Seed Hospitals
  const hospitals = [
    {
      hospitalId: 'hosp_paderu_dh',
      name: 'District Hospital Paderu',
      type: 'district_hospital' as const,
      district: 'Alluri Sitharama Raju',
      mandal: 'Paderu',
      jurisdictionVillages: ['vil_paderu_01', 'vil_dumbriguda_03', 'vil_matsyapuram_01'],
      adminUserIds: ['usr_admin_002'],
      status: 'active' as const,
      simulation: true as const,
    },
    {
      hospitalId: 'hosp_araku_02',
      name: 'Araku Valley Community Health Centre',
      type: 'community_health_centre' as const,
      district: 'Alluri Sitharama Raju',
      mandal: 'Araku Valley',
      jurisdictionVillages: ['vil_araku_01'],
      adminUserIds: ['usr_admin_002'],
      status: 'active' as const,
      simulation: true as const,
    },
    {
      hospitalId: 'hosp_chintapalli_chc',
      name: 'Chintapalli Community Health Centre',
      type: 'community_health_centre' as const,
      district: 'Alluri Sitharama Raju',
      mandal: 'Chintapalli',
      jurisdictionVillages: ['vil_gudem_01'],
      adminUserIds: ['usr_admin_002'],
      status: 'active' as const,
      simulation: true as const,
    },
    {
      hospitalId: 'hosp_kgh_vsp',
      name: 'King George Hospital (KGH) Visakhapatnam',
      type: 'district_hospital' as const,
      district: 'Visakhapatnam',
      mandal: 'Visakhapatnam Urban',
      jurisdictionVillages: [],
      adminUserIds: [],
      status: 'active' as const,
      simulation: true as const,
    },
  ];

  for (const h of hospitals) {
    await Hospital.findOneAndUpdate({ hospitalId: h.hospitalId }, h, { upsert: true, new: true });
  }

  // Seed full ASR healthcare facilities (Area Hospital Rampachodavaram, CHCs, and PHCs)
  for (const fac of ASR_HEALTHCARE_FACILITIES) {
    await Hospital.findOneAndUpdate(
      { hospitalId: fac.facilityId },
      {
        hospitalId: fac.facilityId,
        name: fac.name,
        type: fac.type,
        district: 'Alluri Sitharama Raju',
        mandal: fac.mandal,
        jurisdictionVillages: [],
        adminUserIds: ['usr_admin_002'],
        status: 'active' as const,
        simulation: true as const,
      },
      { upsert: true, new: true }
    );
  }

  // 2. Seed Reference Villages
  const villages = [
    {
      villageId: 'vil_dumbriguda_03',
      villageName: 'Dumbriguda Hamlet',
      mandal: 'Dumbriguda',
      panchayat: 'Dumbriguda',
      tribalHabitation: 'Bagata / Konda Dora Habitation',
      hospitalId: 'hosp_paderu_dh',
      censusCode: '584912',
      populationEstimated: 640,
      gpsCoordinates: { latitude: 18.2541, longitude: 82.8592 },
      simulation: true as const,
    },
    {
      villageId: 'vil_gudem_01',
      villageName: 'Gudem Kotha Veedhi',
      mandal: 'Chintapalli',
      panchayat: 'G.K. Veedhi',
      tribalHabitation: 'Valmiki Settlement',
      hospitalId: 'hosp_chintapalli_chc',
      censusCode: '584913',
      populationEstimated: 480,
      gpsCoordinates: { latitude: 17.9123, longitude: 82.3412 },
      simulation: true as const,
    },
    {
      villageId: 'vil_paderu_01',
      villageName: 'Vankachinta Tribal Village',
      mandal: 'Paderu',
      panchayat: 'Vankachinta',
      tribalHabitation: 'Koya Habitation',
      hospitalId: 'hosp_paderu_dh',
      censusCode: '584914',
      populationEstimated: 750,
      gpsCoordinates: { latitude: 18.0821, longitude: 82.6612 },
      simulation: true as const,
    },
    {
      villageId: 'vil_matsyapuram_01',
      villageName: 'Matsyapuram',
      mandal: 'Hukumpeta',
      panchayat: 'Matsyapuram',
      tribalHabitation: 'Gadaba Settlement',
      hospitalId: 'hosp_paderu_dh',
      censusCode: '584915',
      populationEstimated: 320,
      gpsCoordinates: { latitude: 18.1521, longitude: 82.7212 },
      simulation: true as const,
    },
    {
      villageId: 'vil_araku_01',
      villageName: 'Padmapuram Valley',
      mandal: 'Araku Valley',
      panchayat: 'Padmapuram',
      tribalHabitation: 'Porja Habitation',
      hospitalId: 'hosp_araku_02',
      censusCode: '584916',
      populationEstimated: 890,
      gpsCoordinates: { latitude: 18.3241, longitude: 82.8812 },
      simulation: true as const,
    },
  ];

  for (const v of villages) {
    await Village.findOneAndUpdate({ villageId: v.villageId }, v, { upsert: true, new: true });
  }

  // Seed all villages across all 22 Mandals of ASR District
  for (const v of ASR_VILLAGES_SEED) {
    await Village.findOneAndUpdate(
      { villageId: v.villageId },
      {
        villageId: v.villageId,
        villageName: v.villageName,
        nameTe: v.nameTe,
        mandal: v.mandal,
        panchayat: v.panchayat,
        tribalHabitation: v.tribalHabitation,
        hospitalId: v.hospitalId,
        censusCode: v.censusCode,
        populationEstimated: v.populationEstimated,
        gpsCoordinates: v.gpsCoordinates,
        healthcareAccessLevel: v.healthcareAccessLevel,
        nearestFacilityDistanceKm: v.nearestFacilityDistanceKm,
        nearestFacilityType: v.nearestFacilityType,
        nearestFacilityName: v.nearestFacilityName,
        lastCampDate: v.lastCampDate,
        campCount: v.campCount,
        screeningCoveragePercent: v.screeningCoveragePercent,
        verifiedByGovt: v.verifiedByGovt,
        simulation: true as const,
      },
      { upsert: true, new: true }
    );
  }

  // 3. Seed Specialists
  const specialists = [
    {
      specialistId: 'spec_kgh_onc_01',
      name: 'Dr. K. Sanyasi Rao, MCh (Surgical Oncology)',
      specialty: 'oral_oncology' as const,
      hospitalId: 'hosp_kgh_vsp',
      hospitalName: 'King George Hospital (KGH) Visakhapatnam',
      qualifications: ['MBBS', 'MS (Gen Surg)', 'MCh (Surg Onc)'],
      teleconsultAvailable: true,
      contactPhone: '+918912345690',
      email: 'sanyasi.rao.oncology@kgh.demo',
      languages: ['te', 'en'],
      status: 'active' as const,
      simulation: true as const,
    },
    {
      specialistId: 'spec_paderu_path_02',
      name: 'Dr. Anasuya Devi, MD (Histopathology)',
      specialty: 'pathology' as const,
      hospitalId: 'hosp_paderu_dh',
      hospitalName: 'District Hospital Paderu',
      qualifications: ['MBBS', 'MD (Pathology)'],
      teleconsultAvailable: true,
      contactPhone: '+918912345691',
      email: 'anasuya.pathology@paderu.demo',
      languages: ['te', 'en'],
      status: 'active' as const,
      simulation: true as const,
    },
    {
      specialistId: 'spec_araku_ent_03',
      name: 'Dr. B. Trinadh, MS (ENT / Head & Neck)',
      specialty: 'ent_head_neck' as const,
      hospitalId: 'hosp_araku_02',
      hospitalName: 'Araku Valley Community Health Centre',
      qualifications: ['MBBS', 'MS (ENT)'],
      teleconsultAvailable: true,
      contactPhone: '+918912345692',
      email: 'trinadh.ent@araku.demo',
      languages: ['te', 'en', 'hi'],
      status: 'active' as const,
      simulation: true as const,
    },
  ];

  for (const s of specialists) {
    await Specialist.findOneAndUpdate({ specialistId: s.specialistId }, s, { upsert: true, new: true });
  }

  // 4. Seed Standard Users
  const pwdHash = await hashPassword('AarogyaDemo@2026');
  const demoUsers = [
    {
      userId: 'usr_sysadmin_001',
      username: 'sysadmin.itda',
      role: 'system_admin' as const,
      fullName: 'System Administrator (ITDA Paderu)',
      passwordHash: pwdHash,
      phone: '+918912345670',
      status: 'active' as const,
      simulation: true,
    },
    {
      userId: 'usr_admin_002',
      username: 'admin.paderu',
      role: 'admin' as const,
      fullName: 'Ravi Kumar (Hospital Admin / Paderu)',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwdHash,
      phone: '+918912345671',
      status: 'active' as const,
      simulation: true,
    },
    {
      userId: 'usr_admin_alias',
      username: 'admin',
      role: 'admin' as const,
      fullName: 'ITDA Admin (Paderu)',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwdHash,
      phone: '+918912345671',
      status: 'active' as const,
      simulation: true,
    },
    {
      userId: 'usr_mo_003',
      username: 'doctor.paderu',
      role: 'medical_officer' as const,
      fullName: 'Dr. Suresh Varma, MD (MO In-Charge)',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwdHash,
      phone: '+918912345672',
      status: 'active' as const,
      simulation: true,
    },
    {
      userId: 'usr_anm_004',
      username: 'anm.chintapalli',
      role: 'anm' as const,
      fullName: 'Geetha Bai (ANM Chintapalli)',
      hospitalId: 'hosp_chintapalli_chc',
      assignedVillages: ['vil_gudem_01'],
      passwordHash: pwdHash,
      phone: '+918912345673',
      status: 'active' as const,
      simulation: true,
    },
    {
      userId: 'usr_asha_005',
      username: 'asha.pad01',
      role: 'asha' as const,
      fullName: 'Lakshmi Devi (ASHA Worker)',
      hospitalId: 'hosp_paderu_dh',
      assignedVillages: ['vil_dumbriguda_03', 'vil_paderu_01'],
      passwordHash: pwdHash,
      phone: '+918912345674',
      status: 'active' as const,
      simulation: true,
    },
    {
      userId: 'usr_pat_006',
      username: 'patient.pad01',
      role: 'patient' as const,
      fullName: 'Vantala Balaram (Tribal Beneficiary)',
      patientId: 'PAT-PAD-2026-001',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwdHash,
      phone: '+918912345675',
      status: 'active' as const,
      simulation: true,
    },
  ];

  for (const u of demoUsers) {
    await User.findOneAndUpdate({ userId: u.userId }, u, { upsert: true, new: true });
  }

  // 4b. Seed Health Worker Assignments
  const assignments = [
    {
      assignmentId: 'asgn_demo_asha_005',
      workerId: 'usr_asha_005',
      workerName: 'Lakshmi Devi (ASHA Worker)',
      workerRole: 'asha' as const,
      hospitalId: 'hosp_paderu_dh',
      assignedMandal: 'Dumbriguda',
      assignedVillages: ['vil_dumbriguda_03', 'vil_paderu_01'],
      assignedBy: 'usr_admin_002',
      status: 'active' as const,
      simulation: true as const,
    },
    {
      assignmentId: 'asgn_demo_anm_004',
      workerId: 'usr_anm_004',
      workerName: 'Geetha Bai (ANM Chintapalli)',
      workerRole: 'anm' as const,
      hospitalId: 'hosp_chintapalli_chc',
      assignedMandal: 'Chintapalli',
      assignedVillages: ['vil_gudem_01'],
      assignedBy: 'usr_admin_002',
      status: 'active' as const,
      simulation: true as const,
    },
  ];

  for (const a of assignments) {
    await HealthWorkerAssignment.findOneAndUpdate({ assignmentId: a.assignmentId }, a, { upsert: true, new: true });
  }

  // 5. Seed Patients
  const patients = [
    {
      patientId: 'PAT-PAD-2026-001',
      fullName: 'Vantala Balaram',
      gender: 'male' as const,
      ageEstimated: 49,
      phone: '+918912345675',
      villageId: 'vil_dumbriguda_03',
      villageName: 'Dumbriguda Hamlet',
      mandal: 'Dumbriguda',
      district: 'Alluri Sitharama Raju',
      originalAddressText: 'Near Old Mango Tree, Dumbriguda Tribal Hamlet',
      hospitalId: 'hosp_paderu_dh',
      registeredBy: 'usr_asha_005',
      registeredAt: new Date(Date.now() - 5 * 86400000),
      isDuplicateCandidate: false,
      duplicateReviewStatus: 'none' as const,
      matchReasons: [],
      history: [
        {
          timestamp: new Date(Date.now() - 5 * 86400000),
          action: 'PATIENT_REGISTERED',
          performedBy: 'usr_asha_005',
        },
      ],
      simulation: true,
    },
    {
      patientId: 'PAT-PAD-2026-002',
      fullName: 'Gemmeli Somulu',
      gender: 'male' as const,
      ageEstimated: 52,
      phone: '+918912345676',
      villageId: 'vil_gudem_01',
      villageName: 'Gudem Kotha Veedhi',
      mandal: 'Chintapalli',
      district: 'Alluri Sitharama Raju',
      originalAddressText: 'Beside Stream Water Well, Gudem Habitation',
      hospitalId: 'hosp_chintapalli_chc',
      registeredBy: 'usr_anm_004',
      registeredAt: new Date(Date.now() - 3 * 86400000),
      isDuplicateCandidate: false,
      duplicateReviewStatus: 'none' as const,
      matchReasons: [],
      history: [
        {
          timestamp: new Date(Date.now() - 3 * 86400000),
          action: 'PATIENT_REGISTERED',
          performedBy: 'usr_anm_004',
        },
      ],
      simulation: true,
    },
  ];

  for (const p of patients) {
    await Patient.findOneAndUpdate({ patientId: p.patientId }, p, { upsert: true, new: true });
  }

  // 6. Seed Screening Case
  await ScreeningCase.findOneAndUpdate(
    { caseId: 'case_demo_balaram_01' },
    {
      caseId: 'case_demo_balaram_01',
      patientId: 'PAT-PAD-2026-001',
      patientName: 'Vantala Balaram',
      villageId: 'vil_dumbriguda_03',
      villageName: 'Dumbriguda Hamlet',
      hospitalId: 'hosp_paderu_dh',
      createdBy: 'usr_asha_005',
      status: 'under_review',
      priority: 'urgent',
      photoIds: ['pho_balaram_buccal_01'],
      demoAiResult: {
        riskSupportLabel: 'high_risk_support',
        confidenceScore: 0.88,
        qualityChecks: {
          positioning: 'unavailable',
          obstruction: 'unavailable',
          missingArea: 'unavailable',
        },
        disclaimer:
          'DEMO AI SCREENING SUPPORT ONLY - CONTAINS NO CONFIRMED FINDINGS OR CLINICAL STAGING. REQUIRES CLINICIAN REVIEW.',
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
        analyzedAt: new Date(Date.now() - 4 * 86400000),
      },
      assignedMoId: 'usr_mo_003',
      assignedMoName: 'Dr. Suresh Varma, MD',
      assignedBy: 'usr_admin_002',
      assignedAt: new Date(Date.now() - 4 * 86400000),
      resultReleased: false,
      simulation: true,
    },
    { upsert: true, new: true }
  );

  // 7. Seed Camp
  await Camp.findOneAndUpdate(
    { campId: 'camp_demo_dumbriguda_01' },
    {
      campId: 'camp_demo_dumbriguda_01',
      title: 'Dumbriguda Community Oral Health Screening Camp',
      hospitalId: 'hosp_paderu_dh',
      hospitalName: 'District Hospital Paderu',
      villageIds: ['vil_dumbriguda_03'],
      targetVillageNames: ['Dumbriguda Hamlet'],
      assignedStaffIds: ['usr_mo_003', 'usr_asha_005'],
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 2 * 86400000),
      targetScreenings: 120,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: 'usr_admin_002',
      simulation: true,
    },
    { upsert: true, new: true }
  );

  // 8. Seed Appointment
  await Appointment.findOneAndUpdate(
    { appointmentId: 'apt_demo_balaram_01' },
    {
      appointmentId: 'apt_demo_balaram_01',
      patientId: 'PAT-PAD-2026-001',
      patientName: 'Vantala Balaram',
      destinationHospitalId: 'hosp_paderu_dh',
      destinationHospitalName: 'District Hospital Paderu',
      department: 'Oral Oncology Clinic',
      slotStartTime: new Date(Date.now() + 86400000),
      slotEndTime: new Date(Date.now() + 86400000 + 20 * 60000),
      durationMinutes: 20,
      status: 'confirmed',
      type: 'clinical_consultation',
      reason: 'Oral mucosal evaluation for buccal lesion',
      requestedBy: {
        userId: 'usr_asha_005',
        role: 'asha',
        name: 'Lakshmi Devi',
      },
      confirmedBy: {
        userId: 'usr_admin_002',
        role: 'admin',
        name: 'Ravi Kumar',
        confirmedAt: new Date(),
      },
      reschedulingHistory: [],
      offlineQueued: false,
      simulation: true,
    },
    { upsert: true, new: true }
  );

  // 9. Seed Biopsy
  await Biopsy.findOneAndUpdate(
    { biopsyId: 'bx_demo_somulu_01' },
    {
      biopsyId: 'bx_demo_somulu_01',
      patientId: 'PAT-PAD-2026-002',
      patientName: 'K. Somulu',
      hospitalId: 'hosp_paderu_dh',
      status: 'RESULT_RECEIVED',
      anatomicalLocation: 'Left lateral border of tongue mucosal lesion',
      requestingDoctorId: 'usr_mo_003',
      requestingDoctorName: 'Dr. Suresh Kumar (MO)',
      labAttachment: {
        originalFileId: 'mock_histopath_somulu_01.pdf',
        originalSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        currentFileId: 'mock_histopath_somulu_01.pdf',
        currentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        version: 1,
        amendmentHistory: [],
      },
    },
    { upsert: true, new: true }
  );

  // 10. Seed Referral
  await Referral.findOneAndUpdate(
    { referralId: 'ref_demo_somulu_01' },
    {
      referralId: 'ref_demo_somulu_01',
      patientId: 'PAT-PAD-2026-002',
      sourceHospitalId: 'hosp_paderu_dh',
      destinationHospitalId: 'hosp_kgh_vsp',
      destinationHospitalName: 'King George Hospital (KGH) Visakhapatnam',
      referringDoctorId: 'usr_mo_003',
      reasonForReferral: 'Tertiary surgical oncology consultation for mucosal lesion',
      status: 'CONFIRMED',
      priority: 'high_priority',
      simulation: true,
    },
    { upsert: true, new: true }
  );

  // 11. Seed Teleconsultation
  await Teleconsultation.findOneAndUpdate(
    { consultationId: 'tc_demo_balaram_01' },
    {
      consultationId: 'tc_demo_balaram_01',
      patientId: 'PAT-PAD-2026-001',
      patientName: 'Vantala Balaram',
      hospitalId: 'hosp_paderu_dh',
      assignedClinicianId: 'usr_mo_003',
      assignedClinicianName: 'Dr. Suresh Varma, MD',
      scheduledAt: new Date(Date.now() + 2 * 86400000),
      status: 'SCHEDULED',
      videoAdapterStatus: 'BLOCKED',
      voiceAdapterStatus: 'BLOCKED',
      photoAdapterStatus: 'BLOCKED',
      notes: [
        {
          version: 1,
          recordedBy: 'usr_mo_003',
          recordedByName: 'Dr. Suresh Varma, MD',
          recordedAt: new Date(Date.now() - 86400000),
          observations: 'Initial clinical case review prior to teleconsultation session.',
          sha256Hash: 'sha256_note_version_1_hash_initial',
        },
      ],
      resultReleased: false,
      simulation: true,
    },
    { upsert: true, new: true }
  );

  logger.info({ event: 'master_seed_completed', status: 'All Part 3 Demo entities successfully seeded' });
}
