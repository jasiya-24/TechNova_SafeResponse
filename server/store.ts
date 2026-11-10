import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ActivityLogEntry,
  CitizenProfile,
  EmergencyResource,
  IncidentRecord,
  MapFacility,
  NotificationRecord,
  ResponderProfile,
  ResponderQualification,
  ResponseTeam,
  UserRole,
  VolunteerTask,
  VolunteerTaskStatus,
} from '../src/types/incident';
import {
  createDemoActivityLogs,
  createDemoCitizens,
  createDemoFacilities,
  createDemoIncidents,
  createDemoNotifications,
  createDemoResources,
  createDemoResponders,
  createDemoResponseTeams,
  createDemoVolunteerTasks,
} from './seedData';

export interface StoredAdmin {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  responderId?: string;
  phone?: string;
  city?: string;
  passwordHash: string;
  salt: string;
}

export interface DatabaseSchema {
  incidents: IncidentRecord[];
  activityLogs: ActivityLogEntry[];
  admins: StoredAdmin[];
  citizens: CitizenProfile[];
  responders: ResponderProfile[];
  teams: ResponseTeam[];
  resources: EmergencyResource[];
  facilities: MapFacility[];
  volunteerTasks: VolunteerTask[];
  notifications: NotificationRecord[];
  sessionSecret: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'saferesponse.db.json');

export const PROTOTYPE_DEMO_PASSWORD = process.env.ADMIN_PASSWORD || 'SafeResponse@2026';

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = hashPassword(password, salt);
  const bufA = Buffer.from(actual, 'hex');
  const bufB = Buffer.from(expectedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createInitialAccounts(): StoredAdmin[] {
  const salt = crypto.randomBytes(16).toString('hex');
  const defaultEmail = process.env.ADMIN_EMAIL || 'coordinator@saferesponse.demo';

  return [
    {
      id: 'ADM-001',
      email: defaultEmail.toLowerCase(),
      name: 'R. Verma (Admin)',
      role: 'Admin',
      salt,
      passwordHash: hashPassword(PROTOTYPE_DEMO_PASSWORD, salt),
    },
    {
      id: 'VOL-001',
      email: 'volunteer@saferesponse.demo',
      name: 'Dr. M. Iyer (Medical First Aid)',
      role: 'Volunteer',
      responderId: 'RES-02',
      salt,
      passwordHash: hashPassword(PROTOTYPE_DEMO_PASSWORD, salt),
    },
    {
      id: 'CIT-001',
      email: 'citizen@saferesponse.demo',
      name: 'Aarav Kumar (Sample)',
      role: 'Citizen',
      phone: '+91-98400-11223',
      city: 'Chennai Central',
      salt,
      passwordHash: hashPassword(PROTOTYPE_DEMO_PASSWORD, salt),
    },
  ];
}

function createInitialDatabase(): DatabaseSchema {
  return {
    incidents: createDemoIncidents(),
    activityLogs: createDemoActivityLogs(),
    admins: createInitialAccounts(),
    citizens: createDemoCitizens(),
    responders: createDemoResponders(),
    teams: createDemoResponseTeams(),
    resources: createDemoResources(),
    facilities: createDemoFacilities(),
    volunteerTasks: createDemoVolunteerTasks(),
    notifications: createDemoNotifications(),
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  };
}

export class PersistentStore {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.incidents) && Array.isArray(parsed.admins)) {
          let dirty = false;

          parsed.incidents = parsed.incidents.map((inc) => {
            const rawCat = String(inc.category);
            const category =
              rawCat === 'Fire Emergency'
                ? 'Fire'
                : rawCat === 'Other Emergencies'
                  ? 'Other'
                  : inc.category;
            const rawPeople = inc.peopleAffected as unknown;
            let peopleAffected = inc.peopleAffected;
            if (typeof rawPeople === 'number') {
              peopleAffected =
                rawPeople <= 1
                  ? '1 Person'
                  : rawPeople <= 5
                    ? '2–5 People'
                    : rawPeople <= 10
                      ? '5–10 People'
                      : '10+ People';
            }
            return {
              ...inc,
              category,
              peopleAffected,
              originalDescription: inc.originalDescription ?? inc.description,
              originalSeverity: inc.originalSeverity ?? inc.severity,
              originalSeveritySource: inc.originalSeveritySource ?? inc.severitySource,
              originalSeverityExplanation: inc.originalSeverityExplanation ?? inc.severityExplanation,
            };
          });

