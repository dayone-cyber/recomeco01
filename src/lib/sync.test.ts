import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPECS } from './sync';
import { resetAll, getState } from './store';
import { saveOnboarding, createAccount } from './actions';
import { seedDemo } from './demo';

/** Garante que toda coluna enviada ao Supabase existe no schema.sql (evita erro de PostgREST em produção). */
function schemaColumns(): Record<string, Set<string>> {
  const sql = readFileSync('supabase/schema.sql', 'utf8');
  const out: Record<string, Set<string>> = {};
  for (const m of sql.matchAll(/create table (?:if not exists )?(\w+) \(([\s\S]*?)\n\);/g)) {
    const cols = new Set<string>();
    for (const part of m[2].replace(/--.*$/gm, '').split(/,(?![^(]*\))/)) {
      const w = part.trim().split(/\s+/)[0];
      if (w && !['primary', 'unique', 'constraint'].includes(w.toLowerCase())) cols.add(w);
    }
    out[m[1]] = cols;
  }
  return out;
}

describe('sync ↔ schema.sql', () => {
  it('colunas enviadas existem no schema e as tabelas batem', () => {
    resetAll();
    saveOnboarding({ primary_goal: 'control', main_behaviors: ['check'] });
    createAccount('Ana', 'a@b.co');
    seedDemo();
    const cols = schemaColumns();
    for (const spec of SPECS) {
      expect(cols[spec.table], `tabela ${spec.table}`).toBeDefined();
      const rows = spec.rows(getState());
      expect(rows.length, spec.table).toBeGreaterThan(0 - 1);
      for (const k of Object.keys(rows[0] ?? {})) expect(cols[spec.table].has(k), `${spec.table}.${k}`).toBe(true);
      for (const k of spec.conflict.split(',')) expect(cols[spec.table].has(k), `${spec.table} conflict ${k}`).toBe(true);
    }
  });
});
