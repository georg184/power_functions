/* Exact, DOM-independent generation of monomial simplification exercises.
 * Each family below draws k in 2..5, n in 2..4, r in 1..3 and nonzero rational
 * numerical factors. The independent variable is real; extra letters are
 * fixed nonzero real parameters. Only the quotient family excludes v=0.
 * Every answer is a nonzero monomial coefficient times v^degree, degree>0.
 * normalize() applies exact rational arithmetic and integer exponent laws;
 * it deliberately rejects sums with unlike powers. No learner expression is
 * parsed, scored or evaluated. The UI offers worked solutions on request.
 * A worksheet is reconstructed from its schema, mode, level, count and seed;
 * language and revealed indices complete the learner state. Changing these
 * seed-to-task semantics after release requires a state-schema migration.
 */
(function (root) {
  'use strict';
  const VERSION = '20261011.175718';
  const STATE_VERSION = 1;
  const MODES = ['numbers', 'parameters'];
  const LEVELS = ['progressive', 'easy', 'medium', 'hard'];
  const COUNTS = [6, 10, 12];
  const LANGUAGES = ['de', 'en', 'fr'];

  /** Return a reduced exact rational with a positive denominator. */
  function rational(n, d = 1) {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw new Error('Invalid rational');
    if (d < 0) { n = -n; d = -d; }
    let a = Math.abs(n), b = d;
    while (b) { const next = a % b; a = b; b = next; }
    return {n: n / a, d: d / a};
  }
  const multiply = (a, b) => rational(a.n * b.n, a.d * b.d);
  const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
  const number = (n, d = 1) => ({kind: 'number', ...rational(n, d)});
  const symbol = name => ({kind: 'symbol', name});
  const product = (...args) => ({kind: 'product', args});
  const power = (base, exponent) => exponent === 1 ? base : ({kind: 'power', base, exponent});
  const sum = (...args) => ({kind: 'sum', args});
  const quotient = (top, bottom) => ({kind: 'quotient', top, bottom});

  /** Normalize generated monomials; unlike sums deliberately fail. No learner parser is involved. */
  function normalize(node) {
    if (node.kind === 'number') return {coefficient: rational(node.n, node.d), powers: {}};
    if (node.kind === 'symbol') return {coefficient: rational(1), powers: {[node.name]: 1}};
    if (node.kind === 'power') {
      const base = normalize(node.base), n = node.exponent;
      return {coefficient: rational(base.coefficient.n ** n, base.coefficient.d ** n),
        powers: Object.fromEntries(Object.entries(base.powers).map(([key, value]) => [key, value * n]))};
    }
    if (node.kind === 'product' || node.kind === 'quotient') {
      const factors = node.kind === 'product' ? node.args : [node.top, node.bottom];
      const result = {coefficient: rational(1), powers: {}};
      factors.forEach((part, index) => {
        const item = normalize(part), sign = node.kind === 'quotient' && index === 1 ? -1 : 1;
        result.coefficient = multiply(result.coefficient, sign === 1 ? item.coefficient : rational(item.coefficient.d, item.coefficient.n));
        for (const [key, value] of Object.entries(item.powers)) result.powers[key] = (result.powers[key] || 0) + sign * value;
      });
      result.powers = Object.fromEntries(Object.entries(result.powers).filter(([, value]) => value !== 0));
      return result;
    }
    if (node.kind === 'sum') {
      const terms = node.args.map(normalize), first = terms[0];
      const key = powers => JSON.stringify(Object.entries(powers).sort());
      if (!terms.every(term => key(term.powers) === key(first.powers))) throw new Error('Unlike terms');
      return {coefficient: terms.reduce((total, term) => add(total, term.coefficient), rational(0)), powers: {...first.powers}};
    }
    throw new Error('Unknown expression');
  }

  /** Build an expression from one exact coefficient and signed symbol exponents. */
  function monomial(value, variableLast = null) {
    const top = [], bottom = [];
    if (value.coefficient.n !== 1 || !Object.keys(value.powers).length) top.push(number(value.coefficient.n));
    if (value.coefficient.d !== 1) bottom.push(number(value.coefficient.d));
    const entries = Object.entries(value.powers).sort(([left], [right]) =>
      left === variableLast ? 1 : right === variableLast ? -1 : left.localeCompare(right));
    for (const [name, exponent] of entries) {
      (exponent > 0 ? top : bottom).push(power(symbol(name), Math.abs(exponent)));
    }
    const compact = parts => parts.length === 0 ? number(1) : parts.length === 1 ? parts[0] : product(...parts);
    return bottom.length ? quotient(compact(top), compact(bottom)) : compact(top);
  }

  /** Expose power rules without prematurely collecting all factors. */
  function expandPowers(node) {
    if (node.kind === 'power') {
      const base = expandPowers(node.base), n = node.exponent;
      if (base.kind === 'number') return number(base.n ** n, base.d ** n);
      if (base.kind === 'product') return product(...base.args.map(part => expandPowers(power(part, n))));
      if (base.kind === 'power') return power(base.base, base.exponent * n);
      if (base.kind === 'quotient') return quotient(expandPowers(power(base.top, n)), expandPowers(power(base.bottom, n)));
      return power(base, n);
    }
    if (node.kind === 'product' || node.kind === 'sum') return {...node, args: node.args.map(expandPowers)};
    if (node.kind === 'quotient') return quotient(expandPowers(node.top), expandPowers(node.bottom));
    return node;
  }

  /** Emit TeX solely from the closed, generated expression tree. */
  function latex(node) {
    if (node.kind === 'number') return node.d === 1 ? String(node.n) : `${node.n < 0 ? '-' : ''}\\frac{${Math.abs(node.n)}}{${node.d}}`;
    if (node.kind === 'symbol') return node.name;
    if (node.kind === 'power') {
      const base = latex(node.base), simple = node.base.kind === 'symbol' || node.base.kind === 'number' && node.base.d === 1 && node.base.n >= 0;
      return `${simple ? base : `\\left(${base}\\right)`}^{${node.exponent}}`;
    }
    if (node.kind === 'quotient') return `\\frac{${latex(node.top)}}{${latex(node.bottom)}}`;
    if (node.kind === 'product') {
      const flatten = part => part.kind === 'product' ? part.args.flatMap(flatten) : [part];
      const factors = node.args.flatMap(flatten);
      const baseName = part => part?.kind === 'symbol' ? part.name :
        part?.kind === 'power' && part.base.kind === 'symbol' ? part.base.name : null;
      return factors.map((part, index) => {
        if (index === 0 && part.kind === 'number' && part.n === -1 && part.d === 1 && factors.length > 1 && factors[1].kind !== 'number') return '-';
        const text = latex(part), bracket = part.kind === 'sum' || index > 0 && part.kind === 'number' && part.n < 0;
        const repeatedBase = baseName(part) && baseName(part) === baseName(factors[index - 1]);
        const separator = part.kind === 'number' || part.kind === 'quotient' || repeatedBase ? '\\cdot ' : ' ';
        return (index ? separator : '') + (bracket ? `\\left(${text}\\right)` : text);
      }).join('');
    }
    if (node.kind === 'sum') return node.args.map((part, index) => {
      const text = latex(part);
      return index === 0 ? text : text.startsWith('-') ? ` - ${text.slice(1).trim()}` : ` + ${text}`;
    }).join('');
    throw new Error('Unknown expression');
  }

  /** Deterministic task reconstruction from the saved seed, with no finite question pool. */
  function randomFromSeed(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6D2B79F5) >>> 0;
      let t = Math.imul(value ^ value >>> 15, value | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** Generate one task with a nonzero monomial prefactor for all allowed parameters. */
  function generateTask(mode, level, random) {
    const pick = values => values[Math.floor(random() * values.length)];
    const variable = pick(['x', 't', 's', 'u']), v = symbol(variable);
    const parameterNames = ['a', 'b', 'c', 'k', 'x'].filter(name => name !== variable);
    const p = symbol(pick(parameterNames)), q = symbol(pick(parameterNames.filter(name => name !== p.name)));
    const r = pick([1, 2, 3]), n = pick([2, 3, 4]), k = pick([2, 3, 4, 5]);
    const c = number(pick([-3, -2, -1, 1, 2, 3]), level > 1 ? pick([2, 3, 4]) : 1);
    const vp = exponent => power(v, exponent);
    const families = mode === 'numbers'
      ? level === 1 ? ['simple_power', 'product', 'like_terms'] : level === 2 ? ['nested_power', 'power_product', 'like_terms'] : ['power_product', 'difference', 'fraction_product']
      : level === 1 ? ['parameter_power', 'parameter_product'] : level === 2 ? ['parameter_nested', 'parameter_difference', 'parameter_fraction'] : ['parameter_difference', 'parameter_fraction', 'quotient'];
    const family = pick(families);
    let expression;
    switch (family) {
      case 'simple_power': expression = power(product(number(k), v), n); break;
      case 'product': expression = product(c, vp(r), vp(n)); break;
      case 'like_terms': expression = sum(product(number(k), vp(n)), product(number(-pick([1, k + 1])), vp(n))); break;
      case 'nested_power': expression = power(product(c, vp(r)), n); break;
      case 'power_product': expression = product(number(k), vp(r), power(product(c, v), n)); break;
      case 'difference': expression = sum(power(product(number(1, pick([2, 3, 4])), vp(2)), 3), product(number(-1), power(product(number(k), vp(3)), 2))); break;
      case 'fraction_product': expression = product(number(1, pick([2, 4])), power(product(number(k), v), n), number(2, 5), vp(r)); break;
      case 'parameter_power': expression = power(product(p, v), n); break;
      case 'parameter_product': expression = product(number(k), p, vp(r), c, v); break;
      case 'parameter_nested': expression = power(product(c, p, vp(r)), n); break;
      case 'parameter_difference': expression = sum(power(product(number(k), p, vp(r)), 2), product(number(-pick([1, 2, 3])), power(p, 2), vp(2 * r))); break;
      case 'parameter_fraction': expression = product(number(1, pick([2, 4])), power(product(number(k), p, v), n), number(2, 5), q, vp(r)); break;
      case 'quotient': expression = quotient(product(number(k * pick([2, 3, 5])), vp(n + r)), product(number(k), p, vp(r), q)); break;
      default: throw new Error('Unknown family');
    }
    const value = normalize(expression), degree = value.powers[variable];
    const coefficient = {coefficient: value.coefficient, powers: {...value.powers}};
    delete coefficient.powers[variable];
    if (!value.coefficient.n || !Number.isInteger(degree) || degree < 1) throw new Error('Generator violated power-function contract');
    const parameters = mode === 'parameters' ? [...new Set(collectSymbols(expression).filter(name => name !== variable))].sort() : [];
    const stages = [{rule: 'given', expression}];
    const append = (rule, next) => {
      if (latex(stages[stages.length - 1].expression) !== latex(next)) stages.push({rule, expression: next});
    };
    const expanded = expandPowers(expression);
    append('powers', expanded);
    if (expression.kind === 'sum') {
      append('collect', sum(...expression.args.map(term => monomial(normalize(term), variable))));
      const terms = expression.args.map(term => normalize(term).coefficient);
      append('factor', product(sum(...terms.map(term => number(term.n, term.d))), monomial({coefficient: rational(1), powers: value.powers}, variable)));
    }
    // Put the independent variable last, even when a parameter's name sorts later.
    const prefactor = monomial(coefficient);
    const standard = coefficient.coefficient.n === 1 && coefficient.coefficient.d === 1 && !Object.keys(coefficient.powers).length
      ? vp(degree) : product(prefactor, vp(degree));
    append(family === 'quotient' ? 'cancel' : expression.kind === 'sum' ? 'combine' : 'collect', standard);
    return {mode, level, family, variable, parameters, functionName: pick(['f', 'g', 'h']),
      expression, stages, coefficient: prefactor, degree, excludedZero: family === 'quotient', standard};
  }

  /** Collect the explicitly used symbols, including symbols that might cancel. */
  function collectSymbols(node) {
    if (node.kind === 'symbol') return [node.name];
    if (node.kind === 'power') return collectSymbols(node.base);
    if (node.args) return node.args.flatMap(collectSymbols);
    if (node.kind === 'quotient') return [...collectSymbols(node.top), ...collectSymbols(node.bottom)];
    return [];
  }

  /** Validate the complete schema before reconstructing a saved worksheet. */
  function validateState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state) || state.schema !== STATE_VERSION ||
        !LANGUAGES.includes(state.language) || !(state.mode === null || MODES.includes(state.mode)) ||
        !LEVELS.includes(state.level) || !COUNTS.includes(state.count) ||
        !Number.isInteger(state.seed) || state.seed < 0 || state.seed > 4294967295 ||
        !Array.isArray(state.revealed) || state.revealed.length > state.count ||
        new Set(state.revealed).size !== state.revealed.length ||
        !state.revealed.every(i => Number.isInteger(i) && i >= 0 && i < state.count) ||
        state.mode === null && state.revealed.length) throw new Error('Invalid saved worksheet');
    if (Object.keys(state).sort().join(',') !== 'count,language,level,mode,revealed,schema,seed') throw new Error('Unknown saved-state fields');
    return JSON.parse(JSON.stringify(state));
  }

  /** Generate every task at runtime; progressive sheets advance from level one to three. */
  function generateSheet(state) {
    validateState(state);
    if (state.mode === null) return [];
    const random = randomFromSeed(state.seed);
    return Array.from({length: state.count}, (_, index) => generateTask(state.mode,
      state.level === 'progressive' ? Math.min(3, 1 + Math.floor(3 * index / state.count)) : LEVELS.indexOf(state.level), random));
  }

  const api = Object.freeze({VERSION, STATE_VERSION, MODES, LEVELS, COUNTS, LANGUAGES,
    generateSheet, generateTask, validateState, normalize, latex, randomFromSeed});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PowerFunctionsCore = api;
})(globalThis);
