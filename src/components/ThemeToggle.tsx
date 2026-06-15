// src/components/ThemeToggle.tsx
import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  // MODO CLARO É O PADRÃO (false)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Se não há salvamento, padrão é MODO CLARO
    if (saved === null) return false;
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        backgroundColor: isDark ? '#2d2d2d' : '#f5f5f5',
        border: `1px solid ${isDark ? '#3d3d3d' : '#cccccc'}`,
        color: isDark ? '#ffffff' : '#000000'
      }}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}