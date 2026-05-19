import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { clearSession, getUser } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import { logoutSession } from '../../auth/services/authService';
import { UsuarioLogado } from '../../auth/types/auth';
import { listMetas } from '../../metas/services/metaService';
import { Meta } from '../../metas/types/meta';
import { listOrcamentos } from '../../orcamentos/services/orcamentoService';
import { Orcamento } from '../../orcamentos/types/orcamento';
import { getDashboard } from '../services/dashboardService';
import { DashboardResponse } from '../types/dashboard';

type UseDashboardDataResult = {
  dashboard: DashboardResponse | null;
  handleLogout: () => Promise<void>;
  loading: boolean;
  metaDestaque: Meta | null;
  message: string;
  orcamentoMes: Orcamento | null;
  reloadDashboard: () => Promise<void>;
  usuario: UsuarioLogado | null;
};

export function useDashboardData(): UseDashboardDataResult {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaDestaque, setMetaDestaque] = useState<Meta | null>(null);
  const [message, setMessage] = useState('');
  const [orcamentoMes, setOrcamentoMes] = useState<Orcamento | null>(null);

  const reloadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const [user, dashboardData] = await Promise.all([
        getUser(),
        getDashboard(),
      ]);
      const anoReferencia = dashboardData.mesReferencia.slice(0, 4);
      const [orcamentosResult, metasResult] = await Promise.allSettled([
        listOrcamentos(anoReferencia),
        listMetas(),
      ]);

      setUsuario(user);
      setDashboard(dashboardData);
      setOrcamentoMes(
        orcamentosResult.status === 'fulfilled'
          ? orcamentosResult.value.find(
              (orcamento) =>
                orcamento.mesReferencia === dashboardData.mesReferencia,
            ) ?? null
          : null,
      );
      setMetaDestaque(
        metasResult.status === 'fulfilled'
          ? metasResult.value.find((meta) => meta.ativa) ?? null
          : null,
      );
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar o dashboard.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void reloadDashboard();
    }, [reloadDashboard]),
  );

  const handleLogout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      await clearSession();
      router.replace('/login');
    }
  }, [router]);

  return {
    dashboard,
    handleLogout,
    loading,
    metaDestaque,
    message,
    orcamentoMes,
    reloadDashboard,
    usuario,
  };
}
