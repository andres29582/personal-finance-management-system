import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthScreen } from '../../../../components/auth-screen';
import { FinanceTheme } from '../../../shared/styles/financeTheme';

const BULLETS = [
  'Dados cadastrais e financeiros sao usados apenas para operar o sistema (finalidade legitima do servico).',
  'Registros de auditoria (data, modulo, acao, IP resumido) ajudam a rastrear operacoes e cumprir boas praticas de seguranca.',
  'Voce pode solicitar correcao de dados inexatos e consultar os logs das suas proprias acoes na area Log de auditoria.',
  'A senha e armazenada com hash; tokens de recuperacao sao guardados apenas como resumo criptografico (hash).',
  'Este texto resume o tratamento no MVP academico; em producao seria necessario DPO, base legal detalhada e canais formais do titular.',
];

export function PrivacidadeScreen() {
  const router = useRouter();

  return (
    <AuthScreen title="Privacidade e LGPD" subtitle="Resumo para o usuario final" cardMaxWidth={520}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
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
      </ScrollView>
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={() => router.replace('/login' as never)}>
          <Text style={styles.backText}>Ir ao login</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/register' as never)}>
          <Text style={styles.backText}>Ir ao cadastro</Text>
        </TouchableOpacity>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  backText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: 15,
    fontWeight: '800',
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
  footerLinks: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.lg,
    justifyContent: 'center',
    marginTop: FinanceTheme.spacing.md,
  },
  p: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    lineHeight: 22,
    marginBottom: FinanceTheme.spacing.sm,
  },
  scroll: {
    maxHeight: 420,
  },
});

export default PrivacidadeScreen;
