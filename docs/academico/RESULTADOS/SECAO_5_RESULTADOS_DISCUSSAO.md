# 5 RESULTADOS E DISCUSSÕES

Esta seção apresenta os principais resultados obtidos no desenvolvimento do Sistema de Gestão Financeira Pessoal, considerando os artefatos de análise, modelagem, implementação e validação técnica produzidos ao longo do projeto. Diferentemente de uma abordagem limitada apenas à prototipagem, os resultados alcançados demonstram a consolidação de um MVP funcional, composto por backend, frontend e um módulo complementar de Machine Learning para previsão de déficit financeiro.

A discussão dos resultados está organizada de acordo com as principais dimensões do trabalho: requisitos e rastreabilidade, arquitetura da solução, implementação dos módulos financeiros, interface do usuário, camada de dados, segurança, validação por testes e uso de inteligência computacional aplicada ao contexto de finanças pessoais.

## 5.1 MODELAGEM DOS REQUISITOS E RASTREABILIDADE

A primeira etapa de resultados refere-se à identificação e organização das necessidades do usuário por meio de requisitos funcionais, User Stories e critérios de aceitação. Esses artefatos permitiram transformar problemas cotidianos de gestão financeira em funcionalidades objetivas do sistema, como cadastro de usuário, autenticação, registro de receitas e despesas, controle de contas, orçamentos, metas, relatórios e acompanhamento de dívidas.

A rastreabilidade entre requisitos, módulos implementados, endpoints, serviços e testes demonstrou-se fundamental para garantir coerência entre o planejamento acadêmico e a solução desenvolvida. A matriz de rastreabilidade técnica evidencia que os principais requisitos do MVP foram relacionados a componentes concretos do sistema, como controllers, services, DTOs, testes unitários e testes de integração.

Entre os requisitos cobertos destacam-se autenticação com JWT, gerenciamento de contas, categorias, transações, transferências, dívidas, pagamentos de dívidas, dashboard financeiro, relatórios, logs de auditoria e previsão de déficit. Essa organização contribuiu para reduzir ambiguidades, facilitar a validação das entregas e demonstrar que o desenvolvimento seguiu uma lógica sistemática e verificável.

## 5.2 ARQUITETURA DO SISTEMA

O sistema foi estruturado como uma solução full stack, composta por três partes principais: backend em NestJS, frontend em Expo/React Native Web e módulo de Machine Learning em Python com FastAPI. Essa divisão permitiu separar responsabilidades e organizar o projeto em camadas, favorecendo manutenção, escalabilidade e clareza técnica.

No backend, a aplicação foi organizada em módulos de domínio, como autenticação, usuários, contas, categorias, transações, dashboard, orçamentos, relatórios, metas, alertas, transferências, dívidas, pagamentos de dívida, logs de auditoria e previsões. A utilização de NestJS, TypeORM e PostgreSQL permitiu estruturar regras de negócio, persistência de dados e contratos HTTP de forma consistente.

No frontend, a aplicação foi organizada com Expo Router, telas por domínio, serviços de comunicação com a API, tipos compartilhados e componentes reutilizáveis. Essa estrutura favoreceu a separação entre navegação, apresentação visual e integração com os serviços do backend. O fluxo principal do sistema inicia no cadastro ou login do usuário, passa pela persistência da sessão e utiliza o token JWT para acessar as funcionalidades financeiras autenticadas.

A arquitetura adotada demonstrou-se adequada ao escopo do trabalho por permitir evolução incremental dos módulos e integração entre diferentes tecnologias, mantendo cada parte do sistema com responsabilidades bem definidas.

## 5.3 IMPLEMENTAÇÃO DOS MÓDULOS FINANCEIROS

Como resultado prático do desenvolvimento, foi implementado um MVP funcional para controle financeiro pessoal. O sistema permite ao usuário registrar e acompanhar informações essenciais de sua vida financeira, respondendo a questões como saldo disponível, gastos por período, categorias de maior consumo, evolução patrimonial, dívidas existentes e relação entre receitas e despesas.

O módulo de autenticação contempla cadastro, login, refresh token e recuperação de senha, além de consentimento relacionado à LGPD e tela de privacidade. Essas funcionalidades reforçam a preocupação com acesso seguro e tratamento adequado dos dados do usuário.

Os módulos de contas, categorias e transações formam a base operacional do sistema. As contas representam os locais de movimentação financeira, enquanto as categorias permitem classificar receitas e despesas. As transações registram entradas e saídas, com regras de validação para valores positivos, associação correta de categorias e exclusão lógica, evitando perda definitiva de dados e preservando consistência nos cálculos.

