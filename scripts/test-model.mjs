import fs from 'fs';

const content = fs.readFileSync('.env.local', 'utf8');
const match = content.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)/);
const apiKey = match ? match[1].trim() : '';

const candidates = [
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-pro-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro'
];

async function check() {
  for (const model of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] }),
        signal: AbortSignal.timeout(6000)
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`SUCCESS: ${model} -> 200 OK`);
      } else {
        console.log(`FAILED: ${model} -> status ${res.status}: ${data.error?.message?.slice(0, 80)}`);
      }
    } catch (err) {
      console.log(`ERROR: ${model} -> ${err.message}`);
    }
  }
}

check();
