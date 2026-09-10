// GET /api/products — seção 32 do documento original.
// Lista os produtos suportados pelo motor de cotações, com a chave
// interna usada em /api/quotes e /api/price-history.

const PRODUCTS = [
  { id: 'boi_gordo', label: 'Boi Gordo', categoria: 'Pecuária' },
  { id: 'vaca', label: 'Vaca', categoria: 'Pecuária' },
  { id: 'novilho', label: 'Novilho/Garrote', categoria: 'Pecuária' },
  { id: 'novilha', label: 'Novilha', categoria: 'Pecuária' },
  { id: 'suinos', label: 'Suínos', categoria: 'Pecuária' },
  { id: 'frango', label: 'Frango', categoria: 'Pecuária' },
  { id: 'leite', label: 'Leite', categoria: 'Pecuária' },
  { id: 'soja', label: 'Soja', categoria: 'Grãos' },
  { id: 'milho', label: 'Milho', categoria: 'Grãos' },
  { id: 'trigo', label: 'Trigo', categoria: 'Grãos' },
  { id: 'arroz', label: 'Arroz', categoria: 'Grãos' },
  { id: 'feijao', label: 'Feijão', categoria: 'Grãos' },
  { id: 'sorgo', label: 'Sorgo', categoria: 'Grãos' },
  { id: 'cafe', label: 'Café', categoria: 'Agricultura' },
  { id: 'algodao', label: 'Algodão', categoria: 'Agricultura' },
  { id: 'acucar', label: 'Açúcar', categoria: 'Agricultura' },
  { id: 'laranja', label: 'Laranja', categoria: 'Agricultura' },
  { id: 'cacau', label: 'Cacau', categoria: 'Agricultura' },
  { id: 'amendoim', label: 'Amendoim', categoria: 'Agricultura' },
  { id: 'ovos', label: 'Ovos', categoria: 'Pecuária' },
  { id: 'mandioca', label: 'Mandioca', categoria: 'Agricultura' },
  { id: 'frutas', label: 'Frutas (Manga, Limão e outras)', categoria: 'Agricultura' },
];

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ products: PRODUCTS, total: PRODUCTS.length }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
  });
};