          // Upgrade demo incidents if fewer than 12 demo incidents exist
          const demoIncCount = parsed.incidents.filter((i) => i.isDemo).length;
          if (demoIncCount < 12) {
            const realIncidents = parsed.incidents.filter((i) => !i.isDemo);
            const demoIncidents = createDemoIncidents();
            const existingIds = new Set(realIncidents.map((i) => i.incidentId));
            parsed.incidents = [
              ...realIncidents,
              ...demoIncidents.filter((d) => !existingIds.has(d.incidentId)),
            ];
            dirty = true;
          }

          if (!Array.isArray(parsed.citizens) || parsed.citizens.length < 10) {
            const realCitizens = Array.isArray(parsed.citizens)
              ? parsed.citizens.filter((c) => !c.isDemo)
              : [];
            const demoCitizens = createDemoCitizens();
            const existingIds = new Set(realCitizens.map((c) => c.citizenId));
            parsed.citizens = [
              ...realCitizens,
              ...demoCitizens.filter((d) => !existingIds.has(d.citizenId)),
            ];
            dirty = true;
          }

          if (!Array.isArray(parsed.responders) || parsed.responders.length < 10) {
            const realResponders = Array.isArray(parsed.responders)
              ? parsed.responders.filter((r) => !r.isDemo)
              : [];
            const demoResponders = createDemoResponders();
            const existingIds = new Set(realResponders.map((r) => r.id));
            parsed.responders = [
              ...realResponders,
              ...demoResponders.filter((d) => !existingIds.has(d.id)),
            ];
            dirty = true;
          } else {
            const defaults = createDemoResponders();
            parsed.responders = parsed.responders.map((r) => {
              const def = defaults.find((d) => d.id === r.id);
              return {
                ...r,
                status: r.status || (r.available ? 'Available' : 'Busy'),
                skills: r.skills ?? def?.skills ?? ['Emergency Support'],
                location: r.location ?? def?.location ?? 'Central District',
                assignedTasksCount: r.assignedTasksCount ?? def?.assignedTasksCount ?? 0,
                completedTasksCount: r.completedTasksCount ?? def?.completedTasksCount ?? 0,
                latitude: r.latitude ?? def?.latitude,
                longitude: r.longitude ?? def?.longitude,
              };
            });
          }

          if (!Array.isArray(parsed.teams) || parsed.teams.length < 7) {
            const realTeams = Array.isArray(parsed.teams)
              ? parsed.teams.filter((t) => !t.isDemo)
              : [];
            const demoTeams = createDemoResponseTeams();
            const existingIds = new Set(realTeams.map((t) => t.teamId));
            parsed.teams = [
              ...realTeams,
              ...demoTeams.filter((d) => !existingIds.has(d.teamId)),
            ];
            dirty = true;
          } else {
            const defTeams = createDemoResponseTeams();
            parsed.teams = parsed.teams.map((t) => {
              const def = defTeams.find((d) => d.teamId === t.teamId);
              if (!def) return t;
              return {
                ...t,
                teamType: t.teamType ?? def.teamType,
                latitude: t.latitude ?? def.latitude,
                longitude: t.longitude ?? def.longitude,
              };
            });
          }

          if (!Array.isArray(parsed.resources) || parsed.resources.length === 0) {
            parsed.resources = createDemoResources();
            dirty = true;
          }

          if (!Array.isArray(parsed.facilities) || parsed.facilities.length === 0) {
            parsed.facilities = createDemoFacilities();
            dirty = true;
          }

          if (!Array.isArray(parsed.volunteerTasks) || parsed.volunteerTasks.length === 0) {
            parsed.volunteerTasks = createDemoVolunteerTasks();
            dirty = true;
          }

          if (!Array.isArray(parsed.notifications) || parsed.notifications.length === 0) {
            parsed.notifications = createDemoNotifications();
            dirty = true;
          }

