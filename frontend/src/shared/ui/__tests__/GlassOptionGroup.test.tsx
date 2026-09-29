import { fireEvent, render, screen } from '@testing-library/react-native';
import { GlassOptionGroup } from '../GlassOptionGroup';

describe('GlassOptionGroup', () => {
  it('does not change a disabled option and exposes its disabled state', () => {
    const onChange = jest.fn();

    render(
      <GlassOptionGroup
        disabled
        onChange={onChange}
        options={[{ label: 'Checking', value: 'checking' }]}
        value="checking"
      />,
    );

    const option = screen.getByRole('button', { name: 'Checking' });
    fireEvent.press(option);

    expect(onChange).not.toHaveBeenCalled();
    expect(option.props.accessibilityState).toEqual({ disabled: true, selected: true });
  });
});
