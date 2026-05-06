import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('setup de testes do frontend', () => {
  it('renderiza um componente React Native com Jest e Expo', () => {
    render(<Text>Teste do frontend configurado</Text>);

    expect(screen.getByText('Teste do frontend configurado')).toBeTruthy();
  });
});
