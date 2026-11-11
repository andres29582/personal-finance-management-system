import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getSessionGeneration, getUser, subscribeAuthState } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import { logout } from '../../auth/services/logoutCoordinator';
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
  const { replace } = router;
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaDestaque, setMetaDestaque] = useState<Meta | null>(null);
  const [message, setMessage] = useState('');
  const [orcamentoMes, setOrcamentoMes] = useState<Orcamento | null>(null);
  const active = useRef(true);
  const clearData = useCallback(() => {
    setUsuario(null);
    setDashboard(null);
    setMetaDestaque(null);
    setOrcamentoMes(null);
    setMessage('');
    setLoading(false);
  }, []);
  useEffect(() => {
    active.current = true;
    let generation = getSessionGeneration();
    const unsubscribe = subscribeAuthState(() => {
      if (generation !== getSessionGeneration()) {
        generation = getSessionGeneration();
        clearData();
      }
    });
    return () => { active.current = false; unsubscribe(); };
  }, [clearData]);
  const reloadDashboard = useCallback(async () => {
    const generation = getSessionGeneration();
    const isCurrent = () => active.current && generation === getSessionGeneration();
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
      if (!isCurrent())
        return;
      setUsuario(user);
      setDashboard(dashboardData);
      setOrcamentoMes(orcamentosResult.status === 'fulfilled'
        ? orcamentosResult.value.find((orcamento) => orcamento.mesReferencia === dashboardData.mesReferencia) ?? null
        : null);
      setMetaDestaque(metasResult.status === 'fulfilled'
        ? metasResult.value.find((meta) => meta.ativa) ?? null
        : null);
    }
    catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar o dashboard.');
      if (!isCurrent())
        return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        replace('/login');
      }
    }
    finally {
      if (isCurrent())
        setLoading(false);
    }
  }, [replace]);
  useFocusEffect(useCallback(() => {
    void reloadDashboard();
  }, [reloadDashboard]));
  const handleLogout = useCallback(async () => {
    const operation = logout();
    clearData();
    replace('/login');
    await operation.completion;
  }, [clearData, replace]);
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
