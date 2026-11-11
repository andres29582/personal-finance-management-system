import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SessionsScreen } from "../screens/SessionsScreen";
import * as sessions from "../services/sessionManagement";
import * as storage from "../../../../storage/authStorage";
import { suspendOwnedSessionAuthority } from "../services/sessionAuthority";
jest.setTimeout(15000);
const mockReplace = jest.fn(),
  mockRouter = { replace: mockReplace };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../services/sessionManagement");
jest.mock("../services/sessionAuthority", () => ({
  getSessionAuthorityEpoch: () => 1,
  suspendOwnedSessionAuthority: jest.fn(),
}));
jest.mock("../../../../storage/authStorage");
jest.mock("../../../shared/ui", () => {
  const React = require("react"),
    { View, Text, TextInput, Pressable } = require("react-native");
  return {
    AppShell: ({ children, pageHeader }: any) => (
      <View>
        {pageHeader}
        {children}
      </View>
    ),
    FinanceAppHeader: ({ title, action }: any) => (
      <View>
        <Text>{title}</Text>
        {action}
      </View>
    ),
    GlassPanel: ({ children }: any) => <View>{children}</View>,
    GlassField: ({ children }: any) => <View>{children}</View>,
    GlassTextInput: (props: any) => <TextInput {...props} />,
    GlassButton: ({ label, onPress, disabled }: any) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{label}</Text>
      </Pressable>
    ),
    GlassStatusCard: ({ title, description }: any) => (
      <View>
        <Text>{title}</Text>
        <Text>{description}</Text>
      </View>
    ),
  };
});
const origin = {
  generation: 1,
  incarnation: "A",
  revision: 0,
  sessionId: "current",
  accessToken: "access",
  refreshToken: "refresh",
};
const item = {
  id: "remote",
  isCurrent: false,
  authenticatedAt: "2026-10-11T12:00:00Z",
  lastActivityAt: "2026-10-11T12:00:00Z",
  idleExpiresAt: "2026-10-11T12:15:00Z",
  absoluteExpiresAt: "2026-10-12T00:00:00Z",
  clientDescription: null,
};
let listener: () => void;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(storage.getSessionGeneration).mockReturnValue(1);
  jest.mocked(storage.getSessionSnapshot).mockResolvedValue(origin);
  jest.mocked(storage.isSessionCurrent).mockResolvedValue(true);
  jest.mocked(storage.subscribeAuthState).mockImplementation((fn) => {
    listener = fn;
    return () => {};
  });
  jest
    .mocked(sessions.listSessions)
    .mockResolvedValue({
      items: [{ ...item, id: "current", isCurrent: true }, item],
      nextCursor: null,
      serverNow: "2026-10-11T12:00:00Z",
    });
});
it("shows actual/current dates and requires a password for remote revocation, then clears it on failure", async () => {
  jest
    .mocked(sessions.revokeSession)
    .mockRejectedValue({
      response: {
        status: 400,
        data: { error: { message: "Senha atual incorreta." } },
      },
    });
  render(<SessionsScreen />);
  expect(await screen.findByText("Sessao atual")).toBeTruthy();
  expect(screen.getByText("Dispositivo nao identificado")).toBeTruthy();
  fireEvent.press(screen.getByText("Encerrar esta sessao"));
  const input = await screen.findByLabelText(
    "Senha atual para confirmar encerramento",
  );
  expect(input.props.secureTextEntry).toBe(true);
  fireEvent.changeText(input, " password ");
  fireEvent.press(screen.getByText("Confirmar encerramento"));
  await waitFor(() =>
    expect(sessions.revokeSession).toHaveBeenCalledWith(
      "remote",
      " password ",
      origin,
    ),
  );
  expect(await screen.findByText("Senha atual incorreta.")).toBeTruthy();
  expect(
    screen.getByLabelText("Senha atual para confirmar encerramento").props
      .value,
  ).toBe("");
  expect(suspendOwnedSessionAuthority).not.toHaveBeenCalled();
});
it("global timeout hides the list and suspends only captured authority without replay", async () => {
  jest
    .mocked(sessions.revokeAllSessions)
    .mockRejectedValue(new Error("offline"));
  render(<SessionsScreen />);
  fireEvent.press(
    await screen.findByText("Encerrar todas, incluindo esta sessao"),
  );
  expect(
    await screen.findByText(/incluindo esta sessao. Voce precisara/),
  ).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText("Senha atual para confirmar encerramento"),
    "password",
  );
  fireEvent.press(screen.getByText("Confirmar encerramento"));
  await waitFor(() =>
    expect(suspendOwnedSessionAuthority).toHaveBeenCalledWith(origin, 1),
  );
  expect(screen.queryByText("Sessao atual")).toBeNull();
  expect(sessions.revokeAllSessions).toHaveBeenCalledTimes(1);
});
it("late A list results do not render after generation B", async () => {
  let release!: (value: any) => void;
  jest.mocked(sessions.listSessions).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  render(<SessionsScreen />);
  await waitFor(() => expect(sessions.listSessions).toHaveBeenCalledTimes(1));
  jest.mocked(storage.getSessionGeneration).mockReturnValue(2);
  act(() => listener());
  await act(async () =>
    release({
      items: [item],
      nextCursor: null,
      serverNow: item.authenticatedAt,
    }),
  );
  expect(screen.queryByText("Dispositivo nao identificado")).toBeNull();
});
it("late A global success cannot navigate replacement B", async () => {
  let release!: (value: any) => void;
  jest.mocked(sessions.revokeAllSessions).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  jest.mocked(storage.isLocalLogoutCurrent).mockResolvedValue(false);
  render(<SessionsScreen />);
  fireEvent.press(
    await screen.findByText("Encerrar todas, incluindo esta sessao"),
  );
  fireEvent.changeText(
    await screen.findByLabelText("Senha atual para confirmar encerramento"),
    "password",
  );
  fireEvent.press(screen.getByText("Confirmar encerramento"));
  await waitFor(() =>
    expect(sessions.revokeAllSessions).toHaveBeenCalledTimes(1),
  );
  jest.mocked(storage.getSessionGeneration).mockReturnValue(2);
  act(() => listener());
  await act(async () =>
    release({
      generation: 1,
      completion: Promise.resolve({
        localDurable: true,
        cleanupComplete: true,
        remote: "confirmed",
      }),
    }),
  );
  expect(mockReplace).not.toHaveBeenCalled();
});

it('keeps confirmation in its own safe-area keyboard-aware scroll viewport', async()=>{
  const view=render(<SessionsScreen/>);
  await screen.findByText('Sessao atual');
  fireEvent.press(screen.getByText('Encerrar esta sessao'));
  await screen.findByLabelText('Senha atual para confirmar encerramento');
  expect(view.UNSAFE_getByType(SafeAreaView)).toBeTruthy();
  expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeTruthy();
  expect(view.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
});
