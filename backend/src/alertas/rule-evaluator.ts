import { CondicionCompuesta, CondicionHoja } from '../common/entities/regla-alerta.entity';

type Ctx = Record<string, unknown>;

function cmp(a: unknown, op: string, b: unknown): boolean {
  const numA = typeof a === 'number' ? a : Number(a);
  const numB = typeof b === 'number' ? b : Number(b);
  const numericOps = ['>', '<', '>=', '<='];
  if (numericOps.includes(op) && !Number.isNaN(numA) && !Number.isNaN(numB)) {
    switch (op) {
      case '>': return numA > numB;
      case '<': return numA < numB;
      case '>=': return numA >= numB;
      case '<=': return numA <= numB;
    }
  }
  switch (op) {
    case '=': return a == b; // eslint-disable-line eqeqeq
    case '!=': return a != b; // eslint-disable-line eqeqeq
    case 'in': return Array.isArray(b) && b.includes(a);
    case 'not_in': return Array.isArray(b) && !b.includes(a);
    default: return false;
  }
}

function isHoja(x: CondicionHoja | CondicionCompuesta): x is CondicionHoja {
  return 'campo' in x;
}

export function evaluar(cond: CondicionCompuesta | CondicionHoja, ctx: Ctx): boolean {
  if (isHoja(cond)) return cmp(ctx[cond.campo], cond.comparador, cond.valor);
  const results = cond.condiciones.map((c) => evaluar(c, ctx));
  return cond.operador === 'OR' ? results.some(Boolean) : results.every(Boolean);
}
