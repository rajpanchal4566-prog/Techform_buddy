import fs from 'fs';
import path from 'path';

function getApiKey() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return process.env.GEMINI_API_KEY || '';
}

async function listModels() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found in .env.local or environment variables.');
    process.exit(1);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error (status ${response.status}): ${errorText.slice(0, 300)}`);
      process.exit(1);
    }

    const data = await response.json();
    const models = data.models || [];

    const generateModels = models.filter((m) =>
      Array.isArray(m.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes('generateContent')
    );

    console.log(`Found ${generateModels.length} models supporting generateContent:\n`);
    for (const m of generateModels) {
      const cleanName = m.name.replace(/^models\//, '');
      console.log(`- ${cleanName} (${m.displayName || cleanName})`);
      if (m.description) {
        console.log(`  Description: ${m.description.slice(0, 100)}...`);
      }
    }
  } catch (err) {
    console.error('Failed to list Gemini models:', err.message);
    process.exit(1);
  }
}

listModels();
