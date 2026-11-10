import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { Invitation } from './invitationModel.js';
import { User } from '../auth/userModel.js';
import { hashPassword } from '../auth/tokenService.js';

const router = Router();

const CreateInvitationSchema = z.object({
  email: z.string().email('Valid email address required'),
  fullName: z.string().min(2, 'Full name required'),
  role: z.enum(['admin', 'medical_officer', 'anm', 'asha']),
  hospitalId: z.string().min(1, 'Hospital ID required'),
});

const VerifyTokenParamsSchema = z.object({
  token: z.string().min(16, 'Token required'),
});

const AcceptInvitationSchema = z.object({
  token: z.string().min(16, 'Token required'),
  username: z.string().min(3, 'Username required (min 3 chars)'),
  password: z.string().min(6, 'Password required (min 6 chars)'),
});

const RevokeInvitationParamsSchema = z.object({
  id: z.string().min(1, 'Invitation ID required'),
});

// POST /api/v1/invitations
// Creates 72-hour invitation. Link shown to admin to copy; delivery is not claimed.
router.post(
  '/',
  requireAuth,
  authorizeCapability('invitation:create'),
  validate({ body: CreateInvitationSchema }),
  auditTag('INVITATION_CREATE', 'invitation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, fullName, role, hospitalId } = req.body;

      // SELF-APPROVAL GUARD: Admin cannot invite themselves
      const adminUser = await User.findOne({ userId: req.user!.id });
      const emailPrefix = email.includes('@') ? email.split('@')[0].toLowerCase() : email.toLowerCase();
      if (
        adminUser?.username.toLowerCase() === email.toLowerCase() ||
        adminUser?.username.toLowerCase() === emailPrefix ||
        req.user!.id === email
      ) {
        res.envelopeError(
          'SELF_APPROVAL_BLOCKED',
          'Self-invitation and self-approval are strictly prohibited',
          undefined,
          403
        );
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({ username: email.toLowerCase() });
      if (existingUser) {
        res.envelopeError('USER_ALREADY_EXISTS', 'A user with this email/username already exists', undefined, 400);
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();
      // Strictly 72 hours
      const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const invitationLink = `/invite/accept?token=${token}`;

      const invitation = await Invitation.create({
        invitationId: `inv_${uuidv4()}`,
        hospitalId,
        email,
        fullName,
        role,
        token,
        invitationLink,
        createdBy: req.user!.id,
        expiresAt,
        status: 'pending',
        simulation: true,
      });

      res.status(201).envelope({
        invitationId: invitation.invitationId,
        token: invitation.token,
        invitationLink: invitation.invitationLink,
        expiresAt: invitation.expiresAt,
        hoursValid: 72,
        deliveryNote: 'Link shown to the admin to copy; delivery is not claimed.',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/invitations
router.get(
  '/',
  requireAuth,
  authorizeCapability('invitation:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invitations = await Invitation.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.envelope({
        invitations,
        total: invitations.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/invitations/verify/:token
router.get(
  '/verify/:token',
  validate({ params: VerifyTokenParamsSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const invitation = await Invitation.findOne({ token });

      if (!invitation) {
        res.envelopeError('INVITATION_NOT_FOUND', 'Invitation token not found', undefined, 404);
        return;
      }

      // Check if already used / reused
      if (invitation.status === 'accepted' || invitation.acceptedAt) {
        res.envelopeError(
          'INVITATION_ALREADY_USED',
          'This invitation token has already been accepted and cannot be reused',
          undefined,
          409
        );
        return;
      }

      // Check if expired (> 72 hours)
      if (invitation.expiresAt.getTime() < Date.now()) {
        invitation.status = 'expired';
        await invitation.save();
        res.envelopeError(
          'INVITATION_EXPIRED',
          'Invitation token has expired after 72 hours',
          { expiresAt: invitation.expiresAt },
          410
        );
        return;
      }

      if (invitation.status === 'revoked') {
        res.envelopeError('INVITATION_REVOKED', 'Invitation has been revoked by hospital admin', undefined, 403);
        return;
      }

      res.envelope({
        valid: true,
        invitation: {
          invitationId: invitation.invitationId,
          email: invitation.email,
          fullName: invitation.fullName,
          role: invitation.role,
          hospitalId: invitation.hospitalId,
          expiresAt: invitation.expiresAt,
        },
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/invitations/accept
router.post(
  '/accept',
  validate({ body: AcceptInvitationSchema }),
  auditTag('INVITATION_ACCEPTED', 'invitation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, username, password } = req.body;
      const invitation = await Invitation.findOne({ token });

      if (!invitation) {
        res.envelopeError('INVITATION_NOT_FOUND', 'Invalid invitation token', undefined, 404);
        return;
      }

      // SELF-APPROVAL GUARD: Inviting admin cannot accept/approve their own invitation
      const creatorUser = await User.findOne({ userId: invitation.createdBy });
      if (
        invitation.createdBy === username ||
        creatorUser?.username.toLowerCase() === username.toLowerCase().trim() ||
        (req.user && invitation.createdBy === req.user.id)
      ) {
        res.envelopeError(
          'SELF_APPROVAL_BLOCKED',
          'Self-approval blocked: The creating admin cannot accept or approve their own invitation',
          undefined,
          403
        );
        return;
      }

      // REUSED TOKEN REJECTION
      if (invitation.status === 'accepted' || invitation.acceptedAt) {
        res.envelopeError(
          'INVITATION_ALREADY_USED',
          'This invitation token has already been used and cannot be reused',
          undefined,
          409
        );
        return;
      }

      // EXPIRED TOKEN REJECTION (> 72 hours)
      if (invitation.expiresAt.getTime() < Date.now()) {
        invitation.status = 'expired';
        await invitation.save();
        res.envelopeError(
          'INVITATION_EXPIRED',
          'Invitation token has expired after 72 hours. Contact your facility administrator.',
          { expiresAt: invitation.expiresAt },
          410
        );
        return;
      }

      if (invitation.status === 'revoked') {
        res.envelopeError('INVITATION_REVOKED', 'This invitation has been revoked', undefined, 403);
        return;
      }

      // Check if username taken
      const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
      if (existingUser) {
        res.envelopeError('USERNAME_TAKEN', 'This username is already taken', undefined, 400);
        return;
      }

      const passwordHash = await hashPassword(password);
      const newUser = await User.create({
        userId: `usr_${uuidv4()}`,
        username: username.toLowerCase().trim(),
        role: invitation.role,
        fullName: invitation.fullName,
        hospitalId: invitation.hospitalId,
        passwordHash,
        status: 'active',
        simulation: true,
      });

      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      invitation.acceptedBy = newUser.userId;
      await invitation.save();

      res.status(201).envelope({
        user: {
          userId: newUser.userId,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          hospitalId: newUser.hospitalId,
        },
        message: 'Account successfully created and invitation accepted',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/invitations/:id/revoke
router.post(
  '/:id/revoke',
  requireAuth,
  authorizeCapability('invitation:revoke'),
  validate({ params: RevokeInvitationParamsSchema }),
  auditTag('INVITATION_REVOKE', 'invitation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const invitation = await Invitation.findOne({
        $or: [{ invitationId: id }, { _id: id.length === 24 ? id : undefined }],
      });

      if (!invitation) {
        res.envelopeError('INVITATION_NOT_FOUND', 'Invitation not found', undefined, 404);
        return;
      }

      invitation.status = 'revoked';
      await invitation.save();

      res.envelope({
        invitationId: invitation.invitationId,
        status: 'revoked',
        message: 'Invitation revoked successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const invitationRouter = router;
