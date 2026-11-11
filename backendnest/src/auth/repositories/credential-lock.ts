import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AppException } from '../../common/exceptions/app.exception';
import { InternalServerAppException } from '../../common/exceptions';

export async function credentialTransaction<T>(
  source: DataSource,
  operation: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await source.transaction(operation);
  } catch (error) {
    if (error instanceof AppException) throw error;
    // Do not propagate database errors carrying credential query parameters to logs.
    throw new InternalServerAppException('Credential operation failed.');
  }
}

// All credential writers acquire this row before tokens or sessions.
export async function lockCredentialUser(
  manager: EntityManager,
  userId: string,
) {
  await manager.query("SET LOCAL lock_timeout = '5s'");
  return manager.findOne(User, {
    where: { id: userId },
    lock: { mode: 'pessimistic_write' },
  });
}

export async function credentialTime(manager: EntityManager): Promise<Date> {
  const [row] = await manager.query<Array<{ milliseconds: string | number }>>(
    'SELECT EXTRACT(EPOCH FROM clock_timestamp()) * 1000 AS milliseconds',
  );
  const time = new Date(Number(row?.milliseconds));
  if (!Number.isFinite(time.getTime()))
    throw new Error('Credential clock unavailable.');
  return time;
}
