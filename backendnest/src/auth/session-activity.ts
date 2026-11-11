import { Request } from 'express';

// No GET can distinguish polling from a person. Unknown routes never renew idle.
const interactiveRoutes: Readonly<Record<string, RegExp[]>> = {
  POST: [
    /^\/(categorias|contas|dividas|metas|orcamentos|pagos-divida|transacoes|transferencias|planejamentos|alertas)$/,
    /^\/orcamentos\/[^/]+\/categorias$/,
    /^\/planejamentos\/[^/]+\/(participantes|gastos|acertos\/sincronizar)$/,
  ],
  PATCH: [
    /^\/users\/me$/,
    /^\/(categorias|contas|dividas|metas|orcamentos|transacoes|transferencias|alertas)\/[^/]+$/,
    /^\/(categorias|contas|dividas|metas|alertas)\/[^/]+\/desativar$/,
    /^\/orcamentos\/[^/]+\/categorias\/[^/]+$/,
    /^\/planejamentos\/[^/]+\/(fechar|arquivar|cancelar)$/,
    /^\/planejamentos\/[^/]+\/(gastos|acertos)\/[^/]+(?:\/(cancelar|pagar|reabrir))?$/,
  ],
  DELETE: [
    /^\/(transacoes|transferencias|pagos-divida)\/[^/]+$/,
    /^\/orcamentos\/[^/]+\/categorias\/[^/]+$/,
    /^\/planejamentos\/[^/]+\/participantes\/[^/]+$/,
  ],
};
export function isEligibleSessionActivity(request: Request): boolean {
  const path = request.path?.replace(/\/$/, '') || '';
  return (
    interactiveRoutes[request.method]?.some((route) => route.test(path)) ??
    false
  );
}
