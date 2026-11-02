'use client';

import React from 'react';

export type MascotState = 'idle' | 'listening' | 'thinking' | 'success';

interface BuddyMascotProps {
  state?: MascotState;
  size?: number;
  className?: string;
}

export default function BuddyMascot({ state = 'idle', size = 44, className = '' }: BuddyMascotProps) {
  const gradId = `tfb-m-grad-${size}`;
  const visorId = `tfb-m-visor-${size}`;
  const rimId = `tfb-m-rim-${size}`;

  return (
    <svg
      className={`tfb-mascot-svg ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        {/* Deep Burgundy & Dark Burgundy 3D Chassis Gradient */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#731110" />
          <stop offset="45%" stopColor="#590907" />
          <stop offset="100%" stopColor="#350407" />
        </linearGradient>
        {/* Dark Burgundy Visor Screen */}
        <linearGradient id={visorId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#250305" />
          <stop offset="100%" stopColor="#140102" />
        </linearGradient>
        {/* 3D Top Rim Light */}
        <linearGradient id={rimId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e8d2b5" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Antenna stem & Warm Cream glowing orb */}
      <line x1="50" y1="21" x2="50" y2="8" stroke="#a5a79b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="7" r="5" fill="#e8d2b5">
        <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Rounded robot ears / audio nodes in Sage & Burgundy */}
      <rect x="13" y="38" width="8" height="20" rx="4" fill="#350407" stroke="#a5a79b" strokeWidth="1" />
      <rect x="79" y="38" width="8" height="20" rx="4" fill="#350407" stroke="#a5a79b" strokeWidth="1" />
      <circle cx="17" cy="48" r="2.2" fill="#e8d2b5" />
      <circle cx="83" cy="48" r="2.2" fill="#e8d2b5" />

      {/* Robot head chassis with 3D depth */}
      <rect
        x="19"
        y="19"
        width="62"
        height="58"
        rx="20"
        fill={`url(#${gradId})`}
        stroke="#e8d2b5"
        strokeWidth="1.6"
        strokeOpacity="0.4"
      />

      {/* 3D Specular highlight on top forehead */}
      <rect
        x="23"
        y="21"
        width="54"
        height="12"
        rx="6"
        fill={`url(#${rimId})`}
      />

      {/* Dark visor display screen */}
      <rect
        x="27"
        y="32"
        width="46"
        height="32"
        rx="10"
        fill={`url(#${visorId})`}
        stroke="#a5a79b"
        strokeWidth="1.2"
      />

      {/* Screen reflection highlight */}
      <path
        d="M 31 35 Q 50 33 69 35 Q 65 41 35 41 Z"
        fill="#ffffff"
        opacity="0.1"
      />

      {/* Dynamic expressive eyes according to state */}
      {state === 'listening' && (
        <>
          <circle cx="39" cy="48" r="6" fill="#e8d2b5" />
          <circle cx="39" cy="48" r="8" fill="none" stroke="#e8d2b5" strokeWidth="1.5" opacity="0.7">
            <animate attributeName="r" values="6;10;6" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="61" cy="48" r="6" fill="#e8d2b5" />
          <circle cx="61" cy="48" r="8" fill="none" stroke="#e8d2b5" strokeWidth="1.5" opacity="0.7">
            <animate attributeName="r" values="6;10;6" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <path d="M 46 56 Q 50 59 54 56" stroke="#e8d2b5" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}

      {state === 'thinking' && (
        <>
          <circle cx="39" cy="46" r="5" fill="#a5a79b" />
          <circle cx="61" cy="46" r="5" fill="#a5a79b" />
          <circle cx="43" cy="56" r="1.8" fill="#e8d2b5">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="0.9s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="56" r="1.8" fill="#e8d2b5">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="0.9s" begin="0.3s" repeatCount="indefinite" />
          </circle>
          <circle cx="57" cy="56" r="1.8" fill="#e8d2b5">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="0.9s" begin="0.6s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {state === 'success' && (
        <>
          <path d="M 34 49 Q 39 42 44 49" stroke="#e8d2b5" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 56 49 Q 61 42 66 49" stroke="#e8d2b5" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 45 55 Q 50 61 55 55" stroke="#e8d2b5" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </>
      )}

      {state === 'idle' && (
        <>
          <ellipse cx="39" cy="47" rx="4.5" ry="5.5" fill="#e8d2b5">
            <animate attributeName="ry" values="5.5;5.5;0.8;5.5" keyTimes="0;0.92;0.96;1" dur="3.5s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="41" cy="45" r="1.5" fill="#ffffff" />
          <ellipse cx="61" cy="47" rx="4.5" ry="5.5" fill="#e8d2b5">
            <animate attributeName="ry" values="5.5;5.5;0.8;5.5" keyTimes="0;0.92;0.96;1" dur="3.5s" repeatCount="indefinite" />
          </ellipse>
          <circle cx="63" cy="45" r="1.5" fill="#ffffff" />
          <path d="M 46 54 Q 50 58 54 54" stroke="#a5a79b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

