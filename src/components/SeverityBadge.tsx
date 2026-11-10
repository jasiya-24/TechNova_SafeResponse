import {
  Flame,
  Car,
  HeartPulse,
  Waves,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import type { EmergencyCategory, IncidentStatus, SeverityLevel } from '../types/incident';

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const styles: Record<SeverityLevel, string> = {
    Low: 'bg-[#22C55E]/15 text-[#15803D] border border-[#22C55E]/40',
    Medium: 'bg-[#FACC15]/25 text-[#854D0E] border border-[#FACC15]/60',
    High: 'bg-[#F97316]/18 text-[#9A3412] border border-[#F97316]/45',
    Critical: 'bg-[#EF4444]/15 text-[#B91C1C] border border-[#EF4444]/40',
    'Risk Assessment Pending': 'bg-slate-100 text-slate-700 border border-slate-300',
  };

  const labels: Record<SeverityLevel, string> = {
    Low: 'LOW RISK',
    Medium: 'MEDIUM RISK',
    High: 'HIGH RISK',
    Critical: 'CRITICAL RISK',
    'Risk Assessment Pending': 'Risk Assessment Pending',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${
        styles[severity] || styles['Risk Assessment Pending']
      }`}
    >
      {labels[severity] || severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const styles: Record<IncidentStatus, string> = {
    Reported: 'bg-[#426B80]/12 text-[#2E4F60] border border-[#426B80]/25',
    Pending: 'bg-[#FACC15]/20 text-[#854D0E] border border-[#FACC15]/50',
    'In Progress': 'bg-[#426B80] text-white border border-[#426B80]',
    Resolved: 'bg-[#E5EEE9] text-[#15803D] border border-[#22C55E]/35',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function CategoryIcon({
  category,
  className = 'w-5 h-5',
}: {
  category: EmergencyCategory | string;
  className?: string;
}) {
  switch (category) {
    case 'Fire':
    case 'Fire Emergency':
      return <Flame className={className} aria-hidden="true" />;
    case 'Road Accident':
      return <Car className={className} aria-hidden="true" />;
    case 'Medical Emergency':
      return <HeartPulse className={className} aria-hidden="true" />;
    case 'Flood':
      return <Waves className={className} aria-hidden="true" />;
    case 'Building Collapse':
      return <Building2 className={className} aria-hidden="true" />;
    default:
      return <AlertTriangle className={className} aria-hidden="true" />;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
