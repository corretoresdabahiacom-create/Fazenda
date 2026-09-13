// Diagnóstico rápido: confirma se as 3 variáveis do Firebase Admin
// (necessárias pro histórico de preço gravar) estão configuradas no
// ambiente do Cloudflare Pages — sem nunca expor o valor delas, só se
// existem ou não. Acesse /api/diagnostico-firebase pra verificar.

interface Env {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const status = {
    FIREBASE_PROJECT_ID: !!context.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: !!context.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: !!context.env.FIREBASE_PRIVATE_KEY,
  };
  const tudoConfigurado = status.FIREBASE_PROJECT_ID && status.FIREBASE_CLIENT_EMAIL && status.FIREBASE_PRIVATE_KEY;

  return new Response(JSON.stringify({
    tudoConfigurado,
    detalhe: status,
    explicacao: tudoConfigurado
      ? 'As 3 variáveis estão presentes — o histórico de preço deveria estar gravando normalmente.'
      : 'Faltam uma ou mais variáveis (marcadas "false" acima). Sem elas, o histórico de preço nunca grava, e o gráfico Preço x Clima fica sempre sem dado de preço. Configure em: Cloudflare Pages → seu projeto → Settings → Environment variables.',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
