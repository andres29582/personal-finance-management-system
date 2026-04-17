export type UserProfile = {
  cep: string | null;
  cidade: string | null;
  cpf: string | null;
  dataRegistro: string | null;
  email: string;
  endereco: string | null;
  id: string;
  moedaPadrao: string | null;
  nome: string;
  numero: string | null;
};

export type UpdateUserProfileRequestDto = {
  cep: string;
  cidade: string;
  cpf: string;
  email: string;
  endereco: string;
  nome: string;
  numero: string;
};
