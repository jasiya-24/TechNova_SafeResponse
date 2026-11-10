import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  Check,
  MapPin,
  RefreshCw,
  Mic,
  MicOff,
  AlertCircle,
  AlertTriangle,
  PhoneCall,
  Loader2,
  ArrowRight,
  Save,
  WifiOff,
  UploadCloud,
  Trash2,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import { useLanguage } from '../context/LanguageContext';
import {
  saveReportDraft,
  loadReportDraft,
  clearReportDraft,
  loadOfflineQueue,
  saveOfflineQueue,
  enqueueOfflineSubmission,
  type QueuedSubmission,
  type OfflineReportDraft,
} from '../utils/offlineQueue';
import {
  EMERGENCY_CATEGORIES,
  PEOPLE_AFFECTED_OPTIONS,
  type EmergencyCategory,
  type PeopleAffectedOption,
  type PublicIncidentTrack,
  type SeveritySource,
} from '../types/incident';

interface SubmissionConfirmation {
  incident: PublicIncidentTrack;
  severitySource: SeveritySource;
  severityExplanation: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

const VOICE_LANGUAGES = [
  { code: '', label: 'Auto-Detect (Default)' },
  { code: 'en-IN', label: 'English' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ur-IN', label: 'Urdu (اردو)' },
];

export function ReportPage() {
  const { isOnline, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialCategoryParam = searchParams.get('category') as EmergencyCategory | null;
  const validInitialCategory =
    initialCategoryParam && EMERGENCY_CATEGORIES.includes(initialCategoryParam)
      ? initialCategoryParam
      : 'Fire';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EmergencyCategory>(validInitialCategory);
  const [location, setLocation] = useState('');
  const [peopleAffected, setPeopleAffected] = useState<PeopleAffectedOption>('1 Person');
  const [contactInformation, setContactInformation] = useState('');

  // Offline draft & queue state
  const [savedDraft, setSavedDraft] = useState<OfflineReportDraft | null>(() => loadReportDraft());
  const [draftNotice, setDraftNotice] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<QueuedSubmission[]>(() => loadOfflineQueue());
  const [syncingQueue, setSyncingQueue] = useState(false);

  // Live GPS Location state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationTimestamp, setLocationTimestamp] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [geoError, setGeoError] = useState<string>('');

  // Voice typing state
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [currentTimestamp] = useState(() => new Date().toISOString());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<SubmissionConfirmation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialCategoryParam && EMERGENCY_CATEGORIES.includes(initialCategoryParam)) {
      setCategory(initialCategoryParam);
    }
  }, [initialCategoryParam]);

