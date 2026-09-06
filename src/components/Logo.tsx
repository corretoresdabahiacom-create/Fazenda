/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Logomarca do Agro Gestão: uma folha estilizada com uma marca de "check"
// (organização/gestão) — usada de forma consistente no ícone do app, no
// menu lateral e na tela de login.
export default function Logo({ size = 32, withBadge = true }: { size?: number; withBadge?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#256032" />
          <stop offset="100%" stopColor="#337a4d" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#logoBg)" />
      <path
        d="M 50 22 Q 27 50 50 78 Q 73 50 50 22 Z"
        fill="#ffffff"
      />
      <line x1="50" y1="30" x2="50" y2="74" stroke="#256032" strokeWidth="2.5" />
      <line x1="50" y1="42" x2="39" y2="36" stroke="#256032" strokeWidth="1.5" />
      <line x1="50" y1="42" x2="61" y2="36" stroke="#256032" strokeWidth="1.5" />
      <line x1="50" y1="54" x2="38" y2="48" stroke="#256032" strokeWidth="1.5" />
      <line x1="50" y1="54" x2="62" y2="48" stroke="#256032" strokeWidth="1.5" />
      <line x1="50" y1="66" x2="41" y2="61" stroke="#256032" strokeWidth="1.5" />
      <line x1="50" y1="66" x2="59" y2="61" stroke="#256032" strokeWidth="1.5" />
      {withBadge && (
        <>
          <circle cx="68" cy="72" r="12" fill="#FFC857" />
          <path d="M 62 72 L 67 77 L 75 66" stroke="#256032" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
