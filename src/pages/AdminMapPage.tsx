import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Route as RouteIcon,
  Shield,
  Users,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { SeverityBadge, StatusBadge } from '../components/SeverityBadge';
import { useAdminIncidents } from '../hooks/useAdminIncidents';
import { recommendTeamsForIncident } from '../utils/mapRouting';
import {
  EMERGENCY_CATEGORIES,
  INCIDENT_STATUSES,
  SEVERITY_LEVELS,
  type EmergencyCategory,
  type IncidentStatus,
  type MapFacility,
  type MapFacilityCategory,
  type ResponseTeam,
  type RouteResult,
  type SeverityLevel,
  type VolunteerTask,
} from '../types/incident';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  Low: '#22C55E',
  Medium: '#FACC15',
  High: '#F97316',
  Critical: '#EF4444',
  'Risk Assessment Pending': '#64748B',
};

const TEAM_COLORS: Record<'Fire' | 'Medical' | 'Rescue', string> = {
  Fire: '#DC2626',
  Medical: '#0D9488',
  Rescue: '#4338CA',
};

const FACILITY_COLORS: Record<MapFacilityCategory, { bg: string; code: string }> = {
  Hospital: { bg: '#0284C7', code: 'H' },
  Clinic: { bg: '#0891B2', code: 'C' },
  Doctor: { bg: '#2563EB', code: 'Dr' },
  'Relief Centre': { bg: '#16A34A', code: 'RC' },
  'Emergency Shelter': { bg: '#65A30D', code: 'SH' },
  College: { bg: '#7C3AED', code: 'CL' },
};

