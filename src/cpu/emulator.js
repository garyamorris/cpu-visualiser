import { PHASES, REGISTER_COUNT } from './constants.js';
import { formatValue } from './format.js';
import { parseAddress, parseRegister } from './parser.js';

function initialRegisters() {
  return Array.from({ length: REGISTER_COUNT }, () => 0);
}

export function createCpu(program) {
  return {
    pc: 0,
    ir: null,
    registers: initialRegisters(),
    memory: { ...program.memory },
    flags: { zero: false, negative: false },
    halted: false,
    phaseIndex: 0,
    cycles: 0,
    instructionsExecuted: 0,
    lastChange: null,
    timeline: []
  };
}

function readRegister(registers, token) {
  const index = parseRegister(token);
  return index === null ? 0 : registers[index];
}

function describeExecution(instruction, before, after, detail) {
  const op = instruction?.op || 'HALT';

  if (op === 'LOAD') return `${instruction.args[0]} received ${formatValue(detail.value)} from memory address ${detail.address}.`;
  if (op === 'STORE') return `Memory address ${detail.address} received ${formatValue(detail.value)} from ${instruction.args[0]}.`;
  if (['ADD', 'SUB', 'MUL', 'DIV'].includes(op)) return `${instruction.args[0]} changed from ${formatValue(before)} to ${formatValue(after)}.`;
  if (op === 'SET') return `${instruction.args[0]} was set to ${formatValue(after)}.`;
  if (op === 'CMP') return `Zero flag is ${detail.zero ? 'true' : 'false'} after comparing ${instruction.args[0]} and ${instruction.args[1]}.`;
  if (['JMP', 'JZ', 'JNZ'].includes(op)) return detail.jumped ? `Program Counter jumped to ${instruction.args[0]}.` : 'Jump was skipped, so the next instruction will run.';
  return 'The program stopped.';
}

