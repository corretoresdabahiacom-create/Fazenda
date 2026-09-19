// Os endpoints /api/diagnostico-* são ferramentas de desenvolvimento:
// expõem detalhes da infraestrutura e disparam downloads pesados dos
// arquivos da CONAB/IPEA. Antes ficavam abertos para qualquer pessoa.
//
// Agora só respondem se a variável DIAGNOSTICO_TOKEN estiver configurada
// no Cloudflare Pages E a URL trouxer ?token=<o mesmo valor>. Sem a
// variável, ficam desligados (404). Continuam abríveis direto no
// navegador, como antes — basta acrescentar o token na URL.

export function exigirTokenDiagnostico(request: Request, env: unknown): Response | null {
  const esperado = (env as { DIAGNOSTICO_TOKEN?: string } | undefined)?.DIAGNOSTICO_TOKEN;
  if (!esperado) return new Response('Not found', { status: 404 });
  const recebido = new URL(request.url).searchParams.get('token') || '';
  if (!tempoConstanteIgual(recebido, esperado)) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

function tempoConstanteIgual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
