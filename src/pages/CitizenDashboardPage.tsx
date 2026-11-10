import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Search,
  User,
  Users,
  ArrowRight,
  Save,
  PhoneCall,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import { useAuth } from '../context/AuthContext';
import type { CitizenProfile, NotificationRecord, PublicIncidentTrack } from '../types/incident';

interface CitizenIncident extends PublicIncidentTrack {
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  locationTimestamp?: string | null;
  assignedTeamName?: string | null;
  assignedResponderName?: string | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  verifiedAt?: string | null;
}

export function CitizenDashboardPage() {
  const { admin, logout, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [myIncidents, setMyIncidents] = useState<CitizenIncident[]>([]);
  const [sampleHistory, setSampleHistory] = useState<CitizenIncident[]>([]);
  const [dbNotifications, setDbNotifications] = useState<NotificationRecord[]>([]);
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');

  // Track Incident lookup
  const [trackInput, setTrackInput] = useState('');
  const [trackedIncident, setTrackedIncident] = useState<CitizenIncident | null>(null);
  const [trackError, setTrackError] = useState('');
  const [trackBusy, setTrackBusy] = useState(false);

  // Consent-based Live Location Sharing
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');
  const [sharedCoords, setSharedCoords] = useState<{ lat: number; lng: number; acc: number } | null>(
    null
  );

  // Citizen Profile Form State
  const [profileName, setProfileName] = useState(admin?.name || '');
  const [profileAge, setProfileAge] = useState('30');
  const [profilePhone, setProfilePhone] = useState(admin?.phone || '');
  const [profileDistrict, setProfileDistrict] = useState(admin?.city || '');
  const [profileLocality, setProfileLocality] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [emgName, setEmgName] = useState('');
  const [emgRelation, setEmgRelation] = useState('Family');
  const [emgPhone, setEmgPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('Unknown');
  const [allergies, setAllergies] = useState('None');
  const [conditions, setConditions] = useState('None');
  const [specialAssistance, setSpecialAssistance] = useState('None');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState('');
  const [profileError, setProfileError] = useState('');

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, profRes, notifRes] = await Promise.all([
        fetch('/api/citizen/incidents', { credentials: 'include' }),
        fetch('/api/citizen/profile', { credentials: 'include' }),
        fetch('/api/citizen/notifications', { credentials: 'include' }),
      ]);

      if (incRes.ok) {
        const data = (await incRes.json()) as {
          incidents: CitizenIncident[];
          sampleHistory?: CitizenIncident[];
        };
        setMyIncidents(data.incidents);
        setSampleHistory(data.sampleHistory || []);
        if (data.incidents.length > 0) {
          setSelectedId((prev) => prev || data.incidents[0].incidentId);
        }
      }

      if (profRes.ok) {
        const pData = (await profRes.json()) as { profile?: CitizenProfile };
        if (pData.profile) {
          const p = pData.profile;
          setCitizenProfile(p);
          setProfileName(p.fullName || '');
          setProfileAge(String(p.age || 30));
          setProfilePhone(p.mobileNumber || '');
          setProfileDistrict(p.district || '');
          setProfileLocality(p.locality || '');
          setProfileAddress(p.address || '');
          setEmgName(p.emergencyContact?.name || '');
          setEmgRelation(p.emergencyContact?.relation || 'Family');
          setEmgPhone(p.emergencyContact?.phone || '');
          setBloodGroup(p.medicalInfo?.bloodGroup || 'Unknown');
          setAllergies(p.medicalInfo?.allergies || 'None');
          setConditions(p.medicalInfo?.conditions || 'None');
          setSpecialAssistance(p.specialAssistance || 'None');
        }
      }

      if (notifRes.ok) {
        const nData = (await notifRes.json()) as { notifications: NotificationRecord[] };
        setDbNotifications(nData.notifications || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const activeIncident = useMemo(() => {
    if (trackedIncident) return trackedIncident;
    return (
      myIncidents.find((i) => i.incidentId === selectedId) ||
      sampleHistory.find((i) => i.incidentId === selectedId) ||
      myIncidents[0] ||
      null
    );
  }, [trackedIncident, myIncidents, sampleHistory, selectedId]);

  const handleMarkNotificationRead = async (id: string) => {
    const res = await fetch(`/api/citizen/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const handleTrackLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackInput.trim();
    if (!id) return;
    setTrackBusy(true);
    setTrackError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(id)}/track`);
      const data = (await res.json()) as { incident?: CitizenIncident; error?: string };
      if (!res.ok || !data.incident) {
        setTrackError(data.error || 'Incident ID not found.');
        return;
      }
      setTrackedIncident(data.incident);
    } catch {
      setTrackError('Unable to track incident right now.');
    } finally {
      setTrackBusy(false);
    }
  };

  const handleShareLiveLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('GPS location is not supported in this browser.');
      return;
    }
    setGeoBusy(true);
    setGeoMessage('Requesting consent-based GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);
        setSharedCoords({ lat, lng, acc });

        if (activeIncident && activeIncident.status !== 'Resolved' && !activeIncident.isDemo) {
          try {
            const res = await fetch(
              `/api/citizen/incidents/${encodeURIComponent(activeIncident.incidentId)}/location`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  latitude: lat,
                  longitude: lng,
                  locationAccuracy: acc,
                }),
              }
            );
            if (res.ok) {
              setGeoMessage(
                `Live GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}, ±${acc}m) shared with your active report ${activeIncident.incidentId}.`
              );
              await loadDashboardData();
              setGeoBusy(false);
              return;
            }
          } catch {
            // fallback message below
          }
        }
        setGeoMessage(`GPS captured with consent: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${acc}m).`);
        setGeoBusy(false);
      },
      () => {
        setGeoBusy(false);
        setGeoMessage('Location permission declined. Your location is not being shared.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSaved('');
    setProfileError('');
    try {
      const res = await fetch('/api/citizen/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: profileName,
          age: Number(profileAge) || 30,
          mobileNumber: profilePhone,
          district: profileDistrict,
          locality: profileLocality,
          address: profileAddress,
          emergencyContact: {
            name: emgName,
            relation: emgRelation,
            phone: emgPhone,
          },
          medicalInfo: {
            bloodGroup,
            allergies,
            conditions,
          },
          specialAssistance,
        }),
      });
      const data = (await res.json()) as { profile?: CitizenProfile; error?: string };
      if (!res.ok) {
        setProfileError(data.error || 'Failed to update profile.');
      } else {
        if (data.profile) setCitizenProfile(data.profile);
        setProfileSaved('Citizen profile & medical details saved to database.');
        await refreshAuth();
      }
    } catch {
      setProfileError('Unable to save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/citizen/login');
  };

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Citizen Header & Primary Emergency Actions */}
        <div className="bg-white rounded-2xl border border-[#D9E2E6] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#426B80]">
                Citizen Emergency Portal
              </p>
              {citizenProfile && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    citizenProfile.verified
                      ? 'bg-[#E5EEE9] text-[#2E5A44]'
                      : 'bg-[#E8AD52]/20 text-[#7A5011]'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  {citizenProfile.verified ? 'Verified Profile' : 'Pending Verification'}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#263640]">
              Welcome, {citizenProfile?.fullName || admin?.name || 'Citizen'}
            </h1>
            <p className="text-sm text-[#71818A]">
              Manage your pre-saved emergency &amp; medical profile, trigger instant SOS alerts, and track response teams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/sos"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D9534F] text-white text-sm font-semibold hover:bg-[#B83E3A] transition-colors"
            >
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <span>SOS Emergency</span>
            </Link>
            <Link
              to="/report"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] transition-colors"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Report Emergency</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#C5D2D8] text-sm font-medium text-[#263640] hover:bg-[#F3F7F8]"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Citizen Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Track Incident, My Emergency Reports, Emergency Contacts, Live Location, Sample History */}
          <div className="lg:col-span-5 space-y-6">
            {/* Track Incident */}
            <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-3">
              <h2 className="text-base font-bold text-[#263640] flex items-center gap-2">
                <Search className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                <span>Track Incident</span>
              </h2>
              <form onSubmit={handleTrackLookup} className="flex gap-2">
                <input
                  type="text"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  placeholder="Enter Incident ID (e.g., SR-2026-1008)"
                  aria-label="Incident ID to track"
                  className="flex-1 rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm font-mono text-[#263640]"
                />
                <button
                  type="submit"
                  disabled={trackBusy}
                  className="px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60"
                >
                  {trackBusy ? 'Checking...' : 'Track'}
                </button>
              </form>
              {trackedIncident && (
                <div className="flex items-center justify-between text-xs text-[#426B80]">
                  <span>Showing tracked report {trackedIncident.incidentId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackedIncident(null);
                      setTrackInput('');
                    }}
                    className="font-semibold hover:underline"
                  >
                    Return to My Reports
                  </button>
                </div>
              )}
              {trackError && <p className="text-xs text-[#962825]">{trackError}</p>}
            </section>

            {/* My Emergency Reports */}
            <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#263640]">
                  My Emergency Reports ({myIncidents.length})
                </h2>
                <Link to="/report" className="text-xs font-semibold text-[#426B80] hover:underline">
                  + New Report
                </Link>
              </div>

              {loading ? (
                <p className="text-sm text-[#71818A] py-4">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" aria-hidden="true" />
                  Loading your reports...
                </p>
              ) : myIncidents.length === 0 ? (
                <div className="bg-[#F3F7F8] rounded-xl p-4 text-sm text-[#71818A] space-y-2">
                  <p>You have not submitted any emergency reports while signed in yet.</p>
                  <Link
                    to="/report"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#426B80] hover:underline"
                  >
                    <span>Submit an Emergency Report</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {myIncidents.map((inc) => {
                    const isSelected = activeIncident?.incidentId === inc.incidentId && !trackedIncident;
                    return (
                      <button
                        key={inc.incidentId}
                        type="button"
                        onClick={() => {
                          setTrackedIncident(null);
                          setSelectedId(inc.incidentId);
                        }}
                        className={`w-full text-left rounded-xl border p-3.5 transition-colors space-y-1.5 ${
                          isSelected
                            ? 'bg-[#E5EEE9]/60 border-[#426B80]'
                            : 'bg-[#F3F7F8] border-[#D9E2E6] hover:border-[#426B80]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-[#426B80] tabular-nums">
                            {inc.incidentId}
                            {inc.isDemo ? ' · SAMPLE' : ''}
                          </span>
                          <StatusBadge status={inc.status} />
                        </div>
                        <p className="text-sm font-semibold text-[#263640] truncate">{inc.title}</p>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#71818A]">
                          <span>{inc.category}</span>
                          <span className="tabular-nums">{formatDateTime(inc.reportedAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Emergency Contacts */}
            <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-3">
              <h2 className="text-base font-bold text-[#263640] flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#D9534F]" aria-hidden="true" />
                <span>Emergency Contacts</span>
              </h2>
              <div className="bg-[#F3F7F8] rounded-xl p-3.5 text-xs space-y-1">
                <p className="font-semibold text-[#263640]">Personal Emergency Contact</p>
                {emgName || emgPhone ? (
                  <p className="text-[#71818A]">
                    {emgName || 'Contact'} ({emgRelation}) ·{' '}
                    <span className="font-mono font-semibold text-[#263640]">{emgPhone || 'No phone saved'}</span>
                  </p>
                ) : (
                  <p className="text-[#71818A]">Add a personal emergency contact in your Citizen Profile below.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-[#D9534F]/10 p-2.5">
                  <p className="font-bold text-[#962825] tabular-nums">112</p>
                  <p className="text-[11px] text-[#71818A]">National SOS</p>
                </div>
                <div className="rounded-lg bg-[#E5EEE9] p-2.5">
                  <p className="font-bold text-[#2E5A44] tabular-nums">108</p>
                  <p className="text-[11px] text-[#71818A]">Ambulance</p>
                </div>
                <div className="rounded-lg bg-[#E8AD52]/20 p-2.5">
                  <p className="font-bold text-[#7A5011] tabular-nums">101</p>
                  <p className="text-[11px] text-[#71818A]">Fire Rescue</p>
                </div>
              </div>
            </section>

            {/* Live Location Sharing with Consent */}
            <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-3">
              <h2 className="text-base font-bold text-[#263640] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                <span>Live Location Sharing (With Consent)</span>
              </h2>
              <p className="text-xs text-[#71818A] leading-relaxed">
                Your location is never tracked in the background. Tap below only when you consent to share your current GPS coordinates with your active incident response team.
              </p>
              <button
                type="button"
                onClick={handleShareLiveLocation}
                disabled={geoBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5EEE9] border border-[#C6D8CE] text-xs font-semibold text-[#263640] hover:bg-[#D7E6DD] disabled:opacity-60"
              >
                {geoBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                )}
                <span>Share My Current GPS Location</span>
              </button>
              {sharedCoords && (
                <p className="text-xs font-mono text-[#2E5A44] tabular-nums">
                  Shared: {sharedCoords.lat.toFixed(5)}, {sharedCoords.lng.toFixed(5)} (±{sharedCoords.acc}m)
                </p>
              )}
              {geoMessage && <p className="text-xs text-[#426B80]">{geoMessage}</p>}
            </section>

            {/* Sample Historical Incidents Reference */}
            {sampleHistory.length > 0 && (
              <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#263640]">Sample Historical Incidents</h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F3F7F8] text-[#71818A]">
                    SAMPLE DATA
                  </span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {sampleHistory.map((inc) => (
                    <button
                      key={inc.incidentId}
                      type="button"
                      onClick={() => {
                        setTrackedIncident(null);
                        setSelectedId(inc.incidentId);
                      }}
                      className="w-full text-left rounded-lg border border-[#D9E2E6] bg-[#F3F7F8] p-2.5 hover:border-[#426B80] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#426B80]">{inc.incidentId}</span>
                        <StatusBadge status={inc.status} />
                      </div>
                      <p className="text-xs font-medium text-[#263640] truncate">{inc.title}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Selected Incident Timeline, Notifications & Saved Citizen Profile */}
          <div className="lg:col-span-7 space-y-6">
            {activeIncident ? (
              <section className="bg-white rounded-2xl border border-[#D9E2E6] p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#D9E2E6]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[#71818A]">
                      <span className="font-mono font-semibold text-[#426B80] tabular-nums">
                        {activeIncident.incidentId}
                      </span>
                      <span>· {activeIncident.category}</span>
                      {activeIncident.isSos && (
                        <span className="px-1.5 py-0.5 rounded bg-[#D9534F]/10 text-[#962825] font-semibold">
                          SOS
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-[#263640]">{activeIncident.title}</h2>
                    <p className="text-sm text-[#71818A]">{activeIncident.location}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={activeIncident.severity} />
                    <StatusBadge status={activeIncident.status} />
                  </div>
                </div>

                {/* Completion and Resolution Updates */}
                {activeIncident.status === 'Resolved' && (
                  <div className="bg-[#E5EEE9] border border-[#5D9678]/40 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#2E5A44] shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-[#2E5A44]">
                        Completion &amp; Resolution Confirmed
                      </p>
                      <p className="text-xs text-[#263640]">
                        Resolved on{' '}
                        <span className="font-semibold tabular-nums">
                          {activeIncident.resolvedAt
                            ? formatDateTime(activeIncident.resolvedAt)
                            : formatDateTime(activeIncident.updatedAt)}
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* Assigned Response Team Updates */}
                <div className="bg-[#F3F7F8] rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-[#263640] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                    <span>Assigned Response Team Updates</span>
                  </h3>
                  <div className="space-y-1 text-xs text-[#263640]">
                    {activeIncident.assignedTeamName && (
                      <p>
                        Assigned Team: <strong>{activeIncident.assignedTeamName}</strong>
                      </p>
                    )}
                    {activeIncident.assignedResponderName ? (
                      <p>
                        Assigned Responder:{' '}
                        <strong>{activeIncident.assignedResponderName}</strong>{' '}
                        {activeIncident.acceptedAt
                          ? `· Accepted ${formatDateTime(activeIncident.acceptedAt)}`
                          : '· Awaiting responder confirmation'}
                      </p>
                    ) : !activeIncident.assignedTeamName ? (
                      <p className="text-[#71818A]">
                        Your report is in queue for coordinator verification and response team assignment.
                      </p>
                    ) : null}
                  </div>

                  {activeIncident.publicMessages && activeIncident.publicMessages.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#D9E2E6]">
                      {activeIncident.publicMessages.map((msg) => (
                        <div key={msg.id} className="bg-white rounded-lg p-3 border border-[#D9E2E6] text-xs space-y-1">
                          <div className="flex items-center justify-between text-[#71818A]">
                            <span className="font-semibold text-[#263640] flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                              {msg.senderRole} Update
                            </span>
                            <span className="tabular-nums">{formatDateTime(msg.timestamp)}</span>
                          </div>
                          <p className="text-sm text-[#263640]">{msg.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Response Timeline */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#263640] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                    <span>Response Timeline</span>
                  </h3>
                  <ol className="space-y-3">
                    {activeIncident.statusHistory.map((entry, idx) => (
                      <li
                        key={`${entry.timestamp}-${idx}`}
                        className="flex items-start gap-3 pb-3 border-b border-[#F3F7F8] last:border-b-0"
                      >
                        {entry.status === 'Resolved' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#5D9678] shrink-0 mt-0.5" aria-hidden="true" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#426B80] shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                        <div className="flex-1 text-xs space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#263640]">{entry.status}</span>
                            <span className="text-[#71818A] tabular-nums">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                          {entry.note && <p className="text-[#71818A]">{entry.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            ) : (
              <div className="bg-white rounded-2xl border border-[#D9E2E6] p-8 text-center text-sm text-[#71818A]">
                Select one of your reports or track an Incident ID to view its response timeline and team updates.
              </div>
            )}

            {/* Persistent Notifications */}
            <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#263640] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Notifications</span>
                </h2>
                <span className="text-xs font-semibold text-[#71818A]">
                  {dbNotifications.filter((n) => !n.read).length} unread
                </span>
              </div>
              {dbNotifications.length === 0 ? (
                <p className="text-xs text-[#71818A]">No notifications yet. Updates on your SOS or incident reports will appear here.</p>
              ) : (
                <ul className="divide-y divide-[#F3F7F8]">
                  {dbNotifications.slice(0, 6).map((n) => (
                    <li
                      key={n.id}
                      className={`py-2.5 text-xs space-y-1 ${n.read ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#263640] flex items-center gap-1.5">
                          {!n.read && <span className="w-2 h-2 rounded-full bg-[#D9534F]" />}
                          {n.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#71818A] tabular-nums">
                            {formatDateTime(n.timestamp)}
                          </span>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => handleMarkNotificationRead(n.id)}
                              className="text-[11px] font-semibold text-[#426B80] hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[#71818A]">{n.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Pre-Saved Citizen Profile & Medical Information */}
            <section className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#263640] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Saved Citizen &amp; Medical Profile</span>
                </h2>
                {citizenProfile && (
                  <span className="font-mono text-xs text-[#71818A]">{citizenProfile.citizenId}</span>
                )}
              </div>
              <p className="text-xs text-[#71818A]">
                These details are automatically attached when you trigger an SOS Emergency so responders have your medical and contact information immediately.
              </p>

              {profileSaved && (
                <div className="p-2.5 rounded-lg bg-[#E5EEE9] text-xs font-medium text-[#2E5A44]">
                  {profileSaved}
                </div>
              )}
              {profileError && (
                <div className="p-2.5 rounded-lg bg-[#D9534F]/10 text-xs font-medium text-[#962825]">
                  {profileError}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <label htmlFor="prof-name" className="block text-xs font-semibold text-[#71818A]">
                    Full Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="prof-age" className="block text-xs font-semibold text-[#71818A]">
                    Age
                  </label>
                  <input
                    id="prof-age"
                    type="number"
                    min={1}
                    max={120}
                    value={profileAge}
                    onChange={(e) => setProfileAge(e.target.value)}
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="prof-phone" className="block text-xs font-semibold text-[#71818A]">
                    Mobile Number
                  </label>
                  <input
                    id="prof-phone"
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="prof-district" className="block text-xs font-semibold text-[#71818A]">
                    District
                  </label>
                  <input
                    id="prof-district"
                    type="text"
                    value={profileDistrict}
                    onChange={(e) => setProfileDistrict(e.target.value)}
                    placeholder="e.g., Chennai Central"
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="prof-locality" className="block text-xs font-semibold text-[#71818A]">
                    Locality / Ward
                  </label>
                  <input
                    id="prof-locality"
                    type="text"
                    value={profileLocality}
                    onChange={(e) => setProfileLocality(e.target.value)}
                    placeholder="e.g., Anna Nagar West"
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="prof-address" className="block text-xs font-semibold text-[#71818A]">
                    Residential Address
                  </label>
                  <input
                    id="prof-address"
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="Street & Door No."
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>

                {/* Emergency Contact */}
                <div className="sm:col-span-2 pt-2 border-t border-[#F3F7F8]">
                  <p className="text-xs font-bold text-[#263640] mb-2">Emergency Contact Person</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      aria-label="Emergency Contact Name"
                      value={emgName}
                      onChange={(e) => setEmgName(e.target.value)}
                      placeholder="Contact Name"
                      className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                    />
                    <input
                      type="text"
                      aria-label="Emergency Contact Relation"
                      value={emgRelation}
                      onChange={(e) => setEmgRelation(e.target.value)}
                      placeholder="Relation (e.g. Spouse)"
                      className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                    />
                    <input
                      type="text"
                      aria-label="Emergency Contact Phone"
                      value={emgPhone}
                      onChange={(e) => setEmgPhone(e.target.value)}
                      placeholder="Emergency Phone"
                      className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                    />
                  </div>
                </div>

                {/* Medical Information */}
                <div className="sm:col-span-2 pt-2 border-t border-[#F3F7F8]">
                  <p className="text-xs font-bold text-[#263640] flex items-center gap-1.5 mb-2">
                    <HeartPulse className="w-3.5 h-3.5 text-[#D9534F]" aria-hidden="true" />
                    Medical &amp; Assistance Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      aria-label="Blood Group"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      placeholder="Blood Group (e.g. O+)"
                      className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                    />
                    <input
                      type="text"
                      aria-label="Allergies"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="Allergies"
                      className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                    />
                    <input
                      type="text"
                      aria-label="Medical Conditions"
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder="Medical Conditions"
                      className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                    />
                  </div>
                  <input
                    type="text"
                    aria-label="Special Assistance Requirements"
                    value={specialAssistance}
                    onChange={(e) => setSpecialAssistance(e.target.value)}
                    placeholder="Special assistance requirements (e.g., wheelchair, hearing aid, inhaler)"
                    className="mt-2.5 w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>

                <div className="sm:col-span-2 flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{profileSaving ? 'Saving...' : 'Save Citizen Profile'}</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
