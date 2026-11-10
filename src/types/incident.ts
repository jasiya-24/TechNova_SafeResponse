export type EmergencyCategory =
  | 'Fire'
  | 'Road Accident'
  | 'Medical Emergency'
  | 'Flood'
  | 'Building Collapse'
  | 'Other';

export const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  'Fire',
  'Road Accident',
  'Medical Emergency',
  'Flood',
  'Building Collapse',
  'Other',
];

export type PeopleAffectedOption =
  | '1 Person'
  | '2–5 People'
  | '5–10 People'
  | '10+ People'
  | 'Unknown';

export const PEOPLE_AFFECTED_OPTIONS: PeopleAffectedOption[] = [
  '1 Person',
  '2–5 People',
  '5–10 People',
  '10+ People',
  'Unknown',
];

export type SeverityLevel =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical'
  | 'Risk Assessment Pending';

export const SEVERITY_LEVELS: SeverityLevel[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
  'Risk Assessment Pending',
];

export type IncidentStatus = 'Reported' | 'Pending' | 'In Progress' | 'Resolved';

export const INCIDENT_STATUSES: IncidentStatus[] = [
  'Reported',
  'Pending',
  'In Progress',
  'Resolved',
];

export type SeveritySource = 'AI-Assisted' | 'Rule-Based' | 'Manual Override';

export type UserRole = 'Admin' | 'Client' | 'Volunteer' | 'Citizen';

export type ResponderQualification =
  | 'General Volunteer'
  | 'Medical First Aid'
  | 'Fire & Hazmat Specialist'
  | 'Structural Rescue Specialist';

export interface ResponderProfile {
  id: string;
  name: string;
  email?: string;
  qualification: ResponderQualification;
  skills?: string[];
  location?: string;
  verified: boolean;
  available: boolean;
  status?: 'Available' | 'Busy';
  assignedTasksCount?: number;
  completedTasksCount?: number;
  latitude?: number;
  longitude?: number;
  isDemo?: boolean;
}

