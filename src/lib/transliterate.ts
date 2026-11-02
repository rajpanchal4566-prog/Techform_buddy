/**
 * TechForm Buddy Transliteration, Digit Normalization, and Field Value Engine.
 *
 * Requirements (Hard Rules & Item 3):
 * 1. Form values entered must ALWAYS be in English (Latin script).
 * 2. Names, addresses, and places are TRANSLITERATED, not translated
 *    (preserves official document spellings, e.g. "राहुल शर्मा" -> "Rahul Sharma").
 * 3. Numbers become digits (e.g. "बारह" / "१२" -> "12").
 * 4. Dates are normalized to the format the field expects (e.g. YYYY-MM-DD for date inputs).
 * 5. Prefer stored profile values over re-transcribed speech when field is already known.
 * 6. For spoken values, show interpreted value and require confirmation before filling.
 * 7. Exception: If field is clearly meant for a regional-script value
 *    (e.g. "name in Hindi", "हिंदी में", "देवनागरी"), fill in that script.
 */

// Mapping of Indic numerals to standard ASCII digits (0-9)
const INDIC_DIGIT_MAP: Record<string, string> = {
  // Devanagari (Hindi, Marathi)
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  // Bengali
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  // Gujarati
  '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4',
  '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',
  // Gurmukhi (Punjabi)
  '੦': '0', '੧': '1', '੨': '2', '੩': '3', '੪': '4',
  '੫': '5', '੬': '6', '੭': '7', '੮': '8', '੯': '9',
  // Kannada
  '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
  '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9',
  // Malayalam
  '൦': '0', '൧': '1', '൨': '2', '൩': '3', '൪': '4',
  '൫': '5', '൬': '6', '൭': '7', '൮': '8', '൯': '9',
  // Telugu
  '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
  '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9',
  // Urdu / Persian-Arabic
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

// Spoken number words across Hindi and English to digits
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, शून्य: 0, सिफ़र: 0,
  one: 1, एक: 1, first: 1,
  two: 2, दो: 2, second: 2,
  three: 3, तीन: 3, third: 3,
  four: 4, चार: 4, fourth: 4,
  five: 5, पाँच: 5, पांच: 5, fifth: 5,
  six: 6, छह: 6, छः: 6, छ: 6, sixth: 6,
  seven: 7, सात: 7, seventh: 7,
  eight: 8, आठ: 8, eighth: 8,
  nine: 9, नौ: 9, ninth: 9,
  ten: 10, दस: 10, tenth: 10,
  eleven: 11, ग्यारह: 11,
  twelve: 12, बारह: 12,
  thirteen: 13, तेरह: 13,
  fourteen: 14, चौदह: 14,
  fifteen: 15, पंद्रह: 15,
  sixteen: 16, सोलह: 16,
  seventeen: 17, सत्रह: 17,
  eighteen: 18, अठारह: 18,
  nineteen: 19, उन्नीस: 19,
  twenty: 20, बीस: 20,
  thirty: 30, तीस: 30,
  forty: 40, चालीस: 40,
  fifty: 50, पचास: 50,
  sixty: 60, साठ: 60,
  seventy: 70, सत्तर: 70,
  eighty: 80, अस्सी: 80,
  ninety: 90, नब्बे: 90,
  hundred: 100, सौ: 100,
  thousand: 1000, हज़ार: 1000, हजार: 1000,
  lakh: 100000, लाख: 100000,
  crore: 10000000, करोड़: 10000000,
};

