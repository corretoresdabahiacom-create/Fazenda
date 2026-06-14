import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  // Garantir que o modo claro seja o padrão (darkMode = false)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Se não houver salvamento, padrão é MODO CLARO (false)
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
        backgroundColor: isDark ? '#2d2d2d' : '#e9ecef',
        border: `1px solid ${isDark ? '#3d3d3d' : '#d4d4d4'}`,
        color: isDark ? '#f0f0f0' : '#1a1a1a'
      }}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}