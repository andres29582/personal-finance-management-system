import { IsNull } from 'typeorm';

/** Filtro TypeORM: registro ainda não excluído logicamente. */
export const notSoftDeleted = { excluidoEm: IsNull() };
