import { describe, expect, it } from 'vitest';
import { runProgramToCompletion } from '../emulator.js';
import { parseProgram } from '../parser.js';
import { SAMPLE_PROGRAMS, fallbackProgram } from '../samples.js';

describe('sample programs', () => {
  it.each(Object.entries(SAMPLE_PROGRAMS))('parses without errors: %s', (_key, sample) => {
    const program = parseProgram(sample.code);
    expect(program.errors).toEqual([]);
  });

  it.each(Object.entries(SAMPLE_PROGRAMS))('runs to halt within budget: %s', (_key, sample) => {
    const program = parseProgram(sample.code);
    const cpu = runProgramToCompletion(program, { maxCycles: 2000 });
    expect(cpu.halted).toBe(true);
  });
});

describe('fallbackProgram', () => {
  it('routes loop-related prompts to the countdown sample', () => {
    expect(fallbackProgram('write a counting loop')).toBe(SAMPLE_PROGRAMS.countdown);
  });

  it('falls back to the add sample for unrelated prompts', () => {
    expect(fallbackProgram('hello world')).toBe(SAMPLE_PROGRAMS.add);
  });
});
