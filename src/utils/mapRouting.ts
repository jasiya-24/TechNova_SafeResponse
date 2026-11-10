import type {
  IncidentRecord,
  ResponderProfile,
  ResponseTeam,
  VolunteerTask,
} from '../types/incident';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

export interface RecommendedTeamMatch {
  team: ResponseTeam;
  distanceKm: number | null;
  score: number;
  reason: string;
}

function getPreferredTeamType(
  category: IncidentRecord['category']
): ResponseTeam['teamType'] {
  switch (category) {
    case 'Fire':
      return 'Fire';
    case 'Medical Emergency':
      return 'Medical';
    case 'Building Collapse':
    case 'Flood':
    case 'Road Accident':
    default:
      return 'Rescue';
  }
}

export function recommendTeamsForIncident(
  incident: Pick<IncidentRecord, 'category' | 'latitude' | 'longitude'>,
  teams: ResponseTeam[]
): RecommendedTeamMatch[] {
  const preferredType = getPreferredTeamType(incident.category);

  return teams
    .map((team) => {
      const distanceKm =
        incident.latitude != null &&
        incident.longitude != null &&
        team.latitude != null &&
        team.longitude != null
          ? haversineDistanceKm(
              incident.latitude,
              incident.longitude,
              team.latitude,
              team.longitude
            )
          : null;

      let score = 0;
      const reasons: string[] = [];

      if (team.available || team.status === 'Available' || team.status === 'Standby') {
        score += 50;
        reasons.push('Available for dispatch');
      } else {
        reasons.push('Currently deployed');
      }

      if (team.teamType === preferredType) {
        score += 35;
        reasons.push(`Matches ${incident.category} (${preferredType} Team)`);
      }

      if (distanceKm !== null) {
        score += Math.max(0, 20 - Math.min(20, distanceKm * 2));
        reasons.push(`${distanceKm} km away`);
      }

      return {
        team,
        distanceKm,
        score,
        reason: reasons.join(' · '),
      };
    })
    .sort((a, b) => b.score - a.score);
}

const QUALIFICATION_RANK: Record<ResponderProfile['qualification'], number> = {
  'General Volunteer': 1,
  'Medical First Aid': 2,
  'Fire & Hazmat Specialist': 3,
  'Structural Rescue Specialist': 3,
};

export function isVolunteerEligibleForTask(
  volunteer: Pick<ResponderProfile, 'verified' | 'qualification' | 'skills'>,
  task: Pick<VolunteerTask, 'requiredQualification' | 'requiredSkills'>
): boolean {
  if (!volunteer.verified) return false;
  if (task.requiredQualification === 'General Volunteer') return true;
  if (volunteer.qualification === task.requiredQualification) return true;
  return QUALIFICATION_RANK[volunteer.qualification] >= QUALIFICATION_RANK[task.requiredQualification];
}
