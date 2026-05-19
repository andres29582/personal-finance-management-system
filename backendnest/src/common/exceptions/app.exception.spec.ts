import {
  AppConflictException,
  AppUnauthorizedException,
  BusinessRuleException,
  ExternalServiceException,
  ForbiddenResourceException,
  ResourceNotFoundException,
  ValidationAppException,
} from './index';

describe('app exceptions', () => {
  it('preserves concrete prototypes for instanceof checks', () => {
    const exception = new ResourceNotFoundException(
      'CONTA_NOT_FOUND',
      'Conta não encontrada',
    );

    expect(exception).toBeInstanceOf(ResourceNotFoundException);
    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe('ResourceNotFoundException');
  });

  it('keeps stable status codes and fields', () => {
    expect(
      new BusinessRuleException('INSUFFICIENT_BALANCE', 'Saldo insuficiente')
        .statusCode,
    ).toBe(400);
    expect(
      new ValidationAppException('INVALID_CPF', 'CPF inválido', {
        field: 'cpf',
      }),
    ).toMatchObject({
      code: 'INVALID_CPF',
      field: 'cpf',
      message: 'CPF inválido',
      statusCode: 422,
    });
    expect(
      new ResourceNotFoundException('META_NOT_FOUND', 'Meta não encontrada')
        .statusCode,
    ).toBe(404);
    expect(new AppUnauthorizedException().statusCode).toBe(401);
    expect(new ForbiddenResourceException().statusCode).toBe(403);
    expect(
      new AppConflictException('EMAIL_ALREADY_EXISTS', 'E-mail já cadastrado')
        .statusCode,
    ).toBe(409);
    expect(
      new ExternalServiceException('VIACEP_UNAVAILABLE', 'Falha externa')
        .statusCode,
    ).toBe(502);
  });
});
