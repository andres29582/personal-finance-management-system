import * as alerts from "../../src/modules/alertas/services/alertaService";
import { PlanejamentoParticipanteFormScreen } from "../../src/modules/planejamentos/screens/PlanejamentoParticipanteFormScreen";
import { PlanejamentoGastoFormScreen } from "../../src/modules/planejamentos/screens/PlanejamentoGastoFormScreen";
import * as planning from "../../src/modules/planejamentos/services/planejamentoService";
import { useFinancialDraft } from "../../src/shared/hooks/useFinancialDraft";
import {
  act,
  renderHook,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react-native";
import { TextInput } from "react-native";
import { ContasCreateScreen } from "../../src/modules/contas/screens/ContasCreateScreen";
import { ContasEditScreen } from "../../src/modules/contas/screens/ContasEditScreen";
import { CategoriaFormScreen } from "../../src/modules/categorias/screens/CategoriaFormScreen";
import { DividasFormScreen } from "../../src/modules/dividas/screens/DividasFormScreen";
import { MetasFormScreen } from "../../src/modules/metas/screens/MetasFormScreen";
import { OrcamentoFormScreen } from "../../src/modules/orcamentos/screens/OrcamentoFormScreen";
import { AlertasFormScreen } from "../../src/modules/alertas/screens/AlertasFormScreen";
import { PagosDividaScreen } from "../../src/modules/pagos-divida/screens/PagosDividaScreen";
import { PlanejamentoFormScreen } from "../../src/modules/planejamentos/screens/PlanejamentoFormScreen";
import * as accounts from "../../src/modules/contas/services/contaService";
import * as categories from "../../src/modules/categorias/services/categoriaService";
import * as debts from "../../src/modules/dividas/services/dividaService";
import * as goals from "../../src/modules/metas/services/metaService";
import * as budgets from "../../src/modules/orcamentos/services/orcamentoService";
import * as payments from "../../src/modules/pagos-divida/services/pagoDividaService";
import { getSessionAuthority } from "../../src/modules/auth/services/sessionAuthority";
import { getUser, isLocallySignedOut } from "../../storage/authStorage";
import { readFinancialDraft } from "../../storage/financialDrafts";
import {
  makeConta,
  makeCategoria,
  makeDivida,
} from "../../src/shared/test/builders";
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../../storage/authStorage", () => ({
  getSessionGeneration: () => 1,
  getUser: jest.fn(),
  isLocallySignedOut: jest.fn(),
  subscribeAuthState: () => () => {},
}));
jest.mock("../../src/modules/auth/services/sessionAuthority", () => ({
  getSessionAuthority: jest.fn(),
  subscribeSessionAuthority: () => () => {},
}));
jest.mock("../../src/modules/contas/services/contaService");
jest.mock("../../src/modules/categorias/services/categoriaService");
jest.mock("../../src/modules/dividas/services/dividaService");
jest.mock("../../src/modules/metas/services/metaService");
jest.mock("../../src/modules/orcamentos/services/orcamentoService");
jest.mock("../../src/modules/alertas/services/alertaService");
jest.mock("../../src/modules/pagos-divida/services/pagoDividaService");
jest.mock("../../src/modules/planejamentos/services/planejamentoService");
jest.mock("../../src/shared/ui", () => {
  const React = require("react");
  const { View, Text, TextInput, Pressable } = require("react-native");
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
    GlassField: ({ label, children, error }: any) => (
      <View testID={"field-" + label}>
        {children}
        {error ? <Text>{error}</Text> : null}
      </View>
    ),
    GlassTextInput: (props: any) => <TextInput {...props} />,
    GlassButton: ({ label, onPress, disabled }: any) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{label}</Text>
      </Pressable>
    ),
    GlassOptionGroup: ({ options, onChange }: any) => (
      <View>
        {options.map((option: any) => (
          <Pressable key={option.value} onPress={() => onChange(option.value)}>
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
    GlassStatusCard: ({ title }: any) => <Text>{title}</Text>,
  };
});
const confirm = () =>
  jest.mocked(getSessionAuthority).mockReturnValue({
    snapshot: { incarnation: "A", sessionId: "session", generation: 1 },
  } as never);
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.mocked(getUser).mockResolvedValue({ id: "owner" } as never);
  jest.mocked(planning.getPlanejamentoById).mockResolvedValue({
    id: "plan",
    status: "ABERTO",
    usuarioCriadorId: "owner",
    participantes: [
      {
        id: "participant",
        nome: "Person",
        status: "ATIVO",
        tipo: "VINCULADO",
        usuarioId: "owner",
      },
    ],
  } as never);
  jest.mocked(isLocallySignedOut).mockReturnValue(true);
  readFinancialDraft("any");
  jest.mocked(isLocallySignedOut).mockReturnValue(false);
  confirm();
  jest
    .mocked(accounts.listContas)
    .mockResolvedValue([makeConta({ id: "account" })]);
  jest
    .mocked(accounts.getContaById)
    .mockResolvedValue(makeConta({ id: "edit", nome: "Server name" }));
  jest.mocked(alerts.getAlertaById).mockResolvedValue({
    id: "edit",
    tipo: "vencimento_meta",
    referenciaId: "server-reference",
    diasAnticipacion: 3,
  } as never);
  jest.mocked(goals.getMetaById).mockResolvedValue({
    id: "edit",
    nome: "Server goal",
    tipo: "economia",
    contaId: "account",
    dividaId: null,
    montoObjetivo: 500,
    montoActual: 10,
    fechaLimite: "2028-01-01",
  } as never);
  jest.mocked(budgets.getOrcamentoById).mockResolvedValue({
    id: "edit",
    mesReferencia: "2028-01",
    valorPlanejado: 500,
  } as never);
  jest
    .mocked(categories.listCategorias)
    .mockResolvedValue([makeCategoria({ id: "category", tipo: "despesa" })]);
  jest
    .mocked(debts.listDividas)
    .mockResolvedValue([makeDivida({ id: "debt" })]);
  jest
    .mocked(debts.getDividaById)
    .mockResolvedValue(makeDivida({ id: "debt" }));
  jest.mocked(goals.listMetas).mockResolvedValue([]);
  jest.mocked(budgets.listOrcamentos).mockResolvedValue([]);
  jest.mocked(payments.listPagosByDivida).mockResolvedValue([]);
});
const cases = [
  {
    name: "account create",
    Screen: ContasCreateScreen,
    params: {},
    label: "Nome da conta",
    key: "account/new",
    field: "nome",
  },
  {
    name: "account edit",
    Screen: ContasEditScreen,
    params: { id: "edit" },
    label: "Nome da conta",
    key: "account/edit",
    field: "nome",
  },
  {
    name: "category",
    Screen: CategoriaFormScreen,
    params: {},
    label: "Nome",
    key: "category/new",
    field: "nome",
  },
  {
    name: "debt",
    Screen: DividasFormScreen,
    params: {},
    label: "Nome",
    key: "debt/new",
    field: "nome",
  },
  {
    name: "goal",
    Screen: MetasFormScreen,
    params: {},
    label: "Nome",
    key: "goal/new",
    field: "nome",
  },
  {
    name: "budget",
    Screen: OrcamentoFormScreen,
    params: {},
    label: "Valor planejado",
    key: "budget/new",
    field: "valorPlanejado",
  },
  {
    name: "alert",
    Screen: AlertasFormScreen,
    params: {},
    label: "Dias de antecipacao",
    key: "alert/new",
    field: "diasAnticipacion",
  },
  {
    name: "payment",
    Screen: PagosDividaScreen,
    params: { dividaId: "debt" },
    label: "Valor",
    key: "payment/debt",
    field: "valor",
  },
  {
    name: "shared plan",
    Screen: PlanejamentoFormScreen,
    params: {},
    label: "Nome",
    key: "planning/new",
    field: "nome",
  },
  {
    name: "shared participant",
    Screen: PlanejamentoParticipanteFormScreen,
    params: { id: "plan" },
    label: "Nome",
    key: "planning-participant/plan",
    field: "nome",
  },
  {
    name: "shared expense",
    Screen: PlanejamentoGastoFormScreen,
    params: { id: "plan" },
    label: "Descricao",
    key: 'planning-expense/["plan",null]',
    field: "descricao",
  },
];
it.each(cases)(
  "restores only editable $name fields after same-owner suspension/remount",
  async ({ Screen, params, label, key, field }) => {
    mockParams = params as Record<string, string>;
    const first = render(<Screen />);
    const container = await screen.findByTestId("field-" + label);
    fireEvent.changeText(
      within(container).UNSAFE_getByType(TextInput),
      "Draft 123",
    );
    first.unmount();
    jest.mocked(getSessionAuthority).mockReturnValue(null);
    expect(readFinancialDraft(key)).toBeNull();
    confirm();
    render(<Screen />);
    const restored = await screen.findByTestId("field-" + label);
    expect(within(restored).UNSAFE_getByType(TextInput).props.value).toBe(
      "Draft 123",
    );
    expect(readFinancialDraft<Record<string, string>>(key)?.fields[field]).toBe(
      "Draft 123",
    );
  },
);

