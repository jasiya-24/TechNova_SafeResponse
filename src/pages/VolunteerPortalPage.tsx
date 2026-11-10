import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CheckCircle2,
  MapPin,
  ShieldCheck,
  UserCheck,
  Bell,
  XCircle,
  Loader2,
  Award,
  Layers,
  Route as RouteIcon,
  Play,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import type {
  IncidentRecord,
  MapFacility,
  NotificationRecord,
  ResponderProfile,
  RouteResult,
  VolunteerTask,
  VolunteerTaskStatus,
} from '../types/incident';

const TASK_STATUS_COLORS: Record<VolunteerTaskStatus, string> = {
  NEW: 'bg-[#E5EEE9] text-[#2E5A44]',
  ACCEPTED: 'bg-[#EFF6FF] text-[#1D4ED8]',
  'IN-PROGRESS': 'bg-[#FFFBEB] text-[#B45309]',
  COMPLETED: 'bg-[#DCFCE7] text-[#15803D]',
};

export function VolunteerPortalPage() {
  const [profile, setProfile] = useState<ResponderProfile | null>(null);
  const [demoVolunteers, setDemoVolunteers] = useState<ResponderProfile[]>([]);
  const [selectedDemoId, setSelectedDemoId] = useState<string>('');

  const [assignedTasks, setAssignedTasks] = useState<IncidentRecord[]>([]);
  const [completedTasks, setCompletedTasks] = useState<IncidentRecord[]>([]);
  const [availableOpportunities, setAvailableOpportunities] = useState<IncidentRecord[]>([]);

  const [availableVTasks, setAvailableVTasks] = useState<VolunteerTask[]>([]);
  const [assignedVTasks, setAssignedVTasks] = useState<VolunteerTask[]>([]);
  const [completedVTasks, setCompletedVTasks] = useState<VolunteerTask[]>([]);
  const [facilities, setFacilities] = useState<MapFacility[]>([]);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});
  const [progressNote, setProgressNote] = useState<Record<string, string>>({});
  const [vTaskNote, setVTaskNote] = useState<Record<string, string>>({});

  const [selectedVTaskId, setSelectedVTaskId] = useState<string>('');
  const [taskRoute, setTaskRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const loadVolunteerData = useCallback(async (demoId = selectedDemoId) => {
    setLoading(true);
    try {
      const qs = demoId ? `?demoResponderId=${encodeURIComponent(demoId)}` : '';
      const res = await fetch(`/api/volunteer/dashboard${qs}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as {
          profile: ResponderProfile;
          demoVolunteers?: ResponderProfile[];
          assignedTasks: IncidentRecord[];
          completedTasks: IncidentRecord[];
          availableOpportunities: IncidentRecord[];
          volunteerTasks?: {
            available: VolunteerTask[];
            assigned: VolunteerTask[];
            completed: VolunteerTask[];
          };
          facilities?: MapFacility[];
          notifications: NotificationRecord[];
        };
        setProfile(data.profile);
        setDemoVolunteers(data.demoVolunteers || []);
        setAssignedTasks(data.assignedTasks || []);
        setCompletedTasks(data.completedTasks || []);
        setAvailableOpportunities(data.availableOpportunities || []);
        setAvailableVTasks(data.volunteerTasks?.available || []);
        setAssignedVTasks(data.volunteerTasks?.assigned || []);
        setCompletedVTasks(data.volunteerTasks?.completed || []);
        setFacilities(data.facilities || []);
        setNotifications(data.notifications || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDemoId]);

  useEffect(() => {
    loadVolunteerData(selectedDemoId);
  }, [loadVolunteerData, selectedDemoId]);

  const allMapVTasks = useMemo(
    () => [...assignedVTasks, ...availableVTasks, ...completedVTasks],
    [assignedVTasks, availableVTasks, completedVTasks]
  );

  useEffect(() => {
    if (!selectedVTaskId && allMapVTasks.length > 0) {
      const firstActive = assignedVTasks[0] || availableVTasks[0] || allMapVTasks[0];
      setSelectedVTaskId(firstActive.taskId);
    }
  }, [allMapVTasks, assignedVTasks, availableVTasks, selectedVTaskId]);

  const selectedVTask = useMemo(
    () => allMapVTasks.find((t) => t.taskId === selectedVTaskId) || null,
    [allMapVTasks, selectedVTaskId]
  );

  // Fetch route from volunteer location to selected task
  useEffect(() => {
    if (
      !profile ||
      profile.latitude == null ||
      profile.longitude == null ||
      !selectedVTask
    ) {
      setTaskRoute(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    const params = new URLSearchParams({
      fromLat: String(profile.latitude),
      fromLng: String(profile.longitude),
      toLat: String(selectedVTask.latitude),
      toLng: String(selectedVTask.longitude),
    });

    fetch(`/api/route?${params.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RouteResult | null) => {
        if (!cancelled) setTaskRoute(data);
      })
      .catch(() => {
        if (!cancelled) setTaskRoute(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, selectedVTask]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.62, 77.22],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [loading]);

  // Render Volunteer Map markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    if (profile?.latitude != null && profile?.longitude != null) {
      const vCoords: L.LatLngExpression = [profile.latitude, profile.longitude];
      bounds.push(vCoords);
      const vMarker = L.marker(vCoords, {
        icon: L.divIcon({
          className: 'volunteer-self-marker',
          html: `<div style="width:28px;height:28px;border-radius:9999px;background:#426B80;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);">ME</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: 400,
      });
      vMarker.bindPopup(`<strong>${profile.name}</strong><br/>${profile.location || 'Base'}`);
      vMarker.addTo(layer);
    }

    for (const task of allMapVTasks) {
      const coords: L.LatLngExpression = [task.latitude, task.longitude];
      bounds.push(coords);
      const isSelected = task.taskId === selectedVTaskId;
      const bg =
        task.status === 'COMPLETED'
          ? '#16A34A'
          : task.status === 'IN-PROGRESS'
            ? '#D97706'
            : task.status === 'ACCEPTED'
              ? '#2563EB'
              : '#0F766E';
      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: 'vtask-marker',
          html: `<div style="width:${isSelected ? 28 : 24}px;height:${isSelected ? 28 : 24}px;border-radius:6px;background:${bg};color:#fff;border:2px solid ${isSelected ? '#263640' : '#fff'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 2px 5px rgba(0,0,0,0.28);">VT</div>`,
          iconSize: [isSelected ? 28 : 24, isSelected ? 28 : 24],
          iconAnchor: [12, 12],
        }),
        zIndexOffset: isSelected ? 350 : 150,
      });
      marker.bindPopup(
        `<div style="font-size:12px;">
          <div style="font-family:monospace;font-weight:700;color:${bg};">${task.taskId} · ${task.status}</div>
          <div style="font-weight:600;">${task.title}</div>
          <div style="color:#71818A;">${task.location}</div>
        </div>`
      );
      marker.on('click', () => setSelectedVTaskId(task.taskId));
      marker.addTo(layer);
    }

    for (const fac of facilities.filter(
      (f) => f.category === 'Relief Centre' || f.category === 'Emergency Shelter'
    )) {
      const coords: L.LatLngExpression = [fac.latitude, fac.longitude];
      bounds.push(coords);
      const marker = L.circleMarker(coords, {
        radius: 6,
        fillColor: '#65A30D',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 0.9,
      });
      marker.bindPopup(`<strong>${fac.category}</strong><br/>${fac.name}`);
      marker.addTo(layer);
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 14 });
    }
  }, [profile, allMapVTasks, facilities, selectedVTaskId]);

  // Render Route Line on Volunteer Map
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!taskRoute || taskRoute.coordinates.length < 2) return;

    const isRoad = taskRoute.mode === 'road-route';
    L.polyline(taskRoute.coordinates, {
      color: isRoad ? '#2563EB' : '#D97706',
      weight: isRoad ? 4 : 3,
      opacity: 0.9,
      dashArray: isRoad ? undefined : '8, 8',
    }).addTo(layer);
  }, [taskRoute]);

  const toggleAvailability = async () => {
    if (!profile) return;
    setErrorMessage('');
    const res = await fetch('/api/volunteer/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        available: !profile.available,
        demoResponderId: selectedDemoId || undefined,
      }),
    });
    if (res.ok) {
      setStatusMessage(
        `Availability updated to ${!profile.available ? 'Available' : 'Busy / Unavailable'}.`
      );
      await loadVolunteerData();
    }
  };

  // Support Task Lifecycle Actions (NEW -> ACCEPTED -> IN-PROGRESS -> COMPLETED)
  const handleAcceptVTask = async (taskId: string) => {
    setBusyId(taskId);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/volunteer/vtasks/${encodeURIComponent(taskId)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ demoResponderId: selectedDemoId || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to accept support task.');
      } else {
        setStatusMessage(`Support task ${taskId} accepted (ACCEPTED).`);
        setSelectedVTaskId(taskId);
        await loadVolunteerData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineVTask = async (taskId: string) => {
    setBusyId(taskId);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/volunteer/vtasks/${encodeURIComponent(taskId)}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ demoResponderId: selectedDemoId || undefined }),
      });
      if (res.ok) {
        setStatusMessage(`Support task ${taskId} declined.`);
        await loadVolunteerData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateVTaskStatus = async (taskId: string, status: VolunteerTaskStatus) => {
    setBusyId(taskId);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/volunteer/vtasks/${encodeURIComponent(taskId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status,
          note: vTaskNote[taskId] || '',
          demoResponderId: selectedDemoId || undefined,
        }),
      });
      if (res.ok) {
        setStatusMessage(`Task ${taskId} updated to ${status}.`);
        await loadVolunteerData();
      }
    } finally {
      setBusyId(null);
    }
  };

  // Incident Assignment Actions
  const handleAcceptTask = async (incidentId: string) => {
    setBusyId(incidentId);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/volunteer/tasks/${encodeURIComponent(incidentId)}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to accept task.');
      } else {
        setStatusMessage(`Task ${incidentId} accepted. Status updated to In Progress.`);
        await loadVolunteerData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineTask = async (incidentId: string) => {
    setBusyId(incidentId);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/volunteer/tasks/${encodeURIComponent(incidentId)}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: declineReason[incidentId] || 'Unavailable at this time' }),
      });
      if (res.ok) {
        setStatusMessage(`Task ${incidentId} declined. Coordinator notified for reassignment.`);
        await loadVolunteerData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleProgressUpdate = async (incidentId: string, status: 'In Progress' | 'Resolved') => {
    setBusyId(incidentId);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/volunteer/tasks/${encodeURIComponent(incidentId)}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, note: progressNote[incidentId] || '' }),
      });
      if (res.ok) {
        setStatusMessage(`Updated ${incidentId} to ${status}.`);
        await loadVolunteerData();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Volunteer Operations Portal">
      <div className="space-y-6">
        {/* Volunteer Demo Mode Profile Switcher */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7A5011]">
            <Layers className="w-4 h-4 text-[#E8AD52] shrink-0" aria-hidden="true" />
            <span>
              Volunteer Demo Mode — Switch sample volunteer profiles to test verified/unverified task eligibility &amp; workflows (isolated from real alerts).
            </span>
          </div>
          <select
            aria-label="Switch Volunteer Demo Profile"
            value={selectedDemoId}
            onChange={(e) => {
              setSelectedDemoId(e.target.value);
              setSelectedVTaskId('');
            }}
            className="rounded-lg border border-[#C5D2D8] bg-[#F3F7F8] px-3 py-1.5 text-xs font-semibold text-[#263640]"
          >
            <option value="">My Authenticated Profile</option>
            {demoVolunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} — {v.name} ({v.verified ? 'Verified' : 'Unverified'})
              </option>
            ))}
          </select>
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-[#E5EEE9] border border-[#5D9678]/40 text-xs font-medium text-[#2E5A44]">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div role="alert" className="p-3.5 rounded-xl bg-[#D9534F]/10 border border-[#D9534F]/30 text-xs font-medium text-[#962825]">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-8 text-center text-sm text-[#71818A]">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" aria-hidden="true" />
            Loading volunteer portal...
          </div>
        ) : (
          <>
            {/* Volunteer Profile & Availability + Contribution Summary */}
            {profile && (
              <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#426B80]">{profile.id}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        profile.verified
                          ? 'bg-[#E5EEE9] text-[#2E5A44]'
                          : 'bg-[#E8AD52]/20 text-[#7A5011]'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      {profile.verified ? 'Verified Volunteer' : 'Verification Pending'}
                    </span>
                    <span className="text-xs text-[#71818A] inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                      {profile.location || 'Central District'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[#263640]">{profile.name}</h2>
                  <p className="text-xs text-[#71818A]">
                    Qualification: <strong className="text-[#263640]">{profile.qualification}</strong>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(profile.skills || [profile.qualification]).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md bg-[#F3F7F8] border border-[#D9E2E6] text-[11px] text-[#263640]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 shrink-0">
                  <div className="rounded-xl bg-[#F3F7F8] border border-[#D9E2E6] px-4 py-3 text-center">
                    <p className="text-[11px] text-[#71818A]">Active Tasks</p>
                    <p className="text-xl font-bold text-[#426B80] tabular-nums">
                      {assignedTasks.length + assignedVTasks.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#E5EEE9]/70 border border-[#C6D8CE] px-4 py-3 text-center">
                    <p className="text-[11px] text-[#2E5A44] flex items-center gap-1">
                      <Award className="w-3 h-3" aria-hidden="true" /> Completed
                    </p>
                    <p className="text-xl font-bold text-[#2E5A44] tabular-nums">
                      {profile.completedTasksCount ?? completedTasks.length + completedVTasks.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAvailability}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                      profile.available
                        ? 'bg-[#E5EEE9] text-[#2E5A44] border border-[#5D9678]/40 hover:bg-[#D7E6DD]'
                        : 'bg-[#E8AD52]/20 text-[#7A5011] border border-[#E8AD52]/40'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" aria-hidden="true" />
                    <span>{profile.available ? 'Available for Dispatch' : 'Marked Busy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Volunteer Support Tasks (NEW -> ACCEPTED -> IN-PROGRESS -> COMPLETED) */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#263640]">
                    Volunteer Support Tasks ({assignedVTasks.length} Active · {availableVTasks.length} Available)
                  </h3>
                  <p className="text-xs text-[#71818A]">
                    Safe, skill-matched community support assignments: NEW → ACCEPTED → IN-PROGRESS → COMPLETED.
                  </p>
                </div>
              </div>

              {!profile?.verified && (
                <div className="p-3.5 rounded-xl bg-[#E8AD52]/15 border border-[#E8AD52]/40 text-xs font-medium text-[#7A5011]">
                  Safety Gate: This volunteer profile is currently pending administrator verification. Tasks cannot be accepted until verified.
                </div>
              )}

              {/* Active Assigned Support Tasks */}
              {assignedVTasks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedVTasks.map((task) => (
                    <div
                      key={task.taskId}
                      className={`bg-white rounded-xl border p-4 space-y-3 ${
                        selectedVTaskId === task.taskId ? 'border-[#426B80] ring-1 ring-[#426B80]/30' : 'border-[#D9E2E6]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#426B80]">{task.taskId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TASK_STATUS_COLORS[task.status]}`}>
                          {task.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#5D9678]">{task.taskType}</p>
                        <h4 className="text-sm font-bold text-[#263640]">{task.title}</h4>
                        <p className="text-xs text-[#71818A] mt-1">{task.description}</p>
                        <p className="text-xs text-[#71818A] flex items-center gap-1 mt-1.5">
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{task.location}</span>
                        </p>
                      </div>

                      <input
                        type="text"
                        value={vTaskNote[task.taskId] || ''}
                        onChange={(e) => setVTaskNote((p) => ({ ...p, [task.taskId]: e.target.value }))}
                        placeholder="Add progress note..."
                        className="w-full rounded-lg border border-[#C5D2D8] px-3 py-1.5 text-xs text-[#263640]"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVTaskId(task.taskId)}
                          className="px-3 py-1.5 rounded-lg border border-[#C5D2D8] text-xs font-semibold text-[#263640] hover:bg-[#F3F7F8]"
                        >
                          Show Route
                        </button>
                        {task.status === 'ACCEPTED' && (
                          <button
                            type="button"
                            disabled={busyId === task.taskId}
                            onClick={() => handleUpdateVTaskStatus(task.taskId, 'IN-PROGRESS')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A]"
                          >
                            <Play className="w-3 h-3" aria-hidden="true" />
                            <span>Start Task</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === task.taskId}
                          onClick={() => handleUpdateVTaskStatus(task.taskId, 'COMPLETED')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5D9678] text-white text-xs font-semibold hover:bg-[#497A60]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Mark Completed</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Available NEW Support Tasks */}
              {availableVTasks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableVTasks.map((task) => (
                    <div
                      key={task.taskId}
                      className={`bg-white rounded-xl border p-4 space-y-2.5 ${
                        selectedVTaskId === task.taskId ? 'border-[#426B80]' : 'border-[#D9E2E6]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#426B80]">{task.taskId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TASK_STATUS_COLORS[task.status]}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-[#5D9678]">{task.taskType}</p>
                      <h4 className="text-sm font-bold text-[#263640]">{task.title}</h4>
                      <p className="text-xs text-[#71818A]">{task.description}</p>
                      <p className="text-xs text-[#71818A] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{task.location}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyId === task.taskId}
                          onClick={() => handleAcceptVTask(task.taskId)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#5D9678] text-white text-xs font-semibold hover:bg-[#497A60]"
                        >
                          Accept Task
                        </button>
                        <button
                          type="button"
                          disabled={busyId === task.taskId}
                          onClick={() => handleDeclineVTask(task.taskId)}
                          className="px-3 py-1.5 rounded-lg bg-[#D9534F]/10 text-[#962825] text-xs font-semibold hover:bg-[#D9534F]/20"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVTaskId(task.taskId)}
                          className="px-3 py-1.5 rounded-lg border border-[#C5D2D8] text-xs font-semibold text-[#263640] hover:bg-[#F3F7F8] ml-auto"
                        >
                          View on Map
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Interactive Volunteer Task Map & Route */}
            <section className="bg-white rounded-xl border border-[#D9E2E6] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#D9E2E6] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#263640] flex items-center gap-2">
                    <RouteIcon className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                    <span>Volunteer Task &amp; Relief Hub Map</span>
                  </h3>
                  <p className="text-xs text-[#71818A]">
                    Shows your base location (ME), support tasks (VT), relief centres, and route to the selected task.
                  </p>
                </div>
                {routeLoading ? (
                  <span className="text-xs text-[#71818A]">Calculating route...</span>
                ) : taskRoute ? (
                  <span
                    data-testid="volunteer-route-summary"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      taskRoute.mode === 'road-route'
                        ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                        : 'bg-[#FFFBEB] text-[#B45309]'
                    }`}
                  >
                    {selectedVTask?.taskId}: {taskRoute.label}
                  </span>
                ) : null}
              </div>
              <div
                ref={mapContainerRef}
                data-testid="volunteer-map-canvas"
                className="w-full h-[340px] bg-[#E5EEE9]/30"
              />
            </section>

            {/* Assigned Incident Tasks */}
            <section className="space-y-3">
              <h3 className="text-base font-bold text-[#263640]">
                Assigned Incident Responses ({assignedTasks.length})
              </h3>
              {assignedTasks.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 text-sm text-[#71818A]">
                  No active incident assignments right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {assignedTasks.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono font-semibold text-[#426B80]">
                              {inc.incidentId}
                            </span>
                            <SeverityBadge severity={inc.severity} />
                            <StatusBadge status={inc.status} />
                          </div>
                          <h4 className="text-base font-bold text-[#263640]">{inc.title}</h4>
                          <p className="text-xs text-[#71818A] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{inc.location}</span>
                          </p>
                        </div>

                        {!inc.acceptedAt ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === inc.incidentId}
                              onClick={() => handleAcceptTask(inc.incidentId)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#5D9678] text-white text-xs font-semibold hover:bg-[#497A60]"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Accept Assignment</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === inc.incidentId}
                              onClick={() => handleDeclineTask(inc.incidentId)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D9534F]/10 text-[#962825] text-xs font-semibold hover:bg-[#D9534F]/20"
                            >
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Decline</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E5EEE9] text-[#2E5A44] text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Response Active
                          </span>
                        )}
                      </div>

                      {!inc.acceptedAt ? (
                        <input
                          type="text"
                          value={declineReason[inc.incidentId] || ''}
                          onChange={(e) =>
                            setDeclineReason((p) => ({ ...p, [inc.incidentId]: e.target.value }))
                          }
                          placeholder="Optional reason if declining..."
                          className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-xs text-[#263640]"
                        />
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#F3F7F8]">
                          <input
                            type="text"
                            value={progressNote[inc.incidentId] || ''}
                            onChange={(e) =>
                              setProgressNote((p) => ({ ...p, [inc.incidentId]: e.target.value }))
                            }
                            placeholder="Add field progress update note..."
                            className="flex-1 rounded-lg border border-[#C5D2D8] px-3 py-2 text-xs text-[#263640]"
                          />
                          <button
                            type="button"
                            disabled={busyId === inc.incidentId}
                            onClick={() => handleProgressUpdate(inc.incidentId, 'In Progress')}
                            className="px-3.5 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A]"
                          >
                            Log Progress
                          </button>
                          <button
                            type="button"
                            disabled={busyId === inc.incidentId}
                            onClick={() => handleProgressUpdate(inc.incidentId, 'Resolved')}
                            className="px-3.5 py-2 rounded-lg bg-[#5D9678] text-white text-xs font-semibold hover:bg-[#497A60]"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Available Eligible Opportunities (Safety-Gated) */}
            {availableOpportunities.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-base font-bold text-[#263640]">
                    Available Eligible Incident Opportunities ({availableOpportunities.length})
                  </h3>
                  <p className="text-xs text-[#71818A]">
                    Safety-screened incidents matching your verified qualification ({profile?.qualification}).
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableOpportunities.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="bg-white rounded-xl border border-[#D9E2E6] p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#426B80]">{inc.incidentId}</span>
                        <SeverityBadge severity={inc.severity} />
                      </div>
                      <h4 className="text-sm font-bold text-[#263640]">{inc.title}</h4>
                      <p className="text-xs text-[#71818A]">{inc.location}</p>
                      <button
                        type="button"
                        disabled={busyId === inc.incidentId}
                        onClick={() => handleAcceptTask(inc.incidentId)}
                        className="w-full py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A]"
                      >
                        Volunteer &amp; Accept Task
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Volunteer Notifications & Completed History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-3">
                <h3 className="text-base font-bold text-[#263640] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Assignment Notifications ({notifications.length})</span>
                </h3>
                {notifications.length === 0 ? (
                  <p className="text-xs text-[#71818A]">No assignment notifications yet.</p>
                ) : (
                  <ul className="divide-y divide-[#F3F7F8]">
                    {notifications.slice(0, 5).map((n) => (
                      <li key={n.id} className="py-2.5 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#263640]">{n.title}</span>
                          <span className="text-[#71818A] tabular-nums">
                            {formatDateTime(n.timestamp)}
                          </span>
                        </div>
                        <p className="text-[#71818A]">{n.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-3">
                <h3 className="text-base font-bold text-[#263640]">
                  Completed Contribution History ({completedTasks.length + completedVTasks.length})
                </h3>
                {completedTasks.length === 0 && completedVTasks.length === 0 ? (
                  <p className="text-xs text-[#71818A]">Completed tasks will appear here.</p>
                ) : (
                  <ul className="divide-y divide-[#F3F7F8]">
                    {completedVTasks.map((vt) => (
                      <li key={vt.taskId} className="py-2.5 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-[#0F766E]">{vt.taskId}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TASK_STATUS_COLORS.COMPLETED}`}>
                            COMPLETED
                          </span>
                        </div>
                        <p className="font-medium text-[#263640]">{vt.title}</p>
                        <p className="text-[#71818A]">
                          {vt.completedAt ? `Completed ${formatDateTime(vt.completedAt)}` : vt.taskType}
                        </p>
                      </li>
                    ))}
                    {completedTasks.map((inc) => (
                      <li key={inc.incidentId} className="py-2.5 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-[#426B80]">
                            {inc.incidentId}
                          </span>
                          <StatusBadge status={inc.status} />
                        </div>
                        <p className="font-medium text-[#263640]">{inc.title}</p>
                        <p className="text-[#71818A]">
                          Resolved {inc.resolvedAt ? formatDateTime(inc.resolvedAt) : formatDateTime(inc.updatedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
