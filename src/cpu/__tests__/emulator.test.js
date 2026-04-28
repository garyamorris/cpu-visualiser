import { describe, expect, it } from 'vitest';
import { advanceCpuPhase, createCpu, executeInstruction, runProgramToCompletion } from '../emulator.js';
import { parseProgram } from '../parser.js';

function runLines(source) {
  const program = parseProgram(source);
  expect(program.errors).toEqual([]);
  return { program, cpu: runProgramToCompletion(program) };
}

describe('emulator', () => {
  it('LOAD then STORE round-trips a memory value', () => {
    const { cpu } = runLines(`
      MEM[100] = 5
      MEM[101] = 0
      LOAD R1, [100]
      STORE R1, [101]
      HALT
    `);

    expect(cpu.halted).toBe(true);
    expect(cpu.registers[1]).toBe(5);
    expect(cpu.memory[101]).toBe(5);
  });

  it('preserves negative values through LOAD (regression for `|| 0` bug)', () => {
    const { cpu } = runLines(`
      MEM[100] = -7
      LOAD R1, [100]
      HALT
    `);

    expect(cpu.registers[1]).toBe(-7);
  });

  it('ADD/SUB/MUL/DIV produce the expected results', () => {
    const { cpu } = runLines(`
      MEM[100] = 12
      MEM[101] = 4
      LOAD R1, [100]
      LOAD R2, [101]
      ADD R3, R1, R2
      SUB R4, R1, R2
      MUL R5, R1, R2
      DIV R6, R1, R2
      HALT
    `);

    expect(cpu.registers[3]).toBe(16);
    expect(cpu.registers[4]).toBe(8);
    expect(cpu.registers[5]).toBe(48);
    expect(cpu.registers[6]).toBe(3);
  });

  it('DIV by zero yields 0 instead of throwing', () => {
    const { cpu } = runLines(`
      SET R1, 10
      SET R2, 0
      DIV R3, R1, R2
      HALT
    `);

    expect(cpu.registers[3]).toBe(0);
  });

  it('CMP sets the zero flag when registers are equal', () => {
    const { cpu } = runLines(`
      SET R1, 4
      SET R2, 4
      CMP R1, R2
      HALT
    `);

    expect(cpu.flags.zero).toBe(true);
  });

  it('JZ jumps when the zero flag is set', () => {
    const { cpu } = runLines(`
      MEM[100] = 0
      SET R1, 1
      SET R2, 1
      CMP R1, R2
      JZ done
      SET R3, 99
      STORE R3, [100]
      done:
      HALT
    `);

    expect(cpu.memory[100]).toBe(0);
  });

  it('JNZ countdown loop terminates and stores 0', () => {
    const { cpu } = runLines(`
      MEM[100] = 0
      SET R1, 3
      SET R2, 1
      loop:
      SUB R1, R1, R2
      CMP R1, R0
      JNZ loop
      STORE R1, [100]
      HALT
    `);

    expect(cpu.registers[1]).toBe(0);
    expect(cpu.memory[100]).toBe(0);
  });

  it('HALT freezes the program counter', () => {
    const program = parseProgram('HALT');
    const cpu = runProgramToCompletion(program);
    expect(cpu.halted).toBe(true);
    expect(cpu.pc).toBe(0);
  });

  it('advanceCpuPhase cycles through fetch, decode, execute, write back', () => {
    const program = parseProgram('SET R1, 7\nHALT');
    let cpu = createCpu(program);

    expect(cpu.phaseIndex).toBe(0);
    cpu = advanceCpuPhase(cpu, program);
    expect(cpu.phaseIndex).toBe(1);
    expect(cpu.ir.op).toBe('SET');
    cpu = advanceCpuPhase(cpu, program);
    expect(cpu.phaseIndex).toBe(2);
    cpu = advanceCpuPhase(cpu, program);
    expect(cpu.phaseIndex).toBe(3);
    expect(cpu.registers[1]).toBe(7);
  });

  it('executeInstruction returns halted when no instruction is available', () => {
    const program = parseProgram('');
    const cpu = createCpu(program);
    const next = executeInstruction(cpu, program);
    expect(next.halted).toBe(true);
  });
});