it("preserves sequential functional split toggles without stale closure writes", () => {
  const hook = renderHook(() =>
    useFinancialDraft("split-test", { ids: [] as string[] }),
  );
  act(() => {
    hook.result.current.setField("ids", (ids: string[]) => [...ids, "one"]);
    hook.result.current.setField("ids", (ids: string[]) => [...ids, "two"]);
  });
  expect(hook.result.current.fields.ids).toEqual(["one", "two"]);
});

it("invalidates a submitted intention when cancel clears a not-yet-persisted draft", () => {
  const hook = renderHook(() =>
    useFinancialDraft("empty-intent", { nome: "server value" }),
  );
  const submitted = hook.result.current.capture();
  act(() => hook.result.current.clear());
  expect(hook.result.current.isCurrent(submitted)).toBe(false);
});

it.each([
  {
    Screen: ContasEditScreen,
    label: "Nome da conta",
    key: "account/edit",
    forbidden: ["tipo", "saldoInicial", "conta"],
  },
  {
    Screen: DividasFormScreen,
    label: "Nome",
    key: "debt/edit",
    forbidden: ["contaId", "montoTotal", "fechaInicio"],
  },
  {
    Screen: MetasFormScreen,
    label: "Nome",
    key: "goal/edit",
    forbidden: ["tipo", "contaId", "dividaId"],
  },
  {
    Screen: OrcamentoFormScreen,
    label: "Valor planejado",
    key: "budget/edit",
    forbidden: ["mesReferencia"],
  },
  {
    Screen: AlertasFormScreen,
    label: "Dias de antecipacao",
    key: "alert/edit",
    forbidden: ["tipo", "referenciaId"],
  },
])(
  "excludes read-only edit fields from $key",
  async ({ Screen, label, key, forbidden }) => {
    mockParams = { id: "edit" };
    render(<Screen />);
    const field = await screen.findByTestId("field-" + label);
    fireEvent.changeText(within(field).UNSAFE_getByType(TextInput), "Changed");
    const stored = readFinancialDraft(key)?.fields;
    expect(stored).toBeTruthy();
    for (const name of forbidden) expect(stored).not.toHaveProperty(name);
  },
);
it("clears explicitly cancelled and successful account drafts", async () => {
  const view = render(<ContasCreateScreen />);
  fireEvent.changeText(
    within(screen.getByTestId("field-Nome da conta")).UNSAFE_getByType(
      TextInput,
    ),
    "Cancelled",
  );
  fireEvent.press(screen.getByText("Cancelar"));
  expect(readFinancialDraft("account/new")).toBeNull();
  view.unmount();
  jest
    .mocked(accounts.createConta)
    .mockResolvedValue({ id: "created" } as never);
  render(<ContasCreateScreen />);
  fireEvent.changeText(
    within(screen.getByTestId("field-Nome da conta")).UNSAFE_getByType(
      TextInput,
    ),
    "Saved",
  );
  fireEvent.changeText(
    within(screen.getByTestId("field-Saldo inicial (R$)")).UNSAFE_getByType(
      TextInput,
    ),
    "0",
  );
  fireEvent.press(screen.getByText("Salvar conta"));
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith("/contas"),
  );
  expect(readFinancialDraft("account/new")).toBeNull();
});
it("resets payment amount/description on success but keeps its date and selections visible", async () => {
  mockParams = { dividaId: "debt" };
  jest
    .mocked(payments.createPagoDivida)
    .mockResolvedValue({ id: "payment" } as never);
  render(<PagosDividaScreen />);
  const amount = within(
    await screen.findByTestId("field-Valor"),
  ).UNSAFE_getByType(TextInput);
  const date = within(screen.getByTestId("field-Data")).UNSAFE_getByType(
    TextInput,
  ).props.value;
  fireEvent.changeText(amount, "12");
  fireEvent.changeText(
    within(screen.getByTestId("field-Descricao")).UNSAFE_getByType(TextInput),
    "Note",
  );
  fireEvent.press(screen.getByText("Registrar pagamento"));
  await waitFor(() =>
    expect(
      within(screen.getByTestId("field-Valor")).UNSAFE_getByType(TextInput)
        .props.value,
    ).toBe(""),
  );
  expect(
    within(screen.getByTestId("field-Descricao")).UNSAFE_getByType(TextInput)
      .props.value,
  ).toBe("");
  expect(
    within(screen.getByTestId("field-Data")).UNSAFE_getByType(TextInput).props
      .value,
  ).toBe(date);
  expect(readFinancialDraft("payment/debt")).toBeNull();
});

it("clears the payment draft on explicit back before a later same-owner remount", async () => {
  mockParams = { dividaId: "debt" };
  const first = render(<PagosDividaScreen />);
  fireEvent.changeText(
    within(await screen.findByTestId("field-Valor")).UNSAFE_getByType(
      TextInput,
    ),
    "43",
  );
  expect(readFinancialDraft("payment/debt")?.fields).toHaveProperty(
    "valor",
    "43",
  );
  fireEvent.press(screen.getByText("Voltar"));
  expect(mockRouter.replace).toHaveBeenCalledWith("/dividas");
  expect(readFinancialDraft("payment/debt")).toBeNull();
  first.unmount();
  render(<PagosDividaScreen />);
  expect(
    within(await screen.findByTestId("field-Valor")).UNSAFE_getByType(TextInput)
      .props.value,
  ).toBe("");
});
