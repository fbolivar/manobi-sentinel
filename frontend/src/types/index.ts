export type NivelAlerta = 'verde' | 'amarillo' | 'rojo';
export type Rol = 'admin' | 'operador' | 'consulta';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface Parque {
  id: string;
  nombre: string;
  region: string | null;
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | null;
  area_ha: number | null;
  descripcion: string | null;
  creado_en: string;
}

export interface Alerta {
  id: string;
  tipo: string;
  nivel: NivelAlerta;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  parque_id: string | null;
  parque?: { nombre: string; region: string | null } | null;
  estado: 'activa' | 'cerrada' | 'falsa';
  generada_por: 'motor_reglas' | 'ia' | 'manual' | null;
  creado_en: string;
}

export interface EventoClimatico {
  id: string;
  tipo: 'lluvia' | 'incendio' | 'viento' | 'sequia' | 'inundacion' | 'temperatura' | 'humedad' | 'presion' | 'nivel_rio';
  intensidad: number | null;
  unidad: string | null;
  fecha: string;
  fuente: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}
