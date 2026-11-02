import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Requirement 3: Anti-Regression Lint and Theme Guard', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const appDir = path.join(rootDir, 'src/app');
  const signedInAppDir = path.join(appDir, '(app)');

  function getAllFiles(dir: string, ext: string[]): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getAllFiles(fullPath, ext));
      } else if (ext.some(e => entry.name.endsWith(e))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  test('Anti-Regression 1: No duplicate top-level function or component declarations in any TSX file', () => {
    const tsxFiles = getAllFiles(appDir, ['.tsx']);
    expect(tsxFiles.length).toBeGreaterThan(0);

    const violations: { file: string; identifier: string; lines: number[] }[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      // Track function, class, and component declarations
      const declarations = new Map<string, number[]>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Only inspect top-level declarations (column 0, not indented inside inner functions)
        const isTopLevel = !line.startsWith(' ') && !line.startsWith('\t');
        if (!isTopLevel) continue;

        // Match top-level or exported function declarations
        const funcMatch = line.match(/^(?:export\s+(?:default\s+)?)?function\s+([A-Za-z0-9_]+)\s*\(/);
        if (funcMatch) {
          const name = funcMatch[1];
          const existing = declarations.get(name) || [];
          existing.push(i + 1);
          declarations.set(name, existing);
        }

        // Match const/let component or utility declarations at top-level scope
        const constMatch = line.match(/^(?:export\s+)?(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/);
        if (constMatch) {
          const name = constMatch[1];
          const existing = declarations.get(name) || [];
          existing.push(i + 1);
          declarations.set(name, existing);
        }
      }

      for (const [id, lineNums] of declarations.entries()) {
        if (lineNums.length > 1) {
          const relPath = path.relative(rootDir, file);
          violations.push({ file: relPath, identifier: id, lines: lineNums });
        }
      }
    }

    if (violations.length > 0) {
      const details = violations.map(v => `${v.file}: "${v.identifier}" declared at lines ${v.lines.join(', ')}`).join('\n');
      expect(violations, `Found duplicate component/function declarations:\n${details}`).toHaveLength(0);
    }
    expect(violations).toHaveLength(0);
  });

  test('Anti-Regression 2: Zero forbidden dark-theme utility classes in (app) route group', () => {
    const files = getAllFiles(signedInAppDir, ['.tsx', '.css']);
    expect(files.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /bg-slate-(?:600|700|800|900|950)/g,
      /text-slate-(?:600|700|800|900|950)/g,
      /border-slate-(?:600|700|800|900|950)/g,
      /bg-zinc-(?:600|700|800|900|950)/g,
      /text-zinc-(?:600|700|800|900|950)/g,
      /border-zinc-(?:600|700|800|900|950)/g,
      /bg-gray-(?:800|900|950)/g,
      /bg-neutral-(?:800|900|950)/g,
    ];

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        for (const pattern of forbiddenPatterns) {
          pattern.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = pattern.exec(lineText)) !== null) {
            violations.push({
              file: path.relative(rootDir, file),
              line: idx + 1,
              match: m[0],
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const details = violations.map(v => `${v.file}:${v.line} -> ${v.match}`).join('\n');
      expect(violations, `Found forbidden dark-theme classes in (app):\n${details}`).toHaveLength(0);
    }
    expect(violations).toHaveLength(0);
  });

  test('Anti-Regression 3: Pages under (app) must not render their own app-layout or Sidebar', () => {
    const tsxFiles = getAllFiles(signedInAppDir, ['.tsx']);
    // Filter out the shared layout itself: src/app/(app)/layout.tsx
    const pageFiles = tsxFiles.filter(f => !f.endsWith('(app)\\layout.tsx') && !f.endsWith('(app)/layout.tsx'));

    const violations: { file: string; line: number; violation: string }[] = [];

    for (const file of pageFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        if (/className=["'].*app-layout.*["']/.test(lineText)) {
          violations.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            violation: 'Contains app-layout container (should be handled by layout.tsx)',
          });
        }
        if (/<Sidebar\b/.test(lineText)) {
          violations.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            violation: 'Renders <Sidebar /> directly (should be handled by layout.tsx)',
          });
        }
      });
    }

    if (violations.length > 0) {
      const details = violations.map(v => `${v.file}:${v.line} -> ${v.violation}`).join('\n');
      expect(violations, `Found per-page shells inside (app) pages:\n${details}`).toHaveLength(0);
    }
    expect(violations).toHaveLength(0);
  });
});
