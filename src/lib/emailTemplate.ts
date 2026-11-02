/**
 * Localized Email Templates for TechForm Buddy
 * Supports English (India) and the 10 official Indian languages:
 * Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu.
 */

export interface EmailLocalization {
  subject: string;
  heading: string;
  greeting: string;
  otpIntro: string;
  expiryNote: string;
  ignoreNote: string;
  footer: string;
}

export const EMAIL_I18N: Record<string, EmailLocalization> = {
  en: {
    subject: 'Your TechForm Buddy Verification Code',
    heading: 'TechForm Buddy Verification',
    greeting: 'Hello,',
    otpIntro: 'Use the following 6-digit verification code to complete your email verification:',
    expiryNote: 'This code is valid for 10 minutes.',
    ignoreNote: 'If you did not request this code, please ignore this email.',
    footer: 'TechForm Buddy — Autonomous Civic & Government Form Assistance',
  },
  hi: {
    subject: 'आपका TechForm Buddy सत्यापन कोड',
    heading: 'TechForm Buddy ईमेल सत्यापन',
    greeting: 'नमस्ते,',
    otpIntro: 'अपना ईमेल सत्यापन पूरा करने के लिए नीचे दिए गए 6-अंकीय कोड का उपयोग करें:',
    expiryNote: 'यह कोड 10 मिनट के लिए मान्य है।',
    ignoreNote: 'यदि आपने इस कोड का अनुरोध नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें।',
    footer: 'TechForm Buddy — नागरिक और सरकारी प्रपत्र सहायता',
  },
  ta: {
    subject: 'உங்கள் TechForm Buddy சரிபார்ப்புக் குறியீடு',
    heading: 'TechForm Buddy மின்னஞ்சல் சரிபார்ப்பு',
    greeting: 'வணக்கம்,',
    otpIntro: 'உங்கள் மின்னஞ்சல் சரிபார்ப்பை முடிக்க பின்வரும் 6 இலக்கக் குறியீட்டைப் பயன்படுத்தவும்:',
    expiryNote: 'இந்தக் குறியீடு 10 நிமிடங்களுக்கு மட்டுமே செல்லுபடியாகும்.',
    ignoreNote: 'இந்தக் குறியீட்டை நீங்கள் கோரவில்லை எனில், தயவுசெய்து இந்த மின்னஞ்சலைப் புறக்கணிக்கவும்.',
    footer: 'TechForm Buddy — குடிமக்கள் மற்றும் அரசு படிவ உதவி',
  },
  te: {
    subject: 'మీ TechForm Buddy ధృవీకరణ కోడ్',
    heading: 'TechForm Buddy ఇమెయిల్ ధృవీకరణ',
    greeting: 'నమస్కారం,',
    otpIntro: 'మీ ఇమెయిల్ ధృవీకరణను పూర్తి చేయడానికి క్రింది 6 అంకెల కోడ్‌ను ఉపయోగించండి:',
    expiryNote: 'ఈ కోడ్ 10 నిమిషాల పాటు చెల్లుబాటు అవుతుంది.',
    ignoreNote: 'మీరు ఈ కోడ్‌ను అభ్యర్థించకపోతే, దయచేసి ఈ ఇమెయిల్‌ను విస్మరించండి.',
    footer: 'TechForm Buddy — పౌర మరియు ప్రభుత్వ ఫారమ్‌ల సహాయం',
  },
  bn: {
    subject: 'আপনার TechForm Buddy যাচাইকরণ কোড',
    heading: 'TechForm Buddy ইমেল যাচাইকরণ',
    greeting: 'নমস্কার,',
    otpIntro: 'আপনার ইমেল যাচাইকরণ সম্পূর্ণ করতে নিচের ৬ অঙ্কের কোডটি ব্যবহার করুন:',
    expiryNote: 'এই কোডটির মেয়াদ ১০ মিনিট।',
    ignoreNote: 'আপনি যদি এই কোডটি অনুরোধ না করে থাকেন, তবে অনুগ্রহ করে এই ইমেলটি উপেক্ষা করুন।',
    footer: 'TechForm Buddy — নাগরিক ও সরকারি ফর্ম সহায়তা',
  },
  mr: {
    subject: 'तुमचा TechForm Buddy पडताळणी कोड',
    heading: 'TechForm Buddy ईमेल पडताळणी',
    greeting: 'नमस्कार,',
    otpIntro: 'आपली ईमेल पडताळणी पूर्ण करण्यासाठी खालील ६-अंकी कोड वापरा:',
    expiryNote: 'हा कोड १० मिनिटांसाठी वैध आहे.',
    ignoreNote: 'जर आपण या कोडची विनंती केली नसेल, तर कृपया या ईमेलकडे दुर्लक्ष करा.',
    footer: 'TechForm Buddy — नागरी आणि शासकीय अर्ज साहाय्य',
  },
  gu: {
    subject: 'તમારો TechForm Buddy ચકાસણી કોડ',
    heading: 'TechForm Buddy ઇમેઇલ ચકાસણી',
    greeting: 'નમસ્તે,',
    otpIntro: 'તમારી ઇમેઇલ ચકાસણી પૂર્ણ કરવા માટે નીચે આપેલા 6-અંકના કોડનો ઉપયોગ કરો:',
    expiryNote: 'આ કોડ 10 મિનિટ માટે માન્ય છે.',
    ignoreNote: 'જો તમે આ કોડની વિનંતી ન કરી હોય, તો કૃપા કરીને આ ઇમેઇલને અવગણો.',
    footer: 'TechForm Buddy — નાગરિક અને સરકારી ફોર્મ સહાય',
  },
  kn: {
    subject: 'ನಿಮ್ಮ TechForm Buddy ಪರಿಶೀಲನಾ ಕೋಡ್',
    heading: 'TechForm Buddy ಇಮೇಲ್ ಪರಿಶೀಲನೆ',
    greeting: 'ನಮಸ್ಕಾರ,',
    otpIntro: 'ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲನೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಕೆಳಗಿನ 6-ಅಂಕಿಯ ಕೋಡ್ ಬಳಸಿ:',
    expiryNote: 'ಈ ಕೋಡ್ 10 ನಿಮಿಷಗಳವರೆಗೆ ಮಾನ್ಯವಾಗಿರುತ್ತದೆ.',
    ignoreNote: 'ನೀವು ಈ ಕೋಡ್ ಅನ್ನು ವಿನಂತಿಸದಿದ್ದರೆ, ದಯವಿಟ್ಟು ಈ ಇಮೇಲ್ ಅನ್ನು ನಿರ್ಲಕ್ಷಿಸಿ.',
    footer: 'TechForm Buddy — ನಾಗರಿಕ ಮತ್ತು ಸರ್ಕಾರಿ ಫಾರ್ಮ್ ಸಹಾಯ',
  },
  ml: {
    subject: 'നിങ്ങളുടെ TechForm Buddy സ്ഥിരീകരണ കോഡ്',
    heading: 'TechForm Buddy ഇമെയിൽ സ്ഥിരീകരണം',
    greeting: 'നമസ്കാരം,',
    otpIntro: 'നിങ്ങളുടെ ഇമെയിൽ സ്ഥിരീകരണം പൂർത്തിയാക്കാൻ താഴെ നൽകിയിരിക്കുന്ന 6 അക്ക കോഡ് ഉപയോഗിക്കുക:',
    expiryNote: 'ഈ കോഡ് 10 മിനിറ്റ് സാധുവാണ്.',
    ignoreNote: 'നിങ്ങൾ ഈ കോഡ് അഭ്യർത്ഥിച്ചിട്ടില്ലെങ്കിൽ, ദയവായി ഈ ഇമെയിൽ അവഗണിക്കുക.',
    footer: 'TechForm Buddy — സിവിക് & സർക്കാർ ഫോം സഹായം',
  },
  pa: {
    subject: 'ਤੁਹਾਡਾ TechForm Buddy ਤਸਦੀਕ ਕੋਡ',
    heading: 'TechForm Buddy ਈਮੇਲ ਤਸਦੀਕ',
    greeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ,',
    otpIntro: 'ਆਪਣੀ ਈਮੇਲ ਤਸਦੀਕ ਪੂਰੀ ਕਰਨ ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ 6-ਅੰਕਾਂ ਵਾਲੇ ਕੋਡ ਦੀ ਵਰਤੋਂ ਕਰੋ:',
    expiryNote: 'ਇਹ ਕੋਡ 10 ਮਿੰਟਾਂ ਲਈ ਵੈਧ ਹੈ।',
    ignoreNote: 'ਜੇਕਰ ਤੁਸੀਂ ਇਸ ਕੋਡ ਦੀ ਬੇਨਤੀ ਨਹੀਂ ਕੀਤੀ ਹੈ, ਤਾਂ ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਈਮੇਲ ਨੂੰ ਅਣਡਿੱਠ ਕਰੋ।',
    footer: 'TechForm Buddy — ਨਾਗਰਿਕ ਅਤੇ ਸਰਕਾਰੀ ਫਾਰਮ ਸਹਾਇਤਾ',
  },
  ur: {
    subject: 'آپ کا TechForm Buddy تصدیقی کوڈ',
    heading: 'TechForm Buddy ای میل تصدیق',
    greeting: 'سلام،',
    otpIntro: 'اپنی ای میل کی تصدیق مکمل کرنے کے لیے نیچے دیا گیا 6 ہندسوں کا کوڈ استعمال کریں:',
    expiryNote: 'یہ کوڈ 10 منٹ کے لیے کارآمد ہے۔',
    ignoreNote: 'اگر آپ نے اس کوڈ کی درخواست نہیں کی ہے، تو براہ کرم اس ای میل کو نظر انداز کریں۔',
    footer: 'TechForm Buddy — شہری اور سرکاری فارم کی معاونت',
  },
};

