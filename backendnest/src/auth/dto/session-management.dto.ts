import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SessionListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;
}
export class RevokeSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  senhaAtual: string;
}
export type SessionCursor = { authenticatedAt: string; id: string };
export type SessionListOptions = { limit: number; cursor?: SessionCursor };
export type OwnSession = {
  id: string;
  isCurrent: boolean;
  authenticatedAt: string;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  clientDescription: null;
};
export type OwnSessionPage = {
  items: OwnSession[];
  nextCursor: string | null;
  serverNow: string;
};
export function decodeSessionCursor(
  cursor?: string,
): SessionCursor | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) throw new Error();
    const value: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value[0]) ||
      value[0].startsWith('0000-') ||
      !Number.isFinite(Date.parse(value[0])) ||
      new Date(value[0]).toISOString() !== value[0].slice(0, 23) + 'Z' ||
      typeof value[1] !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        value[1],
      )
    )
      throw new Error();
    return { authenticatedAt: value[0], id: value[1] };
  } catch {
    throw new BadRequestException('Cursor de sessoes invalido.');
  }
}
export function encodeSessionCursor(
  item: Pick<OwnSession, 'authenticatedAt' | 'id'>,
) {
  return Buffer.from(JSON.stringify([item.authenticatedAt, item.id])).toString(
    'base64url',
  );
}
