-- ═══════════════════════════════════════════════════════════════════════════
--  ZETINA Admin Panel — Adiciones al esquema
--  Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tabla de administradores ─────────────────────────────────────────────────
create table if not exists admins (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  nombre        text        not null,
  password_hash text        not null,   -- SHA-256 hex
  created_at    timestamptz not null default now()
);

-- Desactivar RLS y eliminar cualquier política que bloquee el acceso con anon key
alter table admins disable row level security;
drop policy if exists "admins_policy" on admins;
drop policy if exists "Enable read access for all users" on admins;
drop policy if exists "Enable insert for all users" on admins;

-- ── Columnas nuevas en prendas ───────────────────────────────────────────────
alter table prendas add column if not exists numero           text;
alter table prendas add column if not exists categoria        text;
alter table prendas add column if not exists baja             boolean not null default false;
alter table prendas add column if not exists descripcion      text;
alter table prendas add column if not exists color            text;

-- ── Tabla de categorías de prendas ──────────────────────────────────────────
create table if not exists categorias_prendas (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null unique,
  created_at timestamptz not null default now()
);

alter table categorias_prendas disable row level security;

-- Poblar con las categorías base (idempotente)
insert into categorias_prendas (nombre) values
  ('Blusa'), ('Pantalón'), ('Vestido'), ('Falda'), ('Chamarra'),
  ('Conjunto'), ('Sudadera'), ('Short'), ('Zapatos'), ('Bolsa'),
  ('Accesorio'), ('Otro')
on conflict (nombre) do nothing;

-- ── Gastos operativos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id           UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria    TEXT      NOT NULL,
  subcategoria TEXT,
  descripcion  TEXT,
  monto        NUMERIC   NOT NULL,
  fecha        TIMESTAMPTZ DEFAULT now(),
  mes          INTEGER,
  anio         INTEGER,
  created_at   TIMESTAMP DEFAULT now()
);

ALTER TABLE gastos DISABLE ROW LEVEL SECURITY;

-- ── Subcategorías de insumos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcategorias_insumos (
  id         UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT      NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE subcategorias_insumos DISABLE ROW LEVEL SECURITY;

INSERT INTO subcategorias_insumos (nombre) VALUES
  ('Alcohol'), ('Bolsas'), ('Ganchos'), ('Muebles'), ('Aparatos'), ('Cinta'), ('Empaques')
ON CONFLICT (nombre) DO NOTHING;

-- ── Medidas de clientas (inferidas del historial de compras) ─────────────────
alter table clientes add column if not exists medida_cintura       numeric;
alter table clientes add column if not exists medida_busto         numeric;
alter table clientes add column if not exists medida_cadera        numeric;
alter table clientes add column if not exists medida_actualizada_en timestamptz;

-- ── Direcciones de envío de visionarias ───────────────────────────────────────
create table if not exists direcciones_vendedoras (
  id             uuid        primary key default gen_random_uuid(),
  vendedora_id   uuid        not null references vendedoras(id) on delete cascade,
  alias          text        not null default 'Casa',
  calle          text        not null,
  num_exterior   text        not null,
  num_interior   text,
  colonia        text        not null,
  municipio      text        not null,
  estado_dir     text        not null,
  codigo_postal  text        not null,
  referencias    text,
  predeterminada boolean     not null default false,
  created_at     timestamptz not null default now()
);
alter table direcciones_vendedoras disable row level security;

-- ── Dirección de entrega en pedidos ──────────────────────────────────────────
alter table pedidos add column if not exists direccion_entrega_id   uuid references direcciones_vendedoras(id) on delete set null;
alter table pedidos add column if not exists direccion_entrega_texto text;

-- ── Medidas de prendas ───────────────────────────────────────────────────────
alter table prendas add column if not exists medida_1_nombre text;
alter table prendas add column if not exists medida_1_valor  numeric;
alter table prendas add column if not exists medida_2_nombre text;
alter table prendas add column if not exists medida_2_valor  numeric;

-- ── Departamento y fecha de adquisición en prendas ──────────────────────────
alter table prendas add column if not exists departamento      text not null default 'DAMA';
alter table prendas add column if not exists fecha_adquisicion timestamptz;

-- ── Nivel en vendedoras ──────────────────────────────────────────────────────
alter table vendedoras add column if not exists nivel text not null default 'Básico';

-- ── Contraseña temporal en vendedoras ────────────────────────────────────────
alter table vendedoras add column if not exists password_hash     text;
alter table vendedoras add column if not exists password_temporal boolean not null default false;

-- ═══════════════════════════════════════════════════════════════════════════
--  Bucket de Storage
--  Crear manualmente: Supabase Dashboard → Storage → New Bucket
--    Nombre:  prenda-fotos
--    Public:  ✓ (habilitado)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Nota sobre el primer administrador ───────────────────────────────────────
-- El primer admin se crea desde la pantalla de login (index.html).
-- Si prefieres crearlo aquí, calcula SHA-256 de tu contraseña y ejecuta:
--
-- INSERT INTO admins (username, nombre, password_hash)
-- VALUES ('admin', 'Administrador ZETINA', '<sha256-de-tu-contraseña>');
--
-- Puedes obtener el hash en: https://emn178.github.io/online-tools/sha256.html