export interface CitizenProfile {
  citizenId: string;
  fullName: string;
  email: string;
  age: number;
  mobileNumber: string;
  district: string;
  locality: string;
  address?: string;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  medicalInfo: {
    bloodGroup: string;
    allergies: string;
    conditions: string;
    medications?: string;
  };
  specialAssistance: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export interface ResponseTeam {
  teamId: string;
  teamName: string;
  teamType?: 'Fire' | 'Medical' | 'Rescue';
  specialization: string;
  leadName: string;
  assignedIncidents: string[];
  available: boolean;
  status: 'Available' | 'Deployed' | 'Standby';
  memberCount: number;
  district: string;
  latitude?: number;
  longitude?: number;
  isDemo?: boolean;
}

export type MapFacilityCategory =
  | 'Doctor'
  | 'Hospital'
  | 'Clinic'
  | 'Relief Centre'
  | 'Emergency Shelter'
  | 'College';

export interface MapFacility {
  id: string;
  name: string;
  category: MapFacilityCategory;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  capacity?: string;
  contact?: string;
  available: boolean;
  isDemo?: boolean;
}

export type VolunteerTaskStatus = 'NEW' | 'ACCEPTED' | 'IN-PROGRESS' | 'COMPLETED';

export type VolunteerTaskType =
  | 'Relief Material Distribution'
  | 'Food and Water Support'
  | 'Emergency Information Support'
  | 'Shelter Assistance'
  | 'Community Assistance'
  | 'Safe Evacuation Support Coordination';

export interface VolunteerTask {
  taskId: string;
  title: string;
  taskType: VolunteerTaskType;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  requiredQualification: ResponderQualification;
  requiredSkills: string[];
  status: VolunteerTaskStatus;
  assignedVolunteerId?: string | null;
  assignedVolunteerName?: string | null;
  declinedByIds?: string[];
  incidentId?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
  progressNote?: string;
  isDemo?: boolean;
}

export interface RouteResult {
  mode: 'road-route' | 'straight-line';
  distanceKm: number;
  durationMin: number | null;
  coordinates: Array<[number, number]>;
  label: string;
}

export type NotificationType =
  | 'NEW_SOS'
  | 'INCIDENT_VERIFIED'
  | 'TEAM_ASSIGNED'
  | 'RESPONSE_STARTED'
  | 'INCIDENT_RESOLVED'
  | 'VOLUNTEER_ASSIGNED';

export interface NotificationRecord {
  id: string;
  targetUserId?: string | null;
  targetRole: UserRole | 'All';
  incidentId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  isDemo?: boolean;
}

export interface IncidentMessage {
  id: string;
  senderName: string;
  senderRole: UserRole | 'Citizen';
  body: string;
  shareWithCitizen: boolean;
  timestamp: string;
}

export type ResourceCategory =
  | 'Response Vehicle'
  | 'Medical Supply'
  | 'Rescue Equipment'
  | 'Relief Material';

export type ResourceStatus = 'Available' | 'Allocated' | 'Unavailable';

export interface EmergencyResource {
  id: string;
  name: string;
  category: ResourceCategory;
  quantity: number;
  unit: string;
  status: ResourceStatus;
  allocatedIncidentId?: string | null;
  allocatedTeam?: string | null;
  allocatedAt?: string | null;
  returnedAt?: string | null;
  isDemo?: boolean;
}

export interface StatusHistoryEntry {
  status: IncidentStatus;
  severity?: SeverityLevel;
  timestamp: string;
  updatedBy: string;
  note?: string;
}

export interface IncidentRecord {
  incidentId: string;
  clientSubmissionId?: string;
  isSos?: boolean;
  citizenId?: string | null;
  citizenName?: string | null;
  citizenMedicalSnapshot?: {
    bloodGroup?: string;
    allergies?: string;
    conditions?: string;
    specialAssistance?: string;
    emergencyContact?: string;
  } | null;
  title: string;
  description: string;
  originalDescription?: string;
  voiceLanguage?: string;
  category: EmergencyCategory;
  location: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy?: number | null;
  locationTimestamp?: string | null;
  peopleAffected: PeopleAffectedOption;
  contactInformation: string;
  severity: SeverityLevel;
  severitySource: SeveritySource;
  severityExplanation: string;
  originalSeverity: SeverityLevel;
  originalSeveritySource: SeveritySource;
  originalSeverityExplanation: string;
  status: IncidentStatus;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
  assignedResponderId?: string | null;
  assignedResponderName?: string | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  escalatedAt?: string | null;
  escalationThresholdMinutes?: number;
  linkedDuplicateIds?: string[];
  duplicateOf?: string | null;
  messages?: IncidentMessage[];
  reportedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  statusHistory: StatusHistoryEntry[];
  createdBy: string;
  isDemo?: boolean;
}

export interface PublicIncidentTrack {
  incidentId: string;
  isSos?: boolean;
  title: string;
  category: EmergencyCategory;
  location: string;
  severity: SeverityLevel;
  severityExplanation: string;
  status: IncidentStatus;
  acknowledgedAt?: string | null;
  verifiedAt?: string | null;
  assignedTeamName?: string | null;
  assignedResponderName?: string | null;
  reportedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  statusHistory: Array<{
    status: IncidentStatus;
    timestamp: string;
    note?: string;
  }>;
  publicMessages?: Array<{
    id: string;
    senderRole: string;
    body: string;
    timestamp: string;
  }>;
  isDemo?: boolean;
}

export type ActivityActionType =
  | 'INCIDENT_CREATED'
  | 'SOS_CREATED'
  | 'SEVERITY_UPDATED'
  | 'STATUS_UPDATED'
  | 'INCIDENT_EDITED'
  | 'INCIDENT_DELETED'
  | 'INCIDENT_ACKNOWLEDGED'
  | 'INCIDENT_VERIFIED'
  | 'TEAM_ASSIGNED'
  | 'CITIZEN_VERIFIED'
  | 'VOLUNTEER_VERIFIED'
  | 'DUPLICATE_LINKED'
  | 'RESPONDER_ASSIGNED'
  | 'ASSIGNMENT_ACCEPTED'
  | 'ASSIGNMENT_DECLINED'
  | 'ASSIGNMENT_ESCALATED'
  | 'RESOURCE_ALLOCATED'
  | 'RESOURCE_RETURNED'
  | 'MESSAGE_SENT'
  | 'DEMO_DATA_RESET';

export interface ActivityLogEntry {
  id: string;
  adminIdentity: string;
  incidentId: string;
  actionType: ActivityActionType;
  details: string;
  timestamp: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  responderId?: string;
  phone?: string;
  city?: string;
}
