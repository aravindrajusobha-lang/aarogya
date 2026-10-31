import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyReplicaSet } from '../../config/database.js';
import { getAgenda } from '../../config/agenda.js';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const replicaStatus = await verifyReplicaSet(mongoose.connection);

  let schedulerStatus = {
    running: false,
    jobCount: 0,
  };

  try {
    const agenda = getAgenda();
    const jobs = await agenda.jobs({});
    schedulerStatus = {
      running: true,
      jobCount: jobs.length,
    };
  } catch {
    schedulerStatus = {
      running: false,
      jobCount: 0,
    };
  }

  res.envelope({
    status: 'HEALTHY',
    service: 'aarogya-drishti-core-api',
    version: '0.2.0',
    simulation: true,
    disclaimer: 'SIMULATION PLATFORM ONLY - NOT FOR CLINICAL USE',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: mongoose.connection.readyState === 1,
      isReplicaSet: replicaStatus.isReplicaSet,
      setName: replicaStatus.setName,
      supportsTransactions: replicaStatus.supportsTransactions,
    },
    scheduler: schedulerStatus,
  });
});

router.get('/simulation', (_req: Request, res: Response): void => {
  res.envelope(
    {
      simulationMode: true,
      legalNotice: 'DEMO SYSTEM FOR AAROHAN HACKATHON 2026 (ITDA PADERU) - NO REAL PHI/PII PERMITTED',
      adapters: {
        aadhaarVerification: {
          type: 'MOCK',
          description: 'Simulated demographic match adapter - no external UIDAI connectivity',
        },
        smsGateway: {
          type: 'MOCK',
          description: 'Simulated SMS dispatch - messages logged to in-memory audit ledger',
        },
        aiScreeningInference: {
          type: 'DEMO AI',
          description: 'Simulated heuristic visual risk classifier - preliminary risk flag only',
        },
        teleConsultationWebRTC: {
          type: 'MOCK',
          description: 'Simulated peer-to-peer audio/video connection room',
        },
      },
    },
    {
      is_mock: true,
      adapter_status: 'MOCK',
    }
  );
});

export const healthRouter = router;
