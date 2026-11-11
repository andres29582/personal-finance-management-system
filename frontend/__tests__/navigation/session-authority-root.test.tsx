import React from "react";
import { AppState } from "react-native";
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import * as storage from "../../storage/authStorage";
import { api } from "../../src/shared/services/api";
import { RootLayout } from "../../src/navigation/RootLayout";
import { suspendSessionAuthority } from "../../src/modules/auth/services/sessionAuthority";
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockSegments = ["dashboard"];
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useSegments: () => mockSegments,
  useRootNavigationState: () => ({ key: "nav" }),
  Stack: () => {
    const { Text } = require("react-native");
    return <Text>Protected stack</Text>;
  },
}));
jest.mock("../../components/app-loading", () => ({
  AppLoading: () => {
    const { Text } = require("react-native");
    return <Text>Checking authority</Text>;
  },
}));
jest.mock("../../storage/authStorage");
jest.mock("../../src/shared/services/api", () => ({ api: { get: jest.fn() } }));
const snapshot = {
  generation: 1,
  incarnation: "A",
  revision: 1,
  sessionId: "sid-A",
  accessToken: "access",
  refreshToken: "refresh",
};
const state = () => ({
  serverNow: new Date().toISOString(),
  idleExpiresAt: new Date(Date.now() + 900000).toISOString(),
  absoluteExpiresAt: new Date(Date.now() + 43200000).toISOString(),
  policyVersion: 1,
});

it("keeps the protected route mounted for an informational update of its confirmed session", async () => {
  let listener!: () => void;
  jest.mocked(storage.subscribeAuthState).mockImplementation((fn) => {
    listener = fn;
    return () => {};
  });
  jest
    .mocked(api.get)
    .mockResolvedValueOnce({ data: state() } as never)
    .mockReturnValue(new Promise(() => {}));
  render(<RootLayout />);
  expect(await screen.findByText("Protected stack")).toBeTruthy();
  act(() => listener());
  expect(screen.queryByText("Protected stack")).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it("reconfirms the same generation when authority has already been suspended", async () => {
  let listener!: () => void;
  jest.mocked(storage.subscribeAuthState).mockImplementation((fn) => {
    listener = fn;
    return () => {};
  });
  jest
    .mocked(api.get)
    .mockResolvedValueOnce({ data: state() } as never)
    .mockReturnValue(new Promise(() => {}));
  render(<RootLayout />);
  expect(await screen.findByText("Protected stack")).toBeTruthy();
  act(() => {
    suspendSessionAuthority();
    listener();
  });
  expect(screen.queryByText("Protected stack")).toBeNull();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
});
beforeEach(() => {
  jest.clearAllMocks();
  suspendSessionAuthority();
  jest
    .spyOn(AppState, "addEventListener")
    .mockReturnValue({ remove: jest.fn() });
  jest.mocked(storage.observeSessionLifecycle).mockReturnValue(() => {});
  jest.mocked(storage.subscribeAuthState).mockReturnValue(() => {});
  jest.mocked(storage.getSessionGeneration).mockReturnValue(1);
  jest.mocked(storage.isLocallySignedOut).mockReturnValue(false);
  jest.mocked(storage.getToken).mockResolvedValue("access");
  jest.mocked(storage.getSessionSnapshot).mockResolvedValue(snapshot);
  jest.mocked(storage.isSessionCurrent).mockResolvedValue(true);
});
it("actual RootLayout never renders protected content on token presence before server confirmation", async () => {
  let release!: (value: any) => void;
  jest
    .mocked(api.get)
    .mockReturnValue(new Promise((resolve) => (release = resolve)));
  render(<RootLayout />);
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith("/auth/session", { timeout: 5000 }),
  );
  expect(screen.queryByText("Protected stack")).toBeNull();
  await act(async () => release({ data: state() }));
  expect(await screen.findByText("Protected stack")).toBeTruthy();
});
it("transient startup failure retains credentials, hides data and allows explicit retry", async () => {
  jest
    .mocked(api.get)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ data: state() } as never);
  render(<RootLayout />);
  expect(await screen.findByText("Tentar novamente")).toBeTruthy();
  expect(screen.queryByText("Protected stack")).toBeNull();
  expect(storage.clearSessionIfCurrent).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Tentar novamente"));
  expect(await screen.findByText("Protected stack")).toBeTruthy();
});
it("allows explicit local-only exit while the actual protected stack is hidden", async () => {
  const coordinator = require("../../src/modules/auth/services/logoutCoordinator");
  const local = jest.spyOn(coordinator, "logoutLocally").mockReturnValue({
    generation: 2,
    completion: Promise.resolve({
      localDurable: true,
      cleanupComplete: true,
      remote: "unconfirmed",
    }),
  });
  jest.mocked(api.get).mockRejectedValue(new Error("offline"));
  render(<RootLayout />);
  fireEvent.press(await screen.findByText("Sair somente neste dispositivo"));
  expect(local).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Protected stack")).toBeNull();
  local.mockRestore();
});
it("a stale A server response cannot authorize B while B is still validating", async () => {
  let releaseA!: (value: any) => void,
    releaseB!: (value: any) => void,
    listener!: () => void;
  jest.mocked(storage.subscribeAuthState).mockImplementation((fn) => {
    listener = fn;
    return () => {};
  });
  jest
    .mocked(api.get)
    .mockReturnValueOnce(new Promise((resolve) => (releaseA = resolve)))
    .mockReturnValueOnce(new Promise((resolve) => (releaseB = resolve)));
  render(<RootLayout />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  jest.mocked(storage.getSessionGeneration).mockReturnValue(2);
  jest.mocked(storage.getSessionSnapshot).mockResolvedValue({
    ...snapshot,
    generation: 2,
    incarnation: "B",
    sessionId: "sid-B",
  });
  act(() => listener());
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => releaseA({ data: state() }));
  expect(screen.queryByText("Protected stack")).toBeNull();
  await act(async () => releaseB({ data: state() }));
  expect(await screen.findByText("Protected stack")).toBeTruthy();
});

