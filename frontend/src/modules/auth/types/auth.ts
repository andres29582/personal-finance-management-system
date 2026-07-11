export type LoginRequestDto = {
  email: string;
  senha: string;
};

export type RegisterRequestDto = {
  aceitoPoliticaPrivacidade: boolean;
  cep: string;
  cidade: string;
  cpf: string;
  endereco: string;
  nome: string;
  numero: string;
  email: string;
  senha: string;
};

export type UsuarioLogado = {
  cep?: string | null;
  cidade?: string | null;
  cpf?: string | null;
  id: string;
  endereco?: string | null;
  moedaPadrao?: string | null;
  nome: string;
  numero?: string | null;
  email: string;
};

export type RegisterResponseDto = {
  usuario: UsuarioLogado;
};

export type LoginResponseDto = {
  access_token: string;
  refresh_token: string;
  usuario: UsuarioLogado;
};

export type RefreshTokenRequestDto = {
  refreshToken: string;
};

export type RefreshTokenResponseDto = {
  access_token: string;
  refresh_token: string;
};

export type ResetPasswordRequestDto = {
  novaSenha: string;
};

export type ResetPasswordResponseDto = {
  message: string;
};

export type LogoutResponseDto = {
  message: string;
};

export type ForgotPasswordRequestDto = {
  email: string;
};

export type ForgotPasswordResponseDto = {
  message: string;
  /**
   * Development/test-only helper returned by a local backend when explicitly enabled.
   * Not part of the public production contract.
   */
  resetToken?: string;
};

export type ResetPasswordTokenRequestDto = {
  token: string;
  novaSenha: string;
};
