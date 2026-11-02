import sharp from 'sharp';
import fs from 'fs';

function buildSvg(size, isMaskable = false) {
  const pad = isMaskable ? size * 0.16 : 0;
  const c = size - pad * 2;
  const rx = isMaskable ? 0 : size * 0.22;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pwaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4f46e5" />
        <stop offset="50%" stop-color="#2563eb" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
      <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#f8fafc" />
      </linearGradient>
      <filter id="pwaShadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.025}" flood-color="#0f172a" flood-opacity="0.35" />
      </filter>
    </defs>

    <rect width="${size}" height="${size}" rx="${rx}" fill="url(#pwaGrad)" />

    <g transform="translate(${pad}, ${pad})" filter="url(#pwaShadow)">
      <path d="
        M ${c * 0.22} ${c * 0.16}
        H ${c * 0.60}
        L ${c * 0.78} ${c * 0.34}
        V ${c * 0.82}
        C ${c * 0.78} ${c * 0.86}, ${c * 0.74} ${c * 0.86}, ${c * 0.70} ${c * 0.86}
        H ${c * 0.26}
        C ${c * 0.22} ${c * 0.86}, ${c * 0.22} ${c * 0.82}, ${c * 0.22} ${c * 0.78}
        Z
      " fill="url(#sheetGrad)" />

      <path d="
        M ${c * 0.60} ${c * 0.16}
        V ${c * 0.34}
        H ${c * 0.78}
        Z
      " fill="#cbd5e1" />

      <line x1="${c * 0.32}" y1="${c * 0.42}" x2="${c * 0.68}" y2="${c * 0.42}" stroke="#94a3b8" stroke-width="${c * 0.045}" stroke-linecap="round" />
      <line x1="${c * 0.32}" y1="${c * 0.54}" x2="${c * 0.68}" y2="${c * 0.54}" stroke="#94a3b8" stroke-width="${c * 0.045}" stroke-linecap="round" />
      <line x1="${c * 0.32}" y1="${c * 0.66}" x2="${c * 0.52}" y2="${c * 0.66}" stroke="#94a3b8" stroke-width="${c * 0.045}" stroke-linecap="round" />

      <circle cx="${c * 0.72}" cy="${c * 0.72}" r="${c * 0.18}" fill="#3b82f6" stroke="#ffffff" stroke-width="${c * 0.035}" />
      <polygon points="
        ${c * 0.73},${c * 0.60}
        ${c * 0.64},${c * 0.73}
        ${c * 0.71},${c * 0.73}
        ${c * 0.69},${c * 0.84}
        ${c * 0.80},${c * 0.70}
        ${c * 0.73},${c * 0.70}
      " fill="#fbbf24" />
    </g>
  </svg>`;
}

async function main() {
  const targets = [
    { file: 'public/icon-192.png', size: 192, mask: false },
    { file: 'public/icon-512.png', size: 512, mask: false },
    { file: 'public/icon-maskable-192.png', size: 192, mask: true },
    { file: 'public/icon-maskable-512.png', size: 512, mask: true },
    { file: 'public/apple-touch-icon.png', size: 180, mask: false },
    { file: 'public/badge-72.png', size: 72, mask: false },
    { file: 'public/icon.png', size: 512, mask: false },
    { file: 'src/app/icon.png', size: 512, mask: false },
  ];

  for (const t of targets) {
    const svg = buildSvg(t.size, t.mask);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(t.file, buf);
    console.log(`Generated ${t.file} (${t.size}x${t.size}, ${buf.length} bytes)`);
  }

  // Also write favicon.ico
  const favSvg = buildSvg(32, false);
  const favPng = await sharp(Buffer.from(favSvg)).png().toBuffer();
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(favPng.length, 8);
  entry.writeUInt32LE(22, 12);

  const icoBuffer = Buffer.concat([header, entry, favPng]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  fs.writeFileSync('src/app/favicon.ico', icoBuffer);
  console.log('Generated favicon.ico successfully!');
}

main().catch(console.error);

