import { FinanceTheme } from './financeTheme';

export const FinanceLayout = {
  maxContentWidth: 1180,
  minDesktopWidth: 900,
  sidebarWidth: 88,
  sidebarExpandedWidth: 236,
  headerMinHeight: 76,
  cardMinHeight: 132,
  chartCardMinHeight: 260,
  compactChartCardMinHeight: 220,
  gridGap: FinanceTheme.spacing.md,
  screenPadding: {
    mobile: FinanceTheme.spacing.md,
    tablet: FinanceTheme.spacing.lg,
    desktop: FinanceTheme.spacing.xl,
  },
  breakpoints: {
    mobileMax: 599,
    tabletMin: 600,
    tabletMax: 899,
    desktopMin: 900,
  },
} as const;

export function getFinanceContentPadding(width: number) {
  if (width >= FinanceLayout.breakpoints.desktopMin) {
    return FinanceLayout.screenPadding.desktop;
  }

  if (width >= FinanceLayout.breakpoints.tabletMin) {
    return FinanceLayout.screenPadding.tablet;
  }

  return FinanceLayout.screenPadding.mobile;
}

export function isFinanceDesktop(width: number) {
  return width >= FinanceLayout.breakpoints.desktopMin;
}

export function isFinanceTablet(width: number) {
  return (
    width >= FinanceLayout.breakpoints.tabletMin &&
    width <= FinanceLayout.breakpoints.tabletMax
  );
}
