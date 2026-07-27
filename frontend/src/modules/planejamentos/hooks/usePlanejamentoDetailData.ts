import { useCallback, useEffect, useRef, useState } from 'react';
import { getUser } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import {
  getPlanejamentoById,
  getResumoPlanejamento,
  listAcertosPlanejamento,
  listGastosPlanejamento,
} from '../services/planejamentoService';
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
} from '../types/planejamento';

export type UsePlanejamentoDetailDataOptions = {
  onUnauthorized: () => void;
  planejamentoId?: string;
};

export type UsePlanejamentoDetailDataResult = {
  acertos: AcertoPlanejamento[];
  applyParticipantUpdate: (
    participante: ParticipantePlanejamento,
  ) => void;
  gastos: GastoPlanejamento[];
  isCurrentContext: (expectedPlanejamentoId: string) => boolean;
  loading: boolean;
  message: string;
  participantPermissionError: string;
  planejamento: Planejamento | null;
  refreshExpenseFinancialData: (
    expectedPlanejamentoId: string,
  ) => Promise<boolean>;
  refreshFinancialData: (
    expectedPlanejamentoId: string,
  ) => Promise<boolean>;
  reloadAllData: (expectedPlanejamentoId: string) => Promise<boolean>;
  resumo: ResumoFinanceiroPlanejamento | null;
  usuarioAutenticadoId: string | null;
};

