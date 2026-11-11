import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppLoading } from '../../../../components/app-loading';
import { AuthScreen } from '../../../../components/auth-screen';
import { getToken, subscribeAuthState } from '../../../../storage/authStorage';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassPanel,
} from '../../../shared/ui';

const BULLETS = [
  'Dados cadastrais e financeiros sao usados apenas para operar o sistema (finalidade legitima do servico).',
  'Registros de auditoria (data, modulo, acao e endereco IP) ajudam a rastrear operacoes e cumprir boas praticas de seguranca.',
  'Voce pode solicitar correcao de dados inexatos e consultar os logs das suas proprias acoes na area Log de auditoria.',
  'A senha e armazenada com hash; tokens de recuperacao sao guardados apenas como resumo criptografico (hash).',
  'Este texto resume o tratamento no MVP academico; em producao seria necessario DPO, base legal detalhada e canais formais do titular.',
];

export function PrivacidadeScreen() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function syncAuthState() {
      const token = await getToken();
      if (active) setAuthenticated(Boolean(token));
    }

    void syncAuthState();
    const unsubscribe = subscribeAuthState(() => void syncAuthState());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const content = (
    <GlassPanel>
      <Text style={styles.p}>
        O sistema processa dados pessoais (nome, e-mail, CPF, endereco) e dados financeiros que voce
        cadastra. O tratamento segue o principio da minimizacao: coletamos apenas o necessario para
        contas, transacoes, relatorios e auditoria.
      </Text>
      {BULLETS.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={styles.bullet}>*</Text>
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
      <Text style={styles.p}>
        Ao criar conta, voce confirma que leu este resumo. Para duvidas em ambiente academico, consulte
        a equipe do projeto ou o docente responsavel.
      </Text>
    </GlassPanel>
  );

  if (authenticated === null) return <AppLoading />;

  if (!authenticated) {
    return (
      <AuthScreen title="Privacidade e LGPD" subtitle="Resumo para o usuario final" cardMaxWidth={520}>
        {content}
        <View style={styles.actions}>
          <GlassButton label="Ir ao login" onPress={() => router.replace('/login' as never)} variant="ghost" />
          <GlassButton label="Ir ao cadastro" onPress={() => router.replace('/register' as never)} variant="ghost" />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AppShell
      activeRoute="/privacidade"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          eyebrow="Dados e seguranca"
          subtitle="Resumo para o usuario final"
          title="Privacidade e LGPD"
        />
      }
    >
      {content}
      <View style={styles.actions}>
        <GlassButton label="Voltar ao perfil" onPress={() => router.replace('/usuario' as never)} variant="ghost" />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'center',
    marginTop: FinanceTheme.spacing.md,
  },
  bullet: {
    color: FinanceTheme.colors.cyanMuted,
    marginRight: FinanceTheme.spacing.xs,
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    marginTop: FinanceTheme.spacing.sm,
    paddingRight: FinanceTheme.spacing.xs,
  },
  bulletText: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    lineHeight: 20,
  },
  p: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    lineHeight: 22,
    marginBottom: FinanceTheme.spacing.sm,
  },
});

export default PrivacidadeScreen;
