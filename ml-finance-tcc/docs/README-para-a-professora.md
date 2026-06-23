# Nota técnica para avaliação — ML V2

O projeto implementa uma previsão causal de déficit mensal. Para prever `M`,
o modelo recebe somente agregados de `M-3`, `M-2`, `M-1`, o saldo disponível
no início de `M` e o mês do ano.

O target continua sendo `despesa_mes > receita_mes`, porém esses valores do
mês objetivo não são features. Isso remove a fuga de informação da versão
anterior.

O dataset é sintético e sequencial por usuário. O treino e teste são separados
cronologicamente por meses únicos, sem embaralhamento. O relatório inclui
Random Forest, baseline majoritário e baseline de persistência.

O artefato `models/features.json` registra `schema_version: 2`, lista canônica
de features, target, histórico mínimo e política temporal. FastAPI e NestJS
rejeitam contratos incompatíveis.

O modelo é treinado de forma manual e controlada com dataset sintético. O
sistema não realiza reentrenamento automático com dados reais dos usuários em
produção. Qualquer uso futuro de dados reais exigiria política específica de
privacidade, anonimização, base legal e validação de qualidade.