// Dictionary of canonical Indian proper names and geographic terms
const CANONICAL_NAMES_MAP: Record<string, string> = {
  // Names
  राहुल: 'Rahul',
  शर्मा: 'Sharma',
  अमित: 'Amit',
  कुमार: 'Kumar',
  रोहित: 'Rohit',
  वर्मा: 'Verma',
  सुरेश: 'Suresh',
  पटेल: 'Patel',
  महेश: 'Mahesh',
  गुप्ता: 'Gupta',
  अजय: 'Ajay',
  सिंह: 'Singh',
  विकास: 'Vikas',
  यादव: 'Yadav',
  संजय: 'Sanjay',
  मिश्रा: 'Mishra',
  राजेश: 'Rajesh',
  पांडेय: 'Pandey',
  मनोज: 'Manoj',
  तिवारी: 'Tiwari',
  दीपक: 'Deepak',
  झा: 'Jha',
  पूजा: 'Pooja',
  नेहा: 'Neha',
  प्रिया: 'Priya',
  अंजलि: 'Anjali',
  सुनीता: 'Sunita',
  अनिता: 'Anita',
  कविता: 'Kavita',
  मीना: 'Meena',
  अनीता: 'Anita',
  सीमा: 'Seema',
  रेखा: 'Rekha',
  रेनू: 'Renu',
  पूनम: 'Poonam',
  किरण: 'Kiran',
  अभिषेक: 'Abhishek',
  गौरव: 'Gaurav',
  सौरभ: 'Saurabh',
  मनीष: 'Manish',
  आशीष: 'Ashish',
  प्रशांत: 'Prashant',
  संदीप: 'Sandeep',
  सचिन: 'Sachin',
  विशाल: 'Vishal',
  नितिन: 'Nitin',
  आलोक: 'Alok',
  पवन: 'Pawan',
  सुनील: 'Sunil',
  अनिल: 'Anil',
  विनोद: 'Vinod',
  अशोक: 'Ashok',
  राकेश: 'Rakesh',
  दिनेश: 'Dinesh',
  नरेश: 'Naresh',
  सुरेंद्र: 'Surendra',
  महेंद्र: 'Mahendra',
  धर्मेन्द्र: 'Dharmendra',
  जितेंद्र: 'Jitendra',
  सत्येंद्र: 'Satyendra',
  वीरेंद्र: 'Virendra',
  रवि: 'Ravi',
  हरि: 'Hari',
  विजय: 'Vijay',
  किशन: 'Kishan',
  गोपाल: 'Gopal',
  मोहन: 'Mohan',
  मदन: 'Madan',
  श्याम: 'Shyam',
  राधा: 'Radha',
  सीता: 'Sita',
  गीता: 'Geeta',
  लक्ष्मी: 'Lakshmi',
  पार्वती: 'Parvati',
  सरस्वती: 'Saraswati',
  दुर्गा: 'Durga',
  मोहित: 'Mohit',
  अनुराग: 'Anurag',
  मयंक: 'Mayank',
  हर्ष: 'Harsh',
  आयुष: 'Ayush',
  आदित्य: 'Aditya',
  शुभम: 'Shubham',
  ऋषभ: 'Rishabh',
  सिद्धार्थ: 'Siddharth',
  वरुण: 'Varun',
  तरुण: 'Tarun',
  अंकुर: 'Ankur',
  अमन: 'Aman',
  करण: 'Karan',
  अर्जुन: 'Arjun',
  विक्रम: 'Vikram',
  कपूर: 'Kapoor',
  खन्ना: 'Khanna',
  चोपड़ा: 'Chopra',
  मल्होत्रा: 'Malhotra',
  जोशी: 'Joshi',
  भट्ट: 'Bhatt',
  दुबे: 'Dubey',
  चौबे: 'Chaubey',
  रेड्डी: 'Reddy',
  राव: 'Rao',
  नायर: 'Nair',
  पिल्लई: 'Pillai',
  इय्यर: 'Iyer',
  अय्यंगार: 'Iyengar',
  मुखर्जी: 'Mukherjee',
  बनर्जी: 'Banerjee',
  चटर्जी: 'Chatterjee',
  बोस: 'Bose',
  घोष: 'Ghosh',
  गांगुली: 'Ganguly',
  दास: 'Das',
  दत्ता: 'Dutta',
  सेन: 'Sen',
  रॉय: 'Roy',
  चौधरी: 'Choudhary',
  चौधुरी: 'Chaudhary',
  जाट: 'Jat',
  गुर्जर: 'Gurjar',
  यादवजी: 'Yadav',
  ठाकुर: 'Thakur',
  राणा: 'Rana',
  चौहान: 'Chouhan',
  राठौड़: 'Rathore',
  राठौर: 'Rathore',
  शेखावत: 'Shekhawat',
  तोमर: 'Tomar',
  परमार: 'Parmar',
  सिसोदिया: 'Sisodia',
  खान: 'Khan',
  अंसारी: 'Ansari',
  कुरैशी: 'Qureshi',
  सिद्दीकी: 'Siddiqui',
  शेख: 'Sheikh',
  अहमद: 'Ahmed',
  अहमदज़ादा: 'Ahmad',
  अली: 'Ali',
  हुसैन: 'Hussain',
  हसन: 'Hasan',
  मलिक: 'Malik',

  // Address and place words
  गांधी: 'Gandhi',
  नेहरू: 'Nehru',
  मार्ग: 'Marg',
  नगर: 'Nagar',
  कालोनी: 'Colony',
  कॉलोनी: 'Colony',
  रोड: 'Road',
  गली: 'Gali',
  चौक: 'Chowk',
  बाजार: 'Bazaar',
  बाज़ार: 'Bazaar',
  सेक्टर: 'Sector',
  वार्ड: 'Ward',
  मोहल्ला: 'Mohalla',
  ग्राम: 'Gram',
  गाँव: 'Gaon',
  गांव: 'Gaon',
  पोस्ट: 'Post',
  थाना: 'Thana',
  तहसील: 'Tehsil',
  जिला: 'District',
  ज़िला: 'District',
  शहर: 'City',
  राज्य: 'State',
  अपार्टमेंट: 'Apartment',
  फ्लैट: 'Flat',
  मकान: 'House',
  भवन: 'Bhawan',
  विहार: 'Vihar',
  इन्क्लेव: 'Enclave',
  सोसायटी: 'Society',
  कुंज: 'Kunj',
  पार्क: 'Park',

  // Major Indian Cities & States
  दिल्ली: 'Delhi',
  'नई दिल्ली': 'New Delhi',
  मुंबई: 'Mumbai',
  कोलकाता: 'Kolkata',
  चेन्नई: 'Chennai',
  बेंगलुरु: 'Bengaluru',
  बेंगलोर: 'Bangalore',
  हैदराबाद: 'Hyderabad',
  अहमदाबाद: 'Ahmedabad',
  पुणे: 'Pune',
  जयपुर: 'Jaipur',
  लखनऊ: 'Lucknow',
  कानपुर: 'Kanpur',
  नागपुर: 'Nagpur',
  इंदौर: 'Indore',
  भोपाल: 'Bhopal',
  पटना: 'Patna',
  वडोदरा: 'Vadodara',
  सूरत: 'Surat',
  लुधियाना: 'Ludhiana',
  आगरा: 'Agra',
  वाराणसी: 'Varanasi',
  प्रयागराज: 'Prayagraj',
  इलाहाबाद: 'Allahabad',
  अमृतसर: 'Amritsar',
  जोधपुर: 'Jodhpur',
  उदयपुर: 'Udaipur',
  रांची: 'Ranchi',
  रायपुर: 'Raipur',
  देहरादून: 'Dehradun',
  शिमला: 'Shimla',
  श्रीनगर: 'Srinagar',
  जम्मू: 'Jammu',
  चंडीगढ़: 'Chandigarh',
  गोवा: 'Goa',
  केरल: 'Kerala',
  'उत्तर प्रदेश': 'Uttar Pradesh',
  'मध्य प्रदेश': 'Madhya Pradesh',
  राजस्थान: 'Rajasthan',
  महाराष्ट्र: 'Maharashtra',
  गुजरात: 'Gujarat',
  पंजाब: 'Punjab',
  हरियाणा: 'Haryana',
  बिहार: 'Bihar',
  'पश्चिम बंगाल': 'West Bengal',
  तमिलनाडु: 'Tamil Nadu',
  कर्नाटक: 'Karnataka',
  'आंध्र प्रदेश': 'Andhra Pradesh',
  तेलंगाना: 'Telangana',
  ओडिशा: 'Odisha',
  असम: 'Assam',
  उत्तराखंड: 'Uttarakhand',
  'हिमाचल प्रदेश': 'Himachal Pradesh',
  झारखंड: 'Jharkhand',
  छत्तीसगढ़: 'Chhattisgarh',
  भारत: 'India',
};

