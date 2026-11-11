import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppShell } from '../../src/shared/ui/AppShell';
import { financeQuickActions } from '../../src/shared/ui/QuickActionsMenu';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

const footer = [
  ['Dashboard', '/dashboard'],
  ['Planejamentos', '/planejamentos'],
  ['Previsão ML', '/previsao-deficit'],
  ['Decisões', '/decisoes'],
] as const;

const globalActions = [
  ['Nova receita', '/transacoes-form?tipo=receita'],
  ['Nova despesa', '/transacoes-form?tipo=despesa'],
  ['Transferência', '/transferencias-form'],
  ['Contas', '/contas'],
  ['Nova conta', '/contas-create'],
  ['Categorias', '/categorias'],
  ['Nova categoria', '/categorias-form'],
  ['Transferências', '/transferencias'],
  ['Orçamentos', '/orcamentos'],
  ['Novo orçamento', '/orcamentos-form'],
  ['Metas', '/metas'],
  ['Nova meta', '/metas-form'],
  ['Dívidas', '/dividas'],
  ['Nova dívida', '/dividas-form'],
  ['Alertas', '/alertas'],
  ['Novo alerta', '/alertas-form'],
  ['Transações', '/transacoes'],
  ['Relatórios', '/relatorios'],
] as const;

describe('mobile navigation access contract', () => {
  it('routes the four visible footer tabs to real screens', () => {
    render(<AppShell activeRoute="/dashboard">content</AppShell>);

    expect(screen.getAllByRole('tab')).toHaveLength(footer.length);
    for (const [label, route] of footer) {
      expect(existsSync(join(__dirname, '../../app', `${route.slice(1)}.tsx`))).toBe(true);
      fireEvent.press(screen.getByRole('tab', { name: label }));
      expect(mockPush).toHaveBeenLastCalledWith(route);
    }
  });

  it('routes the independent global actions to real screens', () => {
    render(<AppShell activeRoute="/dashboard">content</AppShell>);
    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));

    for (const [label, route] of globalActions) {
      expect(existsSync(join(__dirname, '../../app', `${route.split('?')[0].slice(1)}.tsx`))).toBe(true);
      expect(financeQuickActions).toContainEqual(expect.objectContaining({ label, route }));
      fireEvent.press(screen.getByRole('button', { name: label }));
      expect(mockPush).toHaveBeenLastCalledWith(route);
      fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    }
  });

  it('keeps entity-dependent routes out of global navigation', () => {
    const globalRoutes = [...footer.map(([, route]) => route), ...financeQuickActions.map(({ route }) => route)];
    const contextualRoutes = [
      '/contas-edit',
      '/planejamentos-detail',
      '/planejamentos-participante-form',
      '/planejamentos-gasto-form',
      '/pagos-divida',
    ];

    for (const route of contextualRoutes) {
      expect(globalRoutes.map((entry) => entry.split('?')[0])).not.toContain(route);
    }
  });

  it('reserves the account destinations for the authenticated profile', () => {
    const globalRoutes = [...footer.map(([, route]) => route), ...financeQuickActions.map(({ route }) => route)];

    for (const route of ['/reset-password', '/privacidade', '/audit-logs']) {
      expect(existsSync(join(__dirname, '../../app', `${route.slice(1)}.tsx`))).toBe(true);
      expect(globalRoutes).not.toContain(route);
    }
  });
});
