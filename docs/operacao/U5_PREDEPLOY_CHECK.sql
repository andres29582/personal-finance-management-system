-- Manual schema-only gate. No application startup or data changes.
-- Invoke with psql -X -v ON_ERROR_STOP=1 -f U5_PREDEPLOY_CHECK.sql.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog, public;
DO $gate$
DECLARE expected record; actual record;
BEGIN
  IF to_regclass('public.auth_session') IS NULL
     OR to_regclass('public.usuario') IS NULL
     OR to_regclass('public.auth_session_reauthentication') IS NULL THEN
    RAISE EXCEPTION 'U5_SCHEMA_NOT_READY: required 0016/0017 tables missing';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('auth_session','id','uuid',true),
    ('auth_session','usuario_id','uuid',true),
    ('auth_session','authenticated_at','timestamp with time zone',false),
    ('auth_session','absolute_expires_at','timestamp with time zone',false),
    ('auth_session','last_activity_at','timestamp with time zone',false),
    ('auth_session','refresh_expires_at','timestamp with time zone',false),
    ('auth_session','idle_timeout_seconds','integer',false),
    ('auth_session','policy_version','integer',false),
    ('auth_session','terminal_reason','character varying(64)',false),
    ('auth_session_reauthentication','usuario_id','uuid',true),
    ('auth_session_reauthentication','window_started_at','timestamp with time zone',true),
    ('auth_session_reauthentication','attempts','integer',true)
  ) AS columns(table_name,column_name,type_name,not_null) LOOP
    SELECT format_type(a.atttypid,a.atttypmod) AS type_name, a.attnotnull AS not_null
      INTO actual FROM pg_attribute a
      WHERE a.attrelid=to_regclass('public.'||expected.table_name)
      AND a.attname=expected.column_name AND a.attnum>0 AND NOT a.attisdropped;
    IF NOT FOUND OR actual.type_name<>expected.type_name OR actual.not_null<>expected.not_null THEN
      RAISE EXCEPTION 'U5_SCHEMA_NOT_READY: column %.%',expected.table_name,expected.column_name;
    END IF;
  END LOOP;
  FOR expected IN SELECT * FROM (VALUES
    ('auth_session','auth_session_pkey','p','PRIMARY KEY (id)'),
    ('auth_session','auth_session_usuario_id_fkey','f','FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE'),
    ('auth_session','auth_session_policy_shape','c','CHECK ((((policy_version IS NULL) AND (revoked_at IS NOT NULL)) OR ((policy_version IS NOT NULL) AND (policy_version = 1) AND (authenticated_at IS NOT NULL) AND (absolute_expires_at IS NOT NULL) AND (last_activity_at IS NOT NULL) AND (refresh_expires_at IS NOT NULL) AND (idle_timeout_seconds IS NOT NULL) AND ((idle_timeout_seconds >= 1) AND (idle_timeout_seconds <= 31536000)) AND (absolute_expires_at > authenticated_at) AND (last_activity_at >= authenticated_at) AND (last_activity_at < absolute_expires_at) AND (refresh_expires_at <= absolute_expires_at))))'),
    ('auth_session_reauthentication','auth_session_reauthentication_pkey','p','PRIMARY KEY (usuario_id)'),
    ('auth_session_reauthentication','auth_session_reauthentication_usuario_id_fkey','f','FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE'),
    ('auth_session_reauthentication','auth_session_reauthentication_window_started_at_check','c','CHECK (isfinite(window_started_at))'),
    ('auth_session_reauthentication','auth_session_reauthentication_attempts_check','c','CHECK (((attempts >= 1) AND (attempts <= 5)))')
  ) AS constraints(table_name,conname,type_name,definition) LOOP
    SELECT c.contype::text AS type_name,c.convalidated,c.condeferrable,c.condeferred,
      pg_get_constraintdef(c.oid) AS definition INTO actual FROM pg_constraint c
      WHERE c.conrelid=to_regclass('public.'||expected.table_name) AND c.conname=expected.conname;
    IF NOT FOUND OR actual.type_name<>expected.type_name OR NOT actual.convalidated
      OR actual.condeferrable OR actual.condeferred OR actual.definition<>expected.definition THEN
      RAISE EXCEPTION 'U5_SCHEMA_NOT_READY: constraint %',expected.conname;
    END IF;
  END LOOP;
  SELECT i.indisvalid,i.indisready,i.indisunique,pg_get_indexdef(i.indexrelid) AS definition
    INTO actual FROM pg_index i
    WHERE i.indexrelid=to_regclass('public.auth_session_owner_authenticated_idx')
      AND i.indrelid='public.auth_session'::regclass;
  IF NOT FOUND OR NOT actual.indisvalid OR NOT actual.indisready OR actual.indisunique
    OR actual.definition<>'CREATE INDEX auth_session_owner_authenticated_idx ON public.auth_session USING btree (usuario_id, authenticated_at DESC, id DESC) WHERE ((revoked_at IS NULL) AND (policy_version = 1))' THEN
    RAISE EXCEPTION 'U5_SCHEMA_NOT_READY: owner keyset index';
  END IF;
  RAISE NOTICE 'U5_SCHEMA_READY: schema only; deployment and runtime remain unverified';
END $gate$;
COMMIT;
