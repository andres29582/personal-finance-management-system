import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import * as storage from "../../storage/authStorage";
import {
  completeConfirmedSessionRevocation,
  logout,
  logoutLocally,
} from "../../src/modules/auth/services/logoutCoordinator";
import { loginSession } from "../helpers/session-fixtures";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const values = new Map<string, string>();
let requests: string[];
beforeEach(async () => {
  jest.clearAllMocks();
  values.clear();
  requests = [];
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async (key) => values.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      values.set(key, value);
    });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    values.delete(key);
  });
  await storage.installSession(
    loginSession(),
    await storage.reconcileSession(),
  );
  axios.defaults.adapter = async (config) => {
    requests.push(config.url!);
    throw new Error("No remote operation expected");
  };
});
it("confirmed global revocation uses coordinated durable local cleanup without a second HTTP logout", async () => {
  const origin = await storage.getSessionSnapshot();
  const operation = await completeConfirmedSessionRevocation(origin);
  expect(await operation.completion).toEqual({
    localDurable: true,
    cleanupComplete: true,
    remote: "confirmed",
  });
  expect(await storage.getToken()).toBeNull();
  expect(JSON.parse(values.get(storage.SESSION_KEY)!).status).toBe("signedOut");
  await logout().completion;
  expect(requests).toEqual([]);
});
it("local exit from unknown authority never sends remote requests or claims confirmation", async () => {
  expect(await logoutLocally().completion).toMatchObject({
    localDurable: true,
    remote: "unconfirmed",
  });
  expect(requests).toEqual([]);
});
it("late A confirmed result cannot close B", async () => {
  const origin = await storage.getSessionSnapshot();
  await storage.installSession(loginSession("B"), origin);
  await expect(
    completeConfirmedSessionRevocation(origin),
  ).rejects.toMatchObject({ sessionFailure: "stale" });
  expect(await storage.getToken()).toBe(loginSession("B").access_token);
  expect(requests).toEqual([]);
});