          // Ensure seeded Admin, Volunteer, and Citizen accounts exist with current prototype password
          const defaults = createInitialAccounts();
          for (const acc of defaults) {
            const existingIdx = parsed.admins.findIndex((a) => a.email === acc.email);
            if (existingIdx === -1) {
              parsed.admins.push(acc);
              dirty = true;
            } else if (!verifyPassword(PROTOTYPE_DEMO_PASSWORD, parsed.admins[existingIdx].salt, parsed.admins[existingIdx].passwordHash)) {
              parsed.admins[existingIdx] = {
                ...parsed.admins[existingIdx],
                salt: acc.salt,
                passwordHash: acc.passwordHash,
              };
              dirty = true;
            }
          }

          this.data = parsed;
          if (dirty) {
            this.save();
          }
          return;
        }
      } catch {
        // Fall through to reinitialize if corrupt
      }
    }

    this.data = createInitialDatabase();
    this.save();
  }

  private save(): void {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  getSessionSecret(): string {
    return this.data.sessionSecret;
  }

  findAdminByEmail(email: string): StoredAdmin | undefined {
    return this.data.admins.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  }

  findAdminById(id: string): StoredAdmin | undefined {
    return this.data.admins.find((a) => a.id === id);
  }

  getDemoAccount(role: UserRole = 'Admin'): StoredAdmin {
    return this.data.admins.find((a) => a.role === role) || this.data.admins[0];
  }

  addCitizenAccount(input: {
    name: string;
    email: string;
    password: string;
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
  }): StoredAdmin {
    const salt = crypto.randomBytes(16).toString('hex');
    const citizenId = `CIT-${Date.now().toString(36).toUpperCase()}`;
    const email = input.email.trim().toLowerCase();
    const account: StoredAdmin = {
      id: citizenId,
      email,
      name: input.name.trim(),
      role: 'Citizen',
      phone: input.phone?.trim() || undefined,
      city: input.district?.trim() || input.city?.trim() || undefined,
      salt,
      passwordHash: hashPassword(input.password, salt),
    };
    this.data.admins.push(account);

    const now = new Date().toISOString();
    const profile: CitizenProfile = {
      citizenId,
      fullName: input.name.trim(),
      email,
      age: input.age && input.age > 0 ? input.age : 30,
      mobileNumber: input.phone?.trim() || '',
      district: input.district?.trim() || input.city?.trim() || 'Central District',
      locality: input.locality?.trim() || input.city?.trim() || '',
      address: input.address?.trim() || '',
      emergencyContact: {
        name: input.emergencyContactName?.trim() || '',
        relation: input.emergencyContactRelation?.trim() || 'Family',
        phone: input.emergencyContactPhone?.trim() || '',
      },
      medicalInfo: {
        bloodGroup: input.bloodGroup?.trim() || 'Unknown',
        allergies: input.allergies?.trim() || 'None',
        conditions: input.conditions?.trim() || 'None',
      },
      specialAssistance: input.specialAssistance?.trim() || 'None',
      verified: false,
      createdAt: now,
      updatedAt: now,
      isDemo: false,
    };
    this.data.citizens.unshift(profile);
    this.save();
    return account;
  }

  addVolunteerAccount(input: {
    name: string;
    email: string;
    password: string;
    qualification: ResponderQualification;
    skills?: string[];
    location?: string;
  }): { account: StoredAdmin; responder: ResponderProfile } {
    const salt = crypto.randomBytes(16).toString('hex');
    const responderId = `RES-${Date.now().toString(36).toUpperCase()}`;
    const accountId = `VOL-${Date.now().toString(36).toUpperCase()}`;
    const email = input.email.trim().toLowerCase();

    const responder: ResponderProfile = {
      id: responderId,
      name: input.name.trim(),
      email,
      qualification: input.qualification,
      skills: input.skills?.length ? input.skills : [input.qualification],
      location: input.location?.trim() || 'Central District',
      verified: false,
      available: true,
      status: 'Available',
      assignedTasksCount: 0,
      completedTasksCount: 0,
      isDemo: false,
    };

    const account: StoredAdmin = {
      id: accountId,
      email,
      name: input.name.trim(),
      role: 'Volunteer',
      responderId,
      city: input.location?.trim() || undefined,
      salt,
      passwordHash: hashPassword(input.password, salt),
    };

    this.data.responders.unshift(responder);
    this.data.admins.push(account);
    this.save();
    return { account, responder };
  }

  updateAccountProfile(id: string, updates: { name?: string; phone?: string; city?: string }): StoredAdmin | null {
    const acc = this.data.admins.find((a) => a.id === id);
    if (!acc) return null;
    if (updates.name && updates.name.trim().length >= 2) {
      acc.name = updates.name.trim();
    }
    if (updates.phone !== undefined) {
      acc.phone = updates.phone.trim();
    }
    if (updates.city !== undefined) {
      acc.city = updates.city.trim();
    }
    this.save();
    return acc;
  }

  // Citizen Profiles
  getCitizens(): CitizenProfile[] {
    return [...this.data.citizens];
  }

  getCitizenById(citizenId: string): CitizenProfile | undefined {
    return this.data.citizens.find((c) => c.citizenId === citizenId);
  }

  upsertCitizenProfile(
    citizenId: string,
    email: string,
    updates: Partial<CitizenProfile>
  ): CitizenProfile {
    const now = new Date().toISOString();
    const idx = this.data.citizens.findIndex((c) => c.citizenId === citizenId);
    if (idx === -1) {
      const created: CitizenProfile = {
        citizenId,
        fullName: updates.fullName || 'Citizen User',
        email,
        age: updates.age ?? 30,
        mobileNumber: updates.mobileNumber ?? '',
        district: updates.district ?? '',
        locality: updates.locality ?? '',
        address: updates.address ?? '',
        emergencyContact: updates.emergencyContact ?? { name: '', relation: 'Family', phone: '' },
        medicalInfo: updates.medicalInfo ?? { bloodGroup: 'Unknown', allergies: 'None', conditions: 'None' },
        specialAssistance: updates.specialAssistance ?? 'None',
        verified: false,
        createdAt: now,
        updatedAt: now,
        isDemo: false,
      };
      this.data.citizens.unshift(created);
      this.save();
      return created;
    }

    const current = this.data.citizens[idx];
    const updated: CitizenProfile = {
      ...current,
      fullName: updates.fullName?.trim() || current.fullName,
      age: typeof updates.age === 'number' && updates.age > 0 ? updates.age : current.age,
      mobileNumber: updates.mobileNumber !== undefined ? updates.mobileNumber.trim() : current.mobileNumber,
      district: updates.district !== undefined ? updates.district.trim() : current.district,
      locality: updates.locality !== undefined ? updates.locality.trim() : current.locality,
      address: updates.address !== undefined ? updates.address.trim() : current.address,
      emergencyContact: updates.emergencyContact
        ? {
            name: updates.emergencyContact.name?.trim() ?? current.emergencyContact.name,
            relation: updates.emergencyContact.relation?.trim() ?? current.emergencyContact.relation,
            phone: updates.emergencyContact.phone?.trim() ?? current.emergencyContact.phone,
          }
        : current.emergencyContact,
      medicalInfo: updates.medicalInfo
        ? {
            bloodGroup: updates.medicalInfo.bloodGroup?.trim() ?? current.medicalInfo.bloodGroup,
            allergies: updates.medicalInfo.allergies?.trim() ?? current.medicalInfo.allergies,
            conditions: updates.medicalInfo.conditions?.trim() ?? current.medicalInfo.conditions,
            medications: updates.medicalInfo.medications?.trim() ?? current.medicalInfo.medications,
          }
        : current.medicalInfo,
      specialAssistance:
        updates.specialAssistance !== undefined ? updates.specialAssistance.trim() : current.specialAssistance,
      updatedAt: now,
    };
    this.data.citizens[idx] = updated;

    // Sync basic fields on StoredAdmin
    const acc = this.data.admins.find((a) => a.id === citizenId);
    if (acc) {
      acc.name = updated.fullName;
      acc.phone = updated.mobileNumber;
      acc.city = updated.district || updated.locality;
    }

    this.save();
    return updated;
  }

  verifyCitizen(citizenId: string, verified: boolean, adminIdentity: string): CitizenProfile | null {
    const idx = this.data.citizens.findIndex((c) => c.citizenId === citizenId);
    if (idx === -1) return null;
    this.data.citizens[idx] = {
      ...this.data.citizens[idx],
      verified,
      updatedAt: new Date().toISOString(),
    };
    this.data.activityLogs.unshift({
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      adminIdentity,
      incidentId: citizenId,
      actionType: 'CITIZEN_VERIFIED',
      details: `${verified ? 'Verified' : 'Unverified'} citizen profile ${citizenId} (${this.data.citizens[idx].fullName})`,
      timestamp: new Date().toISOString(),
    });
    this.save();
    return this.data.citizens[idx];
  }

  // Incidents
  getAllIncidents(): IncidentRecord[] {
    return [...this.data.incidents].sort(
      (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );
  }

  getIncidentById(incidentId: string): IncidentRecord | undefined {
    return this.data.incidents.find(
      (inc) => inc.incidentId.toUpperCase() === incidentId.trim().toUpperCase()
    );
  }

  findByClientSubmissionId(clientSubmissionId: string): IncidentRecord | undefined {
    return this.data.incidents.find(
      (inc) => inc.clientSubmissionId && inc.clientSubmissionId === clientSubmissionId
    );
  }

  addIncident(incident: IncidentRecord, logEntry?: ActivityLogEntry): void {
    this.data.incidents.unshift(incident);
    if (logEntry) {
      this.data.activityLogs.unshift(logEntry);
    }
    this.save();
  }

  updateIncident(
    incidentId: string,
    updater: (current: IncidentRecord) => IncidentRecord,
    logEntries: ActivityLogEntry[]
  ): IncidentRecord | null {
    const idx = this.data.incidents.findIndex(
      (inc) => inc.incidentId.toUpperCase() === incidentId.trim().toUpperCase()
    );
    if (idx === -1) return null;
    const updated = updater(this.data.incidents[idx]);
    this.data.incidents[idx] = updated;
    for (const entry of logEntries) {
      this.data.activityLogs.unshift(entry);
    }
    this.save();
    return updated;
  }

  deleteIncident(incidentId: string, logEntry: ActivityLogEntry): boolean {
    const idx = this.data.incidents.findIndex(
      (inc) => inc.incidentId.toUpperCase() === incidentId.trim().toUpperCase()
    );
    if (idx === -1) return false;
    this.data.incidents.splice(idx, 1);
    this.data.activityLogs.unshift(logEntry);
    this.save();
    return true;
  }

  // Responders / Volunteers
  getResponders(): ResponderProfile[] {
    return [...this.data.responders];
  }

  getResponderById(id: string): ResponderProfile | undefined {
    return this.data.responders.find((r) => r.id === id);
  }

  updateResponderAvailability(id: string, available: boolean): ResponderProfile | null {
    const idx = this.data.responders.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.responders[idx] = {
      ...this.data.responders[idx],
      available,
      status: available ? 'Available' : 'Busy',
    };
    this.save();
    return this.data.responders[idx];
  }

  verifyVolunteer(id: string, verified: boolean, adminIdentity: string): ResponderProfile | null {
    const idx = this.data.responders.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.responders[idx] = {
      ...this.data.responders[idx],
      verified,
    };
    this.data.activityLogs.unshift({
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      adminIdentity,
      incidentId: id,
      actionType: 'VOLUNTEER_VERIFIED',
      details: `${verified ? 'Verified' : 'Revoked verification for'} volunteer ${this.data.responders[idx].name}`,
      timestamp: new Date().toISOString(),
    });
    this.save();
    return this.data.responders[idx];
  }

  incrementResponderTasks(id: string, field: 'assignedTasksCount' | 'completedTasksCount'): void {
    const idx = this.data.responders.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const current = this.data.responders[idx][field] ?? 0;
    this.data.responders[idx] = {
      ...this.data.responders[idx],
      [field]: current + 1,
    };
    this.save();
  }

  // Response Teams
  getTeams(): ResponseTeam[] {
    return [...this.data.teams];
  }

  getTeamById(teamId: string): ResponseTeam | undefined {
    return this.data.teams.find((t) => t.teamId === teamId);
  }

  assignTeamToIncident(teamId: string, incidentId: string): ResponseTeam | null {
    const idx = this.data.teams.findIndex((t) => t.teamId === teamId);
    if (idx === -1) return null;

    // Release any previously assigned team for this incident if reassigned
    this.data.teams = this.data.teams.map((t) => {
      if (t.teamId !== teamId && t.assignedIncidents.includes(incidentId)) {
        const remaining = t.assignedIncidents.filter((id) => id !== incidentId);
        return {
          ...t,
          assignedIncidents: remaining,
          available: remaining.length === 0 ? true : t.available,
          status: remaining.length === 0 ? 'Available' : t.status,
        };
      }
      return t;
    });

    const team = this.data.teams[idx];
    const assigned = new Set(team.assignedIncidents);
    assigned.add(incidentId);
    this.data.teams[idx] = {
      ...team,
      assignedIncidents: Array.from(assigned),
      status: 'Deployed',
      available: false,
    };
    this.save();
    return this.data.teams[idx];
  }

  updateTeamAvailability(teamId: string, available: boolean): ResponseTeam | null {
    const idx = this.data.teams.findIndex((t) => t.teamId === teamId);
    if (idx === -1) return null;
    this.data.teams[idx] = {
      ...this.data.teams[idx],
      available,
      status: available ? 'Available' : 'Deployed',
    };
    this.save();
    return this.data.teams[idx];
  }

  // Map Facilities
  getFacilities(): MapFacility[] {
    return [...this.data.facilities];
  }

  // Volunteer Tasks
  getVolunteerTasks(): VolunteerTask[] {
    return [...this.data.volunteerTasks];
  }

  getVolunteerTaskById(taskId: string): VolunteerTask | undefined {
    return this.data.volunteerTasks.find((t) => t.taskId === taskId);
  }

  acceptVolunteerTask(taskId: string, volunteer: ResponderProfile): VolunteerTask | null {
    const idx = this.data.volunteerTasks.findIndex((t) => t.taskId === taskId);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    this.data.volunteerTasks[idx] = {
      ...this.data.volunteerTasks[idx],
      status: 'ACCEPTED',
      assignedVolunteerId: volunteer.id,
      assignedVolunteerName: volunteer.name,
      acceptedAt: now,
      progressNote: `Accepted by ${volunteer.name}`,
    };
    this.incrementResponderTasks(volunteer.id, 'assignedTasksCount');
    this.save();
    return this.data.volunteerTasks[idx];
  }

  declineVolunteerTask(taskId: string, volunteerId: string): VolunteerTask | null {
    const idx = this.data.volunteerTasks.findIndex((t) => t.taskId === taskId);
    if (idx === -1) return null;
    const current = this.data.volunteerTasks[idx];
    const declined = new Set(current.declinedByIds || []);
    declined.add(volunteerId);
    const wasAssignedToMe = current.assignedVolunteerId === volunteerId;
    this.data.volunteerTasks[idx] = {
      ...current,
      declinedByIds: Array.from(declined),
      status: wasAssignedToMe ? 'NEW' : current.status,
      assignedVolunteerId: wasAssignedToMe ? null : current.assignedVolunteerId,
      assignedVolunteerName: wasAssignedToMe ? null : current.assignedVolunteerName,
    };
    this.save();
    return this.data.volunteerTasks[idx];
  }

  updateVolunteerTaskStatus(
    taskId: string,
    volunteer: ResponderProfile,
    status: VolunteerTaskStatus,
    note?: string
  ): VolunteerTask | null {
    const idx = this.data.volunteerTasks.findIndex((t) => t.taskId === taskId);
    if (idx === -1) return null;
    const current = this.data.volunteerTasks[idx];
    const now = new Date().toISOString();
    const wasCompleted = current.status === 'COMPLETED';
    this.data.volunteerTasks[idx] = {
      ...current,
      status,
      assignedVolunteerId: current.assignedVolunteerId || volunteer.id,
      assignedVolunteerName: current.assignedVolunteerName || volunteer.name,
      acceptedAt: current.acceptedAt || now,
      completedAt: status === 'COMPLETED' ? now : current.completedAt,
      progressNote: note?.trim() || current.progressNote || `Status updated to ${status}`,
    };
    if (status === 'COMPLETED' && !wasCompleted) {
      this.incrementResponderTasks(volunteer.id, 'completedTasksCount');
    }
    this.save();
    return this.data.volunteerTasks[idx];
  }

  // Resources
  getResources(): EmergencyResource[] {
    return [...this.data.resources];
  }

  updateResource(
    id: string,
    updater: (r: EmergencyResource) => EmergencyResource,
    logEntry?: ActivityLogEntry
  ): EmergencyResource | null {
    const idx = this.data.resources.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const updated = updater(this.data.resources[idx]);
    this.data.resources[idx] = updated;
    if (logEntry) {
      this.data.activityLogs.unshift(logEntry);
    }
    this.save();
    return updated;
  }

  // Notifications
  getNotificationsForUser(userId: string, role: UserRole, responderId?: string): NotificationRecord[] {
    return this.data.notifications
      .filter((n) => {
        if (role === 'Admin') {
          return n.targetRole === 'Admin' || n.targetRole === 'All';
        }
        if (role === 'Citizen') {
          return n.targetRole === 'Citizen' && n.targetUserId === userId;
        }
        if (role === 'Volunteer') {
          return (
            n.targetRole === 'Volunteer' &&
            (n.targetUserId === responderId || n.targetUserId === userId)
          );
        }
        return false;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  addNotification(notification: NotificationRecord): void {
    this.data.notifications.unshift(notification);
    if (this.data.notifications.length > 200) {
      this.data.notifications = this.data.notifications.slice(0, 200);
    }
    this.save();
  }

  markNotificationRead(id: string, userId: string, role: UserRole, responderId?: string): boolean {
    const idx = this.data.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    const n = this.data.notifications[idx];
    const allowed =
      role === 'Admin' ||
      (role === 'Citizen' && n.targetUserId === userId) ||
      (role === 'Volunteer' && (n.targetUserId === responderId || n.targetUserId === userId));
    if (!allowed) return false;
    this.data.notifications[idx] = { ...n, read: true };
    this.save();
    return true;
  }

  resetDemoData(adminIdentity: string): void {
    const realIncidents = this.data.incidents.filter((inc) => !inc.isDemo);
    const demoIncidents = createDemoIncidents();
    this.data.incidents = [...realIncidents, ...demoIncidents];

    const realResources = this.data.resources.filter((r) => !r.isDemo);
    this.data.resources = [...realResources, ...createDemoResources()];

    const realCitizens = this.data.citizens.filter((c) => !c.isDemo);
    this.data.citizens = [...realCitizens, ...createDemoCitizens()];

    const realTeams = this.data.teams.filter((t) => !t.isDemo);
    this.data.teams = [...realTeams, ...createDemoResponseTeams()];

    const realFacilities = this.data.facilities.filter((f) => !f.isDemo);
    this.data.facilities = [...realFacilities, ...createDemoFacilities()];

    const realVolunteerTasks = this.data.volunteerTasks.filter((vt) => !vt.isDemo);
    this.data.volunteerTasks = [...realVolunteerTasks, ...createDemoVolunteerTasks()];

    const logEntry: ActivityLogEntry = {
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      adminIdentity,
      incidentId: 'SYSTEM',
      actionType: 'DEMO_DATA_RESET',
      details: `Reset demo records (${demoIncidents.length} demo incidents restored; ${realIncidents.length} submitted reports preserved)`,
      timestamp: new Date().toISOString(),
    };
    this.data.activityLogs.unshift(logEntry);
    this.save();
  }

  getActivityLogs(): ActivityLogEntry[] {
    return [...this.data.activityLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  generateUniqueIncidentId(): string {
    const year = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomInt(1000, 9999);
      const candidate = `SR-${year}-${code}`;
      if (!this.getIncidentById(candidate)) {
        return candidate;
      }
    }
    return `SR-${year}-${Date.now().toString().slice(-5)}`;
  }
}
