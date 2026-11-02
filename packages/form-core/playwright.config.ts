import { defineConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Load .env.local into process.env if present
const envLocalPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?([^"'\r\n]*)["']?/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

export default defineConfig({
  testDir: './test',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    // Use Microsoft Edge installed locally on Windows
    channel: 'msedge',
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off',
  },
});
