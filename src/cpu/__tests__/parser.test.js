import { describe, expect, it } from 'vitest';
import { parseAddress, parseProgram, parseRegister, stripComment } from '../parser.js';

describe('stripComment', () => {
  it('removes `;` and `#` comments and trims', () => {
    expect(stripComment('LOAD R1, [100]   ; load')).toBe('LOAD R1, [100]');
    expect(stripComment('  ADD R1,R2,R3 # add')).toBe('ADD R1,R2,R3');
    expect(stripComment('   ; only a comment')).toBe('');
  });
});

describe('parseRegister', () => {
  it('returns the index for valid register tokens', () => {
    expect(parseRegister('R0')).toBe(0);
    expect(parseRegister('r7')).toBe(7);
  });

  it('returns null for invalid tokens', () => {
    expect(parseRegister('R8')).toBeNull();
    expect(parseRegister('Q1')).toBeNull();
    expect(parseRegister(undefined)).toBeNull();
  });
});

describe('parseAddress', () => {
  it('accepts both bracketed and bare numbers', () => {
    expect(parseAddress('[100]')).toBe(100);
    expect(parseAddress('100')).toBe(100);
  });

  it('returns null for non-numeric tokens', () => {
    expect(parseAddress('foo')).toBeNull();
  });
});

describe('parseProgram', () => {
  it('parses memory initializers and instructions', () => {
    const { instructions, memory, errors } = parseProgram(`
      MEM[100] = 5
      MEM[101] = 3
      LOAD R1, [100]
      LOAD R2, [101]
      ADD R3, R1, R2
      HALT
    `);

    expect(errors).toEqual([]);
    expect(memory[100]).toBe(5);
    expect(memory[101]).toBe(3);
    expect(instructions.map((i) => i.op)).toEqual(['LOAD', 'LOAD', 'ADD', 'HALT']);
  });

  it('records label positions in instruction-index space', () => {
    const { labels } = parseProgram(`
      SET R1, 1
      loop:
      SUB R1, R1, R1
      JNZ loop
      HALT
    `);

    expect(labels.loop).toBe(1);
  });

  it('reports unknown instructions', () => {
    const { errors } = parseProgram('FOO R1, R2');
    expect(errors[0]).toMatch(/unknown instruction "FOO"/);
  });

  it('reports arity mismatches', () => {
    const { errors } = parseProgram('ADD R1, R2');
    expect(errors[0]).toMatch(/ADD expects 3 arguments/);
  });

  it('reports missing labels for jumps', () => {
    const { errors } = parseProgram('JMP nowhere');
    expect(errors[0]).toMatch(/label "nowhere" was not found/);
  });

  it('accepts a label on the same line as an instruction', () => {
    const { instructions, labels, errors } = parseProgram(`
      start: SET R1, 1
      HALT
    `);

    expect(errors).toEqual([]);
    expect(labels.start).toBe(0);
    expect(instructions[0].op).toBe('SET');
  });
});
