import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { PersistentStore, verifyPassword } from './server/store';
import { classifyIncidentRuleBased } from './src/utils/severityClassifier';
import {
  findPotentialDuplicates,
  isIncidentSpecialistRequired,
  isResponderEligible,
} from './src/utils/duplicateDetection';
import {
  haversineDistanceKm,
  isVolunteerEligibleForTask,
  recommendTeamsForIncident,
} from './src/utils/mapRouting';
import {
  EMERGENCY_CATEGORIES,
  INCIDENT_STATUSES,
  PEOPLE_AFFECTED_OPTIONS,
  SEVERITY_LEVELS,
  type ActivityLogEntry,
  type AdminUser,
  type EmergencyCategory,
  type IncidentMessage,
  type IncidentRecord,
  type IncidentStatus,
  type PeopleAffectedOption,
  type PublicIncidentTrack,
  type RouteResult,
  type SeverityLevel,
  type SeveritySource,
  type UserRole,
  type VolunteerTaskStatus,
} from './src/types/incident';

const PORT = Number(process.env.PORT) || 3000;
const store = new PersistentStore();

// SSE clients for real-time admin updates
const sseClients = new Set<Response>();

function broadcastEvent(event: string, payload: unknown): void {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

// Signed session token helpers
function signToken(admin: AdminUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      responderId: admin.responderId,
      phone: admin.phone,
      city: admin.city,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', store.getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string | undefined): AdminUser | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', store.getSessionSecret())
    .update(payload)
    .digest('base64url');

  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as AdminUser & {
      exp: number;
    };
    if (!parsed || parsed.exp < Date.now()) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      responderId: parsed.responderId,
      phone: parsed.phone,
      city: parsed.city,
    };
  } catch {
    return null;
  }
}

interface AuthenticatedRequest extends Request {
  admin?: AdminUser;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.sr_session as string | undefined;
  const admin = verifyToken(token);
  if (!admin) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.admin = admin;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.sr_session as string | undefined;
  const admin = verifyToken(token);
  if (!admin) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  if (admin.role === 'Citizen') {
    res.status(403).json({ error: 'Access denied: Citizen accounts cannot access coordinator endpoints.' });
    return;
  }
  req.admin = admin;
  next();
}

function requireAdminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.sr_session as string | undefined;
  const admin = verifyToken(token);
  if (!admin) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  if (admin.role === 'Citizen' || admin.role === 'Volunteer') {
    res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    return;
  }
  req.admin = admin;
  next();
}

async function classifySeverity(input: {
  title: string;
  description: string;
  category: EmergencyCategory;
  peopleAffected: PeopleAffectedOption;
}): Promise<{ severity: SeverityLevel; source: SeveritySource; explanation: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: `Analyze this emergency incident report (which may be in English, Tamil, Hindi, Telugu, Malayalam, Kannada, Urdu, or mixed language) and suggest a risk level (Low, Medium, High, Critical, or Risk Assessment Pending if insufficient info) with a concise 1-2 sentence explanation in English. Consider immediate threat to human life, whether the incident is ongoing, possibility of escalation, and affected people (do NOT reduce risk if affected count is Unknown, and do NOT classify solely by category).\n\nTitle: ${input.title}\nCategory: ${input.category}\nPeople Affected: ${input.peopleAffected}\nDescription: ${input.description}`,
        config: {
          systemInstruction:
            'You are an emergency triage assistant for SafeResponse. Return a JSON object with severity (one of: Low, Medium, High, Critical, Risk Assessment Pending) and explanation (concise, objective, ending with a note that this is an automated suggestion and not a confirmed emergency assessment).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              severity: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['severity', 'explanation'],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      if (raw) {
        const parsed = JSON.parse(raw) as { severity?: string; explanation?: string };
        if (
          parsed.severity &&
          SEVERITY_LEVELS.includes(parsed.severity as SeverityLevel) &&
          parsed.explanation
        ) {
          return {
            severity: parsed.severity as SeverityLevel,
            source: 'AI-Assisted',
            explanation: parsed.explanation,
          };
        }
      }
    } catch {
      // Fall back to transparent rule-based classifier
    }
  }

  const ruleResult = classifyIncidentRuleBased(input);
  return {
    severity: ruleResult.severity,
    source: 'Rule-Based',
    explanation: ruleResult.explanation,
  };
}

