import { FinanceSidebarItem } from '../ui';

export const financeSidebarItems: FinanceSidebarItem[] = [
  { icon: 'view-dashboard-outline', label: 'Dashboard', route: '/dashboard' },
  { icon: 'wallet-outline', label: 'Contas', route: '/contas' },
  { icon: 'swap-horizontal', label: 'Transacoes', route: '/transacoes' },
  { icon: 'tag-outline', label: 'Categorias', route: '/categorias' },
  { icon: 'cash-multiple', label: 'Orcamentos', route: '/orcamentos' },
  { icon: 'chart-box-outline', label: 'Relatorios', route: '/relatorios' },
  {
    icon: 'chart-timeline-variant',
    label: 'Previsao ML',
    route: '/previsao-deficit',
  },
  { icon: 'bullseye-arrow', label: 'Metas', route: '/metas' },
  { icon: 'bank-transfer', label: 'Transferencias', route: '/transferencias' },
  { icon: 'receipt-text-outline', label: 'Dividas', route: '/dividas' },
  { icon: 'shield-search', label: 'Auditoria', route: '/audit-logs' },
  { icon: 'lock-reset', label: 'Senha', route: '/reset-password' },
];
