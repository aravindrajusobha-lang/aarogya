import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../modules/audit/auditModel.js';
import { logger } from '../config/logger.js';

export function auditTag(action: string, resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', async () => {
      try {
        if (AuditLog.db.readyState === 1) {
          await AuditLog.create({
            action,
            resourceType,
            resourceId: req.params.id || req.params.fileId,
            actorId: req.user?.id,
            actorRole: req.user?.role,
            ip: req.ip || req.socket.remoteAddress || 'unknown',
            statusCode: res.statusCode,
            simulation: true,
          });
        }
      } catch (err) {
        logger.error({
          event: 'audit_log_write_failed',
          action,
          resourceType,
          error: (err as Error).message,
        });
      }
    });

    next();
  };
}
