import { validate } from 'class-validator';
import { GetPrevisaoDeficitDto } from './get-previsao-deficit.dto';

describe('Previsao DTO validation', () => {
  it('accepts an empty deficit prediction query', async () => {
    const dto = Object.assign(new GetPrevisaoDeficitDto(), {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a valid monthly deficit prediction query', async () => {
    const dto = Object.assign(new GetPrevisaoDeficitDto(), {
      mes: '2026-05',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed month references', async () => {
    const dto = Object.assign(new GetPrevisaoDeficitDto(), {
      mes: '05-2026',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('mes');
  });
});
