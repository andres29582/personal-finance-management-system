import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthScreen } from '../../../../components/auth-screen';
import { clearSession, getToken } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { GlassButton, GlassField, GlassTextInput } from '../../../shared/ui';
import { resetPassword } from '../services/authService';
import { validatePassword } from '../validators/passwordPolicy';

export function ResetPasswordScreen() {
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function validateSession() {
      const token = await getToken();

      if (!token) {
        router.replace('/login');
      }
    }

    validateSession();

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  async function handleResetPassword() {
    setErro('');
    setSucesso('');

    const passwordValidation = validatePassword(novaSenha);
    if (!passwordValidation.valid) {
      setErro(passwordValidation.message);
      return;
    }

    try {
      setLoading(true);

      const resposta = await resetPassword({
        novaSenha,
      });

      setSucesso(resposta.message || 'Senha atualizada. Faca login novamente.');
      await clearSession();

      redirectTimeoutRef.current = setTimeout(() => {
        router.replace('/login');
      }, 1500);
    } catch (error) {
      const status = (error as any)?.response?.status;

      if (status === 401) {
        await clearSession();
        setErro('Sua sessao expirou. Faca login novamente.');
        router.replace('/login');
      } else {
        const resolved = await resolveApiError(error, 'Nao foi possivel atualizar a senha.');
        setErro(resolved.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Alterar senha"
      subtitle="Defina uma nova senha para manter sua conta protegida."
      cardMaxWidth={380}
    >
      <GlassField label="Nova senha" error={erro && !sucesso ? erro : undefined}>
        <GlassTextInput
          placeholder="Entre 6 e 64 caracteres"
          secureTextEntry
          value={novaSenha}
          onChangeText={(value) => {
            setNovaSenha(value);
            setErro('');
            setSucesso('');
          }}
          editable={!loading}
        />
      </GlassField>

      {erro && !sucesso ? <Text style={styles.errorMessage}>{erro}</Text> : null}
      {sucesso ? <Text style={styles.infoMessage}>{sucesso}</Text> : null}

      <View style={styles.actions}>
        <GlassButton
          label={loading ? 'Atualizando...' : 'Atualizar senha'}
          onPress={handleResetPassword}
          disabled={loading}
        />
      </View>

      <TouchableOpacity
        style={styles.back}
        onPress={() => router.replace('/dashboard' as never)}
        disabled={loading}
      >
        <Text style={styles.backText}>Voltar para home</Text>
      </TouchableOpacity>
    </AuthScreen>
  );
}

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  actions: {
    marginTop: FinanceTheme.spacing.md,
  },
  back: {
    alignItems: 'center',
    marginTop: FinanceTheme.spacing.lg,
  },
  backText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  infoMessage: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
});
