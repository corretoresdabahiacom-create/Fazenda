// src/utils/theme.ts
import { useState, useEffect } from 'react';

export const getThemeStyles = () => {
  const isDark = document.documentElement.classList.contains('dark');
  
  return {
    textPrimary: isDark ? '#e9ecef' : '#212529',
    textSecondary: isDark ? '#ced4da' : '#495057',
    textTertiary: isDark ? '#adb5bd' : '#6c757d',
    bgCard: isDark ? '#1e1e1e' : '#ffffff',
    bgSecondary: isDark ? '#1e1e1e' : '#f8f9fa',
    borderColor: isDark ? '#2d2d2d' : '#dee2e6',
    primary: isDark ? '#52b788' : '#2d6a4f',
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