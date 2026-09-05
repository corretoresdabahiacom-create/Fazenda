// src/utils/theme.ts
import { useState, useEffect } from 'react';

export const getThemeStyles = () => {
  const isDark = document.documentElement.classList.contains('dark');
  
  return {
    textPrimary: isDark ? '#f2f5f0' : '#212529',
    textSecondary: isDark ? '#a9c2b3' : '#495057',
    textTertiary: isDark ? '#a9c2b3' : '#6c757d',
    bgCard: isDark ? '#1c3a26' : '#ffffff',
    bgSecondary: isDark ? '#234529' : '#f8f9fa',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#dee2e6',
    primary: isDark ? '#5fc785' : '#2d6a4f',
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