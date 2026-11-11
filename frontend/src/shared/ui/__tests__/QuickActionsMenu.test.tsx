import { AccessibilityInfo, Modal, Platform } from 'react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  financeQuickActionGroups,
  financeQuickActions,
  QuickActionsMenu,
} from '../QuickActionsMenu';

describe('QuickActionsMenu', () => {
  it('exposes actions only while open and keeps the FAB accessible', () => {
    render(<QuickActionsMenu onNavigate={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Abrir ações rápidas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nova despesa' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Abrir ações rápidas' }));
    expect(screen.getByRole('button', { name: 'Nova despesa' })).toBeTruthy();

    const fab = screen.getAllByRole('button', { name: 'Fechar ações rápidas' })
      .find(({ props }) => props.accessibilityState?.expanded === true);
    expect(fab).toBeTruthy();
    fireEvent.press(fab!);
    expect(screen.getByRole('button', { name: 'Abrir ações rápidas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nova despesa' })).toBeNull();
  });

  it('exposes the three navigation sections and keeps creation accesses', () => {
    const onNavigate = jest.fn();
    render(<QuickActionsMenu onNavigate={onNavigate} />);

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));

    expect(screen.getByText('Registrar')).toBeTruthy();
    expect(screen.getByText('Gestionar')).toBeTruthy();
    expect(screen.getByText('Consultar')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Registrar' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Gestionar' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Consultar' })).toBeTruthy();
    expect(screen.getByLabelText('Nova conta')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Contas'));
    expect(onNavigate).toHaveBeenCalledWith('/contas');
  });

  it('groups registration, management, and consultation destinations without duplicates', () => {
    const routes = financeQuickActions.map((action) => action.route);

    expect(new Set(routes).size).toBe(routes.length);
    expect(financeQuickActionGroups.map(({ label, actions }) => [
      label,
      actions.map(({ route }) => route),
    ])).toEqual([
      ['Registrar', [
        '/transacoes-form?tipo=receita',
        '/transacoes-form?tipo=despesa',
        '/transferencias-form',
      ]],
      ['Gestionar', [
        '/contas', '/contas-create',
        '/categorias', '/categorias-form',
        '/transferencias',
        '/orcamentos', '/orcamentos-form',
        '/metas', '/metas-form',
        '/dividas', '/dividas-form',
        '/alertas', '/alertas-form',
      ]],
      ['Consultar', ['/transacoes', '/relatorios']],
    ]);
  });
});

it('owns a transparent native modal and dismisses on system Back without navigation', () => {
  const onNavigate=jest.fn();
  const view=render(<QuickActionsMenu onNavigate={onNavigate}/>);
  fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
  const modal=view.UNSAFE_getByType(Modal);
  expect(modal.props.transparent).toBe(true);
  expect(typeof modal.props.onRequestClose).toBe('function');
  fireEvent(modal,'requestClose');
  expect(screen.queryByRole('button',{name:'Nova despesa'})).toBeNull();
  expect(onNavigate).not.toHaveBeenCalled();
});

it.each(['ios','android'] as const)('focuses native entry and respects the %s dismissal lifecycle, never navigation', async (os) => {
  const platform=jest.replaceProperty(Platform,'OS',os);
  const focus=jest.spyOn(AccessibilityInfo,'sendAccessibilityEvent').mockImplementation(()=>{});

  try {
    const view=render(<QuickActionsMenu onNavigate={jest.fn()}/>,{createNodeMock:(element)=>element.type === 'View' ? {setNativeProps:jest.fn()} : null});
    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent(view.UNSAFE_getByType(Modal),'show');
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({setNativeProps:expect.any(Function)}),'focus');focus.mockClear();
    fireEvent(view.UNSAFE_getByType(Modal),'requestClose');
    if (os === 'ios') {
      await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
      expect(focus).not.toHaveBeenCalled();
      fireEvent(view.UNSAFE_getByType(Modal),'dismiss');
    }
    await waitFor(()=>expect(focus).toHaveBeenCalledWith(expect.objectContaining({setNativeProps:expect.any(Function)}),'focus'));focus.mockClear();
    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    const obsoleteShow=view.UNSAFE_getByType(Modal).props.onShow;
    fireEvent.press(screen.getByLabelText('Contas'));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
    expect(focus).not.toHaveBeenCalled();
    view.unmount();obsoleteShow();expect(focus).not.toHaveBeenCalled();
  } finally {platform.restore();focus.mockRestore();}
});

it('closes the modal through accessibility escape and ignores an obsolete dismissal after reopen',()=>{
 const focus=jest.spyOn(AccessibilityInfo,'sendAccessibilityEvent').mockImplementation(()=>{});
 try {
  const view=render(<QuickActionsMenu onNavigate={jest.fn()}/>,{createNodeMock:(element)=>element.type==='View'?{setNativeProps:jest.fn()}:null});
  fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
  const oldDismiss=view.UNSAFE_getByType(Modal).props.onDismiss;
  fireEvent(view.UNSAFE_getByType(Modal),'accessibilityEscape');
  expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
  fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
  oldDismiss();expect(focus).not.toHaveBeenCalled();
 } finally {focus.mockRestore();}
});
