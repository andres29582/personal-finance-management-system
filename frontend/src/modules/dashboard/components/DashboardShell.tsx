import { ReactNode } from 'react';
import {
  FinanceAppShell,
  FinanceSidebarItem,
} from '../../../shared/ui';

type DashboardShellProps = {
  activeRoute?: string;
  children: ReactNode;
  header: ReactNode;
  onNavigate: (route: string) => void;
  sidebarItems: FinanceSidebarItem[];
};

export function DashboardShell({
  activeRoute = '/dashboard',
  children,
  header,
  onNavigate,
  sidebarItems,
}: DashboardShellProps) {
  return (
    <FinanceAppShell
      activeRoute={activeRoute}
      brandLabel="Finance"
      header={header}
      onNavigate={onNavigate}
      sidebarItems={sidebarItems}
    >
      {children}
    </FinanceAppShell>
  );
}
