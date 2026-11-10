import { Link } from 'react-router-dom';
import { ArrowRight, PhoneCall, ShieldAlert, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { CategoryIcon } from '../components/SeverityBadge';
import { useLanguage } from '../context/LanguageContext';
import { EMERGENCY_CATEGORIES, type EmergencyCategory } from '../types/incident';

const CATEGORY_DESCRIPTIONS: Record<EmergencyCategory, string> = {
  Fire: 'Structural fires, electrical sparks, smoke, or hazardous flames.',
  'Road Accident': 'Vehicle collisions, highway blockages, or commuter injuries.',
  'Medical Emergency': 'Sudden illness, trauma, cardiac distress, or urgent aid.',
  Flood: 'Waterlogging, rising water levels, or stranded residents.',
  'Building Collapse': 'Structural failure, wall collapse, or trapped individuals.',
  Other: 'Fallen trees, utility hazards, or community safety threats.',
};

export function HomePage() {
  const { t } = useLanguage();

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="bg-white border-b border-[#D9E2E6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-medium text-[#426B80]">
                  Citizen Emergency Help &amp; Support Portal
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-[#263640] leading-[1.15] text-balance">
                  {t('hero.title', 'Emergency Help Starts Here')}
                </h1>
                <p className="text-base sm:text-lg text-[#71818A] leading-relaxed max-w-xl">
                  {t(
                    'hero.subtitle',
                    'Report an emergency in seconds, share your live location with consent, and track real-time response updates from your Citizen Dashboard.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/sos"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#D9534F] text-white text-sm font-semibold hover:bg-[#B83E3A] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9534F]"
                >
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  <span>{t('hero.sos', 'Emergency SOS Quick Report')}</span>
                </Link>
                <Link
                  to="/report"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426B80]"
                >
                  <span>{t('hero.cta', 'Report an Emergency')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/citizen/login"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-[#E5EEE9] border border-[#C6D8CE] text-[#263640] text-sm font-semibold hover:bg-[#D7E6DD] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426B80]"
                >
                  Citizen Login / Dashboard
                </Link>
                <Link
                  to="/track"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-[#F3F7F8] border border-[#C5D2D8] text-[#263640] text-sm font-semibold hover:bg-[#E5EEE9] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426B80]"
                >
                  {t('hero.track', 'Track My Report')}
                </Link>
              </div>

              <div className="pt-2 flex items-start gap-3 text-xs sm:text-sm text-[#71818A]">
                <PhoneCall className="w-4 h-4 text-[#426B80] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  In a life-threatening emergency in India, dial <strong className="text-[#263640] tabular-nums">112</strong> directly for official dispatch services.
                </span>
              </div>
            </div>

            <div className="lg:col-span-6 flex items-stretch">
              <div className="w-full rounded-2xl overflow-hidden border border-[#D9E2E6] bg-[#E5EEE9]/40 relative min-h-[260px]">
                <img
                  src="/src/assets/images/hero_emergency_coordination_1794291315579.jpg"
                  alt="SafeResponse municipal emergency coordination center and community safety map"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Category Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="max-w-2xl space-y-2 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#263640] tracking-tight">
            Select an Emergency Category
          </h2>
          <p className="text-sm sm:text-base text-[#71818A]">
            Choose the category that best matches the situation to open the reporting form with your selection pre-filled.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {EMERGENCY_CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/report?category=${encodeURIComponent(category)}`}
              className="group bg-white rounded-xl border border-[#D9E2E6] p-6 hover:border-[#426B80] transition-colors flex flex-col justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426B80]"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-[#E5EEE9] text-[#426B80] flex items-center justify-center group-hover:bg-[#426B80] group-hover:text-white transition-colors">
                  <CategoryIcon category={category} className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#263640]">{category}</h3>
                <p className="text-sm text-[#71818A] leading-relaxed">
                  {CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-sm font-medium text-[#426B80]">
                <span>Start report</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How SafeResponse Works - 3-step process */}
      <section className="bg-white border-y border-[#D9E2E6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="max-w-2xl space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#263640] tracking-tight">
              How SafeResponse Works
            </h2>
            <p className="text-sm sm:text-base text-[#71818A]">
              A clear three-step workflow designed for calm, reliable reporting under pressure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <p className="text-sm font-mono font-semibold text-[#426B80] tabular-nums">01.</p>
              <h3 className="text-lg font-semibold text-[#263640]">Submit Incident Details</h3>
              <p className="text-sm text-[#71818A] leading-relaxed">
                Provide the incident title, location, affected people count, and a brief description. You receive a unique Incident ID immediately.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-mono font-semibold text-[#426B80] tabular-nums">02.</p>
              <h3 className="text-lg font-semibold text-[#263640]">Automated Triage & Review</h3>
              <p className="text-sm text-[#71818A] leading-relaxed">
                SafeResponse suggests an initial severity level with a transparent explanation. Authorized coordinators review and verify every report.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-mono font-semibold text-[#426B80] tabular-nums">03.</p>
              <h3 className="text-lg font-semibold text-[#263640]">Track Response Progress</h3>
              <p className="text-sm text-[#71818A] leading-relaxed">
                Use your Incident ID anytime on the Track Report page to view verified status updates from Reported through Resolved.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features & Emergency Awareness */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[#263640]">
                Platform Capabilities
              </h2>
              <p className="text-sm text-[#71818A]">
                Built for clarity, accountability, and coordinated disaster monitoring.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#263640]">
                  <ShieldAlert className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Transparent Severity Triage</span>
                </div>
                <p className="text-sm text-[#71818A] leading-relaxed">
                  Analyzes description, impact, and people affected—never category alone—with human override tracking.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#263640]">
                  <Clock className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Verified Status Timelines</span>
                </div>
                <p className="text-sm text-[#71818A] leading-relaxed">
                  Every status transition is timestamped and logged so citizens see only real recorded progress.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#263640]">
                  <CheckCircle2 className="w-4 h-4 text-[#5D9678]" aria-hidden="true" />
                  <span>Privacy-First Tracking</span>
                </div>
                <p className="text-sm text-[#71818A] leading-relaxed">
                  Optional reporter contact details are restricted to authorized coordinators and never shown on public tracking.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#263640]">
                  <PhoneCall className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                  <span>Consent-Based Live Location</span>
                </div>
                <p className="text-sm text-[#71818A] leading-relaxed">
                  Share your live GPS coordinates only when you consent so responders can reach your location faster.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#E5EEE9] rounded-xl border border-[#C6D8CE] p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#263640]">
                Emergency Awareness
              </h2>
              <p className="text-sm text-[#263640]/85 leading-relaxed">
                SafeResponse is a demonstration platform and is not connected to official emergency dispatch services. In a real emergency, contact your local emergency services directly. Submitting a report does not guarantee immediate assistance.
              </p>
              <div className="bg-white rounded-lg border border-[#C6D8CE] p-4 space-y-1">
                <p className="text-xs font-medium text-[#71818A]">
                  India National Emergency Helpline
                </p>
                <p className="text-2xl font-bold text-[#263640] tabular-nums">112</p>
                <p className="text-xs text-[#71818A]">
                  Police · Fire · Ambulance · Disaster Response
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/report"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] transition-colors"
              >
                Submit a Demo Report
              </Link>
              <Link
                to="/track"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-white text-[#263640] border border-[#C6D8CE] text-sm font-semibold hover:bg-[#F3F7F8] transition-colors"
              >
                Track Existing ID
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
