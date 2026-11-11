import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { TransferenciaFormScreen } from "../../src/modules/transferencias/screens/TransferenciaFormScreen";
import { TransacaoFormScreen } from "../../src/modules/transacoes/screens/TransacaoFormScreen";
import { getSessionAuthority } from "../../src/modules/auth/services/sessionAuthority";
import { isLocallySignedOut } from "../../storage/authStorage";
import { readFinancialDraft } from "../../storage/financialDrafts";
import { listContas } from "../../src/modules/contas/services/contaService";
import { listCategorias } from "../../src/modules/categorias/services/categoriaService";
import {
  createTransferencia,
  getTransferenciaById,
} from "../../src/modules/transferencias/services/transferenciaService";
import {
  makeConta,
  makeCategoria,
  makeTransferencia,
} from "../../src/shared/test/builders";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../../src/modules/auth/services/sessionAuthority", () => ({
  getSessionAuthority: jest.fn(),
  subscribeSessionAuthority: () => () => {},
}));
jest.mock("../../storage/authStorage", () => ({
  getSessionGeneration: () => 1,
  isLocallySignedOut: jest.fn(),
  subscribeAuthState: () => () => {},
}));
jest.mock("../../src/modules/contas/services/contaService");
jest.mock("../../src/modules/categorias/services/categoriaService");
jest.mock("../../src/modules/transferencias/services/transferenciaService");
jest.mock("../../src/modules/transacoes/services/transacaoService");
const authority = getSessionAuthority as jest.Mock;
const logout = isLocallySignedOut as jest.Mock;
const confirm = () =>
  authority.mockReturnValue({
    snapshot: { incarnation: "owner", sessionId: "session", generation: 1 },
  });
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  logout.mockReturnValue(true);
  readFinancialDraft("transfer/new");
  logout.mockReturnValue(false);
  confirm();
  (listContas as jest.Mock).mockResolvedValue([
    makeConta({ id: "a" }),
    makeConta({ id: "b" }),
  ]);
  (listCategorias as jest.Mock).mockResolvedValue([
    makeCategoria({ id: "category", tipo: "despesa" }),
  ]);
});

it("retains a transfer and stable intent across unknown outcome/remount; edited payload cannot silently resend", async () => {
  (createTransferencia as jest.Mock).mockRejectedValue({
    code: "ECONNABORTED",
  });
  const view = render(<TransferenciaFormScreen />);
  await screen.findByLabelText("Valor da transferencia");
  fireEvent.changeText(screen.getByLabelText("Valor da transferencia"), "100");
  fireEvent.press(screen.getByText("Salvar transferencia"));
  await screen.findByText(
    "Resultado nao confirmado. Confira o historico ou tente confirmar a mesma transferencia.",
  );
  const original = (createTransferencia as jest.Mock).mock.calls[0][0];
  authority.mockReturnValue(null);
  view.unmount();
  confirm();
  render(<TransferenciaFormScreen />);
  await screen.findByDisplayValue("100");
  fireEvent.changeText(screen.getByLabelText("Valor da transferencia"), "200");
  fireEvent.press(screen.getByText("Salvar transferencia"));
  await screen.findByText(
    "Resultado ainda nao confirmado. Confira o historico antes de alterar esta tentativa.",
  );
  expect(createTransferencia).toHaveBeenCalledTimes(1);
  fireEvent.changeText(screen.getByLabelText("Valor da transferencia"), "100");
  (createTransferencia as jest.Mock).mockResolvedValue(makeTransferencia());
  fireEvent.press(screen.getByText("Salvar transferencia"));
  await waitFor(() => expect(createTransferencia).toHaveBeenCalledTimes(2));
  expect((createTransferencia as jest.Mock).mock.calls[1][0]).toEqual(original);
  await waitFor(() => expect(readFinancialDraft("transfer/new")).toBeNull());
});

it("restores an edited transfer instead of overwriting it with a late entity reload", async () => {
  mockParams = { id: "edit" };
  (getTransferenciaById as jest.Mock).mockResolvedValue(
    makeTransferencia({ valor: 50 }),
  );
  const view = render(<TransferenciaFormScreen />);
  await screen.findByDisplayValue("50");
  fireEvent.changeText(screen.getByLabelText("Valor da transferencia"), "125");
  view.unmount();
  render(<TransferenciaFormScreen />);
  await screen.findByDisplayValue("125");
  await waitFor(() => expect(getTransferenciaById).toHaveBeenCalledTimes(2));
  expect(screen.queryByDisplayValue("50")).toBeNull();
});

it("restores transaction editable fields while keeping the display-date representation", async () => {
  const view = render(<TransacaoFormScreen />);
  await screen.findByPlaceholderText("0,00");
  fireEvent.changeText(screen.getByPlaceholderText("0,00"), "87,50");
  fireEvent.changeText(screen.getByLabelText("Data da transacao"), "21102026");
  view.unmount();
  authority.mockReturnValue(null);
  confirm();
  render(<TransacaoFormScreen />);
  await screen.findByDisplayValue("87,50");
  expect(screen.getByDisplayValue("21/10/2026")).toBeTruthy();
});

it('fences a second submit synchronously before the first render commits', async () => {
  (createTransferencia as jest.Mock).mockReturnValue(new Promise(() => {}));
  render(<TransferenciaFormScreen />);
  await screen.findByLabelText('Valor da transferencia');
  fireEvent.changeText(screen.getByLabelText('Valor da transferencia'), '100');
  const button = screen.getByText('Salvar transferencia');
  act(() => { fireEvent.press(button); fireEvent.press(button); });
  expect(createTransferencia).toHaveBeenCalledTimes(1);
});

it.each(['rejection','success'])('does not let an obsolete %s completion overwrite a remounted edited draft or navigate', async (outcome) => {
  let reject: (error: unknown) => void = () => {};
  let resolve: (value: unknown) => void = () => {};
  (createTransferencia as jest.Mock).mockReturnValue(new Promise((done, fail) => { reject = fail; resolve = done; }));
  const first = render(<TransferenciaFormScreen />);
  await screen.findByLabelText('Valor da transferencia');
  fireEvent.changeText(screen.getByLabelText('Valor da transferencia'), '100');
  fireEvent.press(screen.getByText('Salvar transferencia'));
  first.unmount();
  render(<TransferenciaFormScreen />);
  await screen.findByDisplayValue('100');
  fireEvent.changeText(screen.getByLabelText('Valor da transferencia'), '200');
  await act(async () => { if(outcome === 'success') resolve(makeTransferencia()); else reject({ response: { status: 400, data: { error: { message: 'Obsolete rejection' } } } }); });
  expect(readFinancialDraft<any>('transfer/new')?.fields.valor).toBe('200');
  expect(readFinancialDraft<any>('transfer/new')?.fields.intent).not.toBeNull();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