// Character transliteration for Devanagari to Latin
const DEVANAGARI_CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ng',
  च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'ny',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'v',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
  क़: 'q', ख़: 'kh', ग़: 'gh', ज़: 'z', ड़: 'r', ढ़: 'rh', फ़: 'f',
  क्ष: 'ksh', त्र: 'tr', ज्ञ: 'gy', श्र: 'shr',
};

const DEVANAGARI_VOWELS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo',
  ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '',
};

/**
 * Phonetically transliterates a Devanagari string to Latin English characters.
 */
export function transliterateDevanagari(text: string): string {
  if (!text) return '';
  let normalized = text;
  // Multi-word canonical phrases first
  normalized = normalized.replace(/एम\s*जी\s*रोड/gi, 'MG Road');
  normalized = normalized.replace(/एम\s*जी/gi, 'MG');
  normalized = normalized.replace(/नई\s+दिल्ली/gi, 'New Delhi');

  const tokens = normalized.split(/(\s+|[.,;:\-_/()])/);

  return tokens
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed || !/[ऀ-ॿ]/.test(trimmed)) {
        return token;
      }

      if (CANONICAL_NAMES_MAP[trimmed]) {
        return CANONICAL_NAMES_MAP[trimmed];
      }

      let result = '';
      const chars = Array.from(trimmed);
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const next = chars[i + 1] || '';

        if (DEVANAGARI_CONSONANTS[c]) {
          const latin = DEVANAGARI_CONSONANTS[c];
          // Check if followed by virama (halant)
          if (next === '्') {
            result += latin;
            i++; // skip virama
          } else if (DEVANAGARI_VOWELS[next] && next !== '्') {
            result += latin + DEVANAGARI_VOWELS[next];
            i++; // skip vowel matra
          } else {
            // In Hindi/Indic, trailing consonant usually drops inherent 'a'
            const isEndOfWord = i === chars.length - 1;
            result += latin + (isEndOfWord ? '' : 'a');
          }
        } else if (DEVANAGARI_VOWELS[c]) {
          result += DEVANAGARI_VOWELS[c];
        } else {
          result += c;
        }
      }

      // Capitalize first letter
      return result ? result.charAt(0).toUpperCase() + result.slice(1) : token;
    })
    .join('');
}

