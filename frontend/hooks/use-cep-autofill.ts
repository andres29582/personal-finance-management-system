import { useCallback, useRef, useState } from 'react';
import { lookupCep } from '../services/cepService';
import { CepLookupResponse } from '../types/cep';
import { resolveApiError } from '../utils/api-error';
import { formatCepInput, onlyDigits } from '../utils/br-input';

type CepLookupTone = 'error' | 'muted' | 'success';

type UseCepAutofillOptions = {
  disabled?: boolean;
  onResolved: (data: CepLookupResponse) => void;
};

export function useCepAutofill({
  disabled = false,
  onResolved,
}: UseCepAutofillOptions) {
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<CepLookupTone>('muted');
  const [loading, setLoading] = useState(false);
  const lastFetchedCepRef = useRef('');
  const requestIdRef = useRef(0);

  const handleCepValueChange = useCallback(
    (value: string) => {
      const formattedValue = formatCepInput(value);
      const normalizedCep = onlyDigits(formattedValue);

      if (normalizedCep.length < 8) {
        requestIdRef.current += 1;
        lastFetchedCepRef.current = '';
        setLoading(false);
        setMessage('');
        setTone('muted');
        return formattedValue;
      }

      if (
        disabled ||
        normalizedCep.length !== 8 ||
        lastFetchedCepRef.current === normalizedCep
      ) {
        return formattedValue;
      }

      lastFetchedCepRef.current = normalizedCep;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      void (async () => {
        try {
          setLoading(true);
          setTone('muted');
          setMessage('Buscando CEP...');

          const data = await lookupCep(normalizedCep);

          if (requestIdRef.current !== requestId) {
            return;
          }

          onResolved(data);
          setTone('success');
          setMessage(
            data.endereco || data.cidade
              ? 'Endereco preenchido automaticamente.'
              : 'CEP encontrado. Complete o restante manualmente.',
          );
        } catch (error) {
          if (requestIdRef.current !== requestId) {
            return;
          }

          const resolvedError = await resolveApiError(
            error,
            'Nao foi possivel consultar o CEP.',
            {
              404: 'CEP nao encontrado.',
            },
          );

          lastFetchedCepRef.current = '';
          setTone('error');
          setMessage(resolvedError.message);
        } finally {
          if (requestIdRef.current === requestId) {
            setLoading(false);
          }
        }
      })();

      return formattedValue;
    },
    [disabled, onResolved],
  );

  return {
    cepLookupLoading: loading,
    cepLookupMessage: message,
    cepLookupTone: tone,
    handleCepValueChange,
  };
}
