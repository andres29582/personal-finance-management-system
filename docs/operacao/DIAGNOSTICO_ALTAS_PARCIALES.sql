-- Solo diagnóstico: ausencia de categorías no demuestra un registro fallido.
-- Revisar historia de creación, migraciones y decisiones del usuario antes de reparar.
-- No insertar categorías ni modificar cuentas automáticamente con este resultado.
BEGIN TRANSACTION READ ONLY;

SELECT u.id,
       u.data_registro,
       count(c.id) AS categorias_existentes
FROM public.usuario AS u
LEFT JOIN public.categoria AS c ON c.usuario_id = u.id
GROUP BY u.id, u.data_registro
HAVING count(c.id) = 0
ORDER BY u.data_registro, u.id;

COMMIT;
