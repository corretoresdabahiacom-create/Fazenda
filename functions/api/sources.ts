// GET /api/sources — seção 32 do documento original.
// Lista TODAS as fontes conhecidas do motor de cotações: as ativas
// (testadas, trazendo dado real) e as preparadas/desabilitadas (ver
// adapters-status.ts pro detalhe de cada uma).

import { PREPARED_ADAPTERS } from './adapters-status';

const ACTIVE_SOURCES = [
  { nome: 'Notícias Agrícolas', tipo: 'mercado', cobertura: 'Nacional — todos os produtos', status: 'ativa' },
  { nome: 'IEA-SP', tipo: 'oficial', cobertura: 'Só Estado de São Paulo', status: 'ativa' },
  { nome: 'Incaper', tipo: 'oficial', cobertura: 'Só Espírito Santo', status: 'ativa' },
  { nome: 'Epagri/Cepa', tipo: 'oficial', cobertura: 'Só Santa Catarina', status: 'ativa' },
  { nome: 'AIBA', tipo: 'mercado', cobertura: 'Oeste da Bahia — grãos', status: 'ativa' },
  { nome: 'Scot Consultoria (Boi no Mundo)', tipo: 'internacional', cobertura: 'Comparativo internacional (8 países)', status: 'ativa' },
  { nome: 'TradingEconomics', tipo: 'internacional', cobertura: 'Boi Gordo — referência EUA', status: 'ativa' },
  { nome: 'Yahoo Finance', tipo: 'internacional', cobertura: 'Futuros EUA (CBOT/ICE/CME)', status: 'ativa' },
  { nome: 'Frankfurter (BCE)', tipo: 'oficial', cobertura: 'Câmbio — todas as moedas', status: 'ativa' },
  { nome: 'Banco Central do Brasil (PTAX)', tipo: 'oficial', cobertura: 'Câmbio — reserva', status: 'ativa' },
];

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({
    ativas: ACTIVE_SOURCES,
    preparadas: PREPARED_ADAPTERS,
    total: ACTIVE_SOURCES.length + PREPARED_ADAPTERS.length,
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
};
