import { useState } from 'react';

interface ScreenState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  success: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setData: (data: T | null) => void;
  setSuccess: (success: string | null) => void;
  reset: () => void;
}

export function useScreenState<T = any>(): ScreenState<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
    setSuccess(null);
  };

  return {
    loading,
    error,
    data,
    success,
    setLoading,
    setError,
    setData,
    setSuccess,
    reset,
  };
}