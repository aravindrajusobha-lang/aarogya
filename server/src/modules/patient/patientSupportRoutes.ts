import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { SupportTicket } from './supportTicketModel.js';

export const patientSupportRouter = Router();

const CreateTicketSchema = z.object({
  mutationId: z.string().uuid(),
  category: z.enum(['account', 'appointment', 'report', 'technical', 'other']),
  subject: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
});

function getPatientId(req: Request, res: Response): string | null {
  if (req.user?.role !== 'patient' || !req.user.patientId) {
    if (req.user?.role === 'system_admin' || (req.user?.role === 'patient' && !req.user.patientId)) {
      res.status(404).envelopeError('PATIENT_NOT_FOUND', 'Patient support records were not found.', undefined, 404);
      return null;
    }
    res.status(403).envelopeError('PATIENT_REQUIRED', 'Patient access is required.', undefined, 403);
    return null;
  }
  return req.user.patientId;
}

patientSupportRouter.get(
  '/support-tickets',
  requireAuth,
  authorizeCapability('patient:read_own'),
  auditTag('patient.support_tickets.read', 'support_ticket'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = getPatientId(req, res);
      if (!patientId) return;
      const tickets = await SupportTicket.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean();
      res.envelope({ tickets, total: tickets.length, simulation: true });
    } catch (error) { next(error); }
  }
);

patientSupportRouter.post(
  '/support-tickets',
  requireAuth,
  authorizeCapability('patient:support_own'),
  validate({ body: CreateTicketSchema }),
  auditTag('patient.support_ticket.create', 'support_ticket'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = getPatientId(req, res);
      if (!patientId) return;
      const { mutationId, category, subject, description } = req.body as z.infer<typeof CreateTicketSchema>;
      const existing = await SupportTicket.findOne({ patientId, clientMutationId: mutationId }).lean();
      if (existing) {
        res.status(200).envelope({ ticket: existing, idempotentReplay: true, simulation: true });
        return;
      }
      const ticket = await SupportTicket.create({
        ticketId: `SUP-${uuidv4()}`,
        patientId,
        clientMutationId: mutationId,
        category,
        subject,
        description,
        status: 'open',
        simulation: true,
      });
      res.status(201).envelope({ ticket, idempotentReplay: false, simulation: true });
    } catch (error) { next(error); }
  }
);