export function getEmailStrings(lang: string = 'en'): EmailLocalization {
  const normalized = (lang || 'en').toLowerCase().trim();
  return EMAIL_I18N[normalized] || EMAIL_I18N.en;
}

export function generateVerificationEmailContent(
  otp: string,
  lang: string = 'en'
): { subject: string; html: string; text: string } {
  const strings = getEmailStrings(lang);
  const isRtl = lang.toLowerCase() === 'ur';

  const html = `
<!DOCTYPE html>
<html lang="${lang}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${strings.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 0; color: #1e293b; line-height: 1.5;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 28px 24px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <span style="font-size: 26px;">🇮🇳</span>
                  </td>
                  <td style="vertical-align: middle;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.2px;">TechForm Buddy</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 12px;">${strings.heading}</h2>
              <p style="font-size: 14px; color: #475569; margin: 0 0 16px;">${strings.greeting}</p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">${strings.otpIntro}</p>

              <!-- OTP Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 18px 12px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e40af; line-height: 1.1;">${otp}</div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <p style="font-size: 13px; font-weight: 600; color: #b45309; background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 4px; margin: 0 0 20px;">
                ⏱ ${strings.expiryNote}
              </p>

              <!-- Ignore Note -->
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
                ${strings.ignoreNote}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11px; color: #64748b; margin: 0;">${strings.footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${strings.heading}
==================================================

${strings.greeting}

${strings.otpIntro}

Verification Code: ${otp}

${strings.expiryNote}

${strings.ignoreNote}

--------------------------------------------------
${strings.footer}
  `.trim();

  return {
    subject: strings.subject,
    html,
    text,
  };
}

