import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DecisoesScreen from '../app/decisoes';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

describe('DecisoesScreen', () => {
  it('explica que a tela e somente leitura e abre o perfil', () => {
    render(<DecisoesScreen />);

    expect(screen.getByText('Somente leitura')).toBeTruthy();
    expect(
      screen.getByText(
        'Esta área é somente informativa. Nenhuma decisão é criada, salva ou executada por esta tela.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Perfil'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');
  });
});
