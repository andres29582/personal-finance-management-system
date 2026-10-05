import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { validate } from 'class-validator';
import { CreateTransacaoDto } from './dto/create-transacao.dto';
import { UpdateTransacaoDto } from './dto/update-transacao.dto';
import { TipoTransacao } from './enums/tipo-transacao.enum';

type Schema = {
  type?: string;
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, Schema>;
};
type Operation = {
  operationId: string;
  requestBody?: { content: Record<string, { schema: { $ref: string } }> };
};
type Contract = {
  openapi: string;
  components: { schemas: Record<string, Schema> };
  paths: Record<string, Record<string, Operation>>;
};

// Focused contract regressions and reference integrity, not full OAS validation.
const contract = load(
  readFileSync(resolve(__dirname, '../../swagger.yaml'), 'utf8'),
) as Contract;

describe('Static OpenAPI contract', () => {
  it.each([
    ['/transacoes', 'post', 'CreateTransacaoRequest'],
    ['/transacoes/{id}', 'patch', 'UpdateTransacaoRequest'],
  ])('%s %s uses the transaction request schema', (path, method, name) => {
    expect(
      contract.paths[path][method].requestBody?.content['application/json']
        .schema.$ref,
    ).toBe(`#/components/schemas/${name}`);
  });

  it('preserves OpenAPI 3.0.0 and unique operation identifiers', () => {
    expect(contract.openapi).toBe('3.0.0');
    const methods = new Set([
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'head',
      'options',
      'trace',
    ]);
    const ids = Object.values(contract.paths).flatMap((path) =>
      Object.entries(path)
        .filter(([key]) => methods.has(key))
        .map(([, value]) => value.operationId),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every local JSON Pointer reference', () => {
    const references: string[] = [];
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === '$ref') {
          expect(typeof child).toBe('string');
          references.push(child as string);
        } else visit(child);
      }
    };
    visit(contract);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.startsWith('#/')).toBe(true);
      let target: unknown = contract;
      for (const part of reference.slice(2).split('/')) {
        const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
        expect(target !== null && typeof target === 'object').toBe(true);
        expect(Object.prototype.hasOwnProperty.call(target, key)).toBe(true);
        target = (target as Record<string, unknown>)[key];
      }
    }
  });

  it.each(['CreateTransacaoRequest', 'UpdateTransacaoRequest'])(
    '%s allows optional nullable string descriptions',
    (name) => {
      const schema = contract.components.schemas[name];
      expect(schema.required ?? []).not.toContain('descricao');
      expect(schema.properties?.descricao).toMatchObject({
        type: 'string',
        nullable: true,
      });
    },
  );
});

describe('Transaction description runtime validation', () => {
  const required = {
    contaId: '11111111-1111-4111-8111-111111111111',
    categoriaId: '22222222-2222-4222-8222-222222222222',
    tipo: TipoTransacao.RECEITA,
    valor: 10,
    data: '2026-05-01',
  };
  it.each([undefined, null, '', 'Description'])(
    'accepts description %p in both creation and update',
    async (descricao) => {
      const field = descricao === undefined ? {} : { descricao };
      await expect(
        validate(Object.assign(new CreateTransacaoDto(), required, field)),
      ).resolves.toHaveLength(0);
      await expect(
        validate(Object.assign(new UpdateTransacaoDto(), { valor: 10 }, field)),
      ).resolves.toHaveLength(0);
    },
  );
  it.each([123, false, {}, []])(
    'rejects non-string description %p',
    async (descricao) => {
      for (const dto of [
        Object.assign(new CreateTransacaoDto(), required, { descricao }),
        Object.assign(new UpdateTransacaoDto(), { descricao }),
      ]) {
        expect((await validate(dto)).map((error) => error.property)).toContain(
          'descricao',
        );
      }
    },
  );
});
