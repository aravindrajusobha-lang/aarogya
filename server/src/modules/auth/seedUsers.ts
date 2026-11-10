import { User, IUser } from './userModel.js';
import { hashPassword } from './tokenService.js';
import { logger } from '../../config/logger.js';

export const SEED_USERS = [
  {
    userId: 'usr_sysadmin_001',
    username: 'sysadmin.itda',
    role: 'system_admin' as const,
    fullName: 'System Administrator (ITDA Paderu)',
    password: 'SystemAdmin@2026',
    phone: '+918912345670',
  },
  {
    userId: 'usr_admin_002',
    username: 'admin.paderu',
    role: 'admin' as const,
    fullName: 'Ravi Kumar (District Program Coordinator)',
    password: 'Admin@2026',
    phone: '+918912345671',
  },
  {
    userId: 'usr_mo_003',
    username: 'doctor.paderu',
    role: 'medical_officer' as const,
    fullName: 'Dr. Suresh Varma, MD (MO In-Charge)',
    password: 'Doctor@2026',
    phone: '+918912345672',
  },
  {
    userId: 'usr_anm_004',
    username: 'anm.chintapalli',
    role: 'anm' as const,
    fullName: 'Geetha Bai (ANM Chintapalli Sub-Centre)',
    password: 'Anm@2026',
    phone: '+918912345673',
  },
  {
    userId: 'usr_asha_005',
    username: 'asha.pad01',
    role: 'asha' as const,
    fullName: 'Lakshmi Devi (ASHA Worker - Hukumpeta)',
    password: 'Asha@2026',
    phone: '+918912345674',
  },
  {
    userId: 'usr_pat_006',
    username: 'patient.pad01',
    role: 'patient' as const,
    fullName: 'Kondala Rao (Tribal Farmer)',
    patientId: 'DEMO-PAD-8492',
    password: 'Patient@2026',
    phone: '+918912345675',
  },
];

export async function seedDefaultUsers(): Promise<void> {
  try {
    for (const u of SEED_USERS) {
      const existing = await User.findOne({ username: u.username });
      if (!existing) {
        const passwordHash = await hashPassword(u.password);
        await User.create({
          userId: u.userId,
          username: u.username,
          role: u.role,
          fullName: u.fullName,
          patientId: (u as any).patientId,
          phone: u.phone,
          passwordHash,
          status: 'active',
          simulation: true,
        });
        logger.info({ event: 'seed_user_created', username: u.username, role: u.role });
      }
    }
  } catch (err) {
    logger.error({ event: 'seed_users_failed', error: (err as Error).message });
  }
}