function createBadgeIcon(label: string, bg: string, border = '#FFFFFF', size = 26, ring = false): L.DivIcon {
  const shadow = ring
    ? '0 0 0 4px rgba(66, 107, 128, 0.45), 0 2px 6px rgba(0,0,0,0.35)'
    : '0 2px 5px rgba(0,0,0,0.28)';
  return L.divIcon({
    className: 'saferesponse-map-marker',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};color:#fff;border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:system-ui,sans-serif;box-shadow:${shadow};">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createSquareIcon(label: string, bg: string, border = '#FFFFFF'): L.DivIcon {
  return L.divIcon({
    className: 'saferesponse-map-marker',
    html: `<div style="width:24px;height:24px;border-radius:6px;background:${bg};color:#fff;border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:system-ui,sans-serif;box-shadow:0 2px 5px rgba(0,0,0,0.25);">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function AdminMapPage() {
  const { incidents, loading, refresh } = useAdminIncidents();

  const [teams, setTeams] = useState<ResponseTeam[]>([]);
  const [facilities, setFacilities] = useState<MapFacility[]>([]);
  const [volunteerTasks, setVolunteerTasks] = useState<VolunteerTask[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<EmergencyCategory | ''>('');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | ''>('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');

  const [showIncidents, setShowIncidents] = useState(true);
  const [showTeams, setShowTeams] = useState(true);
  const [showMedical, setShowMedical] = useState(true);
  const [showRelief, setShowRelief] = useState(true);
  const [showVolunteerTasks, setShowVolunteerTasks] = useState(true);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  const [updatingTeamId, setUpdatingTeamId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const hasFittedBoundsRef = useRef(false);

  const loadMapEntities = useCallback(async () => {
    try {
      const [tRes, fRes, vRes] = await Promise.all([
        fetch('/api/admin/teams', { credentials: 'include' }),
        fetch('/api/admin/facilities', { credentials: 'include' }),
        fetch('/api/admin/volunteer-tasks', { credentials: 'include' }),
      ]);
      if (tRes.ok) {
        const td = (await tRes.json()) as { teams: ResponseTeam[] };
        setTeams(td.teams || []);
      }
      if (fRes.ok) {
        const fd = (await fRes.json()) as { facilities: MapFacility[] };
        setFacilities(fd.facilities || []);
      }
      if (vRes.ok) {
        const vd = (await vRes.json()) as { tasks: VolunteerTask[] };
        setVolunteerTasks(vd.tasks || []);
      }
    } catch {
      // Keep UI resilient
    }
  }, []);

  useEffect(() => {
    loadMapEntities();
  }, [loadMapEntities]);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (categoryFilter && inc.category !== categoryFilter) return false;
      if (severityFilter && inc.severity !== severityFilter) return false;
      if (statusFilter && inc.status !== statusFilter) return false;
      return true;
    });
  }, [incidents, categoryFilter, severityFilter, statusFilter]);

  const mappedIncidents = useMemo(
    () => filtered.filter((inc) => inc.latitude !== null && inc.longitude !== null),
    [filtered]
  );

  const unmappedIncidents = useMemo(
    () => filtered.filter((inc) => inc.latitude === null || inc.longitude === null),
    [filtered]
  );

  // Default select first mapped incident with an assigned team in the local cluster so route line is immediately visible
  useEffect(() => {
    if (!selectedIncidentId && mappedIncidents.length > 0) {
      const withTeam =
        mappedIncidents.find(
          (i) => i.assignedTeamId && i.status !== 'Resolved' && (i.latitude ?? 0) > 20
        ) || mappedIncidents.find((i) => i.assignedTeamId && i.status !== 'Resolved');
      setSelectedIncidentId((withTeam || mappedIncidents[0]).incidentId);
    }
  }, [mappedIncidents, selectedIncidentId]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.incidentId === selectedIncidentId) || null,
    [incidents, selectedIncidentId]
  );

  const assignedTeam = useMemo(() => {
    if (!selectedIncident?.assignedTeamId) return null;
    return teams.find((t) => t.teamId === selectedIncident.assignedTeamId) || null;
  }, [selectedIncident, teams]);

  const recommendedTeams = useMemo(() => {
    if (!selectedIncident) return [];
    return recommendTeamsForIncident(selectedIncident, teams);
  }, [selectedIncident, teams]);

  // Fetch route when selectedIncident + assignedTeam have coordinates
  useEffect(() => {
    if (
      !selectedIncident ||
      selectedIncident.latitude == null ||
      selectedIncident.longitude == null ||
      !assignedTeam ||
      assignedTeam.latitude == null ||
      assignedTeam.longitude == null
    ) {
      setRouteResult(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    const params = new URLSearchParams({
      fromLat: String(assignedTeam.latitude),
      fromLng: String(assignedTeam.longitude),
      toLat: String(selectedIncident.latitude),
      toLng: String(selectedIncident.longitude),
    });

    fetch(`/api/route?${params.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RouteResult | null) => {
        if (!cancelled) setRouteResult(data);
      })
      .catch(() => {
        if (!cancelled) setRouteResult(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIncident, assignedTeam]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.622, 77.22],
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // Render all map markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    // 1. Emergency Incidents
    if (showIncidents) {
      for (const inc of mappedIncidents) {
        if (inc.latitude === null || inc.longitude === null) continue;
        const coords: L.LatLngExpression = [inc.latitude, inc.longitude];
        if (inc.latitude > 20) bounds.push(coords);

        const isSelected = inc.incidentId === selectedIncidentId;
        const color = SEVERITY_COLORS[inc.severity];
        const marker = L.marker(coords, {
          icon: createBadgeIcon('!', color, isSelected ? '#263640' : '#FFFFFF', isSelected ? 30 : 24, isSelected),
          zIndexOffset: isSelected ? 500 : 200,
        });

        const popupEl = document.createElement('div');
        popupEl.className = 'text-xs space-y-1 min-w-[190px]';
        popupEl.innerHTML = `
          <div style="font-family: monospace; font-weight: 700; color: #426B80;">${inc.incidentId}</div>
          <div style="font-weight: 600; color: #263640;">${inc.category}: ${inc.title}</div>
          <div style="color: #263640;">Severity: <strong>${inc.severity}</strong> · Status: <strong>${inc.status}</strong></div>
          <div style="color: #71818A;">${inc.location}</div>
          ${inc.assignedTeamName ? `<div style="color: #0D9488; font-weight: 600;">Team: ${inc.assignedTeamName}</div>` : '<div style="color: #D97706;">No team assigned</div>'}
        `;
        marker.bindPopup(popupEl);
        marker.on('click', () => {
          setSelectedIncidentId(inc.incidentId);
        });
        marker.addTo(layer);
      }
    }

    // 2. Response Teams (Fire, Medical, Rescue)
    if (showTeams) {
      for (const team of teams) {
        if (team.latitude == null || team.longitude == null) continue;
        const coords: L.LatLngExpression = [team.latitude, team.longitude];
        bounds.push(coords);
        const type = team.teamType || 'Rescue';
        const code = type === 'Fire' ? 'FT' : type === 'Medical' ? 'MT' : 'RT';
        const color = TEAM_COLORS[type];
        const border = team.available ? '#22C55E' : '#F59E0B';
        const marker = L.marker(coords, {
          icon: createSquareIcon(code, color, border),
          zIndexOffset: 300,
        });
        marker.bindPopup(
          `<div style="font-size:12px;min-width:180px;">
            <div style="font-weight:700;color:${color};">${team.teamName}</div>
            <div>Type: <strong>${type} Team</strong> · Status: <strong>${team.status}</strong></div>
            <div>Lead: ${team.leadName} (${team.memberCount} members)</div>
            <div style="color:#71818A;">${team.district}</div>
          </div>`
        );
        marker.addTo(layer);
      }
    }

    // 3. Facilities (Medical & Relief/Shelter/College)
    for (const fac of facilities) {
      const isMedical = fac.category === 'Hospital' || fac.category === 'Clinic' || fac.category === 'Doctor';
      if (isMedical && !showMedical) continue;
      if (!isMedical && !showRelief) continue;

      const coords: L.LatLngExpression = [fac.latitude, fac.longitude];
      bounds.push(coords);
      const style = FACILITY_COLORS[fac.category];
      const marker = L.marker(coords, {
        icon: createBadgeIcon(style.code, style.bg, '#FFFFFF', 24, false),
        zIndexOffset: 100,
      });
      marker.bindPopup(
        `<div style="font-size:12px;min-width:180px;">
          <div style="font-weight:700;color:${style.bg};">${fac.category}</div>
          <div style="font-weight:600;color:#263640;">${fac.name}</div>
          <div style="color:#71818A;">${fac.address}</div>
          ${fac.capacity ? `<div style="margin-top:2px;">${fac.capacity}</div>` : ''}
        </div>`
      );
      marker.addTo(layer);
    }

    // 4. Volunteer Tasks
    if (showVolunteerTasks) {
      for (const task of volunteerTasks) {
        const coords: L.LatLngExpression = [task.latitude, task.longitude];
        bounds.push(coords);
        const marker = L.marker(coords, {
          icon: createSquareIcon('VT', '#0F766E', '#FFFFFF'),
          zIndexOffset: 150,
        });
        marker.bindPopup(
          `<div style="font-size:12px;min-width:180px;">
            <div style="font-family:monospace;font-weight:700;color:#0F766E;">${task.taskId} · ${task.status}</div>
            <div style="font-weight:600;color:#263640;">${task.title}</div>
            <div style="color:#71818A;">${task.taskType}</div>
            <div style="color:#71818A;">${task.location}</div>
          </div>`
        );
        marker.addTo(layer);
      }
    }

    if (bounds.length > 0 && !hasFittedBoundsRef.current) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [35, 35], maxZoom: 14 });
      hasFittedBoundsRef.current = true;
    }
  }, [
    mappedIncidents,
    teams,
    facilities,
    volunteerTasks,
    selectedIncidentId,
    showIncidents,
    showTeams,
    showMedical,
    showRelief,
    showVolunteerTasks,
  ]);

  // Render Route Line between Assigned Team and Selected Incident
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;
    routeLayer.clearLayers();

    if (!routeResult || routeResult.coordinates.length < 2) return;

    const isRoad = routeResult.mode === 'road-route';
    const polyline = L.polyline(routeResult.coordinates, {
      color: isRoad ? '#2563EB' : '#D97706',
      weight: isRoad ? 5 : 4,
      opacity: 0.9,
      dashArray: isRoad ? undefined : '8, 8',
    });

    polyline.bindPopup(
      `<div style="font-size:12px;">
        <strong>${selectedIncident?.incidentId || ''} ↔ ${assignedTeam?.teamName || ''}</strong><br/>
        <span>${routeResult.label}</span>
      </div>`
    );
    polyline.addTo(routeLayer);
  }, [routeResult, selectedIncident, assignedTeam]);

  const handleAssignTeam = async (incidentId: string, teamId: string) => {
    setAssigningTeamId(teamId);
    setActionMessage('');
    try {
      const res = await fetch(`/api/admin/incidents/${encodeURIComponent(incidentId)}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId }),
      });
      if (res.ok) {
        setActionMessage(`Team assigned to ${incidentId}. Route line updated.`);
        await Promise.all([refresh(), loadMapEntities()]);
      }
    } finally {
      setAssigningTeamId(null);
    }
  };

  const handleStatusChange = async (incidentId: string, status: IncidentStatus) => {
    setActionMessage('');
    const res = await fetch(`/api/admin/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setActionMessage(`Updated ${incidentId} status to ${status}.`);
      await refresh();
    }
  };

  const handleToggleTeamAvailability = async (team: ResponseTeam) => {
    setUpdatingTeamId(team.teamId);
    try {
      const res = await fetch(`/api/admin/teams/${encodeURIComponent(team.teamId)}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ available: !team.available }),
      });
      if (res.ok) {
        setActionMessage(`${team.teamName} marked ${!team.available ? 'Available' : 'Deployed'}.`);
        await loadMapEntities();
      }
    } finally {
      setUpdatingTeamId(null);
    }
  };

  return (
    <AdminLayout title="Interactive Emergency & Route Map">
      <div className="space-y-5">
        {actionMessage && (
          <div className="p-3 rounded-lg bg-[#E5EEE9] border border-[#5D9678]/40 text-xs font-medium text-[#2E5A44] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Filters & Layer Controls */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              aria-label="Filter map by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as EmergencyCategory | '')}
              className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640]"
            >
              <option value="">All Incident Categories</option>
              {EMERGENCY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter map by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | '')}
              className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640]"
            >
              <option value="">All Severities</option>
              {SEVERITY_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter map by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | '')}
              className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640]"
            >
              <option value="">All Statuses</option>
              {INCIDENT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              aria-label="Select incident for route inspection"
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="w-full rounded-lg border border-[#426B80] bg-[#F3F7F8] px-3 py-2 text-sm font-medium text-[#263640]"
            >
              <option value="">Select Incident for Route...</option>
              {mappedIncidents.map((inc) => (
                <option key={inc.incidentId} value={inc.incidentId}>
                  {inc.incidentId} — {inc.category} ({inc.status})
                </option>
              ))}
            </select>
          </div>

          {/* Layer Toggles */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-[#F3F7F8]">
            <span className="font-semibold text-[#263640]">Map Layers:</span>
            {[
              { label: 'Incidents (!)', checked: showIncidents, set: setShowIncidents },
              { label: 'Response Teams (FT/MT/RT)', checked: showTeams, set: setShowTeams },
              { label: 'Hospitals, Clinics & Doctors', checked: showMedical, set: setShowMedical },
              { label: 'Relief Centres, Shelters & Colleges', checked: showRelief, set: setShowRelief },
              { label: 'Volunteer Tasks (VT)', checked: showVolunteerTasks, set: setShowVolunteerTasks },
            ].map((layer) => (
              <label key={layer.label} className="inline-flex items-center gap-1.5 cursor-pointer text-[#263640]">
                <input
                  type="checkbox"
                  checked={layer.checked}
                  onChange={(e) => layer.set(e.target.checked)}
                  className="rounded border-[#C5D2D8] text-[#426B80]"
                />
                <span>{layer.label}</span>
              </label>
            ))}

            {(categoryFilter || severityFilter || statusFilter) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('');
                  setSeverityFilter('');
                  setStatusFilter('');
                }}
                className="inline-flex items-center gap-1 font-semibold text-[#426B80] hover:underline ml-auto"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          {/* Clear Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#71818A]">
            <span className="font-semibold text-[#263640]">Legend:</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block" /> Critical</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#F97316] inline-block" /> High</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#FACC15] inline-block" /> Medium</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22C55E] inline-block" /> Low</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#DC2626] inline-block" /> FT Fire Team</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#0D9488] inline-block" /> MT Medical Team</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#4338CA] inline-block" /> RT Rescue Team</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#0284C7] inline-block" /> Hospital / Clinic / Dr</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#16A34A] inline-block" /> Relief / Shelter</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#7C3AED] inline-block" /> College</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#0F766E] inline-block" /> VT Volunteer Task</span>
          </div>
        </div>

        {/* Map + Selected Incident Command Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#D9E2E6] overflow-hidden flex flex-col">
            <div
              ref={mapContainerRef}
              data-testid="incident-map-canvas"
              className="w-full h-[460px] sm:h-[520px] bg-[#E5EEE9]/30"
            />
            <div className="px-4 py-3 border-t border-[#D9E2E6] text-xs text-[#71818A] flex flex-wrap items-center justify-between gap-2">
              <span className="tabular-nums">
                {mappedIncidents.length} incidents · {teams.length} response teams · {facilities.length} facilities · {volunteerTasks.length} volunteer tasks
              </span>
              <span className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-[#2563EB] inline-block" /> Road Route
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-[#D97706] inline-block" /> Straight-line fallback
                </span>
              </span>
            </div>
          </div>

          {/* Selected Incident & Route Inspection Panel */}
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#263640] flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                <span>Dispatch &amp; Route Inspector</span>
              </h2>
              {selectedIncident && (
                <Link
                  to={`/admin/incidents/${encodeURIComponent(selectedIncident.incidentId)}`}
                  className="text-xs font-semibold text-[#426B80] hover:underline"
                >
                  Full Dossier →
                </Link>
              )}
            </div>

            {!selectedIncident ? (
              <p className="text-xs text-[#71818A]">
                Click an incident marker on the map or select one above to inspect its route line and recommended teams.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-[#F3F7F8] border border-[#D9E2E6] space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#426B80]">
                      {selectedIncident.incidentId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <SeverityBadge severity={selectedIncident.severity} />
                      <StatusBadge status={selectedIncident.status} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#263640]">{selectedIncident.title}</p>
                  <p className="text-xs text-[#71818A]">{selectedIncident.location}</p>
                  <div className="pt-1 flex items-center gap-2">
                    <label className="text-[11px] font-medium text-[#71818A]">Status:</label>
                    <select
                      aria-label="Update selected incident status"
                      value={selectedIncident.status}
                      onChange={(e) =>
                        handleStatusChange(selectedIncident.incidentId, e.target.value as IncidentStatus)
                      }
                      className="rounded border border-[#C5D2D8] bg-white px-2 py-1 text-xs text-[#263640]"
                    >
                      {INCIDENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Assigned Team & Route Line Info */}
                <div className="p-3.5 rounded-lg border border-[#D9E2E6] space-y-1.5">
                  <p className="text-xs font-semibold text-[#263640] flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                    <span>Assigned Team &amp; Route</span>
                  </p>
                  {assignedTeam ? (
                    <>
                      <p className="text-xs font-bold text-[#0D9488]">{assignedTeam.teamName}</p>
                      <p className="text-[11px] text-[#71818A]">
                        Lead: {assignedTeam.leadName} · {assignedTeam.teamType || 'Rescue'} Team
                      </p>
                      {routeLoading ? (
                        <p className="text-xs text-[#71818A] flex items-center gap-1.5 pt-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          <span>Calculating route...</span>
                        </p>
                      ) : routeResult ? (
                        <div
                          data-testid="map-route-summary"
                          className={`mt-1.5 p-2 rounded text-xs font-medium ${
                            routeResult.mode === 'road-route'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                              : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                          }`}
                        >
                          {routeResult.label}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-[#71818A]">
                      No response team assigned yet. Assign a recommended team below to draw the route line.
                    </p>
                  )}
                </div>

                {/* Recommended Teams */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#263640] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                    <span>Recommended Response Teams</span>
                  </p>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {recommendedTeams.slice(0, 4).map(({ team, distanceKm, reason }) => {
                      const isCurrent = selectedIncident.assignedTeamId === team.teamId;
                      return (
                        <div
                          key={team.teamId}
                          className="p-2.5 rounded-lg border border-[#D9E2E6] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[#263640] truncate">{team.teamName}</p>
                            <p className="text-[11px] text-[#71818A] truncate">
                              {distanceKm !== null ? `${distanceKm} km · ` : ''}
                              {reason}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={assigningTeamId === team.teamId || isCurrent}
                            onClick={() => handleAssignTeam(selectedIncident.incidentId, team.teamId)}
                            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold shrink-0 ${
                              isCurrent
                                ? 'bg-[#E5EEE9] text-[#2E5A44]'
                                : 'bg-[#426B80] text-white hover:bg-[#35586A]'
                            }`}
                          >
                            {isCurrent
                              ? 'Assigned'
                              : assigningTeamId === team.teamId
                                ? 'Assigning...'
                                : selectedIncident.assignedTeamId
                                  ? 'Reassign'
                                  : 'Assign'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Availability Quick Control */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#263640] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
              <span>Response Team Availability ({teams.filter((t) => t.available).length} Available / {teams.length} Total)</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {teams.map((team) => (
              <div
                key={team.teamId}
                className="rounded-lg border border-[#D9E2E6] p-3 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#263640] truncate">{team.teamName}</p>
                  <p className="text-[11px] text-[#71818A]">
                    {team.teamType || 'Rescue'} · {team.district}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={updatingTeamId === team.teamId}
                  onClick={() => handleToggleTeamAvailability(team)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                    team.available
                      ? 'bg-[#E5EEE9] text-[#2E5A44] hover:bg-[#D7E6DD]'
                      : 'bg-[#E8AD52]/20 text-[#7A5011] hover:bg-[#E8AD52]/30'
                  }`}
                >
                  {team.available ? 'Available' : 'Deployed'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Separate list for reports without verified coordinates */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#263640]">
                Reports Without Verified Coordinates ({unmappedIncidents.length})
              </h2>
              <p className="text-xs text-[#71818A] mt-0.5">
                Incidents submitted without GPS coordinates are listed here rather than placed at guessed locations.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[#71818A]">Loading...</p>
          ) : unmappedIncidents.length === 0 ? (
            <p className="text-sm text-[#71818A]">
              All filtered incidents currently have verified coordinates.
            </p>
          ) : (
            <div className="divide-y divide-[#F3F7F8]">
              {unmappedIncidents.map((inc) => (
                <div
                  key={inc.incidentId}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-[#71818A]">
                      <span className="font-mono font-semibold text-[#426B80] tabular-nums">
                        {inc.incidentId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{inc.category}</span>
                    </div>
                    <p className="text-sm font-medium text-[#263640]">{inc.title}</p>
                    <p className="text-xs text-[#71818A] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{inc.location}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={inc.severity} />
                    <StatusBadge status={inc.status} />
                    <Link
                      to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                      className="ml-2 text-xs font-semibold text-[#426B80] hover:underline"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
