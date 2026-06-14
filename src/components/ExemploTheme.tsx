import React from 'react';
import { useTheme } from '../utils/theme';

export default function ExemploTheme() {
  const theme = useTheme();
  
  return (
    <div style={{ 
      backgroundColor: theme.bgCard,
      color: theme.textPrimary,
      border: `1px solid ${theme.borderColor}`,
      borderRadius: '1rem',
      padding: '1.5rem'
    }}>
      <h3 style={{ color: theme.textPrimary, fontWeight: 'bold', marginBottom: '0.5rem' }}>
        Componente com Tema Dinâmico
      </h3>
      <p style={{ color: theme.textSecondary, marginBottom: '1rem' }}>
        Este componente usa o hook useTheme para aplicar as cores corretas
        automaticamente quando o tema muda.
      </p>
      <button style={{ 
        backgroundColor: theme.primary, 
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '0.75rem',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}>
        Botão com cor primária
      </button>
    </div>
  );
}