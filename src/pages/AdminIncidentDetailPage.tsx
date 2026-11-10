import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  MapPin,
  Loader2,
  GitMerge,
  UserCheck,
  ShieldAlert,
  MessageSquare,
  Send,
  Clock,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import {
  isIncidentSpecialistRequired,
  isResponderEligible,
  isAssignmentEscalated,
  type DuplicateCandidate,
} from '../utils/duplicateDetection';
import {
  INCIDENT_STATUSES,
  PEOPLE_AFFECTED_OPTIONS,
  SEVERITY_LEVELS,
  type IncidentRecord,
  type IncidentStatus,
  type PeopleAffectedOption,
  type ResponderProfile,
  type ResponseTeam,
  type SeverityLevel,
} from '../types/incident';

export function AdminIncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action states
  const [severity, setSeverity] = useState<SeverityLevel>('Low');
  const [status, setStatus] = useState<IncidentStatus>('Reported');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [peopleAffected, setPeopleAffected] = useState<PeopleAffectedOption>('1 Person');

  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Advanced features state: Duplicates, Responders, Teams, Communication Center
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [responders, setResponders] = useState<ResponderProfile[]>([]);
  const [teams, setTeams] = useState<ResponseTeam[]>([]);
  const [selectedResponderId, setSelectedResponderId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [shareWithCitizen, setShareWithCitizen] = useState(true);
  const [msgBusy, setMsgBusy] = useState(false);

  const loadIncident = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, dupRes, respRes, teamRes] = await Promise.all([
        fetch(`/api/admin/incidents/${encodeURIComponent(id)}`, { credentials: 'include' }),
        fetch(`/api/admin/incidents/${encodeURIComponent(id)}/duplicates`, {
          credentials: 'include',
        }),
        fetch('/api/admin/responders', { credentials: 'include' }),
        fetch('/api/admin/teams', { credentials: 'include' }),
      ]);
      const data = (await res.json()) as { incident?: IncidentRecord; error?: string };
      if (!res.ok || !data.incident) {
        setError(data.error || 'Incident not found.');
        return;
      }
      setIncident(data.incident);
      setSeverity(data.incident.severity);
      setStatus(data.incident.status);
      setTitle(data.incident.title);
      setDescription(data.incident.description);
      setLocation(data.incident.location);
      setPeopleAffected(data.incident.peopleAffected);
      setSelectedResponderId(data.incident.assignedResponderId || '');
      setSelectedTeamId(data.incident.assignedTeamId || '');
      if (dupRes.ok) {
        const dupData = (await dupRes.json()) as { duplicates: DuplicateCandidate[] };
        setDuplicates(dupData.duplicates || []);
      }
      if (respRes.ok) {
        const respData = (await respRes.json()) as { responders: ResponderProfile[] };
        setResponders(respData.responders || []);
      }
      if (teamRes.ok) {
        const teamData = (await teamRes.json()) as { teams: ResponseTeam[] };
        setTeams(teamData.teams || []);
      }
      setError('');
    } catch {
      setError('Failed to load incident details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  const handleLinkDuplicate = async (duplicateIncidentId: string) => {
    if (!incident) return;
    const res = await fetch(
      `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/link-duplicate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ duplicateIncidentId }),
      }
    );
    if (res.ok) {
      setSaveMessage(`Linked ${duplicateIncidentId} as a duplicate while preserving both records.`);
      await loadIncident();
    }
  };

  const handleAssignResponder = async () => {
    if (!incident || !selectedResponderId) return;
    setAssignBusy(true);
    setAssignError('');
    try {
      const res = await fetch(
        `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ responderId: selectedResponderId }),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAssignError(data.error || 'Unable to assign responder.');
        return;
      }
      setSaveMessage('Responder assigned and audit log updated.');
      await loadIncident();
    } finally {
      setAssignBusy(false);
    }
  };

  const handleVerifyIncident = async () => {
    if (!incident) return;
    setVerifying(true);
    try {
      const res = await fetch(
        `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/verify`,
        { method: 'POST', credentials: 'include' }
      );
      if (res.ok) {
        setSaveMessage('Incident verified and citizen notified.');
        await loadIncident();
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleAssignTeam = async () => {
    if (!incident || !selectedTeamId) return;
    setTeamBusy(true);
    try {
      const res = await fetch(
        `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/assign-team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ teamId: selectedTeamId }),
        }
      );
      if (res.ok) {
        setSaveMessage('Response team assigned and citizen notified.');
        await loadIncident();
      }
    } finally {
      setTeamBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incident || !msgBody.trim()) return;
    setMsgBusy(true);
    try {
      const res = await fetch(
        `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body: msgBody.trim(), shareWithCitizen }),
        }
      );
      if (res.ok) {
        setMsgBody('');
        setSaveMessage(
          shareWithCitizen
            ? 'Message logged and shared on public tracking.'
            : 'Internal coordinator message logged.'
        );
        await loadIncident();
      }
    } finally {
      setMsgBusy(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!incident || acknowledging) return;
    setAcknowledging(true);
    try {
      const res = await fetch(
        `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/acknowledge`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const data = (await res.json()) as { incident?: IncidentRecord };
      if (res.ok && data.incident) {
        setIncident(data.incident);
        setStatus(data.incident.status);
        setSaveMessage('Emergency acknowledged and prioritized.');
      }
    } finally {
      setAcknowledging(false);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incident || saving) return;

    setSaving(true);
    setSaveMessage('');
    setError('');
    try {
      const res = await fetch(`/api/admin/incidents/${encodeURIComponent(incident.incidentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          severity,
          status,
          note: note.trim() || undefined,
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          peopleAffected,
        }),
      });
      const data = (await res.json()) as { incident?: IncidentRecord; error?: string };
      if (!res.ok || !data.incident) {
        setError(data.error || 'Failed to update incident.');
        return;
      }
      setIncident(data.incident);
      setNote('');
      setSaveMessage('Incident updates saved and recorded in history.');
    } catch {
      setError('Network error while saving updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!incident) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/incidents/${encodeURIComponent(incident.incidentId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        navigate('/admin/incidents');
      } else {
        setError('Could not delete incident.');
        setShowDeleteModal(false);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout title={incident ? `Incident ${incident.incidentId}` : 'Incident Details'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/admin/incidents"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#426B80] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Incident Management</span>
          </Link>

          {incident && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#EF4444]/40 text-xs font-semibold text-[#B91C1C] hover:bg-[#EF4444]/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete Report</span>
            </button>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-8 text-center text-sm text-[#71818A]">
            Loading incident details...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {saveMessage && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#E5EEE9] border border-[#22C55E]/35 text-sm text-[#15803D]">
            <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Emergency Mode Banner for Critical Incidents */}
        {incident && incident.severity === 'Critical' && (
          <div className="bg-white rounded-xl border-2 border-[#EF4444] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#EF4444] text-white text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>CRITICAL INCIDENT · EMERGENCY MODE</span>
              </div>
              <p className="text-sm font-semibold text-[#263640]">
                {incident.acknowledgedAt
                  ? `Acknowledged by ${incident.acknowledgedBy} on ${formatDateTime(incident.acknowledgedAt)}`
                  : 'Awaiting coordinator acknowledgment and prioritization.'}
              </p>
            </div>
            {!incident.acknowledgedAt && (
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="px-4 py-2.5 rounded-lg bg-[#EF4444] text-white text-xs font-semibold hover:bg-[#DC2626] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                {acknowledging ? 'Acknowledging...' : 'Acknowledge & Prioritize'}
              </button>
            )}
          </div>
        )}

        {incident && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Full Info, Audit & History */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#D9E2E6]">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#71818A]">
                      <span className="font-mono font-semibold text-[#426B80] tabular-nums">
                        {incident.incidentId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{incident.category}</span>
                      {incident.isDemo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>DEMO DATA</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-[#263640] mt-1">{incident.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#71818A]">Incident Description</h3>
                  <p className="text-sm text-[#263640] leading-relaxed whitespace-pre-wrap">
                    {incident.description}
                  </p>
                  {incident.originalDescription &&
                    incident.originalDescription !== incident.description && (
                      <div className="bg-[#F3F7F8] rounded-lg p-3 text-xs text-[#71818A] mt-2">
                        <strong className="text-[#263640]">Original Submitted Description: </strong>
                        {incident.originalDescription}
                      </div>
                    )}
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2 border-t border-[#F3F7F8]">
                  <div>
                    <dt className="text-xs text-[#71818A]">Location</dt>
                    <dd className="font-medium text-[#263640] mt-0.5">{incident.location}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#71818A]">Captured GPS Coordinates</dt>
                    <dd className="font-mono text-xs text-[#263640] tabular-nums mt-0.5">
                      {incident.latitude !== null && incident.longitude !== null ? (
                        <div className="space-y-1">
                          <div>
                            {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
                            {incident.locationAccuracy ? ` (±${incident.locationAccuracy}m)` : ''}
                          </div>
                          <Link
                            to="/admin/map"
                            className="inline-flex items-center gap-1 font-sans font-semibold text-[#426B80] hover:underline"
                          >
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            <span>View on Interactive Map</span>
                          </Link>
                        </div>
                      ) : (
                        'Not provided (Manual address)'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#71818A]">People Affected</dt>
                    <dd className="font-semibold text-[#263640] mt-0.5">
                      {incident.peopleAffected}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#71818A]">Contact Information (Admin Only)</dt>
                    <dd className="font-medium text-[#263640] mt-0.5">
                      {incident.contactInformation || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#71818A]">Reported At</dt>
                    <dd className="text-[#263640] tabular-nums mt-0.5">
                      {formatDateTime(incident.reportedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#71818A]">Last Updated</dt>
                    <dd className="text-[#263640] tabular-nums mt-0.5">
                      {formatDateTime(incident.updatedAt)}
                    </dd>
                  </div>
                </dl>

                {incident.citizenMedicalSnapshot && (
                  <div className="bg-[#E5EEE9]/70 border border-[#C6D8CE] rounded-lg p-3.5 text-xs space-y-1">
                    <p className="font-bold text-[#2E5A44]">
                      Attached Citizen Medical &amp; Assistance Profile ({incident.citizenName || incident.citizenId})
                    </p>
                    <p className="text-[#263640]">
                      Blood Group: <strong>{incident.citizenMedicalSnapshot.bloodGroup || 'Unknown'}</strong> ·
                      Allergies: <strong>{incident.citizenMedicalSnapshot.allergies || 'None'}</strong> ·
                      Conditions: <strong>{incident.citizenMedicalSnapshot.conditions || 'None'}</strong>
                    </p>
                    {incident.citizenMedicalSnapshot.specialAssistance && (
                      <p className="text-[#7A5011] font-medium">
                        Special Assistance: {incident.citizenMedicalSnapshot.specialAssistance}
                      </p>
                    )}
                    {incident.citizenMedicalSnapshot.emergencyContact && (
                      <p className="text-[#71818A]">
                        Emergency Contact: {incident.citizenMedicalSnapshot.emergencyContact}
                      </p>
                    )}
                  </div>
                )}

                {/* Current & Original Risk Classification Audit */}
                <div className="bg-[#F3F7F8] rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-[#263640]">
                    Current Risk Classification ({incident.severitySource})
                  </p>
                  <p className="text-xs text-[#71818A] leading-relaxed">
                    {incident.severityExplanation}
                  </p>

                  {incident.severity !== incident.originalSeverity && (
                    <div className="pt-2 mt-2 border-t border-[#D9E2E6] text-xs text-[#71818A]">
                      <span className="font-semibold text-[#263640]">
                        Original Assessment (Audit):{' '}
                      </span>
                      {incident.originalSeverity} ({incident.originalSeveritySource}) —{' '}
                      {incident.originalSeverityExplanation}
                    </div>
                  )}
                </div>
              </div>

              {/* Update History */}
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-4">
                <h3 className="text-base font-semibold text-[#263640]">Update History</h3>
                <ol className="space-y-3">
                  {incident.statusHistory.map((entry, idx) => (
                    <li
                      key={`${entry.timestamp}-${idx}`}
                      className="text-sm pb-3 border-b border-[#F3F7F8] last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={entry.status} />
                          {entry.severity && <SeverityBadge severity={entry.severity} />}
                        </div>
                        <span className="text-xs text-[#71818A] tabular-nums">
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-[#71818A] mt-1.5">
                        Updated by <strong className="text-[#263640]">{entry.updatedBy}</strong>
                        {entry.note ? ` — ${entry.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Smart Duplicate Incident Detection */}
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[#263640] flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                    <span>Smart Duplicate Incident Detection</span>
                  </h3>
                  {incident.linkedDuplicateIds && incident.linkedDuplicateIds.length > 0 && (
                    <span className="text-xs font-semibold text-[#2E5A44]">
                      Linked: {incident.linkedDuplicateIds.join(', ')}
                    </span>
                  )}
                </div>

                {incident.duplicateOf && (
                  <p className="text-xs bg-[#E5EEE9] text-[#2E5A44] rounded-lg px-3 py-2 font-medium">
                    This report is linked as a duplicate of{' '}
                    <span className="font-mono font-bold">{incident.duplicateOf}</span> (original record preserved).
                  </p>
                )}

                {duplicates.length === 0 ? (
                  <p className="text-xs text-[#71818A]">
                    No potential duplicate reports detected for this location, category, and timeframe.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {duplicates.map((cand) => {
                      const alreadyLinked = incident.linkedDuplicateIds?.includes(cand.incidentId);
                      return (
                        <div
                          key={cand.incidentId}
                          className="bg-[#F3F7F8] rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-[#426B80]">
                                {cand.incidentId}
                              </span>
                              <span className="font-semibold text-[#263640]">{cand.title}</span>
                              <span className="font-bold text-[#9A4614] tabular-nums">
                                {cand.similarityScore}% match
                              </span>
                            </div>
                            <p className="text-[#71818A]">{cand.reasons.join(' · ')}</p>
                          </div>
                          {alreadyLinked ? (
                            <span className="text-[#2E5A44] font-semibold shrink-0">Linked</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLinkDuplicate(cand.incidentId)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-[#C5D2D8] font-semibold text-[#263640] hover:bg-[#E5EEE9] shrink-0"
                            >
                              Link Duplicate
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Responder Assignment & Safety Restrictions */}
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-4">
                <h3 className="text-base font-semibold text-[#263640] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Responder Assignment & Safety Restrictions</span>
                </h3>

                {(() => {
                  const spec = isIncidentSpecialistRequired(incident);
                  if (!spec.required) return null;
                  return (
                    <div className="bg-[#E8AD52]/15 border border-[#E8AD52]/40 rounded-lg p-3 text-xs text-[#7A5011] flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <strong>Operational Safety Restriction:</strong> {spec.safetyNotice}
                      </span>
                    </div>
                  );
                })()}

                {(() => {
                  const esc = isAssignmentEscalated(incident);
                  if (!esc.escalated) return null;
                  return (
                    <div className="bg-[#D9534F]/10 border border-[#D9534F]/30 rounded-lg p-3 text-xs text-[#962825] flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        <strong>Escalation Alert:</strong> Assignment to{' '}
                        {incident.assignedResponderName} has been pending acceptance for{' '}
                        <strong className="tabular-nums">{esc.pendingMinutes} minutes</strong>. Please reassign if needed.
                      </span>
                    </div>
                  );
                })()}

                {assignError && (
                  <p className="text-xs text-[#962825] font-medium">{assignError}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <select
                    aria-label="Select responder"
                    value={selectedResponderId}
                    onChange={(e) => setSelectedResponderId(e.target.value)}
                    className="flex-1 rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640]"
                  >
                    <option value="">-- Select Eligible Responder --</option>
                    {responders.map((resp) => {
                      const eligible = isResponderEligible(resp, incident);
                      return (
                        <option key={resp.id} value={resp.id} disabled={!eligible}>
                          {resp.name} ({resp.qualification})
                          {!eligible ? ' — Blocked: Specialist or verification required' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    disabled={assignBusy || !selectedResponderId}
                    onClick={handleAssignResponder}
                    className="px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60 whitespace-nowrap"
                  >
                    {assignBusy
                      ? 'Assigning...'
                      : incident.assignedResponderId
                      ? 'Reassign Responder'
                      : 'Assign Responder'}
                  </button>
                </div>

                {incident.assignedResponderName && (
                  <p className="text-xs text-[#71818A]">
                    Currently assigned: <strong className="text-[#263640]">{incident.assignedResponderName}</strong>
                    {incident.acceptedAt
                      ? ` · Accepted ${formatDateTime(incident.acceptedAt)}`
                      : ' · Pending responder acceptance'}
                  </p>
                )}
              </div>

              {/* Smart Communication Center */}
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-4">
                <h3 className="text-base font-semibold text-[#263640] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Smart Communication Center</span>
                </h3>

                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {(!incident.messages || incident.messages.length === 0) ? (
                    <p className="text-xs text-[#71818A]">No communication logs recorded yet.</p>
                  ) : (
                    incident.messages.map((m) => (
                      <div key={m.id} className="bg-[#F3F7F8] rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[#71818A]">
                          <span className="font-semibold text-[#263640]">
                            {m.senderName} ({m.senderRole})
                          </span>
                          <span className="tabular-nums">
                            {m.shareWithCitizen ? 'Shared with Citizen · ' : 'Internal · '}
                            {formatDateTime(m.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-[#263640]">{m.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="space-y-2.5 pt-2 border-t border-[#F3F7F8]">
                  <textarea
                    rows={2}
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="Write a coordination message or citizen status update..."
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[#263640] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareWithCitizen}
                        onChange={(e) => setShareWithCitizen(e.target.checked)}
                        className="rounded border-[#C5D2D8]"
                      />
                      <span>Share update on public tracking page</span>
                    </label>
                    <button
                      type="submit"
                      disabled={msgBusy || !msgBody.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{msgBusy ? 'Sending...' : 'Send Update'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Verification, Team Assignment & Triage Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[#263640]">
                    Verification &amp; Team Dispatch
                  </h3>
                  {incident.verifiedAt ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#2E5A44] text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleVerifyIncident}
                      disabled={verifying}
                      className="px-3 py-1.5 rounded-lg bg-[#5D9678] text-white text-xs font-semibold hover:bg-[#497A60] disabled:opacity-60"
                    >
                      {verifying ? 'Verifying...' : 'Verify Incident'}
                    </button>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-[#F3F7F8]">
                  <label htmlFor="assign-team" className="block text-xs font-semibold text-[#263640]">
                    Assign Response Team
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="assign-team"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="flex-1 rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-xs text-[#263640]"
                    >
                      <option value="">Select response team...</option>
                      {teams.map((t) => (
                        <option key={t.teamId} value={t.teamId}>
                          {t.teamName} ({t.status})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignTeam}
                      disabled={teamBusy || !selectedTeamId}
                      className="px-3.5 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60 shrink-0"
                    >
                      {teamBusy ? 'Assigning...' : 'Assign Team'}
                    </button>
                  </div>
                  {incident.assignedTeamName && (
                    <p className="text-xs text-[#2E5A44] font-medium">
                      Currently assigned team: {incident.assignedTeamName}
                    </p>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleSaveChanges}
                className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-5 sticky top-24"
              >
                <h3 className="text-base font-semibold text-[#263640]">
                  Triage &amp; Update Incident
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="detail-severity"
                      className="block text-xs font-semibold text-[#263640]"
                    >
                      Risk Level
                    </label>
                    <select
                      id="detail-severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                      className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                    >
                      {SEVERITY_LEVELS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="detail-status"
                      className="block text-xs font-semibold text-[#263640]"
                    >
                      Incident Status
                    </label>
                    <select
                      id="detail-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                      className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                    >
                      {INCIDENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="detail-note" className="block text-xs font-semibold text-[#263640]">
                    Administrative Note (Optional)
                  </label>
                  <input
                    id="detail-note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Coordinated with municipal response unit"
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                  />
                </div>

                <div className="pt-3 border-t border-[#D9E2E6] space-y-4">
                  <p className="text-xs font-semibold text-[#71818A]">Edit Incident Details</p>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-title" className="block text-xs font-semibold text-[#263640]">
                      Title
                    </label>
                    <input
                      id="edit-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-location"
                      className="block text-xs font-semibold text-[#263640]"
                    >
                      Location
                    </label>
                    <input
                      id="edit-location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-people"
                      className="block text-xs font-semibold text-[#263640]"
                    >
                      People Affected
                    </label>
                    <select
                      id="edit-people"
                      value={peopleAffected}
                      onChange={(e) => setPeopleAffected(e.target.value as PeopleAffectedOption)}
                      className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                    >
                      {PEOPLE_AFFECTED_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-description"
                      className="block text-xs font-semibold text-[#263640]"
                    >
                      Description
                    </label>
                    <textarea
                      id="edit-description"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] disabled:opacity-60 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && incident && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-delete-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#263640]/50 p-4"
          >
            <div className="bg-white rounded-xl border border-[#D9E2E6] max-w-md w-full p-6 space-y-4">
              <h3 id="detail-delete-title" className="text-lg font-bold text-[#263640]">
                Delete Incident {incident.incidentId}?
              </h3>
              <p className="text-sm text-[#71818A]">
                This will permanently remove the report from the database and record the deletion in the administrator activity log.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-[#C5D2D8] text-sm font-semibold text-[#263640]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626]"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