/**
 * Password Reset Email Template (Always rendered in English per requirement)
 */
export function generatePasswordResetEmailContent(
  otp: string,
  _lang: string = 'en'
): { subject: string; html: string; text: string } {
  const subject = 'TechForm Buddy - Password Reset Code';
  const heading = 'Reset Your Password';
  const greeting = 'Hello,';
  const intro =
    'We received a request to reset your password for your TechForm Buddy account. Use the following 6-digit verification code to set your new password:';
  const expiryNote = 'This code is valid for 10 minutes.';
  const ignoreNote =
    'If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.';
  const footer = 'TechForm Buddy — Autonomous Civic & Government Form Assistance';

  const html = `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 0; color: #1e293b; line-height: 1.5;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 28px 24px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <span style="font-size: 26px;">🔐</span>
                  </td>
                  <td style="vertical-align: middle;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.2px;">TechForm Buddy</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 12px;">${heading}</h2>
              <p style="font-size: 14px; color: #475569; margin: 0 0 16px;">${greeting}</p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">${intro}</p>

              <!-- OTP Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 18px 12px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e40af; line-height: 1.1;">${otp}</div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <p style="font-size: 13px; font-weight: 600; color: #b45309; background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 4px; margin: 0 0 20px;">
                ⏱ ${expiryNote}
              </p>

              <!-- Ignore Note -->
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">
                ${ignoreNote}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11px; color: #64748b; margin: 0;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
${heading}
==================================================

${greeting}

${intro}

Password Reset Code: ${otp}

${expiryNote}

${ignoreNote}

--------------------------------------------------
${footer}
  `.trim();

  return {
    subject,
    html,
    text,
  };
}