/**
 * Converts Indic numerals to standard ASCII Arabic digits (0-9).
 */
export function convertIndicDigitsToAscii(text: string): string {
  if (!text) return '';
  let out = '';
  for (const ch of text) {
    out += INDIC_DIGIT_MAP[ch] !== undefined ? INDIC_DIGIT_MAP[ch] : ch;
  }
  return out;
}

/**
 * Converts spoken number words in English and Hindi into digits.
 */
export function convertNumberWordsToDigits(text: string): string {
  if (!text) return '';
  let result = text;

  // Single word numbers replacement (word boundaries)
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    const rx = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(rx, String(val));
  }

  return result;
}

/**
 * Checks if a field is explicitly meant for a regional-script value.
 * (e.g. "name in Hindi", "हिंदी में", "in Devanagari", "regional language")
 */
export function isRegionalScriptField(
  label: string = '',
  placeholder: string = '',
  name: string = ''
): { isRegional: boolean; targetLang?: string } {
  const corpus = `${label} ${placeholder} ${name}`.toLowerCase();

  if (
    corpus.includes('हिंदी') ||
    corpus.includes('हिन्दी') ||
    corpus.includes('देवनागरी') ||
    /\b(in\s+hindi|name\s+in\s+hindi|hindi\s+mein|devanagari)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'hi' };
  }
  if (
    corpus.includes('தமிழ்') ||
    corpus.includes('தமிழில்') ||
    /\b(in\s+tamil|tamilil|tamil)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'ta' };
  }
  if (
    corpus.includes('বাংলা') ||
    corpus.includes('বাংলায়') ||
    /\b(in\s+bengali|banglay|bengali)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'bn' };
  }
  if (
    corpus.includes('मराठी') ||
    corpus.includes('मराठीत') ||
    /\b(in\s+marathi|marathit|marathi)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'mr' };
  }
  if (
    corpus.includes('తెలుగు') ||
    corpus.includes('తెలుగులో') ||
    /\b(in\s+telugu|telugulo|telugu)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'te' };
  }
  if (
    corpus.includes('ગુજરાતી') ||
    corpus.includes('ગુજરાતીમાં') ||
    /\b(in\s+gujarati|gujaratima|gujarati)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'gu' };
  }
  if (
    corpus.includes('ಕನ್ನಡ') ||
    corpus.includes('ಕನ್ನಡದಲ್ಲಿ') ||
    /\b(in\s+kannada|kannadadalli|kannada)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'kn' };
  }
  if (
    corpus.includes('മലയാളം') ||
    corpus.includes('മലയാളത്തിൽ') ||
    /\b(in\s+malayalam|malayalathil|malayalam)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'ml' };
  }
  if (
    corpus.includes('ਪੰਜਾਬੀ') ||
    /\b(in\s+punjabi|punjabivich|punjabi)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'pa' };
  }
  if (
    corpus.includes('اردو') ||
    /\b(in\s+urdu|urdu\s+mein|urdu)\b/i.test(corpus)
  ) {
    return { isRegional: true, targetLang: 'ur' };
  }
  if (
    corpus.includes('मातृभाषा') ||
    /\b(regional\s*language|regional\s*script|vernacular|local\s*language)\b/i.test(corpus)
  ) {
    return { isRegional: true };
  }

  return { isRegional: false };
}

