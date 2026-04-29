import { evaluar } from './rule-evaluator';
import { CondicionCompuesta, CondicionHoja } from '../common/entities/regla-alerta.entity';

const hoja = (campo: string, comparador: CondicionHoja['comparador'], valor: unknown): CondicionHoja =>
  ({ campo, comparador, valor });

describe('rule-evaluator', () => {
  describe('comparadores numéricos', () => {
    it('>, <, >=, <= comparan numéricamente', () => {
      const ctx = { t: 30 };
      expect(evaluar(hoja('t', '>', 20), ctx)).toBe(true);
      expect(evaluar(hoja('t', '>', 30), ctx)).toBe(false);
      expect(evaluar(hoja('t', '>=', 30), ctx)).toBe(true);
      expect(evaluar(hoja('t', '<', 50), ctx)).toBe(true);
      expect(evaluar(hoja('t', '<=', 29), ctx)).toBe(false);
    });

    it('coerce strings numéricos a number', () => {
      expect(evaluar(hoja('t', '>', 10), { t: '25' })).toBe(true);
      expect(evaluar(hoja('t', '>', '10'), { t: 25 })).toBe(true);
    });

    it('con valor no numérico usa comparación estricta', () => {
      expect(evaluar(hoja('t', '>', 'abc'), { t: 'xyz' })).toBe(false);
    });
  });

  describe('comparadores de igualdad e inclusión', () => {
    it('= y != aplican coerción (==)', () => {
      expect(evaluar(hoja('n', '=', '10'), { n: 10 })).toBe(true);
      expect(evaluar(hoja('n', '!=', 11), { n: 10 })).toBe(true);
    });

    it('in / not_in requieren array en valor', () => {
      expect(evaluar(hoja('r', 'in', ['alto', 'medio']), { r: 'alto' })).toBe(true);
      expect(evaluar(hoja('r', 'in', ['alto']), { r: 'bajo' })).toBe(false);
      expect(evaluar(hoja('r', 'not_in', ['alto']), { r: 'bajo' })).toBe(true);
      expect(evaluar(hoja('r', 'in', 'alto'), { r: 'alto' })).toBe(false); // valor no array
    });

    it('comparador desconocido devuelve false', () => {
      expect(evaluar(hoja('x', '~~' as never, 1), { x: 1 })).toBe(false);
    });
  });

  describe('campos ausentes', () => {
    it('campo undefined no hace match numérico', () => {
      expect(evaluar(hoja('missing', '>', 0), {})).toBe(false);
    });
  });

  describe('compuestas AND / OR', () => {
    const c: CondicionCompuesta = {
      operador: 'AND',
      condiciones: [hoja('temp', '>', 30), hoja('hum', '<', 40)],
    };

    it('AND true sólo si todas son true', () => {
      expect(evaluar(c, { temp: 35, hum: 20 })).toBe(true);
      expect(evaluar(c, { temp: 35, hum: 60 })).toBe(false);
    });

    it('OR true si al menos una', () => {
      const or: CondicionCompuesta = { operador: 'OR', condiciones: c.condiciones };
      expect(evaluar(or, { temp: 10, hum: 20 })).toBe(true);
      expect(evaluar(or, { temp: 10, hum: 80 })).toBe(false);
    });

    it('anidación de compuestas', () => {
      const nested: CondicionCompuesta = {
        operador: 'AND',
        condiciones: [
          hoja('parque.nivel_riesgo', 'in', ['alto', 'medio']),
          { operador: 'OR', condiciones: [hoja('temp', '>', 35), hoja('viento', '>', 50)] },
        ],
      };
      expect(evaluar(nested, { 'parque.nivel_riesgo': 'alto', temp: 20, viento: 60 })).toBe(true);
      expect(evaluar(nested, { 'parque.nivel_riesgo': 'alto', temp: 20, viento: 10 })).toBe(false);
      expect(evaluar(nested, { 'parque.nivel_riesgo': 'bajo', temp: 40, viento: 60 })).toBe(false);
    });
  });

  describe('casos realistas del dominio', () => {
    it('incendio alto: temp≥32 AND humedad≤30 AND sin lluvia 7d', () => {
      const regla: CondicionCompuesta = {
        operador: 'AND',
        condiciones: [
          hoja('temperatura_c', '>=', 32),
          hoja('humedad_relativa', '<=', 30),
          hoja('dias_sin_lluvia', '>=', 7),
        ],
      };
      expect(evaluar(regla, { temperatura_c: 33, humedad_relativa: 25, dias_sin_lluvia: 9 })).toBe(true);
      expect(evaluar(regla, { temperatura_c: 33, humedad_relativa: 25, dias_sin_lluvia: 3 })).toBe(false);
    });

    it('IA por encima de umbral', () => {
      expect(evaluar(hoja('prediccion_ia.incendio', '>', 70), { 'prediccion_ia.incendio': 82.5 })).toBe(true);
      expect(evaluar(hoja('prediccion_ia.incendio', '>', 70), { 'prediccion_ia.incendio': 12 })).toBe(false);
    });
  });
});
