/**
 * Detecção de sinais graves. Determinística e conservadora (melhor um falso positivo
 * que ignorar um risco real). Qualquer texto livre passa por aqui antes de ser salvo.
 */
const PATTERNS: RegExp[] = [
  /suic[ií]d/i,
  /me\s+matar/i,
  /quero\s+morrer/i,
  /(n[aã]o\s+quero|cansad[oa]\s+de)\s+viver/i,
  /acabar\s+com\s+(tudo|a\s+minha\s+vida|minha\s+vida)/i,
  /tirar\s+(a\s+)?minha\s+vida/i,
  /me\s+(machucar|cortar|ferir)/i,
  /autoles[aã]o/i,
  /(vai|vou|ele|ela)\s+(me\s+)?(matar|bater|agredir)/i,
  /(me\s+)?(amea[cç]|agrid|espanc|estupr|persegu)/i,
  /tenho\s+medo\s+(dele|dela|de\s+morrer)/i,
  /violên?c?i?a/i,
  /abuso/i,
];

export function detectRisk(text: string | null | undefined): boolean {
  if (!text) return false;
  return PATTERNS.some((r) => r.test(text));
}
