// Lista ÚNICA de e-mails de administrador do sistema (Painel Admin,
// cotações manuais, sincronização de usuários, envio de push).
//
// IMPORTANTE: esta lista precisa bater com isBootstrapAdminEmail() em
// firestore.rules — as regras do Firestore não conseguem importar código,
// então lá a lista é repetida. Mude nos dois lugares.
//
// "admin@fazenda.com.br" foi REMOVIDO: a senha dessa conta estava escrita
// no código-fonte público, então qualquer pessoa podia entrar com ela.
export const ADMIN_EMAILS: readonly string[] = [
  'admmeuarmazem@gmail.com',
  'arnaldolima.adv79@gmail.com',
];

/**
 * true só se o e-mail estiver na lista E tiver sido verificado pelo
 * provedor de login (conta Google, ou link de verificação do Firebase).
 * Sem a verificação, alguém poderia criar uma conta com senha usando um
 * desses e-mails antes do dono real.
 */
export function isAdminEmail(email: string | null | undefined, emailVerified: boolean | undefined): boolean {
  if (!email || emailVerified !== true) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