// Aliases for clear semantic consumption across app, core and tests
export const transliterateIndicToEnglish = transliterateDevanagari;
export const convertIndicNumeralsToAscii = convertIndicDigitsToAscii;

function getProfileVal(profile: Record<string, any>, key: string): string | null {
  if (!profile || !key) return null;
  if (profile[key]) return String(profile[key]);
  const camelKey = key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
  if (profile[camelKey]) return String(profile[camelKey]);
  const lowerKey = key.toLowerCase().replace(/_/g, '');
  for (const [k, v] of Object.entries(profile)) {
    if (k.toLowerCase().replace(/_/g, '') === lowerKey && v) {
      return String(v);
    }
  }
  return null;
}

/**
 * Normalizes dates into standard format required by the field.
 * Default is YYYY-MM-DD for HTML5 date inputs, or DD/MM/YYYY for standard text inputs.
 */
export function normalizeDateValue(rawDate: string, isDateInput: boolean = false): string {
  const cleaned = convertIndicDigitsToAscii(convertNumberWordsToDigits(rawDate.trim()));

  // Indian month names in Hindi and English
  const MONTHS_MAP: Record<string, string> = {
    जनवरी: '01', january: '01', jan: '01',
    फरवरी: '02', february: '02', feb: '02',
    मार्च: '03', march: '03', mar: '03',
    अप्रैल: '04', april: '04', apr: '04',
    मई: '05', may: '05',
    जून: '06', june: '06', jun: '06',
    जुलाई: '07', july: '07', jul: '07',
    अगस्त: '08', august: '08', aug: '08',
    सितंबर: '09', september: '09', sep: '09',
    अक्टूबर: '10', october: '10', oct: '10',
    नवंबर: '11', november: '11', nov: '11',
    दिसंबर: '12', december: '12', dec: '12',
  };

  // Check for phrases like "15 अगस्त 1947" or "15 August 1947"
  const textMonthMatch = cleaned.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})$/);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const monthWord = textMonthMatch[2].toLowerCase();
    const month = MONTHS_MAP[monthWord];
    const year = textMonthMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // 1. Check for standard DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return isDateInput ? `${year}-${month}-${day}` : `${year}-${month}-${day}`;
  }

  // 2. Check for standard YYYY-MM-DD
  const ymdMatch = cleaned.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return cleaned;
}

/**
 * Map field label to known profile keys so stored profile values can be preferred.
 */
