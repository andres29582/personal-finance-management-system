import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { makeCategoria } from "../../../shared/test/builders";
import * as categoriaService from "../services/categoriaService";
import { CategoriaFormScreen } from "../screens/CategoriaFormScreen";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock("../services/categoriaService");

const mockCreateCategoria =
  categoriaService.createCategoria as jest.MockedFunction<
    typeof categoriaService.createCategoria
  >;
const mockGetCategoriaById =
  categoriaService.getCategoriaById as jest.MockedFunction<
    typeof categoriaService.getCategoriaById
  >;
const mockUpdateCategoria =
  categoriaService.updateCategoria as jest.MockedFunction<
    typeof categoriaService.updateCategoria
  >;

describe("CategoriaFormScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
  });

  it("creates a category and exposes the canonical profile action", async () => {
    mockCreateCategoria.mockResolvedValue(makeCategoria());

    render(<CategoriaFormScreen />);

    fireEvent.press(screen.getByLabelText("Abrir perfil do usuário"));
    expect(mockPush).toHaveBeenCalledWith("/usuario");

    fireEvent.changeText(
      screen.getByLabelText("Nome da categoria"),
      "Alimentacao",
    );
    fireEvent.press(screen.getByText("Salvar categoria"));

    await waitFor(() => {
      expect(mockCreateCategoria).toHaveBeenCalledWith({
        nome: "Alimentacao",
        tipo: "despesa",
      });
      expect(mockReplace).toHaveBeenCalledWith("/categorias");
    });
  });

  it("loads and updates an existing category", async () => {
    mockLocalSearchParams = { id: "categoria1" };
    mockGetCategoriaById.mockResolvedValue(
      makeCategoria({ id: "categoria1", nome: "Salario", tipo: "receita" }),
    );
    mockUpdateCategoria.mockResolvedValue(makeCategoria());

    render(<CategoriaFormScreen />);

    await waitFor(() =>
      expect(screen.getByDisplayValue("Salario")).toBeTruthy(),
    );

    expect(screen.queryByText("Despesa")).toBeNull();
    fireEvent.changeText(
      screen.getByLabelText("Nome da categoria"),
      "Renda mensal",
    );
    fireEvent.press(screen.getByText("Salvar categoria"));

    await waitFor(() => {
      expect(mockUpdateCategoria).toHaveBeenCalledWith("categoria1", {
        nome: "Renda mensal",
      });
      expect(mockReplace).toHaveBeenCalledWith("/categorias");
    });
  });
});
