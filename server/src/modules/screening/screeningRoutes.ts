import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { ScreeningService } from './screeningService.js';
import { ScreeningPhoto } from './screeningPhotoModel.js';
import { ScreeningCase } from './screeningCaseModel.js';
import { ClinicalAssessment } from './clinicalAssessmentModel.js';
import { ReportService } from '../report/reportService.js';
import { isGeminiConfigured, analyzeOralPhotoWithGemini } from '../assistant/geminiService.js';

export const screeningRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP`));
    }
  },
});

const CreateCaseSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().min(1, 'Patient Name required'),
  villageId: z.string().min(1, 'Village ID required'),
  villageName: z.string().optional(),
  hospitalId: z.string().optional(),
  priority: z.enum(['routine', 'urgent', 'high_priority']).optional(),
  photoIds: z.array(z.string()).optional(),
});

const AssignCaseSchema = z.object({
  targetMoId: z.string().min(1, 'Target Medical Officer ID required'),
});

const ClinicalAssessmentSchema = z.object({
  clinicalImpression: z.string().min(1, 'Clinical impression description required'),
  lesionObserved: z.boolean().optional(),
  anatomicalSite: z.string().optional(),
  riskCategorization: z.enum(['low_risk_support', 'moderate_risk_support', 'high_risk_support']),
  recommendedFollowUpDays: z.number().int().min(1).max(365).optional(),
  clinicalNotes: z.string().optional(),
});

const ReleaseResultSchema = z.object({
  patientSummaryMessage: z.string().min(1, 'Patient summary message required'),
  recommendedAction: z.string().min(1, 'Recommended follow-up action required'),
});

const EscalateCaseSchema = z.object({
  reason: z.string().min(1, 'Escalation reason required'),
});

const ReferralCaseSchema = z.object({
  specialistId: z.string().optional(),
  specialty: z.string().min(1, 'Specialty required'),
  facilityName: z.string().min(1, 'Facility Name required'),
  referralNotes: z.string().min(1, 'Referral notes required'),
});

// ==========================================
// 1. Photo Upload (Demo or Consented Images Only)
// ==========================================
screeningRouter.post(
  '/photos/upload',
  requireAuth,
  authorizeCapability('screening:create'),
  auditTag('SCREENING_PHOTO_UPLOAD', 'screening_photo'),
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).envelope(null, 'Photo file required under key "photo"', 400);
        return;
      }

      const patientId = req.body.patientId;
      if (!patientId) {
        res.status(400).envelope(null, 'patientId required in request body', 400);
        return;
      }

      const hospitalId = req.body.hospitalId || req.user!.hospitalId || 'hosp_default';
      const isDemo = req.body.isDemo === 'true' || req.body.isDemo === true;

      const photoRecord = await ScreeningService.uploadPhoto({
        buffer: req.file.buffer,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        patientId,
        hospitalId,
        isDemo,
        user: req.user!,
      });

      res.status(201).envelope({
        photo: photoRecord,
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 2. Amend Photo (Original Remains Byte-Identical)
// ==========================================
screeningRouter.post(
  '/photos/:id/amend',
  requireAuth,
  authorizeCapability('screening:create'),
  auditTag('SCREENING_PHOTO_AMEND', 'screening_photo'),
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).envelope(null, 'Amended photo file required under key "photo"', 400);
        return;
      }

      const amendmentReason = req.body.amendmentReason || 'Clinical image enhancement / re-upload';

      const photoRecord = await ScreeningService.amendPhoto(
        req.params.id,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        amendmentReason,
        req.user!
      );

      res.status(200).envelope({
        photo: photoRecord,
        message: 'Amended version registered; original image remains byte-identical',
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 3. Get Photo Metadata and Version History
// ==========================================
screeningRouter.get(
  '/photos/:id',
  requireAuth,
  authorizeCapability('screening:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const photo = await ScreeningPhoto.findOne({ photoId: req.params.id });
      if (!photo) {
        res.status(404).envelope(null, 'Screening photo not found', 404);
        return;
      }
      res.status(200).envelope(photo);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 4. DEMO AI Screening Support Analysis
// ==========================================
screeningRouter.post(
  '/ai/analyze',
  requireAuth,
  authorizeCapability('screening:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { photoId, photoSha256, imageBase64, mimeType, patientNote, language } = req.body;
      let sha = photoSha256;

      if (photoId && !sha) {
        const photo = await ScreeningPhoto.findOne({ photoId });
        sha = photo?.currentSha256;
      }

      if (imageBase64 && isGeminiConfigured()) {
        try {
          const gemini = await analyzeOralPhotoWithGemini({
            imageBase64,
            mimeType: mimeType || 'image/jpeg',
            patientNote: patientNote || 'Screening queue photo analysis',
            language: language || 'en',
          });
          res.status(200).envelope({
            riskTier: gemini.riskTier,
            confidence: gemini.confidenceScore,
            recommendedSpecialist: gemini.recommendedDoctor?.specialty || 'Dental Surgeon',
            observations: gemini.visualFindings,
            geminiAnalysis: gemini,
            simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
          });
          return;
        } catch {
          // Fall back to calibrated demo AI
        }
      }

      const aiResult = ScreeningService.runDemoAi(sha);

      res.status(200).envelope(aiResult);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5. Create Screening Case
// ==========================================
screeningRouter.post(
  '/cases',
  requireAuth,
  authorizeCapability('screening:create'),
  validate({ body: CreateCaseSchema }),
  auditTag('SCREENING_CASE_CREATE', 'screening_case'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caseRecord = await ScreeningService.createCase({
        patientId: req.body.patientId,
        patientName: req.body.patientName,
        villageId: req.body.villageId,
        villageName: req.body.villageName,
        hospitalId: req.body.hospitalId || req.user!.hospitalId || 'hosp_default',
        priority: req.body.priority,
        photoIds: req.body.photoIds,
        user: req.user!,
      });

      res.status(201).envelope({
        case: caseRecord,
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 6. MO Case Queue: List Cases
// ==========================================
screeningRouter.get(
  '/cases',
  requireAuth,
  authorizeCapability('screening:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hospitalId = (req.query.hospitalId as string) || (req.user?.role !== 'system_admin' ? req.user?.hospitalId : undefined);
      const status = req.query.status as string | undefined;
      const assignedMoId = req.query.assignedMoId as string | undefined;

      const cases = await ScreeningService.listCases({
        hospitalId,
        status,
        assignedMoId,
      });

      res.status(200).envelope({
        total: cases.length,
        items: cases,
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 7. Get Case by ID
// ==========================================
screeningRouter.get(
  '/cases/:id',
  requireAuth,
  authorizeCapability('screening:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caseRecord = await ScreeningService.getCaseById(req.params.id);
      if (!caseRecord) {
        res.status(404).envelope(null, 'Screening case not found', 404);
        return;
      }
      res.status(200).envelope({
        case: caseRecord,
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 8. Assign Case (Cross-Hospital Assignment Guard)
// ==========================================
screeningRouter.post(
  '/cases/:id/assign',
  requireAuth,
  authorizeCapability('screening:assign'),
  validate({ body: AssignCaseSchema }),
  auditTag('SCREENING_CASE_ASSIGN', 'screening_case'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updatedCase = await ScreeningService.assignCase(
        req.params.id,
        req.body.targetMoId,
        req.user!
      );

      res.status(200).envelope(updatedCase);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 9. Record Clinical Assessment (Separate Entity)
// ==========================================
screeningRouter.post(
  '/cases/:id/assess',
  requireAuth,
  authorizeCapability('screening:review'),
  validate({ body: ClinicalAssessmentSchema }),
  auditTag('CLINICAL_ASSESSMENT_RECORD', 'clinical_assessment'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assessment = await ScreeningService.recordClinicalAssessment(
        req.params.id,
        req.body,
        req.user!
      );

      res.status(201).envelope({
        assessment,
        message: 'Clinical assessment recorded. Results remain separate and unreleased to patient.',
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 10. Release Case Result (Separate Entity)
// ==========================================
screeningRouter.post(
  '/cases/:id/release-result',
  requireAuth,
  authorizeCapability('screening:release'),
  validate({ body: ReleaseResultSchema }),
  auditTag('SCREENING_RESULT_RELEASE', 'result_release'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const release = await ScreeningService.releaseResult(
        req.params.id,
        req.body,
        req.user!
      );

      res.status(201).envelope({
        release,
        message: 'Results officially released. Patient can now view clinical summary.',
        simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 11. Escalate Case
// ==========================================
screeningRouter.post(
  '/cases/:id/escalate',
  requireAuth,
  authorizeCapability('screening:review'),
  validate({ body: EscalateCaseSchema }),
  auditTag('SCREENING_CASE_ESCALATE', 'screening_case'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const escalatedCase = await ScreeningService.escalateCase(
        req.params.id,
        req.body.reason,
        req.user!
      );

      res.status(200).envelope(escalatedCase);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 12. Request Referral
// ==========================================
screeningRouter.post(
  '/cases/:id/referral',
  requireAuth,
  authorizeCapability('screening:review'),
  validate({ body: ReferralCaseSchema }),
  auditTag('SCREENING_CASE_REFERRAL', 'screening_case'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const referredCase = await ScreeningService.requestReferral(
        req.params.id,
        req.body,
        req.user!
      );

      res.status(200).envelope(referredCase);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 13. Patient View: Clinical Results (Only After Release)
// ==========================================
screeningRouter.get(
  '/patient/:patientId/results',
  requireAuth,
  authorizeCapability('screening:read_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const results = await ScreeningService.getPatientResults(
        req.params.patientId,
        req.user!
      );

      res.status(200).envelope(results);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 14. Configurable Patient Intake Questionnaire
// ==========================================
export const QUESTIONNAIRE_CONFIG = {
  version: '2.0.0',
  title: 'Comprehensive Oral Health Risk Questionnaire',
  description: 'Frontline community oral mucosal habit and symptom intake',
  supportedLanguages: ['en', 'te', 'hi'],
  sections: [
    {
      id: 'demographics',
      title: { en: 'Demographic Information', te: 'జనాభా వివరాలు', hi: 'जनसांख्यिकीय विवरण' },
      questions: [
        { id: 'age', type: 'number', label: { en: 'Age (Years)', te: 'వయస్సు (సంవత్సరాలు)', hi: 'आयु (वर्ष)' }, required: true, min: 1, max: 120 },
        { id: 'gender', type: 'select', label: { en: 'Gender', te: 'లింగం', hi: 'लिंग' }, options: ['male', 'female', 'other'], required: true },
      ],
    },
    {
      id: 'oral_health_history',
      title: { en: 'Oral Health History', te: 'నోటి ఆరోగ్య చరిత్ర', hi: 'मौखिक स्वास्थ्य इतिहास' },
      questions: [
        { id: 'prior_lesions', type: 'boolean', label: { en: 'Previous oral sores, patches, or growths?', te: 'గతంలో నోటిలో పుండ్లు, మచ్చలు లేదా వాపులు ఉన్నాయా?', hi: 'क्या पहले मुंह में छाले, धब्बे या गांठ हुई थी?' }, optional: true },
        { id: 'brushing_frequency', type: 'select', label: { en: 'Cleaning / brushing habit', te: 'పళ్ళు తోముకునే అలవాటు', hi: 'दांत साफ करने की आदत' }, options: ['twice_daily', 'once_daily', 'neem_stick', 'finger_ash', 'rarely'], optional: true },
        { id: 'family_history', type: 'boolean', label: { en: 'Family history of chronic oral mucosal conditions?', te: 'కుటుంబంలో ఎవరికైనా దీర్ఘకాలిక నోటి సమస్యలు ఉన్నాయా?', hi: 'क्या परिवार में किसी को पुरानी मौखिक बीमारी का इतिहास है?' }, optional: true },
      ],
    },
    {
      id: 'tobacco_habits',
      title: { en: 'Tobacco Consumption', te: 'పొగాకు అలవాట్లు', hi: 'तंबाकू की आदतें' },
      questions: [
        { id: 'chewed_tobacco_gutka', type: 'boolean', label: { en: 'Chewing tobacco, gutkha, khaini, or zarda?', te: 'గుట్కా, ఖైనీ, జర్దా లేదా పొగాకు నములుతారా?', hi: 'क्या आप गुटखा, खैनी, जर्दा या तंबाकू चबाते हैं?' }, riskWeight: 25 },
        { id: 'smoked_tobacco', type: 'boolean', label: { en: 'Smoking beedi, cigarette, or cheroot?', te: 'బీడీ లేదా సిగరెట్ తాగుతారా?', hi: 'क्या आप बीड़ी या सिगरेट पीते हैं?' }, riskWeight: 15 },
        { id: 'reverse_smoking_chutta', type: 'boolean', label: { en: 'Reverse smoking (chutta with lit end inside mouth)?', te: 'చుట్టను వెలిగించిన కొన నోటిలో ఉంచి తాగుతారా (రివర్స్ స్మోకింగ్)?', hi: 'क्या आप उलटी बीड़ी/छुट्टा पीते हैं?' }, riskWeight: 35 },
        { id: 'tobacco_years', type: 'select', label: { en: 'Duration of tobacco use', te: 'పొగాకు వాడిన కాలం', hi: 'तंबाकू उपयोग की अवधि' }, options: ['none', '1_5_years', '6_10_years', 'more_than_10_years'], optional: true },
      ],
    },
    {
      id: 'areca_alcohol',
      title: { en: 'Areca Nut & Alcohol Intake', te: 'పోక చెక్క & మద్యపానం', hi: 'सुपारी और शराब का सेवन' },
      questions: [
        { id: 'areca_nut_betel_quid', type: 'boolean', label: { en: 'Areca nut, supari, or pan masala chewing?', te: 'పోక చెక్క, సుపారీ లేదా పాన్ మసాలా నములుతారా?', hi: 'क्या आप सुपारी या पान मसाला चबाते हैं?' }, riskWeight: 20 },
        { id: 'alcohol', type: 'boolean', label: { en: 'Alcohol or local brewed liquor consumption?', te: 'మద్యం లేదా సారా తాగుతారా?', hi: 'क्या आप शराब या महुआ का सेवन करते हैं?' }, riskWeight: 10 },
      ],
    },
    {
      id: 'oral_symptoms',
      title: { en: 'Oral Symptoms & Duration', te: 'నోటి లక్షణాలు & వ్యవధి', hi: 'मौखिक लक्षण और अवधि' },
      questions: [
        { id: 'ulcer_longer_than_2_weeks', type: 'boolean', label: { en: 'Non-healing ulcer persisting > 2 weeks?', te: '2 వారాలకు పైగా తగ్గని నోటి పుండు ఉందా?', hi: 'क्या 2 सप्ताह से अधिक समय से न भरने वाला छाला है?' }, riskWeight: 40, isRedFlag: true },
        { id: 'white_red_patch', type: 'boolean', label: { en: 'White, red, or mixed patch on cheek/tongue?', te: 'నాలుక లేదా బుగ్గపై తెల్లటి లేదా ఎర్రటి మచ్చ ఉందా?', hi: 'क्या जीभ या गाल पर सफेद या लाल धब्बा है?' }, riskWeight: 35, isRedFlag: true },
        { id: 'difficulty_opening_mouth', type: 'boolean', label: { en: 'Difficulty opening mouth wide (trismus)?', te: 'నోరు పూర్తిగా తెరవడంలో ఇబ్బంది ఉందా?', hi: 'क्या मुंह पूरा खोलने में कठिनाई है?' }, riskWeight: 35, isRedFlag: true },
        { id: 'burning_sensation', type: 'boolean', label: { en: 'Burning sensation on eating spicy food?', te: 'కారంగా ఉండే ఆహారం తిన్నప్పుడు నోరు మండుతోందా?', hi: 'क्या तीखा खाने पर मुंह में जलन होती है?' }, riskWeight: 15 },
        { id: 'neck_lump', type: 'boolean', label: { en: 'Swelling or lump in the neck/jaw area?', te: 'మెడ లేదా దవడ భాగంలో గడ్డ లేదా వాపు ఉందా?', hi: 'क्या गर्दन या जबड़े में कोई गांठ या सूजन है?' }, riskWeight: 40, isRedFlag: true },
        { id: 'symptom_duration', type: 'select', label: { en: 'Duration of most severe symptom', te: 'లక్షణం ప్రారంభమైన కాలం', hi: 'लक्षण की अवधि' }, options: ['under_2_weeks', '2_to_4_weeks', '1_to_3_months', 'over_3_months'], optional: true },
      ],
    },
    {
      id: 'informed_consent',
      title: { en: 'Informed Consent', te: 'సమ్మతి పత్రం', hi: 'सूचित सहमति' },
      text: {
        en: 'I agree to participate in this oral mucosal screening support simulation. I understand this platform provides screening assistance only and is not a medical evaluation.',
        te: 'ఈ నోటి ఆరోగ్య స్క్రీనింగ్ సిమ్యులేషన్‌లో పాల్గొనడానికి నేను అంగీకరిస్తున్నాను. ఇది కేవలం స్క్రీనింగ్ సహాయం మాత్రమేనని మరియు వైద్య నిర్ధారణ కాదని నేను అర్థం చేసుకున్నాను.',
        hi: 'मैं इस मौखिक स्वास्थ्य स्क्रीनिंग सहायता सिमुलेशन में भाग लेने के लिए सहमत हूँ। मैं समझता हूँ कि यह केवल स्क्रीनिंग सहायता है और चिकित्सा निर्णय नहीं है।',
      },
      required: true,
    },
  ],
};

screeningRouter.get(
  '/questionnaire-config',
  async (_req: Request, res: Response): Promise<void> => {
    res.envelope({
      questionnaire: QUESTIONNAIRE_CONFIG,
      simulation: true,
    });
  }
);

// ==========================================
// 15. Image Quality & Oral Region Validation
// ==========================================
const QualityCheckSchema = z.object({
  blurScore: z.number().min(0).optional().default(65),
  brightness: z.number().min(0).max(255).optional().default(120),
  width: z.number().min(100).optional().default(800),
  height: z.number().min(100).optional().default(600),
  oralRegion: z.enum([
    'buccal_mucosa_right',
    'buccal_mucosa_left',
    'tongue_dorsum',
    'tongue_ventral',
    'floor_of_mouth',
    'hard_palate',
    'soft_palate',
    'labial_mucosa',
    'gingiva',
    'anterior_dentition',
  ]).optional().default('buccal_mucosa_right'),
});

screeningRouter.post(
  '/quality-check',
  validate({ body: QualityCheckSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const { blurScore, brightness, width, height, oralRegion } = req.body;
    const isSharp = blurScore >= 50;
    const isLightingOk = brightness >= 40 && brightness <= 220;
    const isResolutionOk = width >= 640 && height >= 480;

    const ok = isSharp && isLightingOk && isResolutionOk;
    const issues: string[] = [];
    if (!isSharp) issues.push('Image appears blurry. Hold camera steady or tap to focus.');
    if (brightness < 40) issues.push('Lighting is too dark. Use torch/flashlight or brighter ambient lighting.');
    if (brightness > 220) issues.push('Lighting is overexposed. Reduce glare or move light source slightly aside.');
    if (!isResolutionOk) issues.push('Resolution is too low for visual observation. Minimum 640x480 required.');

    res.envelope({
      ok,
      oralRegion,
      blurScore,
      brightness,
      resolution: `${width}x${height}`,
      issues,
      guidance: ok
        ? 'Image quality is acceptable for clinical screening support.'
        : issues.join(' '),
      simulation: true,
    });
  }
);

// ==========================================
// 16. Download Screening Report PDF
// ==========================================
screeningRouter.get(
  '/cases/:id/report/pdf',
  requireAuth,
  auditTag('SCREENING_REPORT_PDF_DOWNLOAD', 'screening_case'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caseId = req.params.id;
      const screeningCase = await ScreeningCase.findOne({ caseId });
      if (!screeningCase) {
        res.envelopeError('CASE_NOT_FOUND', 'Screening case record not found', undefined, 404);
        return;
      }

      // If patient is requesting, verify ownership and ensure results are formally released
      if (req.user!.role === 'patient') {
        if (screeningCase.patientId !== req.user!.id && screeningCase.patientId !== (req.user as any).patientId) {
          res.envelopeError('FORBIDDEN', 'Access denied to other patient reports', undefined, 403);
          return;
        }
        if (!screeningCase.resultReleased) {
          res.envelopeError('RESULT_NOT_RELEASED', 'Report has not yet been released by the reviewing Medical Officer', undefined, 403);
          return;
        }
      }

      // Retrieve clinical assessment if present
      const assessment = screeningCase.clinicalAssessmentId
        ? await ClinicalAssessment.findOne({ assessmentId: screeningCase.clinicalAssessmentId }).lean()
        : null;

      const lines = [
        '========================================================================',
        'AAROGYA-DRISHTI: STRUCTURED ORAL HEALTH SCREENING SUMMARY REPORT',
        'ITDA Paderu Tribal Agency Oral Health Initiative - Alluri Sitharama Raju District',
        '========================================================================',
        '',
        `Case Reference ID   : ${screeningCase.caseId}`,
        `Patient ID          : ${screeningCase.patientId}`,
        `Patient Name        : ${screeningCase.patientName}`,
        `Habitation / Village: ${screeningCase.villageName || screeningCase.villageId}`,
        `Assigned Hospital   : ${screeningCase.hospitalId}`,
        `Screening Priority  : ${screeningCase.priority?.toUpperCase() || 'ROUTINE'}`,
        `Screening Status    : ${screeningCase.status?.toUpperCase() || 'COMPLETED'}`,
        `Created Timestamp   : ${new Date(screeningCase.createdAt).toISOString()}`,
        '',
        '--- DEMO AI SCREENING SUPPORT OBSERVATIONS ---',
        `Preliminary Risk    : ${screeningCase.demoAiResult?.riskSupportLabel?.toUpperCase() || 'LOW_RISK_SUPPORT'}`,
        `Model Confidence    : ${Math.round((screeningCase.demoAiResult?.confidenceScore || 0.88) * 100)}%`,
        `Visual Findings     : ${screeningCase.demoAiResult?.observedCondition || 'Benign Mucosa / Low-Risk Variant'}`,
        `Triage Specialty    : ${screeningCase.demoAiResult?.recommendedDoctor?.specialty || 'Dental Outpost Review'}`,
        `Recommended Window  : Within ${screeningCase.demoAiResult?.recommendedDoctor?.timelineDays || 14} days`,
        '',
        '--- HUMAN CLINICIAN ASSESSMENT NOTES ---',
        `Reviewing Clinician : ${screeningCase.assignedMoName || 'Primary Health Centre Medical Officer'}`,
        `Clinical Impression : ${assessment ? (assessment as any).clinicalImpression : 'Visual review completed. Follow-up recommended.'}`,
        `Risk Categorization : ${assessment ? (assessment as any).riskCategorization?.toUpperCase() : (screeningCase.demoAiResult?.riskSupportLabel?.toUpperCase() || 'LOW_RISK_SUPPORT')}`,
        `Recommended Action  : ${assessment ? ((assessment as any).clinicalNotes || 'Schedule in-person clinic consultation') : 'Attend Community Health Centre OPD for clinical review.'}`,
        '',
        '--- MANDATORY CLINICAL SAFETY DISCLAIMER ---',
        'WARNING: This report provides DEMO AI screening support and visual triage assistance only.',
        'This document is strictly non-diagnostic and does not replace in-person histopathological biopsy.',
        '========================================================================',
      ];

      const pdfBuffer = ReportService.generateMinimalPdf(
        `Oral Screening Report: ${screeningCase.caseId}`,
        lines,
        { userId: req.user!.id, role: req.user!.role, hospitalId: req.user!.hospitalId, scopes: req.user!.scopes || [] },
        true
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="aarogya-screening-report-${screeningCase.caseId}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
);
