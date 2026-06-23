import { validate } from 'class-validator';
import { GetDashboardDto } from './get-dashboard.dto';

describe('Dashboard DTO validation', () => {
  it('accepts an empty dashboard query', async () => {
    const dto = Object.assign(new GetDashboardDto(), {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a valid monthly dashboard query', async () => {
    const dto = Object.assign(new GetDashboardDto(), {
      mes: '2026-05',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed month references', async () => {
    const dto = Object.assign(new GetDashboardDto(), {
      mes: '05-2026',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('mes');
  });
});