it("hides actual protected stack on background and requires a fresh no-touch server response on resume", async () => {
  let onState!: (state: any) => void, release!: (value: any) => void;
  const subscription = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      onState = listener;
      return { remove: jest.fn() };
    });
  jest
    .mocked(api.get)
    .mockResolvedValueOnce({ data: state() } as never)
    .mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
  const view = render(<RootLayout />);
  expect(await screen.findByText("Protected stack")).toBeTruthy();
  act(() => onState("background"));
  expect(screen.queryByText("Protected stack")).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
  act(() => onState("active"));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Protected stack")).toBeNull();
  await act(async () => release({ data: state() }));
  expect(await screen.findByText("Protected stack")).toBeTruthy();
  view.unmount();
  subscription.mockRestore();
});
it("renders an accessible informational warning without a heartbeat", async () => {
  const metadata = state();
  metadata.idleExpiresAt = new Date(
    Date.parse(metadata.serverNow) + 30000,
  ).toISOString();
  jest.mocked(api.get).mockResolvedValue({ data: metadata } as never);
  render(<RootLayout />);
  expect(await screen.findByText(/Sua sessao pode expirar/)).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it("pre-suspend metadata cannot reopen protected Stack before fresh resume confirmation", async () => {
  const authorityModule =
    require("../../src/modules/auth/services/sessionAuthority") as {
      getSessionAuthorityEpoch?: () => number;
      recordSessionAuthority: (
        value: unknown,
        snapshot: unknown,
        epoch: number,
      ) => Promise<boolean>;
    };
  let onState!: (state: any) => void, release!: (value: any) => void;
  const subscription = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      onState = listener;
      return { remove: jest.fn() };
    });
  jest
    .mocked(api.get)
    .mockResolvedValueOnce({ data: state() } as never)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
  const view = render(<RootLayout />);
  expect(await screen.findByText("Protected stack")).toBeTruthy();
  const dispatchedEpoch = authorityModule.getSessionAuthorityEpoch?.() ?? 0;
  act(() => onState("background"));
  act(() => onState("active"));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => {
    await authorityModule.recordSessionAuthority(
      state(),
      snapshot,
      dispatchedEpoch,
    );
  });
  const reopenedBeforeConfirmation =
    screen.queryByText("Protected stack") !== null;
  await act(async () => {
    await authorityModule.recordSessionAuthority(
      state(),
      snapshot,
      authorityModule.getSessionAuthorityEpoch?.() ?? 0,
    );
  });
  const freshHeaderBypassedConfirmation =
    screen.queryByText("Protected stack") !== null;
  await act(async () => release({ data: state() }));
  expect(await screen.findByText("Protected stack")).toBeTruthy();
  view.unmount();
  subscription.mockRestore();
  expect(reopenedBeforeConfirmation).toBe(false);
  expect(freshHeaderBypassedConfirmation).toBe(false);
});
