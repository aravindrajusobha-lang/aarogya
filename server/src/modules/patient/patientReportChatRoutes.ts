import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { AiChatMessage } from '../assistant/aiChatMessageModel.js';
import { generateChatResponseWithGemini, isGeminiConfigured } from '../assistant/geminiService.js';
import { User } from '../auth/userModel.js';
import { logger } from '../../config/logger.js';

export const patientReportChatRouter = Router();

const ScreeningParams = z.object({ screeningId: z.string().trim().min(1).max(100).regex(/^[\w-]+$/) });
const ChatBody = z.object({
  mutationId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
  language: z.enum(['en', 'te', 'hi', 'ta', 'kn', 'ml']).default('en'),
  reportContext: z.string().max(1400).optional().default(''),
  shareProfileContext: z.boolean().default(false),
});

function patientChatScope(req: Request, res: Response): { patientId: string; chatId: string } | null {
  if (req.user?.role !== 'patient' || !req.user.patientId) {
    if (req.user?.role === 'system_admin' || (req.user?.role === 'patient' && !req.user.patientId)) {
      res.status(404).envelopeError('PATIENT_NOT_FOUND', 'Patient chat was not found.', undefined, 404);
      return null;
    }
    res.status(403).envelopeError('PATIENT_REQUIRED', 'Patient access is required.', undefined, 403);
    return null;
  }
  const screeningId = req.params.screeningId;
  return { patientId: req.user.patientId, chatId: `patient:${req.user.patientId}:${screeningId}` };
}

patientReportChatRouter.get(
  '/screenings/:screeningId/chat',
  requireAuth,
  authorizeCapability('patient:read_own'),
  validate({ params: ScreeningParams }),
  auditTag('patient.report_chat.read', 'ai_chat'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = patientChatScope(req, res);
      if (!scope) return;
      const chat: any = await AiChatMessage.findOne({
        chatId: scope.chatId,
        patientId: scope.patientId,
        screeningId: req.params.screeningId,
      }).lean();
      res.envelope({ screeningId: req.params.screeningId, messages: chat?.messages || [], simulation: true });
    } catch (error) { next(error); }
  }
);

patientReportChatRouter.post(
  '/screenings/:screeningId/chat',
  requireAuth,
  authorizeCapability('patient:chat_own'),
  validate({ params: ScreeningParams, body: ChatBody }),
  auditTag('patient.report_chat.message', 'ai_chat'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = patientChatScope(req, res);
      if (!scope) return;
      const { mutationId, message, language, reportContext, shareProfileContext } = req.body as z.infer<typeof ChatBody>;
      const profile: any = shareProfileContext
        ? await User.findOne({ userId: req.user!.id, role: 'patient', patientId: scope.patientId })
            .select('yearOfBirth gender medicalHistory allergies currentMedications habits')
            .lean()
        : null;
      const chat: any = await AiChatMessage.findOneAndUpdate(
        { chatId: scope.chatId, patientId: scope.patientId, screeningId: req.params.screeningId },
        { $setOnInsert: { chatId: scope.chatId, patientId: scope.patientId, screeningId: req.params.screeningId, messages: [], simulation: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const replayMessages = (chat.messages || []).filter((entry: any) => entry.messageId === mutationId || entry.messageId === `assistant-${mutationId}`);
      if (replayMessages.length === 2) {
        res.status(200).envelope({ screeningId: req.params.screeningId, messages: replayMessages, idempotentReplay: true, simulation: true });
        return;
      }
      const history = (chat.messages || []).slice(-6).map((entry: any) => ({
        role: entry.role,
        text: entry.content,
      }));
      const context = [
        'Respond as a patient-facing explainer for DEMO AI screening support only. Do not identify diseases or provide medicine, treatment, or cure instructions. Use plain language and remind the patient that qualified health staff make personal care decisions.',
        reportContext ? `Patient-provided report summary: ${reportContext}` : '',
        profile ? `Patient-consented profile context: ${JSON.stringify({ yearOfBirth: profile.yearOfBirth, gender: profile.gender, medicalHistory: profile.medicalHistory, allergies: profile.allergies, currentMedications: profile.currentMedications, habits: profile.habits })}` : 'Do not infer or request profile details.',
      ].filter(Boolean).join('\n');
      let answerText = language === 'te'
        ? 'నేను ఈ DEMO AI స్క్రీనింగ్ నివేదికలోని పదాలను సాధారణంగా వివరించగలను. ఇది వైద్య నిర్ధారణ కాదు. వ్యక్తిగత సంరక్షణ కోసం అర్హత కలిగిన ఆరోగ్య సిబ్బందిని సంప్రదించండి.'
        : language === 'hi'
          ? 'मैं इस DEMO AI स्क्रीनिंग रिपोर्ट के शब्दों को सरल भाषा में समझा सकता हूँ। यह चिकित्सीय निदान नहीं है। व्यक्तिगत देखभाल के लिए योग्य स्वास्थ्य कर्मी से बात करें।'
          : 'I can explain the wording in this DEMO AI screening report in plain language. Please speak with qualified health staff about personal care.';
      if (isGeminiConfigured()) {
        try {
          const generated = await generateChatResponseWithGemini({ message, conversationHistory: history, language, context });
          answerText = generated.answerText;
        } catch (error) {
          logger.warn({ error: error instanceof Error ? error.message : 'unknown' }, 'Patient report chat used safe offline response');
        }
      }
      const now = new Date();
      const newMessages = [
        { messageId: mutationId, role: 'user' as const, content: message, language, timestamp: now, metadata: { reportContext: Boolean(reportContext), profileContext: shareProfileContext } },
        { messageId: `assistant-${mutationId}`, role: 'assistant' as const, content: answerText, language, timestamp: new Date(now.getTime() + 1), metadata: { reportContext: Boolean(reportContext), profileContext: shareProfileContext } },
      ];
      await AiChatMessage.updateOne(
        { chatId: scope.chatId, patientId: scope.patientId, screeningId: req.params.screeningId },
        { $push: { messages: { $each: newMessages } } }
      );
      res.status(200).envelope({ screeningId: req.params.screeningId, messages: newMessages, simulation: true });
    } catch (error) { next(error); }
  }
);
