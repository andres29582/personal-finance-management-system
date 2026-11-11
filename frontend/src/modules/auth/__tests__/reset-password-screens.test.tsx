import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { ResetPasswordScreen } from "../screens/ResetPasswordScreen";
import { ResetPasswordTokenScreen } from "../screens/ResetPasswordTokenScreen";
import * as authService from "../services/authService";
import { clearSession } from "../../../../storage/authStorage";

// Isolate form behavior from the unrelated in-progress shared UI implementation.
jest.mock("../../../shared/ui", () => {
  const React = require("react");
  const { View, Text, TextInput, Pressable } = require("react-native");
  return {
    GlassField: ({ children }: { children: unknown }) =>
      React.createElement(View, null, children),
    GlassTextInput: (props: unknown) => React.createElement(TextInput, props),
    GlassButton: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled: boolean;
    }) =>
      React.createElement(
        Pressable,
        { onPress, disabled },
        React.createElement(Text, null, label),
      ),
  };
});

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: mockReplace },
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ token: "valid-token" }),
}));
jest.mock("../services/authService");
jest.mock("../../../../storage/authStorage", () => ({
  clearSession: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockResolvedValue("access-token"),
  getSessionSnapshot: jest.fn().mockResolvedValue({ generation: 0, incarnation: 'reset-origin', revision: 0, sessionId: 'reset-session', accessToken: 'test', refreshToken: 'test' }),
  isSessionCurrent: jest.fn().mockResolvedValue(true),
  getSessionGeneration: jest.fn().mockReturnValue(0),
}));

const mockResetPassword = authService.resetPassword as jest.MockedFunction<
  typeof authService.resetPassword
>;
const mockResetPasswordWithToken =
  authService.resetPasswordWithToken as jest.MockedFunction<
    typeof authService.resetPasswordWithToken
  >;

describe("password reset screens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an oversized password in the authenticated reset screen", () => {
    render(<ResetPasswordScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("Entre 6 e 64 caracteres"),
      "a".repeat(65),
    );
    fireEvent.press(screen.getByText("Atualizar senha"));

    expect(
      screen.getAllByText("A senha deve ter entre 6 e 64 caracteres."),
    ).not.toHaveLength(0);
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("preserves surrounding spaces when resetting with a token", async () => {
    mockResetPasswordWithToken.mockResolvedValue({
      message: "Senha atualizada.",
    });
    render(<ResetPasswordTokenScreen />);
    const password = " senha segura ";

    fireEvent.changeText(
      screen.getByPlaceholderText("Entre 6 e 64 caracteres"),
      password,
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Repita a nova senha"),
      password,
    );
    fireEvent.press(screen.getByText("Redefinir senha"));

    await waitFor(() => {
      expect(mockResetPasswordWithToken).toHaveBeenCalledWith({
        token: "valid-token",
        novaSenha: password,
      });
    });
  });

  it("sends untrimmed legacy current password and clears the session on success", async () => {
    mockResetPassword.mockResolvedValue({ message: "Senha atualizada." });
    render(<ResetPasswordScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText("Digite sua senha atual"),
      " old ",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Entre 6 e 64 caracteres"),
      "NewPassword123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Repita a nova senha"),
      "NewPassword123",
    );
    fireEvent.press(screen.getByText("Atualizar senha"));
    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith({
        senhaAtual: " old ",
        novaSenha: "NewPassword123",
      }),
    );
    await waitFor(() => expect(clearSession).toHaveBeenCalled());
  });

  it("does not clear the session when the current password is incorrect", async () => {
    mockResetPassword.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: {
            code: "AUTH_CURRENT_PASSWORD_INVALID",
            message: "Senha atual incorreta.",
          },
        },
      },
    });
    render(<ResetPasswordScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText("Digite sua senha atual"),
      "wrong",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Entre 6 e 64 caracteres"),
      "NewPassword123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Repita a nova senha"),
      "NewPassword123",
    );
    fireEvent.press(screen.getByText("Atualizar senha"));
    await waitFor(() => expect(mockResetPassword).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getAllByText("Senha atual incorreta.").length,
      ).toBeGreaterThan(0),
    );
    expect(clearSession).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each([
    ["", "NewPassword123"],
    ["old", "DifferentPassword123"],
  ])(
    "rejects missing proof or mismatched confirmation locally",
    (current, confirmation) => {
      render(<ResetPasswordScreen />);
      fireEvent.changeText(
        screen.getByPlaceholderText("Digite sua senha atual"),
        current,
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("Entre 6 e 64 caracteres"),
        "NewPassword123",
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("Repita a nova senha"),
        confirmation,
      );
      fireEvent.press(screen.getByText("Atualizar senha"));
      expect(mockResetPassword).not.toHaveBeenCalled();
    },
  );
});
