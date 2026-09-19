import { auth } from './firebase';

/**
 * fetch que envia o ID token do Firebase do usuário logado no header
 * Authorization. Os endpoints de IA, push e pagamentos exigem login no
 * servidor — sem o token eles respondem 401.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
  if (idToken) headers.set('Authorization', `Bearer ${idToken}`);
  return fetch(input, { ...init, headers });
}
