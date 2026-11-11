import { describe, expect, it, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useKeyboardVisible } from '../useKeyboardVisible';

describe('useKeyboardVisible', () => {
  it('subscribes to keyboard events and updates state', () => {
    let showCallback: (() => void) | undefined;
    let hideCallback: (() => void) | undefined;

    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event: string, callback: any) => {
        if (event.includes('Show')) {
          showCallback = callback;
        }
        if (event.includes('Hide')) {
          hideCallback = callback;
        }
        return { remove: jest.fn() } as any;
      });

    const { result } = renderHook(() => useKeyboardVisible());

    expect(result.current).toBe(false);

    act(() => {
      showCallback?.();
    });
    expect(result.current).toBe(true);

    act(() => {
      hideCallback?.();
    });
    expect(result.current).toBe(false);

    addListenerSpy.mockRestore();
  });
});

