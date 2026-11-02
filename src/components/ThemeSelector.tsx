'use client';

import { isThemePreference, useTheme } from '@/components/ThemeProvider';

export default function ThemeSelector() {
  const { preference, setPreference } = useTheme();

  return (
    <label className="theme-control">
      <span className="sr-only">Color theme</span>
      <select
        className="theme-select"
        aria-label="Color theme"
        value={preference}
        onChange={(event) => {
          if (isThemePreference(event.target.value)) setPreference(event.target.value);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
