type RegisterUserPayload = {
  nome: string;
  email: string;
  cpf: string;
  cep: string;
  endereco: string;
  numero: string;
  cidade: string;
  senha: string;
  aceitoPoliticaPrivacidade: boolean;
};

type LoginPayload = {
  email: string;
  senha: string;
};

export function makeRegisterUserPayload(
  overrides: Partial<RegisterUserPayload> = {},
): RegisterUserPayload {
  return {
    nome: 'Usuario E2E',
    email: 'usuario.e2e@example.com',
    cpf: '52998224725',
    cep: '01001000',
    endereco: 'Rua E2E',
    numero: '100',
    cidade: 'Sao Paulo',
    senha: 'SenhaForte123',
    aceitoPoliticaPrivacidade: true,
    ...overrides,
  };
}

export function makeLoginPayload(
  overrides: Partial<LoginPayload> = {},
): LoginPayload {
  return {
    email: 'usuario.e2e@example.com',
    senha: 'SenhaForte123',
    ...overrides,
  };
}
