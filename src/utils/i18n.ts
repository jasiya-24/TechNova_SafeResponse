export type AppLanguage = 'en' | 'ta' | 'hi';

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  ta: 'தமிழ்',
  hi: 'हिन्दी',
};

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.report': 'Report Emergency',
    'nav.track': 'Track Report',
    'nav.sos': 'SOS Quick Report',
    'nav.admin': 'Admin Login',
    'hero.title': 'Emergency Help Starts Here',
    'hero.subtitle':
      'Report an emergency. Help us coordinate a faster response through smarter incident monitoring and management.',
    'hero.cta': 'Report an Emergency',
    'hero.track': 'Track My Report',
    'hero.sos': 'Emergency SOS Quick Report',
    'status.Reported': 'Reported',
    'status.Pending': 'Pending',
    'status.In Progress': 'In Progress',
    'status.Resolved': 'Resolved',
    'conn.online': 'Online',
    'conn.offline': 'Offline (Drafts & Queue Active)',
    'sos.title': 'Emergency SOS Quick Report',
    'sos.subtitle':
      'Submit an urgent minimal report in seconds. You can add additional details after receiving your Incident ID.',
    'sos.submit': 'Send SOS Alert Now',
    'track.title': 'Track Your Emergency Report',
    'track.subtitle': 'Enter your Incident Reference to check the latest available status.',
    'track.button': 'Track Report',
  },
  ta: {
    'nav.home': 'முகப்பு',
    'nav.report': 'அவசர புகார்',
    'nav.track': 'புகார் நிலை',
    'nav.sos': 'SOS விரைவு புகார்',
    'nav.admin': 'நிர்வாக உள்நுழைவு',
    'hero.title': 'அவசர உதவி இங்கிருந்து தொடங்குகிறது',
    'hero.subtitle':
      'அவசர நிலையை உடனே தெரிவிக்கவும். விரைவான ஒருங்கிணைப்பு மற்றும் மேலாண்மை மூலம் உதவ எங்களுக்கு உதவுங்கள்.',
    'hero.cta': 'அவசர புகார் அளிக்கவும்',
    'hero.track': 'என் புகாரை கண்காணிக்கவும்',
    'hero.sos': 'அவசர SOS விரைவு புகார்',
    'status.Reported': 'பதிவு செய்யப்பட்டது',
    'status.Pending': 'நிலுவையில்',
    'status.In Progress': 'நடவடிக்கையில்',
    'status.Resolved': 'தீர்க்கப்பட்டது',
    'conn.online': 'இணைப்பில் உள்ளது',
    'conn.offline': 'ஆஃப்லைன் (வரைவு & வரிசை செயலில்)',
    'sos.title': 'அவசர SOS விரைவு புகார்',
    'sos.subtitle':
      'சில நொடிகளில் அவசர புகாரை அனுப்பவும். புகார் எண் பெற்ற பிறகு கூடுதல் விவரங்களை சேர்க்கலாம்.',
    'sos.submit': 'SOS எச்சரிக்கையை அனுப்பு',
    'track.title': 'உங்கள் அவசர புகாரை கண்காணிக்கவும்',
    'track.subtitle': 'சமீபத்திய நிலையை அறிய உங்கள் புகார் எண்ணை உள்ளிடவும்.',
    'track.button': 'நிலையை காண்க',
  },
  hi: {
    'nav.home': 'होम',
    'nav.report': 'आपातकाल रिपोर्ट',
    'nav.track': 'रिपोर्ट ट्रैक करें',
    'nav.sos': 'SOS त्वरित रिपोर्ट',
    'nav.admin': 'एडमिन लॉगिन',
    'hero.title': 'आपातकालीन सहायता यहाँ से शुरू होती है',
    'hero.subtitle':
      'आपात स्थिति की रिपोर्ट करें। स्मार्ट निगरानी और प्रबंधन के माध्यम से तेज़ सहायता समन्वय में मदद करें।',
    'hero.cta': 'आपातकाल रिपोर्ट करें',
    'hero.track': 'मेरी रिपोर्ट ट्रैक करें',
    'hero.sos': 'आपातकालीन SOS त्वरित रिपोर्ट',
    'status.Reported': 'रिपोर्ट दर्ज',
    'status.Pending': 'लंबित',
    'status.In Progress': 'प्रगति पर',
    'status.Resolved': 'सुलझाया गया',
    'conn.online': 'ऑनलाइन',
    'conn.offline': 'ऑफ़लाइन (ड्राफ़्ट और कतार सक्रिय)',
    'sos.title': 'आपातकालीन SOS त्वरित रिपोर्ट',
    'sos.subtitle':
      'कुछ सेकंड में त्वरित आपातकालीन रिपोर्ट भेजें। आईडी मिलने के बाद आप अतिरिक्त विवरण जोड़ सकते हैं।',
    'sos.submit': 'अभी SOS अलर्ट भेजें',
    'track.title': 'अपनी आपातकालीन रिपोर्ट ट्रैक करें',
    'track.subtitle': 'नवीनतम स्थिति देखने के लिए अपनी घटना आईडी दर्ज करें।',
    'track.button': 'रिपोर्ट ट्रैक करें',
  },
};

export function translate(lang: AppLanguage, key: string, fallback?: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || fallback || key;
}
