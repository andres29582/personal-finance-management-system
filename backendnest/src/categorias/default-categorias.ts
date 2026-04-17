import { TipoCategoria } from './enums/tipo-categoria.enum';

export const DEFAULT_CATEGORIAS = [
  {
    nome: 'Salario',
    tipo: TipoCategoria.RECEITA,
    cor: '#2E7D32',
    icone: 'wallet',
  },
  {
    nome: 'Freelance',
    tipo: TipoCategoria.RECEITA,
    cor: '#0B6B34',
    icone: 'briefcase',
  },
  {
    nome: 'Investimentos',
    tipo: TipoCategoria.RECEITA,
    cor: '#075A2B',
    icone: 'trending-up',
  },
  {
    nome: 'Alimentacao',
    tipo: TipoCategoria.DESPESA,
    cor: '#EF6C00',
    icone: 'restaurant',
  },
  {
    nome: 'Moradia',
    tipo: TipoCategoria.DESPESA,
    cor: '#6D4C41',
    icone: 'home',
  },
  {
    nome: 'Transporte',
    tipo: TipoCategoria.DESPESA,
    cor: '#1565C0',
    icone: 'car',
  },
  {
    nome: 'Saude',
    tipo: TipoCategoria.DESPESA,
    cor: '#C62828',
    icone: 'heart',
  },
  {
    nome: 'Lazer',
    tipo: TipoCategoria.DESPESA,
    cor: '#7B1FA2',
    icone: 'game-controller',
  },
] as const;