export function executeInstruction(cpu, program) {
  const instruction = cpu.ir || program.instructions[cpu.pc];

  if (!instruction) {
    return { ...cpu, halted: true };
  }

  const next = {
    ...cpu,
    registers: [...cpu.registers],
    memory: { ...cpu.memory },
    flags: { ...cpu.flags }
  };
  let nextPc = cpu.pc + 1;
  let resultText = '';
  let detail = {};
  let lastChange = null;

  const writeRegister = (token, value) => {
    const index = parseRegister(token);
    if (index !== null) {
      const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
      next.registers[index] = safe;
      return index;
    }
    return null;
  };

  switch (instruction.op) {
    case 'SET': {
      const before = readRegister(cpu.registers, instruction.args[0]);
      const value = Number(instruction.args[1]);
      const register = writeRegister(instruction.args[0], value);
      resultText = describeExecution(instruction, before, value, {});
      lastChange = {
        title: register === null ? 'Register write skipped' : `R${register} updated`,
        description: register === null ? resultText : `SET copied ${formatValue(value)} into R${register}.`,
        registers: register === null ? [] : [register],
        memory: []
      };
      break;
    }
    case 'LOAD': {
      const address = parseAddress(instruction.args[1]);
      const value = next.memory[address] ?? 0;
      const register = writeRegister(instruction.args[0], value);
      detail = { address, value };
      resultText = describeExecution(instruction, 0, value, detail);
      lastChange = {
        title: register === null ? 'Memory loaded' : `Memory ${address} loaded into R${register}`,
        description: register === null ? resultText : `${formatValue(value)} moved from RAM address ${address} into register R${register}.`,
        registers: register === null ? [] : [register],
        memory: Number.isFinite(address) ? [address] : []
      };
      break;
    }
    case 'STORE': {
      const address = parseAddress(instruction.args[1]);
      const register = parseRegister(instruction.args[0]);
      const value = readRegister(next.registers, instruction.args[0]);
      next.memory[address] = value;
      detail = { address, value };
      resultText = describeExecution(instruction, 0, value, detail);
      lastChange = {
        title: register === null ? `Memory ${address} updated` : `R${register} stored in memory ${address}`,
        description: `${formatValue(value)} moved from ${instruction.args[0]} into RAM address ${address}.`,
        registers: register === null ? [] : [register],
        memory: Number.isFinite(address) ? [address] : []
      };
      break;
    }
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV': {
      const before = readRegister(cpu.registers, instruction.args[0]);
      const left = readRegister(next.registers, instruction.args[1]);
      const right = readRegister(next.registers, instruction.args[2]);
      let value = 0;

      if (instruction.op === 'ADD') value = left + right;
      if (instruction.op === 'SUB') value = left - right;
      if (instruction.op === 'MUL') value = left * right;
      if (instruction.op === 'DIV') value = right === 0 ? 0 : Math.trunc(left / right);

      const register = writeRegister(instruction.args[0], value);
      next.flags.zero = value === 0;
      next.flags.negative = value < 0;
      resultText = describeExecution(instruction, before, value, {});
      lastChange = {
        title: register === null ? 'ALU result calculated' : `ALU wrote result into R${register}`,
        description: `${instruction.op} calculated ${formatValue(value)} and saved it in ${instruction.args[0]}.`,
        registers: register === null ? [] : [register],
        memory: []
      };
      break;
    }
    case 'CMP': {
      const left = readRegister(next.registers, instruction.args[0]);
      const right = readRegister(next.registers, instruction.args[1]);
      next.flags.zero = left === right;
      next.flags.negative = left < right;
      detail = { zero: next.flags.zero };
      resultText = describeExecution(instruction, 0, 0, detail);
      lastChange = {
        title: 'Flags updated',
        description: resultText,
        registers: [parseRegister(instruction.args[0]), parseRegister(instruction.args[1])].filter((value) => value !== null),
        memory: []
      };
      break;
    }
    case 'JMP': {
      nextPc = program.labels[instruction.args[0].toLowerCase()];
      detail = { jumped: true };
      resultText = describeExecution(instruction, 0, 0, detail);
      lastChange = {
        title: 'Program Counter jumped',
        description: resultText,
        registers: [],
        memory: []
      };
      break;
    }
    case 'JZ': {
      const jumped = next.flags.zero;
      if (jumped) nextPc = program.labels[instruction.args[0].toLowerCase()];
      detail = { jumped };
      resultText = describeExecution(instruction, 0, 0, detail);
      lastChange = {
        title: jumped ? 'Program Counter jumped' : 'Jump skipped',
        description: resultText,
        registers: [],
        memory: []
      };
      break;
    }
    case 'JNZ': {
      const jumped = !next.flags.zero;
      if (jumped) nextPc = program.labels[instruction.args[0].toLowerCase()];
      detail = { jumped };
      resultText = describeExecution(instruction, 0, 0, detail);
      lastChange = {
        title: jumped ? 'Program Counter jumped' : 'Jump skipped',
        description: resultText,
        registers: [],
        memory: []
      };
      break;
    }
    case 'HALT':
      next.halted = true;
      resultText = describeExecution(instruction, 0, 0, {});
      lastChange = {
        title: 'Program halted',
        description: resultText,
        registers: [],
        memory: []
      };
      break;
    default:
      next.halted = true;
      resultText = `Cannot run ${instruction.op}.`;
      lastChange = {
        title: 'Unknown instruction',
        description: resultText,
        registers: [],
        memory: []
      };
  }

  return {
    ...next,
    pc: next.halted ? cpu.pc : nextPc,
    ir: instruction,
    instructionsExecuted: cpu.instructionsExecuted + 1,
    lastChange,
    timeline: [
      {
        id: `${cpu.cycles}-${instruction.lineNumber}`,
        lineNumber: instruction.lineNumber,
        instruction: instruction.clean,
        result: resultText
      },
      ...cpu.timeline
    ].slice(0, 6)
  };
}

export function advanceCpuPhase(current, program) {
  if (current.halted) return current;

  const instruction = program.instructions[current.pc];
  if (!instruction && current.phaseIndex === 0) return { ...current, halted: true };

  if (current.phaseIndex === 0) {
    return {
      ...current,
      ir: instruction,
      phaseIndex: 1,
      cycles: current.cycles + 1
    };
  }

  if (current.phaseIndex === 1) {
    return {
      ...current,
      phaseIndex: 2,
      cycles: current.cycles + 1
    };
  }

  if (current.phaseIndex === 2) {
    const executed = executeInstruction(current, program);
    return {
      ...executed,
      phaseIndex: 3,
      cycles: current.cycles + 1
    };
  }

  return {
    ...current,
    ir: current.halted ? current.ir : null,
    phaseIndex: 0,
    cycles: current.cycles + 1
  };
}

export function runProgramToCompletion(program, { maxCycles = 1000 } = {}) {
  let cpu = createCpu(program);
  let safety = 0;
  while (!cpu.halted && safety < maxCycles) {
    cpu = advanceCpuPhase(cpu, program);
    safety += 1;
  }
  return cpu;
}

export { PHASES };