export function usePlanejamentoDetailData({
  onUnauthorized,
  planejamentoId,
}: UsePlanejamentoDetailDataOptions): UsePlanejamentoDetailDataResult {
  const [planejamento, setPlanejamento] = useState<Planejamento | null>(null);
  const [resumo, setResumo] =
    useState<ResumoFinanceiroPlanejamento | null>(null);
  const [gastos, setGastos] = useState<GastoPlanejamento[]>([]);
  const [acertos, setAcertos] = useState<AcertoPlanejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [usuarioAutenticadoId, setUsuarioAutenticadoId] = useState<
    string | null
  >(null);
  const [participantPermissionError, setParticipantPermissionError] =
    useState('');
  const identityGenerationRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const onUnauthorizedRef = useRef(onUnauthorized);
  const planejamentoIdRef = useRef(planejamentoId);

  onUnauthorizedRef.current = onUnauthorized;
  planejamentoIdRef.current = planejamentoId;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      identityGenerationRef.current += 1;
      loadGenerationRef.current += 1;
    };
  }, []);

  const isCurrentContext = useCallback(
    (expectedPlanejamentoId: string) =>
      mountedRef.current &&
      planejamentoIdRef.current === expectedPlanejamentoId,
    [],
  );

  const isCurrentDataLoad = useCallback(
    (expectedPlanejamentoId: string, generation: number) =>
      isCurrentContext(expectedPlanejamentoId) &&
      loadGenerationRef.current === generation,
    [isCurrentContext],
  );

  const beginDataLoad = useCallback(
    (expectedPlanejamentoId: string) => {
      if (!isCurrentContext(expectedPlanejamentoId)) {
        return null;
      }

      return ++loadGenerationRef.current;
    },
    [isCurrentContext],
  );

  const loadAllData = useCallback(
    async (
      expectedPlanejamentoId: string,
      finishLoading: boolean,
    ): Promise<boolean> => {
      const generation = beginDataLoad(expectedPlanejamentoId);

      if (generation === null) {
        return false;
      }

      try {
        const [data, resumoData, gastosData, acertosData] = await Promise.all([
          getPlanejamentoById(expectedPlanejamentoId),
          getResumoPlanejamento(expectedPlanejamentoId),
          listGastosPlanejamento(expectedPlanejamentoId),
          listAcertosPlanejamento(expectedPlanejamentoId),
        ]);

        if (!isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          return false;
        }

        setPlanejamento(data);
        setResumo(resumoData);
        setGastos(gastosData);
        setAcertos(acertosData);
        return true;
      } catch (error) {
        if (!isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          return false;
        }

        throw error;
      } finally {
        if (
          finishLoading &&
          isCurrentDataLoad(expectedPlanejamentoId, generation)
        ) {
          setLoading(false);
        }
      }
    },
    [beginDataLoad, isCurrentDataLoad],
  );

  const reloadAllData = useCallback(
    (expectedPlanejamentoId: string) =>
      loadAllData(expectedPlanejamentoId, true),
    [loadAllData],
  );

  const refreshFinancialData = useCallback(
    async (expectedPlanejamentoId: string): Promise<boolean> => {
      const generation = beginDataLoad(expectedPlanejamentoId);

      if (generation === null) {
        return false;
      }

      try {
        const [resumoData, acertosData] = await Promise.all([
          getResumoPlanejamento(expectedPlanejamentoId),
          listAcertosPlanejamento(expectedPlanejamentoId),
        ]);

        if (!isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          return false;
        }

        setResumo(resumoData);
        setAcertos(acertosData);
        return true;
      } catch (error) {
        if (!isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          return false;
        }

        throw error;
      } finally {
        if (isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          setLoading(false);
        }
      }
    },
    [beginDataLoad, isCurrentDataLoad],
  );

  const refreshExpenseFinancialData = useCallback(
    async (expectedPlanejamentoId: string): Promise<boolean> => {
      const generation = beginDataLoad(expectedPlanejamentoId);

      if (generation === null) {
        return false;
      }

      try {
        const [resumoData, gastosData, acertosData] = await Promise.all([
          getResumoPlanejamento(expectedPlanejamentoId),
          listGastosPlanejamento(expectedPlanejamentoId),
          listAcertosPlanejamento(expectedPlanejamentoId),
        ]);

        if (!isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          return false;
        }

        setResumo(resumoData);
        setGastos(gastosData);
        setAcertos(acertosData);
        return true;
      } catch (error) {
        if (!isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          return false;
        }

        throw error;
      } finally {
        if (isCurrentDataLoad(expectedPlanejamentoId, generation)) {
          setLoading(false);
        }
      }
    },
    [beginDataLoad, isCurrentDataLoad],
  );

  const applyParticipantUpdate = useCallback(
    (participante: ParticipantePlanejamento) => {
      if (!isCurrentContext(participante.planejamentoId)) {
        return;
      }

      setPlanejamento((current) => {
        if (!current || current.id !== participante.planejamentoId) {
          return current;
        }

        return {
          ...current,
          participantes: current.participantes?.map((item) =>
            item.id === participante.id ? participante : item,
          ),
        };
      });
    },
    [isCurrentContext],
  );

  useEffect(() => {
    let active = true;

    async function loadPlanejamento() {
      if (!planejamentoId) {
        loadGenerationRef.current += 1;

        if (active && mountedRef.current) {
          setMessage('Planejamento nao informado.');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setMessage('');

      const loadPromise = loadAllData(planejamentoId, false);
      const generation = loadGenerationRef.current;

      try {
        await loadPromise;
      } catch (error) {
        if (
          !active ||
          !isCurrentDataLoad(planejamentoId, generation)
        ) {
          return;
        }

        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o planejamento.',
        );

        if (
          !active ||
          !isCurrentDataLoad(planejamentoId, generation)
        ) {
          return;
        }

        setMessage(resolvedError.message);

        if (resolvedError.unauthorized) {
          onUnauthorizedRef.current();
        }
      } finally {
        if (
          active &&
          isCurrentDataLoad(planejamentoId, generation)
        ) {
          setLoading(false);
        }
      }
    }

    void loadPlanejamento();

    return () => {
      active = false;
    };
  }, [isCurrentDataLoad, loadAllData, planejamentoId]);

  useEffect(() => {
    let active = true;
    const expectedPlanejamentoId = planejamentoId;
    const identityGeneration = ++identityGenerationRef.current;

    setUsuarioAutenticadoId(null);

    async function loadUsuarioAutenticado() {
      try {
        const usuarioAutenticado = await getUser();

        if (
          !active ||
          !mountedRef.current ||
          planejamentoIdRef.current !== expectedPlanejamentoId ||
          identityGeneration !== identityGenerationRef.current
        ) {
          return;
        }

        setUsuarioAutenticadoId(usuarioAutenticado?.id ?? null);
        setParticipantPermissionError('');
      } catch {
        if (
          !active ||
          !mountedRef.current ||
          planejamentoIdRef.current !== expectedPlanejamentoId ||
          identityGeneration !== identityGenerationRef.current
        ) {
          return;
        }

        setUsuarioAutenticadoId(null);
        setParticipantPermissionError(
          'Não foi possível verificar sua permissão para gerenciar participantes.',
        );
      }
    }

    void loadUsuarioAutenticado();

    return () => {
      active = false;
    };
  }, [planejamentoId]);

  return {
    acertos,
    applyParticipantUpdate,
    gastos,
    isCurrentContext,
    loading,
    message,
    participantPermissionError,
    planejamento,
    refreshExpenseFinancialData,
    refreshFinancialData,
    reloadAllData,
    resumo,
    usuarioAutenticadoId,
  };
}