  const syncOfflineQueue = useCallback(async () => {
    const current = loadOfflineQueue();
    const pendingItems = current.filter((item) => item.queueStatus !== 'synced');
    if (pendingItems.length === 0 || !navigator.onLine) return;

    setSyncingQueue(true);
    const updated = [...current];
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.queueStatus === 'synced') continue;
      try {
        const res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          const data = (await res.json()) as { incident: PublicIncidentTrack };
          updated[i] = {
            ...item,
            queueStatus: 'synced',
            serverIncidentId: data.incident.incidentId,
            errorMessage: undefined,
          };
        } else {
          const errData = (await res.json()) as { error?: string };
          updated[i] = {
            ...item,
            queueStatus: 'failed',
            errorMessage: errData.error || 'Server rejected submission.',
          };
        }
      } catch {
        updated[i] = {
          ...item,
          queueStatus: 'pending',
          errorMessage: 'Network still unreachable.',
        };
      }
    }
    saveOfflineQueue(updated);
    setOfflineQueue(updated);
    setSyncingQueue(false);
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncOfflineQueue();
    }
  }, [isOnline, syncOfflineQueue]);

  const detectLiveLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('GPS location is not supported by this browser. Please enter your location manually.');
      return;
    }

    setGeoLoading(true);
    setGeoError('');
    setGeoStatus('Retrieving your live GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);
        const ts = new Date(pos.timestamp || Date.now()).toISOString();

        setLatitude(lat);
        setLongitude(lng);
        setLocationAccuracy(acc);
        setLocationTimestamp(ts);
        setGeoStatus(`GPS coordinates captured (±${acc}m accuracy). Looking up readable address...`);

        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { Accept: 'application/json' } }
          );
          if (resp.ok) {
            const data = (await resp.json()) as { display_name?: string };
            if (data.display_name) {
              setLocation(data.display_name);
              setGeoStatus(`Live location detected (±${acc}m accuracy).`);
              setGeoLoading(false);
              return;
            }
          }
        } catch {
          // Graceful fallback if reverse geocoding is unavailable
        }

        setLocation((prev) => prev.trim() || `GPS Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setGeoStatus(`GPS coordinates captured (±${acc}m accuracy). You may refine the street address below.`);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setGeoStatus('');
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            'Location permission was denied. You can enter your address or landmark manually below.'
          );
        } else {
          setGeoError(
            'Unable to retrieve GPS signal right now. Please enter your location manually below.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Auto-retrieve if permission was already granted
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((perm) => {
          if (perm.state === 'granted') {
            detectLiveLocation();
          }
        })
        .catch(() => {
          // Ignore browsers that don't support permissions query
        });
    }
  }, [detectLiveLocation]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleVoiceTyping = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText('');
      setVoiceStatus('Voice typing stopped. You can edit the text below.');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceStatus(
        'Voice typing is not supported in this browser. Please type your description directly.'
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    if (voiceLang) {
      recognition.lang = voiceLang;
    }

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript + ' ';
        } else {
          interimChunk += transcript;
        }
      }
      if (finalChunk.trim()) {
        setDescription((prev) => (prev ? `${prev.trim()} ${finalChunk.trim()}` : finalChunk.trim()));
      }
      setInterimText(interimChunk);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setInterimText('');
      if (event.error === 'not-allowed') {
        setVoiceStatus('Microphone access denied. Please type your description or allow microphone access.');
      } else {
        setVoiceStatus('Voice recognition paused. You can continue typing or tap the microphone again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setVoiceStatus(
      voiceLang
        ? `Listening (${VOICE_LANGUAGES.find((l) => l.code === voiceLang)?.label})... Speak clearly.`
        : 'Listening with automatic language detection... Speak in any language.'
    );
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) {
      next.title = 'Please enter an incident title (at least 3 characters).';
    }
    if (description.trim().length < 5) {
      next.description = 'Please describe the situation (at least 5 characters).';
    }
    if (!EMERGENCY_CATEGORIES.includes(category)) {
      next.category = 'Please select an incident category.';
    }
    if (location.trim().length < 3) {
      next.location = 'Please provide the incident location or detect your live location.';
    }
    if (!PEOPLE_AFFECTED_OPTIONS.includes(peopleAffected)) {
      next.peopleAffected = 'Please select the number of people affected.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveDraft = () => {
    const draft: OfflineReportDraft = {
      title,
      description,
      category,
      location,
      peopleAffected,
      contactInformation,
      savedAt: new Date().toISOString(),
    };
    saveReportDraft(draft);
    setSavedDraft(draft);
    setDraftNotice('Draft saved locally on this device.');
  };

  const handleLoadDraft = () => {
    if (!savedDraft) return;
    setTitle(savedDraft.title);
    setDescription(savedDraft.description);
    setCategory(savedDraft.category);
    setLocation(savedDraft.location);
    setPeopleAffected(savedDraft.peopleAffected);
    setContactInformation(savedDraft.contactInformation);
    setDraftNotice('Saved draft loaded.');
  };

  const handleClearDraft = () => {
    clearReportDraft();
    setSavedDraft(null);
    setDraftNotice('Saved draft cleared.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (submitting || !validate()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const clientSubmissionId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      title: title.trim(),
      description: description.trim(),
      originalDescription: description.trim(),
      voiceLanguage: voiceLang || 'auto',
      category,
      location: location.trim(),
      peopleAffected,
      contactInformation: contactInformation.trim(),
      latitude,
      longitude,
      locationAccuracy,
      locationTimestamp,
      clientSubmissionId,
    };

    if (!isOnline) {
      const nextQueue = enqueueOfflineSubmission({
        clientSubmissionId,
        payload,
        queueStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      setOfflineQueue(nextQueue);
      clearReportDraft();
      setSavedDraft(null);
      setDraftNotice('You are offline. Report queued safely and will sync when connectivity returns.');
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
      const data = (await res.json()) as SubmissionConfirmation & { error?: string };
      if (!res.ok) {
        setSubmitError(data.error || 'Could not submit your report. Please try again.');
        return;
      }
      clearReportDraft();
      setSavedDraft(null);
      setConfirmation(data);
    } catch {
      const nextQueue = enqueueOfflineSubmission({
        clientSubmissionId,
        payload,
        queueStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      setOfflineQueue(nextQueue);
      setSubmitError(
        'Network unreachable. Your report has been queued locally and has NOT yet reached the server.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.incident.incidentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  if (confirmation) {
    const { incident, severitySource, severityExplanation } = confirmation;
    const isCritical = incident.severity === 'Critical';

    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-6">
          {/* Emergency Mode Banner for Critical Incidents */}
          {isCritical && (
            <div
              role="alert"
              className="bg-white rounded-2xl border-2 border-[#EF4444] p-6 space-y-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#EF4444] text-white text-xs font-bold tracking-wide">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  <span>CRITICAL INCIDENT · EMERGENCY MODE</span>
                </div>
                <StatusBadge status={incident.status} />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#263640]">
                  Your emergency report is being processed.
                </h2>
                <p className="text-sm text-[#71818A]">
                  Stay calm. Your report is available to the response team for priority review.
                </p>
              </div>

              <div className="bg-[#F3F7F8] rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-[#263640]">Immediate Priority Actions</p>
                <ul className="list-disc pl-5 space-y-1 text-[#263640]/85 text-xs sm:text-sm">
                  <li>Move to a safe distance away from active fire, structural hazards, or traffic.</li>
                  <li>
                    SafeResponse is a demonstration platform and has not contacted official dispatch. In a real emergency in India, dial{' '}
                    <strong className="tabular-nums">112</strong> directly.
                  </li>
                </ul>
                <p className="text-xs text-[#71818A] pt-1">
                  <strong>Reported Location:</strong> {incident.location}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-[#E5EEE9] text-[#22C55E] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-[#263640]">
                  Your report has been received.
                </h1>
                <p className="text-sm sm:text-base text-[#71818A]">
                  Your incident details have been recorded in SafeResponse.
                </p>
              </div>
            </div>

            <div className="bg-[#F3F7F8] rounded-xl border border-[#D9E2E6] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#71818A]">Incident Reference</p>
                <p className="text-2xl font-mono font-bold text-[#263640] tabular-nums mt-0.5">
                  {incident.incidentId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#C5D2D8] text-sm font-medium text-[#263640] hover:bg-[#E5EEE9] transition-colors whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#22C55E]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy Reference</span>
                  </>
                )}
              </button>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-b border-[#D9E2E6] py-5">
              <div>
                <dt className="text-[#71818A]">Incident Category</dt>
                <dd className="font-semibold text-[#263640] mt-1">{incident.category}</dd>
              </div>
              <div>
                <dt className="text-[#71818A]">Submitted Date & Time</dt>
                <dd className="font-semibold text-[#263640] tabular-nums mt-1">
                  {formatDateTime(incident.reportedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[#71818A]">Current Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={incident.status} />
                </dd>
              </div>
              <div>
                <dt className="text-[#71818A]">Risk Assessment ({severitySource})</dt>
                <dd className="mt-1">
                  <SeverityBadge severity={incident.severity} />
                </dd>
              </div>
            </dl>

            <div className="bg-[#F3F7F8] rounded-lg p-4 text-sm text-[#71818A] space-y-1">
              <p className="font-medium text-[#263640]">Classification Reason</p>
              <p className="leading-relaxed">{severityExplanation}</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#71818A]">
              <PhoneCall className="w-4 h-4 text-[#426B80] shrink-0" aria-hidden="true" />
              <span>
                In a real emergency in India, dial <strong className="text-[#263640]">112</strong> directly.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={`/track?id=${encodeURIComponent(incident.incidentId)}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] transition-colors"
              >
                <span>Track My Report</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setTitle('');
                  setDescription('');
                  setLocation('');
                  setPeopleAffected('1 Person');
                  setContactInformation('');
                  setLatitude(null);
                  setLongitude(null);
                  setLocationAccuracy(null);
                  setLocationTimestamp(null);
                  setGeoStatus('');
                  setGeoError('');
                }}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[#C5D2D8] text-sm font-semibold text-[#263640] hover:bg-[#F3F7F8] transition-colors"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#263640] tracking-tight">
            {t('nav.report', 'Report an Emergency')}
          </h1>
          <p className="text-sm sm:text-base text-[#71818A]">
            Use live GPS location detection, multilingual voice typing, or offline drafts to submit a report reliably.
          </p>
        </div>

        {/* Offline Banner & Draft / Queue Panel */}
        {(!isOnline || savedDraft || offlineQueue.length > 0) && (
          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-4 sm:p-5 space-y-3">
            {!isOnline && (
              <div className="flex items-start gap-2.5 text-sm text-[#7A5011] bg-[#E8AD52]/15 border border-[#E8AD52]/40 rounded-lg p-3">
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">You are currently offline.</p>
                  <p className="text-xs mt-0.5">
                    Reports submitted while offline are queued locally and will only be marked received once the server confirms synchronization.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {savedDraft && (
                  <>
                    <span className="text-[#71818A]">
                      Saved draft ({formatDateTime(savedDraft.savedAt)})
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadDraft}
                      className="px-2.5 py-1 rounded bg-[#E5EEE9] text-[#263640] font-semibold hover:bg-[#D7E6DD]"
                    >
                      Load Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="px-2 py-1 rounded text-[#71818A] hover:text-[#962825]"
                    >
                      Discard
                    </button>
                  </>
                )}
                {draftNotice && <span className="text-[#426B80] font-medium">{draftNotice}</span>}
              </div>
              {offlineQueue.some((q) => q.queueStatus !== 'synced') && isOnline && (
                <button
                  type="button"
                  onClick={syncOfflineQueue}
                  disabled={syncingQueue}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#426B80] text-white font-semibold hover:bg-[#35586A] disabled:opacity-60"
                >
                  <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{syncingQueue ? 'Syncing...' : 'Sync Queued Reports'}</span>
                </button>
              )}
            </div>

            {offlineQueue.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#F3F7F8]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#263640]">
                    Offline Submission Queue ({offlineQueue.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = offlineQueue.filter((q) => q.queueStatus !== 'synced');
                      saveOfflineQueue(remaining);
                      setOfflineQueue(remaining);
                    }}
                    className="text-xs text-[#71818A] hover:text-[#263640] inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>Clear Synced</span>
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {offlineQueue.slice(0, 5).map((item) => (
                    <li
                      key={item.clientSubmissionId}
                      className="flex items-center justify-between gap-2 text-xs bg-[#F3F7F8] rounded-lg px-3 py-2"
                    >
                      <span className="truncate font-medium text-[#263640]">
                        {item.payload.title} ({item.payload.category})
                      </span>
                      <span
                        className={`shrink-0 font-semibold ${
                          item.queueStatus === 'synced'
                            ? 'text-[#2E5A44]'
                            : item.queueStatus === 'failed'
                            ? 'text-[#962825]'
                            : 'text-[#7A5011]'
                        }`}
                      >
                        {item.queueStatus === 'synced'
                          ? `Synced (${item.serverIncidentId})`
                          : item.queueStatus === 'failed'
                          ? 'Sync Failed'
                          : 'Pending Sync'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6 shadow-xs"
        >
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-3 p-4 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#B91C1C]"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {/* 1. Incident Title */}
          <div className="space-y-1.5">
            <label htmlFor="incident-title" className="block text-sm font-semibold text-[#263640]">
              Incident Title <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="incident-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Electrical fire at Sector 9 market"
              required
              aria-invalid={Boolean(errors.title)}
              className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640] placeholder:text-[#71818A]/70 focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
            />
            {errors.title && <p className="text-xs text-[#B91C1C]">{errors.title}</p>}
          </div>

          {/* 2. Category & People Affected */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label
                htmlFor="incident-category"
                className="block text-sm font-semibold text-[#263640]"
              >
                Incident Category <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="incident-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as EmergencyCategory)}
                required
                className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3.5 py-2.5 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
              >
                {EMERGENCY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-[#B91C1C]">{errors.category}</p>}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="incident-people"
                className="block text-sm font-semibold text-[#263640]"
              >
                Number of People Affected <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="incident-people"
                value={peopleAffected}
                onChange={(e) => setPeopleAffected(e.target.value as PeopleAffectedOption)}
                required
                className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3.5 py-2.5 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
              >
                {PEOPLE_AFFECTED_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {errors.peopleAffected && (
                <p className="text-xs text-[#B91C1C]">{errors.peopleAffected}</p>
              )}
            </div>
          </div>

          {/* 3. Live Location Access + Manual Entry */}
          <div className="space-y-3 bg-[#F3F7F8] rounded-xl border border-[#D9E2E6] p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="incident-location"
                  className="block text-sm font-semibold text-[#263640]"
                >
                  Incident Location <span className="text-[#EF4444]">*</span>
                </label>
                <p className="text-xs text-[#71818A] mt-0.5">
                  Shared only with authorized coordinators. Manual entry is always available.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={detectLiveLocation}
                  disabled={geoLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {geoLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : latitude !== null ? (
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {latitude !== null ? 'Refresh Location' : 'Detect My Live Location'}
                  </span>
                </button>
              </div>
            </div>

            {latitude !== null && longitude !== null && (
              <div className="bg-white rounded-lg border border-[#C6D8CE] px-3.5 py-2.5 text-xs text-[#263640] flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono font-semibold text-[#15803D] tabular-nums">
                  GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
                {locationAccuracy !== null && (
                  <span className="text-[#71818A] tabular-nums">
                    Accuracy: ±{locationAccuracy}m
                  </span>
                )}
                {locationTimestamp && (
                  <span className="text-[#71818A] tabular-nums">
                    Captured: {formatDateTime(locationTimestamp)}
                  </span>
                )}
              </div>
            )}

            <input
              id="incident-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Street address, landmark, ward, or sector"
              required
              aria-invalid={Boolean(errors.location)}
              className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3.5 py-2.5 text-sm text-[#263640] placeholder:text-[#71818A]/70 focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
            />

            {geoStatus && <p className="text-xs text-[#426B80]">{geoStatus}</p>}
            {geoError && <p className="text-xs text-[#854D0E]">{geoError}</p>}
            {errors.location && <p className="text-xs text-[#B91C1C]">{errors.location}</p>}
          </div>

          {/* 4. Incident Description + Smart Multilingual Voice Typing */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="incident-description"
                className="block text-sm font-semibold text-[#263640]"
              >
                Incident Description <span className="text-[#EF4444]">*</span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Optional voice typing language"
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  disabled={isListening}
                  className="rounded-lg border border-[#C5D2D8] bg-white px-2.5 py-1.5 text-xs text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
                >
                  {VOICE_LANGUAGES.map((lang) => (
                    <option key={lang.code || 'auto'} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={toggleVoiceTyping}
                  aria-pressed={isListening}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    isListening
                      ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
                      : 'bg-[#E5EEE9] text-[#263640] border border-[#C6D8CE] hover:bg-[#D7E6DD]'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Stop Voice</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                      <span>Voice Typing</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              id="incident-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened in any language (Tamil, English, Hindi, Telugu, Malayalam, Kannada, Urdu, etc.) or tap Voice Typing..."
              required
              aria-invalid={Boolean(errors.description)}
              className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640] placeholder:text-[#71818A]/70 focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
            />

            {interimText && (
              <p className="text-xs text-[#426B80] italic">Transcribing: {interimText}</p>
            )}
            {voiceStatus && <p className="text-xs text-[#71818A]">{voiceStatus}</p>}
            {errors.description && <p className="text-xs text-[#B91C1C]">{errors.description}</p>}
          </div>

          {/* 5. Optional Contact Information & Timestamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label
                htmlFor="incident-contact"
                className="block text-sm font-semibold text-[#263640]"
              >
                Contact Information{' '}
                <span className="text-xs font-normal text-[#71818A]">(Optional)</span>
              </label>
              <input
                id="incident-contact"
                type="text"
                value={contactInformation}
                onChange={(e) => setContactInformation(e.target.value)}
                placeholder="Phone number or email for coordinators"
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640] placeholder:text-[#71818A]/70 focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
              />
              <p className="text-xs text-[#71818A]">
                Visible only to authorized administrators.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-[#263640]">
                Report Date and Time
              </span>
              <div className="rounded-lg border border-[#D9E2E6] bg-[#F3F7F8] px-3.5 py-2.5 text-sm text-[#71818A] tabular-nums">
                {formatDateTime(currentTimestamp)} (Auto-generated)
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#D9E2E6]">
            <p className="text-xs text-[#71818A]">
              Demo platform: For real emergencies in India, dial 112 directly.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg border border-[#C5D2D8] bg-[#F3F7F8] text-xs font-semibold text-[#263640] hover:bg-[#E5EEE9] transition-colors whitespace-nowrap"
              >
                <Save className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                <span>Save Draft</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Recording Report...</span>
                  </>
                ) : (
                  <span>{isOnline ? 'Submit Report' : 'Queue Offline'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}
