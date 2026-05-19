import { FinanceAppHeader } from '../../../shared/ui';

type DashboardHeaderProps = {
  email?: string;
  monthReference?: string;
  onLogout: () => void;
  onProfilePress: () => void;
  userName?: string;
};

export function DashboardHeader({
  email,
  monthReference,
  onLogout,
  onProfilePress,
  userName,
}: DashboardHeaderProps) {
  return (
    <FinanceAppHeader
      avatarSource={require('../../../../assets/images/icone-usuario.png')}
      eyebrow="Dashboard financeiro"
      meta={monthReference}
      onLogout={onLogout}
      onProfilePress={onProfilePress}
      subtitle={email ?? 'Resumo financeiro do mes'}
      title={`Ola${userName ? `, ${userName}` : ''}`}
    />
  );
}