Também foram implementadas funcionalidades complementares, como orçamentos mensais, metas financeiras, alertas, transferências entre contas, dívidas e pagamentos de dívidas. Esses recursos ampliam o alcance do sistema, permitindo que o usuário não apenas registre movimentações, mas também acompanhe planejamento, compromissos financeiros e objetivos futuros.

## 5.4 DASHBOARD, RELATÓRIOS E ANÁLISE FINANCEIRA

O dashboard consolidado representa um dos principais resultados do sistema, pois reúne indicadores financeiros relevantes em uma visão centralizada. A tela apresenta informações como saldo atual, receitas, despesas, gastos por categoria e transações recentes, facilitando a interpretação rápida da situação financeira do usuário.

Os relatórios financeiros complementam o dashboard ao permitir análises por período e consulta agregada das movimentações. A implementação contempla filtros, totais consolidados e gráficos que apoiam a comparação entre receitas e despesas, bem como a identificação de padrões de consumo. Dessa forma, o sistema deixa de ser apenas um repositório de registros e passa a atuar como ferramenta de apoio à tomada de decisão.

A discussão desses resultados indica que a visualização organizada dos dados financeiros contribui para maior consciência sobre hábitos de consumo, planejamento de orçamento e acompanhamento de metas. A combinação entre registros detalhados e indicadores consolidados oferece ao usuário uma visão mais ampla de sua vida financeira.

## 5.5 MODELAGEM E PERSISTÊNCIA DOS DADOS

A modelagem de dados foi consolidada por meio das entidades implementadas no backend e das migrações de banco de dados. O sistema utiliza PostgreSQL como base relacional, com entidades associadas a usuários, contas, categorias, transações, orçamentos, metas, alertas, transferências, dívidas, pagamentos de dívida, sessões de autenticação, tokens de recuperação de senha e logs de auditoria.

Um resultado relevante da implementação é a decisão de calcular o saldo atual das contas em tempo de leitura, a partir do saldo inicial, das transações e das transferências registradas. Essa estratégia evita duplicidade de informação persistida e reduz o risco de inconsistência entre saldo armazenado e movimentações reais.

Outro ponto importante é o uso de exclusão lógica em operações financeiras. Essa abordagem permite que registros sejam desativados sem remoção física imediata, preservando histórico, rastreabilidade e coerência com necessidades de auditoria. A modelagem demonstrou aderência às regras de negócio e forneceu base consistente para os módulos analíticos do sistema.

## 5.6 SEGURANÇA, PRIVACIDADE E AUDITORIA

Os resultados relacionados à segurança incluem autenticação por JWT, proteção de rotas financeiras, validação de entrada por DTOs, tratamento padronizado de exceções e isolamento dos dados por usuário autenticado. Essa estrutura reduz riscos de acesso indevido e garante que cada usuário visualize e manipule apenas suas próprias informações financeiras.

A inclusão de consentimento LGPD no cadastro e de uma tela de privacidade demonstra preocupação com aspectos legais e éticos do tratamento de dados pessoais. Embora o projeto tenha caráter acadêmico, a presença desses elementos aproxima a solução de práticas esperadas em sistemas reais que lidam com informações sensíveis.

O módulo de logs de auditoria também representa um resultado importante, pois permite registrar eventos relevantes e consultar o histórico de ações do usuário. A validação desse módulo incluiu preocupação com paginação, isolamento multiusuário e sanitização de dados sensíveis, evitando exposição de informações como senhas e tokens.

## 5.7 PREVISÃO DE DÉFICIT COM MACHINE LEARNING

Além das funcionalidades tradicionais de gestão financeira, o projeto incorporou um módulo de Machine Learning voltado à previsão de déficit mensal. Esse módulo foi desenvolvido em Python, utilizando Pandas, Scikit-learn e FastAPI, com pipeline de ingestão de dados, pré-processamento, treinamento, avaliação e exposição de endpoint para predição.

O problema tratado consiste em prever se determinado mês tende a apresentar déficit, com base em variáveis agregadas como receita mensal, despesa mensal, saldo inicial, quantidade de transações de receita e despesa e volatilidade dos gastos. O modelo utiliza Random Forest para classificação binária e gera métricas como acurácia, precisão, recall, F1-score e ROC-AUC, além de artefatos gráficos como matriz de confusão, curva ROC, curva precision-recall, histogramas e heatmap de correlação.

