-- =====================================================================
-- Manobi Sentinel — Esquema relacional + espacial
-- PostgreSQL 16 + PostGIS 3.x
-- =====================================================================

-- ------------------ PARQUES ------------------
CREATE TABLE IF NOT EXISTS parques (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre        VARCHAR(255) NOT NULL,
    geometria     GEOMETRY(MULTIPOLYGON, 4326),
    region        VARCHAR(100),
    nivel_riesgo  VARCHAR(20) CHECK (nivel_riesgo IN ('bajo','medio','alto')),
    area_ha       NUMERIC,
    descripcion   TEXT,
    creado_en     TIMESTAMP DEFAULT NOW()
);

-- ------------------ EVENTOS CLIMÁTICOS ------------------
CREATE TABLE IF NOT EXISTS eventos_climaticos (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo          VARCHAR(50) CHECK (tipo IN ('lluvia','incendio','viento','sequia','inundacion')),
    intensidad    NUMERIC,
    unidad        VARCHAR(20),
    fecha         TIMESTAMP NOT NULL,
    ubicacion     GEOMETRY(POINT, 4326),
    fuente        VARCHAR(100),
    datos_raw     JSONB,
    creado_en     TIMESTAMP DEFAULT NOW()
);

-- ------------------ ALERTAS ------------------
CREATE TABLE IF NOT EXISTS alertas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo            VARCHAR(100) NOT NULL,
    nivel           VARCHAR(20) CHECK (nivel IN ('verde','amarillo','rojo')),
    descripcion     TEXT,
    fecha_inicio    TIMESTAMP NOT NULL,
    fecha_fin       TIMESTAMP,
    parque_id       UUID REFERENCES parques(id) ON DELETE CASCADE,
    estado          VARCHAR(20) CHECK (estado IN ('activa','cerrada','falsa')),
    generada_por    VARCHAR(50),
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- ------------------ REGLAS DE ALERTA ------------------
CREATE TABLE IF NOT EXISTS reglas_alerta (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre            VARCHAR(255),
    condicion         JSONB NOT NULL,
    accion            TEXT,
    nivel_resultante  VARCHAR(20) CHECK (nivel_resultante IN ('verde','amarillo','rojo')),
    activa            BOOLEAN DEFAULT TRUE,
    creado_en         TIMESTAMP DEFAULT NOW()
);

-- ------------------ PREDICCIONES ------------------
CREATE TABLE IF NOT EXISTS predicciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo            VARCHAR(50) CHECK (tipo IN ('incendio','inundacion')),
    probabilidad    NUMERIC CHECK (probabilidad BETWEEN 0 AND 100),
    fecha           TIMESTAMP NOT NULL,
    parque_id       UUID REFERENCES parques(id) ON DELETE CASCADE,
    modelo_version  VARCHAR(50),
    parametros      JSONB,
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- ------------------ USUARIOS ------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) CHECK (rol IN ('admin','operador','consulta')),
    activo          BOOLEAN DEFAULT TRUE,
    ultimo_login    TIMESTAMP,
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- ------------------ AUDITORÍA ------------------
CREATE TABLE IF NOT EXISTS auditoria_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion      VARCHAR(255) NOT NULL,
    fecha       TIMESTAMP DEFAULT NOW(),
    ip          INET,
    user_agent  TEXT,
    detalle     JSONB,
    resultado   VARCHAR(20) CHECK (resultado IN ('exito','error'))
);

-- ------------------ REPORTES ------------------
CREATE TABLE IF NOT EXISTS reportes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo            VARCHAR(100),
    formato         VARCHAR(10) CHECK (formato IN ('pdf','xlsx','csv')),
    ruta_minio      VARCHAR(500),
    generado_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    parametros      JSONB,
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- ------------------ SUSCRIPCIONES NOTIFICACIÓN ------------------
CREATE TABLE IF NOT EXISTS suscripciones_notificacion (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    parque_id    UUID REFERENCES parques(id) ON DELETE CASCADE,
    niveles      VARCHAR(20)[] NOT NULL DEFAULT ARRAY['rojo'],
    canal        VARCHAR(20) CHECK (canal IN ('email','webhook','push')),
    destino      VARCHAR(500),
    activa       BOOLEAN DEFAULT TRUE,
    creado_en    TIMESTAMP DEFAULT NOW()
);

-- ------------------ ESTACIONES IDEAM ------------------
CREATE TABLE IF NOT EXISTS estaciones_ideam (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo       VARCHAR(50) UNIQUE NOT NULL,
    nombre       VARCHAR(255),
    ubicacion    GEOMETRY(POINT, 4326),
    departamento VARCHAR(100),
    municipio    VARCHAR(100),
    altitud_m    NUMERIC,
    activa       BOOLEAN DEFAULT TRUE
);
