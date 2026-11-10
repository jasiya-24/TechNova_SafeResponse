import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  MapPin,
  PhoneCall,
  CheckCircle2,
  Loader2,
  ArrowRight,
  WifiOff,
  Send,
  UserCheck,
  HeartPulse,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { SeverityBadge, StatusBadge, CategoryIcon, formatDateTime } from '../components/SeverityBadge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  EMERGENCY_CATEGORIES,
  type CitizenProfile,
  type EmergencyCategory,
  type PublicIncidentTrack,
} from '../types/incident';
import { enqueueOfflineSubmission } from '../utils/offlineQueue';

export function SosPage() {
  const { t, isOnline } = useLanguage();
  const { admin } = useAuth();
  const [savedProfile, setSavedProfile] = useState<CitizenProfile | null>(null);
  const [category, setCategory] = useState<EmergencyCategory>('Medical Emergency');
  const [shareLocation, setShareLocation] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationText, setLocationText] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [confirmedIncident, setConfirmedIncident] = useState<PublicIncidentTrack | null>(null);

  // Supplemental details state
  const [extraTitle, setExtraTitle] = useState('');
  const [extraDescription, setExtraDescription] = useState('');
  const [extraContact, setExtraContact] = useState('');
  const [supplementSaved, setSupplementSaved] = useState(false);
  const [supplementSaving, setSupplementSaving] = useState(false);

  useEffect(() => {
    if (admin?.role === 'Citizen') {
      fetch('/api/citizen/profile', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { profile?: CitizenProfile } | null) => {
          if (data?.profile) {
            setSavedProfile(data.profile);
            const fallbackLoc = [data.profile.locality, data.profile.district].filter(Boolean).join(', ');
            if (fallbackLoc) {
              setLocationText((prev) => prev || fallbackLoc);
            }
          }
        })
        .catch(() => {});
    }
  }, [admin]);

  const requestConsentLocation = () => {
    setShareLocation(true);
    if (!navigator.geolocation) {
      setGeoStatus('GPS unavailable in this browser. You can type a landmark below.');
      return;
    }
    setGeoLoading(true);
    setGeoStatus('Requesting GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);
        setLatitude(lat);
        setLongitude(lng);
        setLocationAccuracy(acc);
        setLocationText((prev) => prev || `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setGeoStatus(`GPS captured (±${acc}m accuracy).`);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setGeoStatus('Location permission declined or unavailable. You may enter a landmark manually.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setQueuedOffline(false);

    const clientSubmissionId = `sos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      title: `SOS Alert: ${category}`,
      description: `Emergency SOS Quick Report submitted for ${category}. Additional details pending.`,
      originalDescription: `Emergency SOS Quick Report submitted for ${category}.`,
      category,
      location: locationText.trim() || 'GPS / Location Pending',
      peopleAffected: 'Unknown' as const,
      contactInformation: '',
      latitude: shareLocation ? latitude : null,
      longitude: shareLocation ? longitude : null,
      locationAccuracy: shareLocation ? locationAccuracy : null,
      locationTimestamp: shareLocation && latitude !== null ? new Date().toISOString() : null,
      isSos: true,
      clientSubmissionId,
    };

    if (!isOnline) {
      enqueueOfflineSubmission({
        clientSubmissionId,
        payload,
        queueStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      setQueuedOffline(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { incident?: PublicIncidentTrack; error?: string };
      if (!res.ok || !data.incident) {
        setError(data.error || 'Unable to send SOS alert. Please try again or dial 112.');
        return;
      }
      setConfirmedIncident(data.incident);
    } catch {
      enqueueOfflineSubmission({
        clientSubmissionId,
        payload,
        queueStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      setQueuedOffline(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedIncident) return;
    setSupplementSaving(true);
    try {
      const res = await fetch(
        `/api/incidents/${encodeURIComponent(confirmedIncident.incidentId)}/supplement`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: extraTitle.trim() || undefined,
            description: extraDescription.trim() || undefined,
            location: locationText.trim() || undefined,
            contactInformation: extraContact.trim() || undefined,
          }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { incident: PublicIncidentTrack };
        setConfirmedIncident(data.incident);
        setSupplementSaved(true);
      }
    } finally {
      setSupplementSaving(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#962825]">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <span>Emergency SOS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#263640]">
            {t('sos.title', 'Emergency SOS Quick Report')}
          </h1>
          <p className="text-sm sm:text-base text-[#71818A]">
            {t(
              'sos.subtitle',
              'Submit an urgent minimal report in seconds. You can add additional details after receiving your Incident ID.'
            )}
          </p>
        </div>

        {queuedOffline && (
          <div
            role="status"
            className="bg-white rounded-2xl border border-[#E8AD52] p-6 space-y-3"
          >
            <div className="flex items-center gap-2 text-[#7A5011] font-semibold">
              <WifiOff className="w-5 h-5" aria-hidden="true" />
              <span>Queued Offline — Not Yet Received by Server</span>
            </div>
            <p className="text-sm text-[#71818A]">
              Your device is currently offline or unreachable. Your SOS alert has been safely saved in the offline queue and will sync automatically when connectivity returns. In an immediate life-threatening emergency, dial <strong className="text-[#263640]">112</strong> directly.
            </p>
            <Link
              to="/report"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#426B80] hover:underline"
            >
              <span>View Offline Queue</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {confirmedIncident ? (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-[#D9534F] p-6 sm:p-8 space-y-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#5D9678] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#263640]">
                    SOS Alert Received & Coordinator Notified
                  </h2>
                  <p className="text-sm text-[#71818A]">
                    Your Incident ID is{' '}
                    <span className="font-mono font-bold text-[#426B80] tabular-nums">
                      {confirmedIncident.incidentId}
                    </span>
                    . Client coordinators have been alerted immediately.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <SeverityBadge severity={confirmedIncident.severity} />
                <StatusBadge status={confirmedIncident.status} />
                <span className="text-xs text-[#71818A] tabular-nums">
                  {formatDateTime(confirmedIncident.reportedAt)}
                </span>
              </div>

              <div className="bg-[#F3F7F8] rounded-xl p-4 flex items-start gap-3 text-sm">
                <PhoneCall className="w-5 h-5 text-[#426B80] shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[#263640]">
                  <strong>Emergency Guidance:</strong> Move to a safe location. SafeResponse is a coordination platform; in India, dial <strong className="tabular-nums">112</strong> directly for police, fire, or ambulance dispatch.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/track?id=${encodeURIComponent(confirmedIncident.incidentId)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A]"
                >
                  <span>Track SOS Status</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Add Additional Details Later */}
            <form
              onSubmit={handleSaveSupplement}
              className="bg-white rounded-2xl border border-[#D9E2E6] p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-[#263640]">
                Add Additional Details (Optional)
              </h3>
              <p className="text-xs text-[#71818A]">
                When it is safe to do so, share extra context so responders can prepare the right equipment.
              </p>

              {supplementSaved && (
                <div className="p-3 rounded-lg bg-[#E5EEE9] text-xs font-medium text-[#2E5A44]">
                  Additional details added to {confirmedIncident.incidentId}.
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="sos-extra-title" className="block text-sm font-medium text-[#263640]">
                  Short Summary
                </label>
                <input
                  id="sos-extra-title"
                  type="text"
                  value={extraTitle}
                  onChange={(e) => setExtraTitle(e.target.value)}
                  placeholder="e.g., 2nd floor smoke near staircase"
                  className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2 text-sm text-[#263640]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sos-extra-desc" className="block text-sm font-medium text-[#263640]">
                  Situation Details
                </label>
                <textarea
                  id="sos-extra-desc"
                  rows={3}
                  value={extraDescription}
                  onChange={(e) => setExtraDescription(e.target.value)}
                  placeholder="Number of people, hazards, access instructions..."
                  className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2 text-sm text-[#263640]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sos-extra-contact" className="block text-sm font-medium text-[#263640]">
                  Contact Phone (Optional, kept private to responders)
                </label>
                <input
                  id="sos-extra-contact"
                  type="text"
                  value={extraContact}
                  onChange={(e) => setExtraContact(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2 text-sm text-[#263640]"
                />
              </div>

              <button
                type="submit"
                disabled={supplementSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] disabled:opacity-60"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{supplementSaving ? 'Saving...' : 'Update SOS Report'}</span>
              </button>
            </form>
          </div>
        ) : (
          <form
            onSubmit={handleSosSubmit}
            className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6"
          >
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-[#D9534F]/10 border border-[#D9534F]/30 text-sm text-[#962825]"
              >
                {error}
              </div>
            )}

            {savedProfile && (
              <div className="rounded-xl bg-[#E5EEE9]/70 border border-[#C6D8CE] p-4 space-y-2 text-xs text-[#263640]">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#2E5A44]">
                    <UserCheck className="w-4 h-4" aria-hidden="true" />
                    Pre-Saved Citizen Profile Attached Automatically
                  </span>
                  <span className="font-mono text-[#71818A]">{savedProfile.citizenId}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[#263640]">
                  <div>
                    <span className="text-[#71818A]">Name:</span> {savedProfile.fullName}
                  </div>
                  <div>
                    <span className="text-[#71818A]">Mobile:</span> {savedProfile.mobileNumber || 'Not set'}
                  </div>
                  <div>
                    <span className="text-[#71818A]">Emergency Contact:</span>{' '}
                    {savedProfile.emergencyContact?.name
                      ? `${savedProfile.emergencyContact.name} (${savedProfile.emergencyContact.phone})`
                      : 'Not set'}
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <HeartPulse className="w-3.5 h-3.5 text-[#D9534F]" aria-hidden="true" />
                    <span className="text-[#71818A]">Medical:</span>{' '}
                    {savedProfile.medicalInfo?.bloodGroup || 'Unknown'} · {savedProfile.medicalInfo?.conditions || 'None'}
                  </div>
                </div>
                {savedProfile.specialAssistance && savedProfile.specialAssistance !== 'None' && (
                  <p className="text-[#7A5011] font-medium">
                    Special Assistance: {savedProfile.specialAssistance}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <label className="block text-sm font-semibold text-[#263640]">
                1. Select Emergency Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {EMERGENCY_CATEGORIES.map((cat) => {
                  const selected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-[#D9534F]/10 border-[#D9534F] text-[#962825]'
                          : 'bg-[#F3F7F8] border-[#D9E2E6] text-[#263640] hover:border-[#426B80]'
                      }`}
                    >
                      <CategoryIcon category={cat} className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[#263640]">
                2. Optional Consent-Based Location Sharing
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={requestConsentLocation}
                  disabled={geoLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5EEE9] border border-[#5D9678]/40 text-sm font-semibold text-[#263640] hover:bg-[#D7E6DD]"
                >
                  {geoLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  )}
                  <span>Share My Live GPS Location</span>
                </button>
                {geoStatus && <span className="text-xs text-[#71818A]">{geoStatus}</span>}
              </div>

              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Optional landmark or street name"
                aria-label="Optional landmark or street name"
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#D9534F] text-white text-base font-bold hover:bg-[#B83E3A] disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Sending SOS Alert...</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                  <span>{t('sos.submit', 'Send SOS Alert Now')}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