export function matchFieldToProfileKey(label: string = '', name: string = ''): string | null {
  const corpus = `${label} ${name}`.toLowerCase();

  // Full Name
  if (/\b(full\s*name|applicant\s*name|candidate\s*name|name\s*of\s*applicant|पूरा\s*नाम|नाम)\b/i.test(corpus)) {
    if (!/\b(father|mother|spouse|guardian|nominee|witness)\b/i.test(corpus)) {
      return 'full_name';
    }
  }
  // Father's Name
  if (/\b(father|पिता)\b/i.test(corpus)) return 'father_name';
  // Mother's Name
  if (/\b(mother|माता)\b/i.test(corpus)) return 'mother_name';
  // Email
  if (/\b(email|ईमेल)\b/i.test(corpus)) return 'email';
  // Phone
  if (/\b(mobile|phone|contact|मोबाइल)\b/i.test(corpus)) return 'phone';
  // Date of Birth
  if (/\b(dob|birth|जन्म)\b/i.test(corpus)) return 'date_of_birth';
  // Gender
  if (/\b(gender|sex|लिंग)\b/i.test(corpus)) return 'gender';
  // Address
  if (/\b(address|street|पता|निवास)\b/i.test(corpus)) return 'address';
  // City
  if (/\b(city|town|district|शहर|जिला)\b/i.test(corpus)) return 'city';
  // State
  if (/\b(state|राज्य)\b/i.test(corpus)) return 'state';
  // Pincode
  if (/\b(pincode|postal|zip|पिनकोड)\b/i.test(corpus)) return 'pincode';

  return null;
}

/**
 * Core processor for spoken or typed form values.
 * Enforces Hard Rule: Always English Latin script (unless field is regional script),
 * transliteration for names/addresses/places, digits for numbers, normalized dates,
 * and preference for stored profile values.
 */
export function processFieldValueForFilling(options: {
  rawValue: string;
  fieldLabel?: string;
  fieldType?: string;
  fieldName?: string;
  profileValues?: Record<string, string>;
  fromLang?: string;
}): {
  interpretedValue: string;
  finalValue: string;
  isRegional: boolean;
  fromProfile: boolean;
  source: 'profile' | 'regional_script' | 'transliterated' | 'number' | 'date';
  requiresConfirmation: boolean;
  profileKey: string | null;
} {
  const raw = (options.rawValue || '').trim();
  const label = options.fieldLabel || '';
  const fieldType = (options.fieldType || 'text').toLowerCase();
  const fieldName = options.fieldName || '';
  const profile = options.profileValues || {};

  // 1. Check if field is regional script exception
  const regionalCheck = isRegionalScriptField(label, '', fieldName);
  if (regionalCheck.isRegional) {
    return {
      interpretedValue: raw,
      finalValue: raw,
      isRegional: true,
      fromProfile: false,
      source: 'regional_script',
      requiresConfirmation: true,
      profileKey: null,
    };
  }

  // 2. Check if field matches a known profile key and profile has the value
  const matchedKey = matchFieldToProfileKey(label, fieldName);
  const profileVal = matchedKey ? getProfileVal(profile, matchedKey) : null;
  if (profileVal && profileVal.trim()) {
    return {
      interpretedValue: profileVal.trim(),
      finalValue: profileVal.trim(),
      isRegional: false,
      fromProfile: true,
      source: 'profile',
      requiresConfirmation: true,
      profileKey: matchedKey,
    };
  }

  // 3. Normalization pipeline:
  // Step A: Convert Indic digits to ASCII Arabic digits
  let processed = convertIndicDigitsToAscii(raw);
  let detectedSource: 'profile' | 'regional_script' | 'transliterated' | 'number' | 'date' = 'transliterated';

  // Step B: Convert number words to digits if field is numeric/phone/pincode
  const isNumericField =
    fieldType === 'number' ||
    fieldType === 'tel' ||
    /\b(number|pin|code|phone|mobile|amount|age|digit)\b/i.test(`${label} ${fieldName}`);
  if (isNumericField) {
    processed = convertNumberWordsToDigits(processed);
    detectedSource = 'number';
  }

  // Step C: If field is date, normalize
  if (fieldType === 'date' || /\b(dob|birth|date)\b/i.test(`${label} ${fieldName}`)) {
    processed = normalizeDateValue(processed, fieldType === 'date');
    detectedSource = 'date';
  } else if (!isNumericField) {
    // Step D: Transliterate Indic characters to Latin characters
    if (/[ऀ-ॿ]/.test(processed)) {
      processed = transliterateDevanagari(processed);
      detectedSource = 'transliterated';
    }
  }

  return {
    interpretedValue: processed.trim(),
    finalValue: processed.trim(),
    isRegional: false,
    fromProfile: false,
    source: detectedSource,
    requiresConfirmation: true,
    profileKey: matchedKey,
  };
}

