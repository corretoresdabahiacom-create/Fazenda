// src/utils/theme.ts
import { useState, useEffect } from 'react';

export const getThemeStyles = () => {
  const isDark = document.documentElement.classList.contains('dark');
  
  return {
    textPrimary: isDark ? '#f2f5f0' : '#212529',
    textSecondary: isDark ? '#9db5a6' : '#495057',
    textTertiary: isDark ? '#9db5a6' : '#6c757d',
    bgCard: isDark ? '#16301f' : '#ffffff',
    bgSecondary: isDark ? '#1c3a26' : '#f8f9fa',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#dee2e6',
    primary: isDark ? '#4caf6e' : '#2d6a4f',
  };
};

export const useTheme = () => {
  const [theme, setTheme] = useState(getThemeStyles());
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getThemeStyles());
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  
  return theme;
};