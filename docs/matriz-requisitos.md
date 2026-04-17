# Matriz requisito -> endpoint -> pantalla -> prueba

| Requisito | Backend | Frontend | Prueba sugerida |
| --- | --- | --- | --- |
| Registro de usuario | `POST /auth/register` | `app/register.tsx` | Registrar usuario nuevo y verificar categorias seed |
| Login | `POST /auth/login` | `app/login.tsx` | Iniciar sesion y abrir dashboard |
| Reset de clave | `POST /auth/reset-password` | `app/reset-password.tsx` | Cambiar contrasena con sesion activa |
| Cuentas | `/contas` | `app/contas.tsx`, `app/contas-create.tsx`, `app/contas-edit.tsx` | Crear cuenta y revisar saldo actual |
| Categorias | `/categorias` | `app/categorias.tsx`, `app/categorias-form.tsx` | Crear categoria y filtrarla por tipo |
| Transacciones | `/transacoes` | `app/transacoes.tsx`, `app/transacoes-form.tsx` | Registrar ingreso y gasto |
| Dashboard | `GET /dashboard` | `app/dashboard.tsx` | Revisar saldos y ultimas transacciones |
| Orcamentos | `/orcamentos` | `app/orcamentos.tsx`, `app/orcamentos-form.tsx` | Crear presupuesto y revisar alerta |
| Relatorios | `GET /relatorios` | `app/relatorios.tsx` | Filtrar reporte por mes o trimestre |
| Metas | `/metas` | `app/metas.tsx`, `app/metas-form.tsx` | Crear meta y revisar progreso |
| Alertas | `/alertas` | `app/alertas.tsx`, `app/alertas-form.tsx` | Crear alerta in-app |
| Transferencias | `/transferencias` | `app/transferencias.tsx`, `app/transferencias-form.tsx` | Transferir entre cuentas y revisar saldo |
| Dividas | `/dividas` | `app/dividas.tsx`, `app/dividas-form.tsx` | Crear deuda y listar pagos |
| Pagos de deuda | `/pagos-divida` | `app/pagos-divida.tsx` | Registrar pago y validar transaccion ligada |
