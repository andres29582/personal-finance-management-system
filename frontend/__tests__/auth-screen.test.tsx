import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthScreen } from '../components/auth-screen';

describe('AuthScreen', () => {
  it('uses the AEPV.ia.finance baseline without legacy security chrome', () => {
    render(
      <AuthScreen title="Teste" subtitle="Descricao de teste">
        <Text>Conteudo da tela</Text>
      </AuthScreen>,
    );

    expect(screen.getAllByText(/AEPV/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.ia\.finance/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Teste')).toBeTruthy();
    expect(screen.getByText('Conteudo da tela')).toBeTruthy();
    expect(screen.queryByText('ACESSO SEGURO')).toBeNull();
    expect(screen.queryByLabelText('Acesso seguro')).toBeNull();
    expect(screen.queryByText(/AquaFinance/i)).toBeNull();
  });
});