function toPublicTrack(inc: IncidentRecord): PublicIncidentTrack {
  return {
    incidentId: inc.incidentId,
    isSos: inc.isSos,
    title: inc.title,
    category: inc.category,
    location: inc.location,
    severity: inc.severity,
    severityExplanation: inc.severityExplanation,
    status: inc.status,
    acknowledgedAt: inc.acknowledgedAt ?? null,
    verifiedAt: inc.verifiedAt ?? null,
    assignedTeamName: inc.assignedTeamName ?? null,
    assignedResponderName: inc.assignedResponderName ?? null,
    reportedAt: inc.reportedAt,
    updatedAt: inc.updatedAt,
    resolvedAt: inc.resolvedAt,
    statusHistory: inc.statusHistory.map((h) => ({
      status: h.status,
      timestamp: h.timestamp,
      note: h.note,
    })),
    publicMessages: (inc.messages ?? [])
      .filter((m) => m.shareWithCitizen)
      .map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        body: m.body,
        timestamp: m.timestamp,
      })),
    isDemo: inc.isDemo,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Auth routes
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const admin = store.findAdminByEmail(email);
    if (!admin || !verifyPassword(password, admin.salt, admin.passwordHash)) {
      res.status(401).json({ error: 'Invalid administrator email or password.' });
      return;
    }

    const user: AdminUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      responderId: admin.responderId,
      phone: admin.phone,
      city: admin.city,
    };
    const token = signToken(user);
    res.cookie('sr_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ user });
  });

  // Citizen Registration
  app.post('/api/auth/citizen/register', (req: Request, res: Response) => {
    const {
      name,
      email,
      password,
      phone,
      city,
      age,
      district,
      locality,
      address,
      emergencyContactName,
      emergencyContactRelation,
      emergencyContactPhone,
      bloodGroup,
      allergies,
      conditions,
      specialAssistance,
    } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      city?: string;
      age?: number;
      district?: string;
      locality?: string;
      address?: string;
      emergencyContactName?: string;
      emergencyContactRelation?: string;
      emergencyContactPhone?: string;
      bloodGroup?: string;
      allergies?: string;
      conditions?: string;
      specialAssistance?: string;
    };
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (store.findAdminByEmail(email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const created = store.addCitizenAccount({
      name,
      email,
      password,
      phone,
      city,
      age: typeof age === 'number' ? age : Number(age) || undefined,
      district,
      locality,
      address,
      emergencyContactName,
      emergencyContactRelation,
      emergencyContactPhone,
      bloodGroup,
      allergies,
      conditions,
      specialAssistance,
    });
    const user: AdminUser = {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      phone: created.phone,
      city: created.city,
    };
    const token = signToken(user);
    res.cookie('sr_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ user });
  });

  // Volunteer Registration
  app.post('/api/auth/volunteer/register', (req: Request, res: Response) => {
    const { name, email, password, qualification, skills, location } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      qualification?: string;
      skills?: string[] | string;
      location?: string;
    };
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (store.findAdminByEmail(email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const allowedQuals = [
      'General Volunteer',
      'Medical First Aid',
      'Fire & Hazmat Specialist',
      'Structural Rescue Specialist',
    ];
    const safeQual = allowedQuals.includes(qualification || '')
      ? (qualification as import('./src/types/incident').ResponderQualification)
      : 'General Volunteer';
    const parsedSkills = Array.isArray(skills)
      ? skills.map((s) => s.trim()).filter(Boolean)
      : typeof skills === 'string'
        ? skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const { account, responder } = store.addVolunteerAccount({
      name,
      email,
      password,
      qualification: safeQual,
      skills: parsedSkills,
      location,
    });

    const user: AdminUser = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      responderId: account.responderId,
      city: account.city,
    };
    const token = signToken(user);
    res.cookie('sr_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ user, responder });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('sr_session', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const admin = verifyToken(req.cookies?.sr_session as string | undefined);
    res.json({ user: admin });
  });

  // Citizen Dashboard APIs (strictly scoped to authenticated Citizen)
  app.get('/api/citizen/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    if (user.role !== 'Citizen') {
      res.status(403).json({ error: 'Citizen portal access only.' });
      return;
    }
    const profile =
      store.getCitizenById(user.id) ||
      store.upsertCitizenProfile(user.id, user.email, {
        fullName: user.name,
        mobileNumber: user.phone || '',
        district: user.city || '',
      });
    res.json({ user, profile });
  });

  app.patch('/api/citizen/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    if (user.role !== 'Citizen') {
      res.status(403).json({ error: 'Citizen portal access only.' });
      return;
    }
    const body = req.body as {
      name?: string;
      fullName?: string;
      phone?: string;
      mobileNumber?: string;
      city?: string;
      age?: number;
      district?: string;
      locality?: string;
      address?: string;
      emergencyContact?: { name?: string; relation?: string; phone?: string };
      medicalInfo?: { bloodGroup?: string; allergies?: string; conditions?: string; medications?: string };
      specialAssistance?: string;
    };

    const profile = store.upsertCitizenProfile(user.id, user.email, {
      fullName: body.fullName || body.name,
      age: body.age !== undefined ? Number(body.age) : undefined,
      mobileNumber: body.mobileNumber ?? body.phone,
      district: body.district ?? body.city,
      locality: body.locality,
      address: body.address,
      emergencyContact: body.emergencyContact
        ? {
            name: body.emergencyContact.name ?? '',
            relation: body.emergencyContact.relation ?? 'Family',
            phone: body.emergencyContact.phone ?? '',
          }
        : undefined,
      medicalInfo: body.medicalInfo
        ? {
            bloodGroup: body.medicalInfo.bloodGroup ?? 'Unknown',
            allergies: body.medicalInfo.allergies ?? 'None',
            conditions: body.medicalInfo.conditions ?? 'None',
            medications: body.medicalInfo.medications,
          }
        : undefined,
      specialAssistance: body.specialAssistance,
    });

    const nextUser: AdminUser = {
      id: user.id,
      email: user.email,
      name: profile.fullName,
      role: 'Citizen',
      phone: profile.mobileNumber,
      city: profile.district || profile.locality,
    };
    const token = signToken(nextUser);
    res.cookie('sr_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ user: nextUser, profile });
  });

  app.get('/api/citizen/incidents', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    if (user.role !== 'Citizen') {
      res.status(403).json({ error: 'Citizen portal access only.' });
      return;
    }
    const all = store.getAllIncidents();
    const profile =
      store.getCitizenById(user.id) ||
      store.getCitizens().find((c) => c.email.toLowerCase() === user.email.toLowerCase());
    const mine = all.filter(
      (inc) =>
        inc.citizenId === user.id ||
        inc.createdBy === user.id ||
        (profile && inc.citizenId === profile.citizenId)
    );
    const sampleHistory = all.filter((inc) => Boolean(inc.isDemo)).slice(0, 5);

    const mapIncident = (inc: IncidentRecord) => ({
      ...toPublicTrack(inc),
      description: inc.description,
      latitude: inc.latitude,
      longitude: inc.longitude,
      locationAccuracy: inc.locationAccuracy ?? null,
      locationTimestamp: inc.locationTimestamp ?? null,
      assignedTeamName: inc.assignedTeamName ?? null,
      assignedResponderName: inc.assignedResponderName ?? null,
      assignedAt: inc.assignedAt ?? null,
      acceptedAt: inc.acceptedAt ?? null,
      verifiedAt: inc.verifiedAt ?? null,
    });

    res.json({
      incidents: mine.map(mapIncident),
      sampleHistory: sampleHistory.map(mapIncident),
    });
  });

  app.get('/api/citizen/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    if (user.role !== 'Citizen') {
      res.status(403).json({ error: 'Citizen portal access only.' });
      return;
    }
    res.json({ notifications: store.getNotificationsForUser(user.id, 'Citizen') });
  });

  app.post('/api/citizen/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const ok = store.markNotificationRead(String(req.params.id), user.id, user.role, user.responderId);
    if (!ok) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.patch('/api/citizen/incidents/:id/location', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    if (user.role !== 'Citizen') {
      res.status(403).json({ error: 'Citizen portal access only.' });
      return;
    }
    const id = String(req.params.id || '').trim();
    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    if (existing.citizenId !== user.id && existing.createdBy !== user.id) {
      res.status(403).json({ error: 'You can only update location for your own incident reports.' });
      return;
    }
    const { latitude, longitude, locationAccuracy, location } = req.body as {
      latitude?: number;
      longitude?: number;
      locationAccuracy?: number | null;
      location?: string;
    };
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Valid GPS latitude and longitude are required.' });
      return;
    }
    const now = new Date().toISOString();
    const updated = store.updateIncident(
      id,
      (cur) => ({
        ...cur,
        latitude,
        longitude,
        locationAccuracy: locationAccuracy ?? cur.locationAccuracy ?? null,
        locationTimestamp: now,
        location: location?.trim() || cur.location,
        updatedAt: now,
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}`,
          adminIdentity: user.name,
          incidentId: existing.incidentId,
          actionType: 'INCIDENT_EDITED',
          details: `Citizen shared consent-based live GPS coordinates (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
          timestamp: now,
        },
      ]
    );
    if (updated) {
      broadcastEvent('incidents-updated', { type: 'updated', incidentId: updated.incidentId });
    }
    res.json({ ok: true, updatedAt: now });
  });

  // Public incident submission (supports standard, SOS quick report, and offline sync idempotency)
  app.post('/api/incidents', async (req: Request, res: Response) => {
    const body = req.body as {
      clientSubmissionId?: string;
      isSos?: boolean;
      title?: string;
      description?: string;
      originalDescription?: string;
      voiceLanguage?: string;
      category?: string;
      location?: string;
      peopleAffected?: string;
      contactInformation?: string;
      latitude?: unknown;
      longitude?: unknown;
      locationAccuracy?: unknown;
      locationTimestamp?: string;
    };

    // Idempotency check for offline queue sync
    if (body.clientSubmissionId) {
      const existingDup = store.findByClientSubmissionId(body.clientSubmissionId);
      if (existingDup) {
        res.status(200).json({
          incident: toPublicTrack(existingDup),
          severitySource: existingDup.severitySource,
          severityExplanation: existingDup.severityExplanation,
          deduplicated: true,
        });
        return;
      }
    }

    const isSos = Boolean(body.isSos);
    const category = body.category as EmergencyCategory;
    const title = (body.title ?? (isSos ? `SOS Quick Report: ${category}` : '')).trim();
    const description = (
      body.description ??
      (isSos ? `Urgent SOS Quick Report submitted for ${category}. Additional details pending.` : '')
    ).trim();
    const originalDescription = (body.originalDescription ?? description).trim();
    const location = (
      body.location ?? (isSos ? 'Location pending / check GPS coordinates' : '')
    ).trim();
    const peopleAffected: PeopleAffectedOption = PEOPLE_AFFECTED_OPTIONS.includes(
      body.peopleAffected as PeopleAffectedOption
    )
      ? (body.peopleAffected as PeopleAffectedOption)
      : 'Unknown';
    const contactInformation = (body.contactInformation ?? '').trim();

    if (!EMERGENCY_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Please select a valid incident category.' });
      return;
    }
    if (!isSos && title.length < 3) {
      res.status(400).json({ error: 'Incident title is required (minimum 3 characters).' });
      return;
    }
    if (!isSos && description.length < 5) {
      res.status(400).json({ error: 'Incident description is required (minimum 5 characters).' });
      return;
    }
    if (!isSos && location.length < 3) {
      res.status(400).json({ error: 'Incident location is required.' });
      return;
    }

    const lat =
      body.latitude !== null && body.latitude !== undefined && body.latitude !== ''
        ? Number(body.latitude)
        : null;
    const lng =
      body.longitude !== null && body.longitude !== undefined && body.longitude !== ''
        ? Number(body.longitude)
        : null;
    const accuracy =
      body.locationAccuracy !== null &&
      body.locationAccuracy !== undefined &&
      body.locationAccuracy !== ''
        ? Number(body.locationAccuracy)
        : null;

    const validLat = lat !== null && Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null;
    const validLng =
      lng !== null && Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null;
    const validAccuracy =
      accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null;

    const classification = isSos
      ? {
          severity: 'Critical' as SeverityLevel,
          source: 'Rule-Based' as SeveritySource,
          explanation:
            'SOS Quick Report prioritized as CRITICAL RISK for immediate coordinator review. Additional citizen details can be added.',
        }
      : await classifySeverity({
          title,
          description,
          category,
          peopleAffected,
        });

    const now = new Date().toISOString();
    const incidentId = store.generateUniqueIncidentId();
    const authUser = verifyToken(req.cookies?.sr_session as string | undefined);
    const citizenProfile =
      authUser?.role === 'Citizen'
        ? store.getCitizenById(authUser.id) ||
          store.getCitizens().find((c) => c.email.toLowerCase() === authUser.email.toLowerCase())
        : undefined;

    const resolvedContact =
      contactInformation ||
      citizenProfile?.mobileNumber ||
      authUser?.phone ||
      '';

    const record: IncidentRecord = {
      incidentId,
      clientSubmissionId: body.clientSubmissionId || undefined,
      isSos,
      citizenId: citizenProfile?.citizenId || (authUser?.role === 'Citizen' ? authUser.id : null),
      citizenName: citizenProfile?.fullName || (authUser?.role === 'Citizen' ? authUser.name : null),
      citizenMedicalSnapshot: citizenProfile
        ? {
            bloodGroup: citizenProfile.medicalInfo.bloodGroup,
            allergies: citizenProfile.medicalInfo.allergies,
            conditions: citizenProfile.medicalInfo.conditions,
            specialAssistance: citizenProfile.specialAssistance,
            emergencyContact: citizenProfile.emergencyContact?.phone
              ? `${citizenProfile.emergencyContact.name} (${citizenProfile.emergencyContact.phone})`
              : undefined,
          }
        : null,
      title,
      description,
      originalDescription,
      voiceLanguage: body.voiceLanguage || undefined,
      category,
      location,
      latitude: validLat !== null && validLng !== null ? validLat : null,
      longitude: validLat !== null && validLng !== null ? validLng : null,
      locationAccuracy: validLat !== null && validLng !== null ? validAccuracy : null,
      locationTimestamp:
        validLat !== null && validLng !== null ? body.locationTimestamp || now : null,
      peopleAffected,
      contactInformation: resolvedContact,
      severity: classification.severity,
      severitySource: classification.source,
      severityExplanation: classification.explanation,
      originalSeverity: classification.severity,
      originalSeveritySource: classification.source,
      originalSeverityExplanation: classification.explanation,
      status: 'Reported',
      acknowledgedAt: null,
      acknowledgedBy: null,
      escalationThresholdMinutes: isSos || classification.severity === 'Critical' ? 10 : 15,
      reportedAt: now,
      updatedAt: now,
      resolvedAt: null,
      statusHistory: [
        {
          status: 'Reported',
          severity: classification.severity,
          timestamp: now,
          updatedBy: citizenProfile?.fullName || (isSos ? 'Citizen SOS Portal' : 'Public Submission'),
          note: isSos
            ? 'SOS Quick Report recorded in SafeResponse'
            : 'Incident report recorded in SafeResponse',
        },
      ],
      createdBy: authUser?.id || 'Public',
      isDemo: false,
    };

    const logEntry: ActivityLogEntry = {
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      adminIdentity: citizenProfile?.fullName || (isSos ? 'Citizen SOS Portal' : 'Public Portal'),
      incidentId,
      actionType: isSos ? 'SOS_CREATED' : 'INCIDENT_CREATED',
      details: `${isSos ? 'SOS Quick Report' : 'New report'} for ${category} (${classification.severity})`,
      timestamp: now,
    };

    store.addIncident(record, logEntry);

    // Persistent notification for Admin Dashboard
    store.addNotification({
      id: `NOTIF-${Date.now().toString(36).toUpperCase()}`,
      targetUserId: null,
      targetRole: 'Admin',
      incidentId,
      type: 'NEW_SOS',
      title: isSos ? `New SOS Alert: ${category}` : `New ${classification.severity} Incident`,
      message: `${record.citizenName || 'Citizen'} reported ${category} at ${location} (${incidentId}).`,
      read: false,
      timestamp: now,
    });

    broadcastEvent('incidents-updated', { type: 'created', incidentId });

    res.status(201).json({
      incident: toPublicTrack(record),
      severitySource: record.severitySource,
      severityExplanation: record.severityExplanation,
    });
  });

  // Citizen supplemental details for SOS Quick Report
  app.patch('/api/incidents/:id/supplement', (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    const body = req.body as {
      description?: string;
      location?: string;
      peopleAffected?: PeopleAffectedOption;
      contactInformation?: string;
    };
    const now = new Date().toISOString();
    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        description: body.description?.trim()
          ? `${curr.description}\n\n[Citizen Follow-up]: ${body.description.trim()}`
          : curr.description,
        location: body.location?.trim() || curr.location,
        peopleAffected:
          body.peopleAffected && PEOPLE_AFFECTED_OPTIONS.includes(body.peopleAffected)
            ? body.peopleAffected
            : curr.peopleAffected,
        contactInformation: body.contactInformation?.trim() || curr.contactInformation,
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: curr.status,
            timestamp: now,
            updatedBy: 'Citizen Follow-up',
            note: 'Additional details submitted by reporter',
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-SUP`,
          adminIdentity: 'Citizen Follow-up',
          incidentId: existing.incidentId,
          actionType: 'INCIDENT_EDITED',
          details: 'Citizen submitted supplemental details for SOS report',
          timestamp: now,
        },
      ]
    );

    broadcastEvent('incidents-updated', { type: 'supplemented', incidentId: id });
    res.json({ incident: updated ? toPublicTrack(updated) : null });
  });

  // Public tracking endpoint (never exposes contactInformation or admin identity)
  app.get('/api/incidents/:id/track', (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Incident ID is required.' });
      return;
    }
    const found = store.getIncidentById(id);
    if (!found) {
      res.status(404).json({
        error: `No incident found with ID "${id}". Please check the ID format (e.g., SR-2026-1001) and try again.`,
      });
      return;
    }
    res.json({ incident: toPublicTrack(found) });
  });

  // Admin SSE stream
  app.get('/api/admin/stream', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Admin: list incidents
  app.get('/api/admin/incidents', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ incidents: store.getAllIncidents() });
  });

  // Admin: get single incident
  app.get('/api/admin/incidents/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const found = store.getIncidentById(String(req.params.id));
    if (!found) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    res.json({ incident: found });
  });

  // Admin: update incident (severity, status, permitted fields)
  app.patch('/api/admin/incidents/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    const body = req.body as {
      severity?: SeverityLevel;
      status?: IncidentStatus;
      title?: string;
      description?: string;
      location?: string;
      peopleAffected?: PeopleAffectedOption;
      note?: string;
    };

    if (body.severity !== undefined && !SEVERITY_LEVELS.includes(body.severity)) {
      res.status(400).json({ error: 'Invalid severity level.' });
      return;
    }
    if (body.status !== undefined && !INCIDENT_STATUSES.includes(body.status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }

    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Administrator';
    const logs: ActivityLogEntry[] = [];

    const updated = store.updateIncident(
      id,
      (curr) => {
        const next: IncidentRecord = { ...curr, updatedAt: now };

        const statusChanged = body.status !== undefined && body.status !== curr.status;
        const severityChanged = body.severity !== undefined && body.severity !== curr.severity;

        if (severityChanged && body.severity) {
          logs.push({
            id: `ACT-${Date.now().toString(36).toUpperCase()}-SEV`,
            adminIdentity: adminName,
            incidentId: curr.incidentId,
            actionType: 'SEVERITY_UPDATED',
            details: `Risk level changed from ${curr.severity} to ${body.severity}`,
            timestamp: now,
          });
          next.severity = body.severity;
          next.severitySource = 'Manual Override';
        }

        if (statusChanged && body.status) {
          logs.push({
            id: `ACT-${Date.now().toString(36).toUpperCase()}-STS`,
            adminIdentity: adminName,
            incidentId: curr.incidentId,
            actionType: 'STATUS_UPDATED',
            details: `Status changed from ${curr.status} to ${body.status}${body.note ? ` — ${body.note}` : ''}`,
            timestamp: now,
          });
          next.status = body.status;
          if (body.status === 'Resolved') {
            next.resolvedAt = now;
          } else if (curr.status === 'Resolved') {
            next.resolvedAt = null;
          }
        }

        if (statusChanged || severityChanged || body.note?.trim()) {
          next.statusHistory = [
            ...curr.statusHistory,
            {
              status: next.status,
              severity: severityChanged ? next.severity : undefined,
              timestamp: now,
              updatedBy: adminName,
              note:
                body.note?.trim() ||
                (severityChanged && !statusChanged
                  ? `Risk level overridden to ${next.severity}`
                  : `Status updated to ${next.status}`),
            },
          ];
        }

        let editedFields = false;
        if (typeof body.title === 'string' && body.title.trim() && body.title.trim() !== curr.title) {
          next.title = body.title.trim();
          editedFields = true;
        }
        if (
          typeof body.description === 'string' &&
          body.description.trim() &&
          body.description.trim() !== curr.description
        ) {
          next.description = body.description.trim();
          editedFields = true;
        }
        if (
          typeof body.location === 'string' &&
          body.location.trim() &&
          body.location.trim() !== curr.location
        ) {
          next.location = body.location.trim();
          editedFields = true;
        }
        if (
          body.peopleAffected &&
          PEOPLE_AFFECTED_OPTIONS.includes(body.peopleAffected) &&
          body.peopleAffected !== curr.peopleAffected
        ) {
          next.peopleAffected = body.peopleAffected;
          editedFields = true;
        }

        if (editedFields) {
          logs.push({
            id: `ACT-${Date.now().toString(36).toUpperCase()}-EDT`,
            adminIdentity: adminName,
            incidentId: curr.incidentId,
            actionType: 'INCIDENT_EDITED',
            details: 'Updated incident details',
            timestamp: now,
          });
        }

        return next;
      },
      logs
    );

    if (updated && body.status && body.status !== existing.status) {
      const targetCitizenId = updated.citizenId || (updated.createdBy !== 'Public' ? updated.createdBy : null);
      if (targetCitizenId) {
        if (body.status === 'In Progress') {
          store.addNotification({
            id: `NOTIF-${Date.now().toString(36).toUpperCase()}-RSP`,
            targetUserId: targetCitizenId,
            targetRole: 'Citizen',
            incidentId: updated.incidentId,
            type: 'RESPONSE_STARTED',
            title: 'Response In Progress',
            message: `Response team has started active operations for ${updated.incidentId}.`,
            read: false,
            timestamp: now,
          });
        } else if (body.status === 'Resolved') {
          store.addNotification({
            id: `NOTIF-${Date.now().toString(36).toUpperCase()}-RES`,
            targetUserId: targetCitizenId,
            targetRole: 'Citizen',
            incidentId: updated.incidentId,
            type: 'INCIDENT_RESOLVED',
            title: 'Incident Resolved',
            message: `Your emergency report ${updated.incidentId} has been marked Resolved.`,
            read: false,
            timestamp: now,
          });
        }
      }
    }

    broadcastEvent('incidents-updated', { type: 'updated', incidentId: id });
    res.json({ incident: updated });
  });

  // Admin: acknowledge & prioritize critical/high-priority emergency
  app.post('/api/admin/incidents/:id/acknowledge', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Administrator';
    const logEntry: ActivityLogEntry = {
      id: `ACT-${Date.now().toString(36).toUpperCase()}-ACK`,
      adminIdentity: adminName,
      incidentId: existing.incidentId,
      actionType: 'INCIDENT_ACKNOWLEDGED',
      details: `Acknowledged & prioritized ${existing.severity} risk incident`,
      timestamp: now,
    };

    const updated = store.updateIncident(
      id,
      (curr) => {
        const nextStatus: IncidentStatus = curr.status === 'Reported' ? 'In Progress' : curr.status;
        return {
          ...curr,
          status: nextStatus,
          acknowledgedAt: now,
          acknowledgedBy: adminName,
          updatedAt: now,
          statusHistory: [
            ...curr.statusHistory,
            {
              status: nextStatus,
              timestamp: now,
              updatedBy: adminName,
              note: 'Emergency acknowledged and prioritized by coordinator',
            },
          ],
        };
      },
      [logEntry]
    );

    broadcastEvent('incidents-updated', { type: 'acknowledged', incidentId: id });
    res.json({ incident: updated });
  });

  // Duplicate detection & linking
  app.get('/api/admin/incidents/:id/duplicates', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const target = store.getIncidentById(id);
    if (!target) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    const candidates = findPotentialDuplicates(target, store.getAllIncidents());
    res.json({ candidates });
  });

  app.post('/api/admin/incidents/:id/link-duplicate', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    if (req.admin?.role === 'Volunteer') {
      res.status(403).json({ error: 'Only authorized Admin or Client coordinators can link duplicates.' });
      return;
    }
    const id = String(req.params.id);
    const { duplicateId } = req.body as { duplicateId?: string };
    const target = store.getIncidentById(id);
    const dup = duplicateId ? store.getIncidentById(duplicateId) : undefined;
    if (!target || !dup || target.incidentId === dup.incidentId) {
      res.status(400).json({ error: 'Valid primary and duplicate incident IDs are required.' });
      return;
    }

    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Coordinator';

    const updatedPrimary = store.updateIncident(
      target.incidentId,
      (curr) => {
        const existingLinks = curr.linkedDuplicateIds ?? [];
        if (existingLinks.includes(dup.incidentId)) return curr;
        return {
          ...curr,
          linkedDuplicateIds: [...existingLinks, dup.incidentId],
          updatedAt: now,
          statusHistory: [
            ...curr.statusHistory,
            {
              status: curr.status,
              timestamp: now,
              updatedBy: adminName,
              note: `Linked duplicate report ${dup.incidentId} (both original records preserved)`,
            },
          ],
        };
      },
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-DUP`,
          adminIdentity: adminName,
          incidentId: target.incidentId,
          actionType: 'DUPLICATE_LINKED',
          details: `Linked ${dup.incidentId} as potential duplicate of ${target.incidentId}`,
          timestamp: now,
        },
      ]
    );

    store.updateIncident(
      dup.incidentId,
      (curr) => ({
        ...curr,
        duplicateOf: target.incidentId,
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: curr.status,
            timestamp: now,
            updatedBy: adminName,
            note: `Marked as linked duplicate of ${target.incidentId} (audit history preserved)`,
          },
        ],
      }),
      []
    );

    broadcastEvent('incidents-updated', { type: 'duplicate-linked', incidentId: target.incidentId });
    res.json({ incident: updatedPrimary });
  });

  // Responders & Safety-Gated Assignment
  app.get('/api/admin/responders', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ responders: store.getResponders() });
  });

  app.post('/api/admin/incidents/:id/assign', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    if (req.admin?.role === 'Volunteer') {
      res.status(403).json({ error: 'Only Admin or Client coordinators can assign responders.' });
      return;
    }
    const id = String(req.params.id);
    const { responderId, reason } = req.body as { responderId?: string; reason?: string };
    const existing = store.getIncidentById(id);
    const responder = responderId ? store.getResponderById(responderId) : undefined;

    if (!existing || !responder) {
      res.status(404).json({ error: 'Incident or responder not found.' });
      return;
    }

    if (!isResponderEligible(responder, existing)) {
      const safety = isIncidentSpecialistRequired(existing);
      res.status(403).json({
        error: `Safety Restriction: ${responder.name} (${responder.qualification}) is not qualified or available for this incident. ${safety.safetyNotice}`,
      });
      return;
    }

    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Coordinator';

    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        assignedResponderId: responder.id,
        assignedResponderName: responder.name,
        assignedAt: now,
        acceptedAt: null,
        escalatedAt: null,
        verifiedAt: curr.verifiedAt || now,
        verifiedBy: curr.verifiedBy || adminName,
        status: curr.status === 'Reported' ? 'Pending' : curr.status,
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: curr.status === 'Reported' ? 'Pending' : curr.status,
            timestamp: now,
            updatedBy: adminName,
            note: `Assigned to ${responder.name} (${responder.qualification})${reason ? ` — ${reason}` : ''}`,
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-ASG`,
          adminIdentity: adminName,
          incidentId: existing.incidentId,
          actionType: 'RESPONDER_ASSIGNED',
          details: `Assigned ${responder.name} (${responder.qualification})${reason ? ` — ${reason}` : ''}`,
          timestamp: now,
        },
      ]
    );

    if (updated) {
      store.updateResponderAvailability(responder.id, false);
      store.incrementResponderTasks(responder.id, 'assignedTasksCount');
      store.addNotification({
        id: `NOTIF-${Date.now().toString(36).toUpperCase()}-VOL`,
        targetUserId: responder.id,
        targetRole: 'Volunteer',
        incidentId: updated.incidentId,
        type: 'VOLUNTEER_ASSIGNED',
        title: `New Assignment: ${updated.incidentId}`,
        message: `You have been assigned to ${updated.title} at ${updated.location}.`,
        read: false,
        timestamp: now,
      });
      if (updated.citizenId) {
        store.addNotification({
          id: `NOTIF-${Date.now().toString(36).toUpperCase()}-CIT`,
          targetUserId: updated.citizenId,
          targetRole: 'Citizen',
          incidentId: updated.incidentId,
          type: 'TEAM_ASSIGNED',
          title: 'Responder Assigned',
          message: `${responder.name} has been assigned to your report ${updated.incidentId}.`,
          read: false,
          timestamp: now,
        });
      }
    }
    broadcastEvent('incidents-updated', { type: 'assigned', incidentId: id });
    res.json({ incident: updated });
  });

  app.post('/api/admin/incidents/:id/accept', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    const now = new Date().toISOString();
    const actorName = req.admin?.name || 'Responder';

    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        acceptedAt: now,
        status: 'In Progress',
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: 'In Progress',
            timestamp: now,
            updatedBy: actorName,
            note: `Assignment accepted by ${actorName}`,
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-ACC`,
          adminIdentity: actorName,
          incidentId: existing.incidentId,
          actionType: 'ASSIGNMENT_ACCEPTED',
          details: `${actorName} accepted assignment and started response`,
          timestamp: now,
        },
      ]
    );

    if (updated?.citizenId) {
      store.addNotification({
        id: `NOTIF-${Date.now().toString(36).toUpperCase()}-ACC`,
        targetUserId: updated.citizenId,
        targetRole: 'Citizen',
        incidentId: updated.incidentId,
        type: 'RESPONSE_STARTED',
        title: 'Response Started',
        message: `${actorName} accepted your emergency report ${updated.incidentId} and is responding.`,
        read: false,
        timestamp: now,
      });
    }

    broadcastEvent('incidents-updated', { type: 'accepted', incidentId: id });
    res.json({ incident: updated });
  });

  // Smart Communication Center
  app.post('/api/admin/incidents/:id/messages', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const { body: msgBody, shareWithCitizen } = req.body as {
      body?: string;
      shareWithCitizen?: boolean;
    };
    const text = (msgBody ?? '').trim();
    if (!text) {
      res.status(400).json({ error: 'Message body cannot be empty.' });
      return;
    }

    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    const now = new Date().toISOString();
    const senderName = req.admin?.name || 'Coordinator';
    const senderRole = req.admin?.role || 'Admin';

    const message: IncidentMessage = {
      id: `MSG-${Date.now().toString(36).toUpperCase()}`,
      senderName,
      senderRole,
      body: text,
      shareWithCitizen: Boolean(shareWithCitizen),
      timestamp: now,
    };

    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        messages: [...(curr.messages ?? []), message],
        updatedAt: now,
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-MSG`,
          adminIdentity: senderName,
          incidentId: existing.incidentId,
          actionType: 'MESSAGE_SENT',
          details: `${shareWithCitizen ? 'Citizen-visible update' : 'Internal team message'} posted`,
          timestamp: now,
        },
      ]
    );

    broadcastEvent('incidents-updated', { type: 'message', incidentId: id });
    res.json({ incident: updated, message });
  });

  // Emergency Resource Management
  app.get('/api/admin/resources', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ resources: store.getResources() });
  });

  app.post('/api/admin/resources/:id/allocate', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    if (req.admin?.role === 'Volunteer') {
      res.status(403).json({ error: 'Only Admin or Client coordinators can allocate resources.' });
      return;
    }
    const resId = String(req.params.id);
    const { incidentId, team } = req.body as { incidentId?: string; team?: string };
    if (!incidentId || !team?.trim()) {
      res.status(400).json({ error: 'Incident ID and response team are required.' });
      return;
    }

    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Coordinator';
    const updated = store.updateResource(
      resId,
      (r) => ({
        ...r,
        status: 'Allocated',
        allocatedIncidentId: incidentId.trim(),
        allocatedTeam: team.trim(),
        allocatedAt: now,
        returnedAt: null,
      }),
      {
        id: `ACT-${Date.now().toString(36).toUpperCase()}-RES`,
        adminIdentity: adminName,
        incidentId: incidentId.trim(),
        actionType: 'RESOURCE_ALLOCATED',
        details: `Allocated ${resId} to ${team.trim()}`,
        timestamp: now,
      }
    );

    if (!updated) {
      res.status(404).json({ error: 'Resource not found.' });
      return;
    }
    res.json({ resource: updated });
  });

  app.post('/api/admin/resources/:id/return', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const resId = String(req.params.id);
    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Coordinator';

    const updated = store.updateResource(
      resId,
      (r) => ({
        ...r,
        status: 'Available',
        returnedAt: now,
        allocatedIncidentId: null,
        allocatedTeam: null,
      }),
      {
        id: `ACT-${Date.now().toString(36).toUpperCase()}-RET`,
        adminIdentity: adminName,
        incidentId: 'RESOURCE',
        actionType: 'RESOURCE_RETURNED',
        details: `Marked resource ${resId} returned and available`,
        timestamp: now,
      }
    );

    if (!updated) {
      res.status(404).json({ error: 'Resource not found.' });
      return;
    }
    res.json({ resource: updated });
  });

  // Admin: delete incident
  app.delete('/api/admin/incidents/:id', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const adminName = req.admin?.name || 'Administrator';
    const ok = store.deleteIncident(id, {
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      adminIdentity: adminName,
      incidentId: id,
      actionType: 'INCIDENT_DELETED',
      details: `Deleted incident record ${id}`,
      timestamp: new Date().toISOString(),
    });

    if (!ok) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    broadcastEvent('incidents-updated', { type: 'deleted', incidentId: id });
    res.json({ ok: true });
  });

  // Admin: reset demo data without deleting real submitted reports
  app.post('/api/admin/reset-demo', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const adminName = req.admin?.name || 'Administrator';
    store.resetDemoData(adminName);
    broadcastEvent('incidents-updated', { type: 'demo-reset' });
    res.json({ incidents: store.getAllIncidents() });
  });

  // Admin: activity log
  app.get('/api/admin/activity', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ logs: store.getActivityLogs() });
  });

  // Admin: real database-computed platform stats (supports ?mode=demo|real|all)
  app.get('/api/admin/stats', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const mode = String(req.query.mode || 'all').toLowerCase();
    const filterByMode = <T extends { isDemo?: boolean }>(items: T[]): T[] => {
      if (mode === 'demo') return items.filter((i) => i.isDemo);
      if (mode === 'real') return items.filter((i) => !i.isDemo);
      return items;
    };

    const incidents = filterByMode(store.getAllIncidents());
    const citizens = filterByMode(store.getCitizens());
    const volunteers = filterByMode(store.getResponders());
    const teams = filterByMode(store.getTeams());
    const facilities = filterByMode(store.getFacilities());
    const volunteerTasks = filterByMode(store.getVolunteerTasks());

    res.json({
      totalCitizens: citizens.length,
      verifiedCitizens: citizens.filter((c) => c.verified).length,
      totalVolunteers: volunteers.length,
      verifiedVolunteers: volunteers.filter((v) => v.verified).length,
      availableVolunteers: volunteers.filter((v) => v.available).length,
      totalIncidents: incidents.length,
      activeIncidents: incidents.filter((i) => i.status !== 'Resolved').length,
      criticalIncidents: incidents.filter((i) => i.severity === 'Critical' && i.status !== 'Resolved').length,
      resolvedIncidents: incidents.filter((i) => i.status === 'Resolved').length,
      availableTeams: teams.filter((t) => t.available || t.status === 'Available').length,
      busyTeams: teams.filter((t) => !t.available && t.status !== 'Available').length,
      totalTeams: teams.length,
      fireTeams: teams.filter((t) => t.teamType === 'Fire').length,
      medicalTeams: teams.filter((t) => t.teamType === 'Medical').length,
      rescueTeams: teams.filter((t) => t.teamType === 'Rescue').length,
      doctorsCount: facilities.filter((f) => f.category === 'Doctor').length,
      hospitalsCount: facilities.filter((f) => f.category === 'Hospital').length,
      clinicsCount: facilities.filter((f) => f.category === 'Clinic').length,
      reliefCentresCount: facilities.filter((f) => f.category === 'Relief Centre').length,
      sheltersCount: facilities.filter((f) => f.category === 'Emergency Shelter').length,
      collegesCount: facilities.filter((f) => f.category === 'College').length,
      volunteerTasksTotal: volunteerTasks.length,
      volunteerTasksCompleted: volunteerTasks.filter((t) => t.status === 'COMPLETED').length,
      volunteerTasksActive: volunteerTasks.filter(
        (t) => t.status === 'ACCEPTED' || t.status === 'IN-PROGRESS'
      ).length,
    });
  });

  // Routing proxy: OSRM road route with explicit straight-line Haversine fallback
  app.get('/api/route', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const toLat = Number(req.query.toLat);
    const toLng = Number(req.query.toLng);

    if (
      !Number.isFinite(fromLat) ||
      !Number.isFinite(fromLng) ||
      !Number.isFinite(toLat) ||
      !Number.isFinite(toLng)
    ) {
      res.status(400).json({ error: 'Valid fromLat, fromLng, toLat, toLng coordinates are required.' });
      return;
    }

    const straightKm = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
    const fallback: RouteResult = {
      mode: 'straight-line',
      distanceKm: straightKm,
      durationMin: null,
      coordinates: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      label: `Straight-line distance: ${straightKm} km (road routing unavailable)`,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const response = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        res.json(fallback);
        return;
      }

      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry?: { coordinates?: Array<[number, number]> };
        }>;
      };

      const route = data.routes?.[0];
      if (!route || !route.geometry?.coordinates?.length) {
        res.json(fallback);
        return;
      }

      const distanceKm = Math.round((route.distance / 1000) * 100) / 100;
      const durationMin = Math.max(1, Math.round(route.duration / 60));
      const coordinates: Array<[number, number]> = route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );

      const result: RouteResult = {
        mode: 'road-route',
        distanceKm,
        durationMin,
        coordinates,
        label: `Road route: ${distanceKm} km (~${durationMin} min)`,
      };
      res.json(result);
    } catch {
      res.json(fallback);
    }
  });

  // Admin: Citizen Management
  app.get('/api/admin/citizens', requireAdminOnly, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ citizens: store.getCitizens() });
  });

  app.post('/api/admin/citizens/:id/verify', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const citizenId = String(req.params.id);
    const { verified } = req.body as { verified?: boolean };
    const updated = store.verifyCitizen(
      citizenId,
      verified !== undefined ? Boolean(verified) : true,
      req.admin?.name || 'Administrator'
    );
    if (!updated) {
      res.status(404).json({ error: 'Citizen profile not found.' });
      return;
    }
    res.json({ citizen: updated });
  });

  // Admin: Volunteer Verification
  app.post('/api/admin/volunteers/:id/verify', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const volunteerId = String(req.params.id);
    const { verified } = req.body as { verified?: boolean };
    const updated = store.verifyVolunteer(
      volunteerId,
      verified !== undefined ? Boolean(verified) : true,
      req.admin?.name || 'Administrator'
    );
    if (!updated) {
      res.status(404).json({ error: 'Volunteer not found.' });
      return;
    }
    res.json({ volunteer: updated });
  });

  // Admin: Response Teams, Facilities, Volunteer Tasks & Recommendations
  app.get('/api/admin/teams', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ teams: store.getTeams() });
  });

  app.patch('/api/admin/teams/:id/availability', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const teamId = String(req.params.id);
    const { available } = req.body as { available?: boolean };
    const updated = store.updateTeamAvailability(teamId, Boolean(available));
    if (!updated) {
      res.status(404).json({ error: 'Response team not found.' });
      return;
    }
    broadcastEvent('incidents-updated', { type: 'team-availability', teamId });
    res.json({ team: updated });
  });

  app.get('/api/admin/facilities', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ facilities: store.getFacilities() });
  });

  app.get('/api/admin/volunteer-tasks', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ tasks: store.getVolunteerTasks() });
  });

  app.get('/api/admin/incidents/:id/recommended-teams', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const inc = store.getIncidentById(String(req.params.id));
    if (!inc) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    const recommendations = recommendTeamsForIncident(inc, store.getTeams());
    res.json({ recommendations });
  });

  app.post('/api/admin/incidents/:id/verify', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = store.getIncidentById(id);
    if (!existing) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Administrator';
    const updated = store.updateIncident(
      id,
      (curr) => {
        const nextStatus: IncidentStatus = curr.status === 'Reported' ? 'Pending' : curr.status;
        return {
          ...curr,
          verifiedAt: curr.verifiedAt || now,
          verifiedBy: curr.verifiedBy || adminName,
          status: nextStatus,
          updatedAt: now,
          statusHistory: [
            ...curr.statusHistory,
            {
              status: nextStatus,
              timestamp: now,
              updatedBy: adminName,
              note: 'Incident verified by emergency coordinator',
            },
          ],
        };
      },
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-VER`,
          adminIdentity: adminName,
          incidentId: existing.incidentId,
          actionType: 'INCIDENT_VERIFIED',
          details: `Verified emergency report ${existing.incidentId}`,
          timestamp: now,
        },
      ]
    );

    if (updated?.citizenId) {
      store.addNotification({
        id: `NOTIF-${Date.now().toString(36).toUpperCase()}-VER`,
        targetUserId: updated.citizenId,
        targetRole: 'Citizen',
        incidentId: updated.incidentId,
        type: 'INCIDENT_VERIFIED',
        title: 'Incident Verified',
        message: `Your emergency report ${updated.incidentId} has been verified by ${adminName}.`,
        read: false,
        timestamp: now,
      });
    }
    broadcastEvent('incidents-updated', { type: 'verified', incidentId: id });
    res.json({ incident: updated });
  });

  app.post('/api/admin/incidents/:id/assign-team', requireAdminOnly, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const { teamId } = req.body as { teamId?: string };
    const existing = store.getIncidentById(id);
    const team = teamId ? store.getTeamById(teamId) : undefined;
    if (!existing || !team) {
      res.status(404).json({ error: 'Incident or response team not found.' });
      return;
    }

    const now = new Date().toISOString();
    const adminName = req.admin?.name || 'Administrator';
    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        verifiedAt: curr.verifiedAt || now,
        verifiedBy: curr.verifiedBy || adminName,
        assignedTeamId: team.teamId,
        assignedTeamName: team.teamName,
        assignedAt: now,
        status: curr.status === 'Reported' ? 'Pending' : curr.status,
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: curr.status === 'Reported' ? 'Pending' : curr.status,
            timestamp: now,
            updatedBy: adminName,
            note: `Response Team Assigned: ${team.teamName} (Lead: ${team.leadName})`,
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-TEAM`,
          adminIdentity: adminName,
          incidentId: existing.incidentId,
          actionType: 'TEAM_ASSIGNED',
          details: `Assigned response team ${team.teamName} to ${existing.incidentId}`,
          timestamp: now,
        },
      ]
    );

    store.assignTeamToIncident(team.teamId, existing.incidentId);
    if (updated?.citizenId) {
      store.addNotification({
        id: `NOTIF-${Date.now().toString(36).toUpperCase()}-TEAM`,
        targetUserId: updated.citizenId,
        targetRole: 'Citizen',
        incidentId: updated.incidentId,
        type: 'TEAM_ASSIGNED',
        title: 'Response Team Assigned',
        message: `${team.teamName} has been assigned to your report ${updated.incidentId}.`,
        read: false,
        timestamp: now,
      });
    }
    broadcastEvent('incidents-updated', { type: 'team-assigned', incidentId: id });
    res.json({ incident: updated, team: store.getTeamById(team.teamId) });
  });

  // Admin: Notifications
  app.get('/api/admin/notifications', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    res.json({ notifications: store.getNotificationsForUser(user.id, user.role, user.responderId) });
  });

  app.post('/api/admin/notifications/:id/read', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const ok = store.markNotificationRead(String(req.params.id), user.id, user.role, user.responderId);
    if (!ok) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Volunteer Portal Endpoints
  app.get('/api/volunteer/dashboard', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const responders = store.getResponders();
    const demoResponderId = req.query.demoResponderId ? String(req.query.demoResponderId) : '';
    const requestedDemo = demoResponderId
      ? responders.find((r) => r.id === demoResponderId && r.isDemo)
      : undefined;

    const profile =
      requestedDemo ||
      (user.responderId ? store.getResponderById(user.responderId) : undefined) ||
      responders.find((r) => r.email?.toLowerCase() === user.email.toLowerCase()) ||
      responders[1];

    const allIncidents = store.getAllIncidents();
    const assignedTasks = allIncidents.filter(
      (inc) => inc.assignedResponderId === profile.id && inc.status !== 'Resolved'
    );
    const completedTasks = allIncidents.filter(
      (inc) => inc.assignedResponderId === profile.id && inc.status === 'Resolved'
    );
    const availableOpportunities = allIncidents.filter(
      (inc) =>
        inc.status !== 'Resolved' &&
        !inc.assignedResponderId &&
        isResponderEligible(profile, inc)
    );
    const notifications = store.getNotificationsForUser(user.id, 'Volunteer', profile.id);

    const allVolunteerTasks = store.getVolunteerTasks();
    const availableVolunteerTasks = allVolunteerTasks.filter(
      (t) =>
        t.status === 'NEW' &&
        !(t.declinedByIds || []).includes(profile.id) &&
        isVolunteerEligibleForTask(profile, t)
    );
    const myVolunteerTasks = allVolunteerTasks.filter(
      (t) => t.assignedVolunteerId === profile.id && t.status !== 'COMPLETED'
    );
    const completedVolunteerTasks = allVolunteerTasks.filter(
      (t) => t.assignedVolunteerId === profile.id && t.status === 'COMPLETED'
    );

    res.json({
      profile,
      demoVolunteers: responders.filter((r) => r.isDemo),
      assignedTasks,
      completedTasks,
      availableOpportunities,
      volunteerTasks: {
        available: availableVolunteerTasks,
        assigned: myVolunteerTasks,
        completed: completedVolunteerTasks,
      },
      facilities: store.getFacilities(),
      notifications,
    });
  });

  app.patch('/api/volunteer/availability', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const { available, demoResponderId } = req.body as {
      available?: boolean;
      demoResponderId?: string;
    };
    const responderId = demoResponderId || user.responderId || 'RES-02';
    const updated = store.updateResponderAvailability(responderId, Boolean(available));
    if (!updated) {
      res.status(404).json({ error: 'Volunteer profile not found.' });
      return;
    }
    res.json({ profile: updated });
  });

  // Volunteer Support Tasks (NEW -> ACCEPTED -> IN-PROGRESS -> COMPLETED)
  app.post('/api/volunteer/vtasks/:taskId/accept', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const taskId = String(req.params.taskId);
    const { demoResponderId } = (req.body || {}) as { demoResponderId?: string };
    const responderId = demoResponderId || user.responderId || 'RES-02';
    const responder = store.getResponderById(responderId);
    const task = store.getVolunteerTaskById(taskId);
    if (!responder || !task) {
      res.status(404).json({ error: 'Volunteer or task not found.' });
      return;
    }
    if (!responder.verified) {
      res.status(403).json({
        error: 'Safety Gate: Volunteer must be verified by an administrator before accepting tasks.',
      });
      return;
    }
    if (!isVolunteerEligibleForTask(responder, task)) {
      res.status(403).json({
        error: `Safety Gate: This task requires ${task.requiredQualification} qualification.`,
      });
      return;
    }
    if (task.status !== 'NEW') {
      res.status(409).json({ error: 'This task has already been claimed.' });
      return;
    }
    const updated = store.acceptVolunteerTask(taskId, responder);
    broadcastEvent('incidents-updated', { type: 'vtask-accepted', taskId });
    res.json({ task: updated });
  });

  app.post('/api/volunteer/vtasks/:taskId/decline', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const taskId = String(req.params.taskId);
    const { demoResponderId } = (req.body || {}) as { demoResponderId?: string };
    const responderId = demoResponderId || user.responderId || 'RES-02';
    const updated = store.declineVolunteerTask(taskId, responderId);
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    broadcastEvent('incidents-updated', { type: 'vtask-declined', taskId });
    res.json({ task: updated });
  });

  app.patch('/api/volunteer/vtasks/:taskId/status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const taskId = String(req.params.taskId);
    const { status, note, demoResponderId } = req.body as {
      status?: VolunteerTaskStatus;
      note?: string;
      demoResponderId?: string;
    };
    const responderId = demoResponderId || user.responderId || 'RES-02';
    const responder = store.getResponderById(responderId);
    const task = store.getVolunteerTaskById(taskId);
    if (!responder || !task) {
      res.status(404).json({ error: 'Volunteer or task not found.' });
      return;
    }
    const allowedStatuses: VolunteerTaskStatus[] = ['ACCEPTED', 'IN-PROGRESS', 'COMPLETED'];
    if (!status || !allowedStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid task status.' });
      return;
    }
    const updated = store.updateVolunteerTaskStatus(taskId, responder, status, note);
    broadcastEvent('incidents-updated', { type: 'vtask-updated', taskId, status });
    res.json({ task: updated });
  });

  app.post('/api/volunteer/tasks/:id/accept', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const id = String(req.params.id);
    const existing = store.getIncidentById(id);
    const responderId = user.responderId || 'RES-02';
    const responder = store.getResponderById(responderId);
    if (!existing || !responder) {
      res.status(404).json({ error: 'Incident or volunteer profile not found.' });
      return;
    }
    if (!responder.verified) {
      res.status(403).json({ error: 'Your volunteer profile must be verified by an administrator before accepting tasks.' });
      return;
    }
    if (existing.assignedResponderId && existing.assignedResponderId !== responder.id) {
      res.status(403).json({ error: 'This incident is already assigned to another responder.' });
      return;
    }
    if (!existing.assignedResponderId && !isResponderEligible(responder, existing)) {
      res.status(403).json({ error: 'Safety Restriction: This task requires specialist certification.' });
      return;
    }

    const now = new Date().toISOString();
    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        assignedResponderId: responder.id,
        assignedResponderName: responder.name,
        assignedAt: curr.assignedAt || now,
        acceptedAt: now,
        status: 'In Progress',
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: 'In Progress',
            timestamp: now,
            updatedBy: responder.name,
            note: `Volunteer ${responder.name} accepted task and started response`,
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-VACC`,
          adminIdentity: responder.name,
          incidentId: existing.incidentId,
          actionType: 'ASSIGNMENT_ACCEPTED',
          details: `Volunteer ${responder.name} accepted assignment`,
          timestamp: now,
        },
      ]
    );

    if (updated?.citizenId) {
      store.addNotification({
        id: `NOTIF-${Date.now().toString(36).toUpperCase()}-VRSP`,
        targetUserId: updated.citizenId,
        targetRole: 'Citizen',
        incidentId: updated.incidentId,
        type: 'RESPONSE_STARTED',
        title: 'Volunteer En Route',
        message: `${responder.name} accepted your report ${updated.incidentId} and is responding.`,
        read: false,
        timestamp: now,
      });
    }

    broadcastEvent('incidents-updated', { type: 'accepted', incidentId: id });
    res.json({ incident: updated });
  });

  app.post('/api/volunteer/tasks/:id/decline', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const id = String(req.params.id);
    const { reason } = req.body as { reason?: string };
    const existing = store.getIncidentById(id);
    const responderId = user.responderId || 'RES-02';
    const responder = store.getResponderById(responderId);
    if (!existing || !responder) {
      res.status(404).json({ error: 'Incident or volunteer profile not found.' });
      return;
    }

    const now = new Date().toISOString();
    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        assignedResponderId: null,
        assignedResponderName: null,
        assignedAt: null,
        acceptedAt: null,
        status: curr.status === 'In Progress' ? 'Pending' : curr.status,
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: curr.status === 'In Progress' ? 'Pending' : curr.status,
            timestamp: now,
            updatedBy: responder.name,
            note: `Assignment declined by ${responder.name}${reason ? `: ${reason}` : ''}`,
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-DEC`,
          adminIdentity: responder.name,
          incidentId: existing.incidentId,
          actionType: 'ASSIGNMENT_DECLINED',
          details: `${responder.name} declined assignment${reason ? ` (${reason})` : ''}`,
          timestamp: now,
        },
      ]
    );

    store.updateResponderAvailability(responder.id, true);
    store.addNotification({
      id: `NOTIF-${Date.now().toString(36).toUpperCase()}-DEC`,
      targetUserId: null,
      targetRole: 'Admin',
      incidentId: existing.incidentId,
      type: 'VOLUNTEER_ASSIGNED',
      title: `Reassignment Needed: ${existing.incidentId}`,
      message: `${responder.name} declined ${existing.incidentId}. Please assign another responder.`,
      read: false,
      timestamp: now,
    });

    broadcastEvent('incidents-updated', { type: 'declined', incidentId: id });
    res.json({ incident: updated });
  });

  app.patch('/api/volunteer/tasks/:id/progress', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const user = req.admin!;
    const id = String(req.params.id);
    const { status, note } = req.body as { status?: IncidentStatus; note?: string };
    const existing = store.getIncidentById(id);
    const responderId = user.responderId || 'RES-02';
    const responder = store.getResponderById(responderId);
    if (!existing || !responder) {
      res.status(404).json({ error: 'Incident or volunteer profile not found.' });
      return;
    }

    const nextStatus: IncidentStatus =
      status === 'Resolved' || status === 'In Progress' ? status : existing.status;
    const now = new Date().toISOString();

    const updated = store.updateIncident(
      id,
      (curr) => ({
        ...curr,
        status: nextStatus,
        resolvedAt: nextStatus === 'Resolved' ? now : curr.resolvedAt,
        updatedAt: now,
        statusHistory: [
          ...curr.statusHistory,
          {
            status: nextStatus,
            timestamp: now,
            updatedBy: responder.name,
            note: note?.trim() || `Progress updated to ${nextStatus} by ${responder.name}`,
          },
        ],
      }),
      [
        {
          id: `ACT-${Date.now().toString(36).toUpperCase()}-PRG`,
          adminIdentity: responder.name,
          incidentId: existing.incidentId,
          actionType: 'STATUS_UPDATED',
          details: `Volunteer updated status to ${nextStatus}${note ? ` — ${note}` : ''}`,
          timestamp: now,
        },
      ]
    );

    if (nextStatus === 'Resolved') {
      store.updateResponderAvailability(responder.id, true);
      store.incrementResponderTasks(responder.id, 'completedTasksCount');
      if (updated?.citizenId) {
        store.addNotification({
          id: `NOTIF-${Date.now().toString(36).toUpperCase()}-VRES`,
          targetUserId: updated.citizenId,
          targetRole: 'Citizen',
          incidentId: updated.incidentId,
          type: 'INCIDENT_RESOLVED',
          title: 'Incident Resolved',
          message: `Your emergency report ${updated.incidentId} has been resolved by ${responder.name}.`,
          read: false,
          timestamp: now,
        });
      }
    }

    broadcastEvent('incidents-updated', { type: 'updated', incidentId: id });
    res.json({ incident: updated });
  });

  // Vite or static serving
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeResponse server running on http://localhost:${PORT}`);
  });
}

startServer();
