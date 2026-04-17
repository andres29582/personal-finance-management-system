# Resumen de arquitectura

## Vision general

El sistema esta dividido en dos aplicaciones:

- `frontend`: Expo Router, React Native Web, axios y almacenamiento local para sesion.
- `backendnest`: NestJS, TypeORM y PostgreSQL.

## Flujo principal

1. El usuario se registra o inicia sesion desde el frontend.
2. El backend devuelve `access_token` y los datos basicos del usuario.
3. El frontend guarda la sesion y envia el token en cada request.
4. La API valida JWT y resuelve datos financieros por dominio.

## Dominios del backend

- `auth`: registro, login y cambio de clave.
- `contas`: cuentas con `saldoAtual` calculado en lectura.
- `categorias`: catalogo editable con seed por defecto para usuarios nuevos.
- `transacoes`: ingresos y gastos.
- `dashboard`: resumen mensual consolidado.
- `orcamentos`: presupuesto mensual por usuario.
- `relatorios`: lectura agregada por periodo.
- `metas`, `alertas`, `transferencias`, `dividas`, `pagos-divida`: modulos complementarios del MVP.

## Decisiones clave

- `transacoes` es la unica fuente para ingresos y gastos.
- `transferencias` afectan el saldo de cuentas, pero no entran en reportes de ingresos y gastos.
- `pagos-divida` crea y elimina su `transacao` asociada dentro de una transaccion de base de datos.
- `saldoAtual` no se persiste en la tabla `conta`; se calcula desde saldo inicial, transacciones y transferencias.

## Frontend

- `app`: rutas y pantallas.
- `services`: clientes HTTP.
- `storage`: token y usuario.
- `types`: contratos TypeScript.
- `components`: bloques reutilizables.
- `utils`: formato y manejo simple de errores.
