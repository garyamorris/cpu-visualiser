import { INSTRUCTION_ARITY, MEMORY_ADDRESSES, REGISTER_REGEX } from './constants.js';

export function initialMemory() {
  return MEMORY_ADDRESSES.reduce((memory, address) => {
    memory[address] = 0;
    return memory;
  }, {});
}

export function stripComment(line) {
  return line.split(';')[0].split('#')[0].trim();
}

export function parseRegister(token) {
  const match = String(token || '').trim().match(REGISTER_REGEX);
  return match ? Number(match[1]) : null;
}

export function parseAddress(token) {
  const match = String(token || '').trim().match(/^\[?(\d+)\]?$/);
  return match ? Number(match[1]) : null;
}

function splitInstruction(line) {
  return line
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function parseProgram(source) {
  const memory = initialMemory();
  const labels = {};
  const instructions = [];
  const errors = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    let line = stripComment(rawLine);

    if (!line) return;

    const memMatch = line.match(/^(?:MEM|MEMORY)\s*\[\s*(\d+)\s*\]\s*=\s*(-?\d+)$/i);
    if (memMatch) {
      memory[Number(memMatch[1])] = Number(memMatch[2]);
      return;
    }

    const dataMatch = line.match(/^\.DATA\s+(\d+)\s+(-?\d+)$/i);
    if (dataMatch) {
      memory[Number(dataMatch[1])] = Number(dataMatch[2]);
      return;
    }

    const labelMatch = line.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if (labelMatch) {
      labels[labelMatch[1].toLowerCase()] = instructions.length;
      line = labelMatch[2].trim();
      if (!line) return;
    }

    const parts = splitInstruction(line);
    const op = parts[0]?.toUpperCase();

    if (!op) return;

    instructions.push({
      op,
      args: parts.slice(1),
      raw: rawLine.trim(),
      clean: line,
      lineNumber: index + 1
    });
  });

  instructions.forEach((instruction) => {
    const { op, args, lineNumber } = instruction;
    const arity = INSTRUCTION_ARITY[op];

    if (arity === undefined) {
      errors.push(`Line ${lineNumber}: unknown instruction "${op}".`);
      return;
    }

    if (args.length !== arity) {
      errors.push(`Line ${lineNumber}: ${op} expects ${arity} argument${arity === 1 ? '' : 's'}.`);
    }

    if (['JMP', 'JZ', 'JNZ'].includes(op) && args[0] && labels[args[0].toLowerCase()] === undefined) {
      errors.push(`Line ${lineNumber}: label "${args[0]}" was not found.`);
    }
  });

  return { instructions, labels, memory, errors };
}