A integração conceitual entre o módulo de Machine Learning e o sistema financeiro amplia o valor da solução, pois permite evoluir de uma aplicação descritiva para uma aplicação também preditiva. Dessa forma, o sistema pode apoiar o usuário na identificação antecipada de risco financeiro, contribuindo para decisões preventivas antes que o déficit ocorra.

## 5.8 VALIDAÇÃO TÉCNICA E TESTES

A validação técnica do sistema foi realizada por meio de testes unitários, testes de controller/DTO, testes de integração e testes end-to-end. Essa estratégia permitiu verificar regras de negócio críticas, contratos da API, isolamento entre usuários, cálculos financeiros e comportamento dos principais fluxos do sistema.

No backend, os testes cobrem funcionalidades como autenticação, contas, transações, transferências, dívidas, pagamentos de dívida, dashboard, relatórios, previsão de déficit e logs de auditoria. Os cenários incluem validação de token inválido, bloqueio de acesso sem autenticação, valores financeiros inválidos, uso de categorias incompatíveis, exclusão lógica, cálculo de saldo, agregações por período e separação de dados entre usuários diferentes.

No frontend, os testes contemplam telas e fluxos críticos, incluindo login, dashboard, transações, contas, transferências, dívidas, pagamentos de dívida, relatórios, previsão de déficit e logs de auditoria. No módulo de Machine Learning, a suíte de testes valida carregamento de dados, pré-processamento, persistência do modelo, API direta e integração HTTP.

Os resultados dos testes reforçam a confiabilidade do MVP e demonstram que a solução não se limita à implementação visual, mas inclui mecanismos objetivos de verificação de qualidade.

## 5.9 PROTOTIPAGEM E INTERFACE DO SISTEMA

A prototipagem da interface serviu como etapa inicial de validação visual e conceitual, permitindo representar as principais telas antes e durante a implementação. As propostas de tela contemplaram login e cadastro, dashboard principal, registro de despesas, registro de receitas e relatórios financeiros.

A tela de autenticação foi planejada com foco em simplicidade, segurança e acesso rápido, contendo campos de e-mail e senha, ação de entrada, opção de cadastro e recuperação de senha. Essa interface atende ao fluxo inicial do sistema e orienta o usuário para o uso autenticado da aplicação.

O dashboard foi concebido para apresentar uma visão consolidada das finanças, com cards de resumo, gráficos, transações recentes e ações rápidas. Essa tela se relaciona diretamente aos requisitos de acompanhamento financeiro contínuo e tomada de decisão.

As telas de registro de receitas e despesas foram diferenciadas de acordo com a natureza da movimentação. Enquanto despesas incluem campos como categoria, data, valor, descrição e método de pagamento, receitas priorizam a origem dos rendimentos e categorias específicas de entrada financeira. Essa separação melhora a clareza do fluxo e reduz erros de preenchimento.

A tela de relatórios foi planejada para oferecer filtros por período, métricas consolidadas, gráficos comparativos e tabela detalhada de transações. Com isso, a interface apoia tanto uma visão resumida quanto uma análise mais detalhada do comportamento financeiro.

## 5.10 SÍNTESE DA DISCUSSÃO

A análise integrada dos resultados permite concluir que os objetivos do trabalho foram alcançados em nível superior à simples modelagem inicial. O projeto resultou em um MVP funcional, com arquitetura full stack, persistência relacional, autenticação segura, módulos financeiros integrados, relatórios, dashboard, auditoria, testes automatizados e componente de Machine Learning aplicado à previsão de déficit.

Os artefatos de requisitos, modelagem, implementação e validação demonstram coerência metodológica e técnica. A relação entre User Stories, entidades, endpoints, telas e testes garante rastreabilidade ao desenvolvimento e evidencia que as funcionalidades implementadas respondem às necessidades identificadas no início do trabalho.

Como limitação, observa-se que alguns módulos complementares ainda podem ser ampliados em termos de cobertura de testes, refinamento visual e uso com dados reais em maior escala, especialmente no contexto da previsão de déficit. Ainda assim, os resultados obtidos constituem uma base sólida para evolução futura do sistema, tanto como produto acadêmico quanto como aplicação prática de gestão financeira pessoal.

Portanto, o sistema desenvolvido contribui para a organização, controle e análise das finanças pessoais, oferecendo ao usuário recursos para registrar movimentações, acompanhar indicadores, planejar metas, consultar relatórios e antecipar riscos financeiros. Essa combinação de funcionalidades confirma a relevância técnica e prática da solução proposta.
