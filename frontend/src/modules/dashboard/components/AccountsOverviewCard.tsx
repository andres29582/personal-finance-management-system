import { AppStatusCard } from '../../../../components/app-screen';

type AccountsOverviewCardProps = {
  onCreateAccount: () => void;
  totalContas: number;
};

export function AccountsOverviewCard({
  onCreateAccount,
  totalContas,
}: AccountsOverviewCardProps) {
  if (totalContas === 0) {
    return (
      <AppStatusCard
        title="Comece criando sua primeira conta"
        description="As contas sao a base para registrar transacoes, orcamentos e relatorios."
        actionLabel="Nova conta"
        onActionPress={onCreateAccount}
      />
    );
  }

  return null;
}
