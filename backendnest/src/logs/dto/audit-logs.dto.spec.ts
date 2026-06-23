import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindAuditLogsQueryDto } from './find-audit-logs-query.dto';

describe('Audit logs DTO validation', () => {
  it('accepts an empty audit log query', async () => {
    const dto = plainToInstance(FindAuditLogsQueryDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('transforms and accepts valid pagination query values', async () => {
    const dto = plainToInstance(FindAuditLogsQueryDto, {
      limit: '25',
      offset: '10',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(10);
  });

  it('rejects pagination outside the accepted range', async () => {
    const dto = plainToInstance(FindAuditLogsQueryDto, {
      limit: '101',
      offset: '-1',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['limit', 'offset']),
    );
  });

  it('rejects non-integer pagination values', async () => {
    const dto = plainToInstance(FindAuditLogsQueryDto, {
      limit: '10.5',
      offset: 'abc',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['limit', 'offset']),
    );
  });
});
