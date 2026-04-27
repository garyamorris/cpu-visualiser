import { useEffect, useMemo, useState } from 'react';

const REGISTER_COUNT = 8;
const MEMORY_ADDRESSES = [100, 101, 102, 103, 104, 105, 106, 107];
const PHASES = ['fetch', 'decode', 'execute', 'writeBack'];

const PHASE_DETAILS = {
  fetch: {
    title: 'Fetch',
    subtitle: 'Instruction Fetch',
    summary: 'The Program Counter points to the next instruction. The CPU copies that instruction into the Instruction Register.',
    simple: 'Like checking your to-do list and reading the next task.',
    badge: 'PC -> IR'
  },
  decode: {
    title: 'Decode',
    subtitle: 'Instruction Decode',
    summary: 'The Control Unit reads the instruction and works out which operation, registers and memory addresses are needed.',
    simple: 'Like understanding what the task is asking you to do.',
    badge: 'Control Unit'
  },
  execute: {
    title: 'Execute',
    subtitle: 'ALU Work',
    summary: 'The ALU or memory system performs the instruction, such as adding values or loading from RAM.',
    simple: 'Like doing the actual work.',
    badge: 'ALU / Memory'
  },
  writeBack: {
    title: 'Write Back',
    subtitle: 'Save Result',
    summary: 'The CPU stores the result in a register or memory, then moves to the next instruction.',
    simple: 'Like writing down the answer before moving on.',
    badge: 'Result Saved'
  }
};

const SAMPLE_PROGRAMS = {
  load: {
    title: 'Load A Number',
    description: 'Shows a single value moving from RAM through cache into a register.',
    difficulty: 'Starter',
    prompt: 'Generate a simple program that loads one number from memory into a register.',
    code: `; Load one value from memory into a register
MEM[100] = 42

LOAD R1, [100]    ; R1 <- memory[100]
HALT`
  },
  add: {
    title: 'Add Two Numbers',
    description: 'Loads two memory values, adds them, then stores the result.',
    difficulty: 'Starter',
    prompt: 'Generate a simple program that adds two numbers from memory and stores the answer.',
    code: `; Add two numbers and store the result in memory
MEM[100] = 5
MEM[101] = 3
MEM[102] = 0

LOAD R1, [100]    ; R1 <- first number
LOAD R2, [101]    ; R2 <- second number
ADD R3, R1, R2    ; R3 <- R1 + R2
STORE R3, [102]   ; memory[102] <- answer
HALT`
  },
  subtract: {
    title: 'Find Difference',
    description: 'Subtracts one number from another and writes the answer to RAM.',
    difficulty: 'Starter',
    prompt: 'Generate a program that subtracts one memory value from another.',
    code: `; Subtract one value from another
MEM[100] = 12
MEM[101] = 7
MEM[102] = 0

LOAD R1, [100]
LOAD R2, [101]
SUB R3, R1, R2
STORE R3, [102]
HALT`
  },
  multiply: {
    title: 'Multiply Values',
    description: 'Uses the ALU to multiply two values loaded from memory.',
    difficulty: 'Starter',
    prompt: 'Generate a program that multiplies two values and stores the result.',
    code: `; Multiply two values
MEM[100] = 4
MEM[101] = 6
MEM[102] = 0

LOAD R1, [100]
LOAD R2, [101]
MUL R3, R1, R2
STORE R3, [102]
HALT`
  },
  divide: {
    title: 'Divide Values',
    description: 'Divides one value by another and saves the quotient.',
    difficulty: 'Starter',
    prompt: 'Generate a program that divides two values and stores the quotient.',
    code: `; Divide one value by another
MEM[100] = 20
MEM[101] = 4
MEM[102] = 0

LOAD R1, [100]
LOAD R2, [101]
DIV R3, R1, R2
STORE R3, [102]
HALT`
  },
  sumThree: {
    title: 'Sum Three Numbers',
    description: 'Adds three values by reusing an intermediate register result.',
    difficulty: 'Builder',
    prompt: 'Generate a program that adds three memory values and stores the total.',
    code: `; Add three values and store the total
MEM[100] = 2
MEM[101] = 4
MEM[102] = 6
MEM[103] = 0

LOAD R1, [100]
LOAD R2, [101]
LOAD R3, [102]
ADD R4, R1, R2    ; R4 <- first + second
ADD R5, R4, R3    ; R5 <- running total + third
STORE R5, [103]
HALT`
  },
  storeConstant: {
    title: 'Store A Constant',
    description: 'Creates a value inside the CPU, then writes it into memory.',
    difficulty: 'Starter',
    prompt: 'Generate a program that stores a constant value in memory.',
    code: `; Store a constant value in memory
MEM[100] = 0

SET R1, 12        ; R1 <- 12
STORE R1, [100]   ; memory[100] <- R1
HALT`
  },
  branch: {
    title: 'Compare And Branch',
    description: 'Compares two values and jumps to a different line when they match.',
    difficulty: 'Branching',
    prompt: 'Generate a program that compares two values and stores 1 when they match.',
    code: `; Store 1 when the values are equal, otherwise store 0
MEM[100] = 9
MEM[101] = 9
MEM[102] = 0

LOAD R1, [100]
LOAD R2, [101]
CMP R1, R2
JZ equal
SET R3, 0
STORE R3, [102]
HALT
equal:
SET R3, 1
STORE R3, [102]
HALT`
  },
  countdown: {
    title: 'Count Down Loop',
    description: 'Repeats a few instructions until a counter reaches zero.',
    difficulty: 'Looping',
    prompt: 'Generate a program that counts down from 3 to 0 using a loop.',
    code: `; Count down from 3 to 0
MEM[100] = 0

SET R1, 3         ; counter starts at 3
SET R2, 1         ; amount to subtract each loop
loop:
SUB R1, R1, R2    ; counter <- counter - 1
CMP R1, R0        ; compare counter with zero
JNZ loop          ; repeat while counter is not zero
STORE R1, [100]   ; save final counter value
HALT`
  }
};

function initialRegisters() {
  return Array.from({ length: REGISTER_COUNT }, () => 0);
}

function initialMemory() {
  return MEMORY_ADDRESSES.reduce((memory, address) => {
    memory[address] = 0;
    return memory;
  }, {});
}

function formatValue(value) {
  const safe = Number.isFinite(value) ? value : 0;
  const unsigned = safe >>> 0;
  return `0x${unsigned.toString(16).padStart(8, '0')}`;
}

function stripComment(line) {
  return line.split(';')[0].split('#')[0].trim();
}

function parseRegister(token) {
  const match = String(token || '').trim().match(/^R([0-7])$/i);
  return match ? Number(match[1]) : null;
}

function parseAddress(token) {
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

function parseProgram(source) {
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
    const arity = {
      SET: 2,
      LOAD: 2,
      STORE: 2,
      ADD: 3,
      SUB: 3,
      MUL: 3,
      DIV: 3,
      CMP: 2,
      JMP: 1,
      JZ: 1,
      JNZ: 1,
      HALT: 0
    }[op];

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

function createCpu(program) {
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

function executeInstruction(cpu, program) {
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
      next.registers[index] = Math.trunc(value || 0);
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
      const value = next.memory[address] || 0;
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

function getFetchText(cpu, program) {
  const instruction = program.instructions[cpu.pc];
  if (cpu.halted) return 'CPU halted';
  if (!instruction) return 'No instruction';
  return instruction.clean;
}

function buildTraceLines(source, program) {
  const instructionByLine = new Map(
    program.instructions.map((instruction, instructionIndex) => [
      instruction.lineNumber,
      { ...instruction, instructionIndex }
    ])
  );

  return source.split(/\r?\n/).map((rawLine, index) => {
    const lineNumber = index + 1;
    const stripped = stripComment(rawLine);
    const instruction = instructionByLine.get(lineNumber);
    let kind = 'source';

    if (!rawLine.trim()) kind = 'blank';
    else if (/^\s*[;#]/.test(rawLine)) kind = 'comment';
    else if (instruction) kind = 'instruction';
    else if (/^(?:MEM|MEMORY)\s*\[/i.test(stripped) || /^\.DATA\s+/i.test(stripped)) kind = 'memory';
    else if (/^[A-Za-z_]\w*:\s*$/.test(stripped)) kind = 'label';

    return {
      number: lineNumber,
      text: rawLine,
      kind,
      instruction
    };
  });
}

function advanceCpuPhase(current, program) {
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

function fallbackProgram(prompt) {
  const normalised = prompt.toLowerCase();

  if (normalised.includes('loop') || normalised.includes('count')) return SAMPLE_PROGRAMS.countdown;
  if (normalised.includes('divide') || normalised.includes('quotient')) return SAMPLE_PROGRAMS.divide;
  if (normalised.includes('multiply') || normalised.includes('times')) return SAMPLE_PROGRAMS.multiply;
  if (normalised.includes('subtract') || normalised.includes('difference')) return SAMPLE_PROGRAMS.subtract;
  if (normalised.includes('compare') || normalised.includes('equal')) return SAMPLE_PROGRAMS.branch;
  if (normalised.includes('three') || normalised.includes('total')) return SAMPLE_PROGRAMS.sumThree;
  if (normalised.includes('constant')) return SAMPLE_PROGRAMS.storeConstant;
  if (normalised.includes('load') || normalised.includes('read')) return SAMPLE_PROGRAMS.load;
  return SAMPLE_PROGRAMS.add;
}

function InfoTip({ title, text, side = 'top' }) {
  return (
    <span className={`info-tip ${side}`} tabIndex="0" aria-label={`${title}: ${text}`}>
      <span className="info-dot">?</span>
      <span className="info-popover" role="tooltip">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
    </span>
  );
}

function App() {
  const [programText, setProgramText] = useState(SAMPLE_PROGRAMS.add.code);
  const [loadedSource, setLoadedSource] = useState(SAMPLE_PROGRAMS.add.code);
  const [loadedTitle, setLoadedTitle] = useState(SAMPLE_PROGRAMS.add.title);
  const [aiPrompt, setAiPrompt] = useState(SAMPLE_PROGRAMS.add.prompt);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me for a small CPU program, then load it into the visualizer.' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [speed, setSpeed] = useState(900);
  const [beginnerMode, setBeginnerMode] = useState(true);

  const editorProgram = useMemo(() => parseProgram(programText), [programText]);
  const [program, setProgram] = useState(() => parseProgram(SAMPLE_PROGRAMS.add.code));
  const [cpu, setCpu] = useState(() => createCpu(parseProgram(SAMPLE_PROGRAMS.add.code)));

  const activePhase = PHASES[cpu.phaseIndex];
  const currentInstruction = cpu.ir || program.instructions[cpu.pc];
  const activeLineNumber = currentInstruction?.lineNumber;
  const traceLines = useMemo(() => buildTraceLines(loadedSource, program), [loadedSource, program]);
  const executedLineCounts = useMemo(
    () => cpu.timeline.reduce((counts, item) => {
      if (item.lineNumber) counts[item.lineNumber] = (counts[item.lineNumber] || 0) + 1;
      return counts;
    }, {}),
    [cpu.timeline]
  );
  const hasUnloadedEdits = programText !== loadedSource;
  const changedRegisters = cpu.lastChange?.registers || [];
  const changedMemory = cpu.lastChange?.memory || [];
  const currentUsesCache = ['LOAD', 'STORE'].includes(currentInstruction?.op);
  const cachePathActive = (currentUsesCache && ['execute', 'writeBack'].includes(activePhase)) || changedMemory.length > 0;
  const cacheMode = currentUsesCache ? currentInstruction.op.toLowerCase() : 'idle';
  const cacheAddress = currentUsesCache ? parseAddress(currentInstruction.args[1]) : changedMemory[0];
  const cacheRegister = currentUsesCache ? currentInstruction.args[0] : changedRegisters.length ? `R${changedRegisters[0]}` : 'registers';
  const cachePathText = currentInstruction?.op === 'LOAD'
    ? `RAM ${cacheAddress} -> L1 Cache -> ${cacheRegister}`
    : currentInstruction?.op === 'STORE'
      ? `${cacheRegister} -> L1 Cache -> RAM ${cacheAddress}`
      : cpu.lastChange?.memory?.length
        ? cpu.lastChange.description
        : 'Waiting for a LOAD or STORE instruction.';
  const cacheRouteLabels = cacheMode === 'store' ? ['REG', 'L1', 'RAM'] : ['RAM', 'L1', 'REG'];

  function resetCpu(nextProgram = program) {
    setAutoRun(false);
    setCpu(createCpu(nextProgram));
  }

  function loadProgram(title = loadedTitle) {
    const nextProgram = editorProgram;
    if (nextProgram.errors.length) return;

    setLoadedTitle(title);
    setLoadedSource(programText);
    setProgram(nextProgram);
    resetCpu(nextProgram);
  }

  function loadSample(sampleKey) {
    const sample = SAMPLE_PROGRAMS[sampleKey];
    if (!sample) return;

    const nextProgram = parseProgram(sample.code);
    setProgramText(sample.code);
    setLoadedTitle(sample.title);
    setLoadedSource(sample.code);
    setProgram(nextProgram);
    setAiPrompt(sample.prompt);
    setMessages((items) => [
      ...items,
      { role: 'assistant', text: `Loaded sample: ${sample.title}. Step through it to see ${sample.description.toLowerCase()}` }
    ]);
    resetCpu(nextProgram);
  }

  function stepCpu() {
    if (program.errors.length || cpu.halted) return;

    setCpu((current) => advanceCpuPhase(current, program));
  }

  function stepLine() {
    if (program.errors.length || cpu.halted) return;

    setCpu((current) => {
      let next = current;

      for (let steps = 0; steps < PHASES.length; steps += 1) {
        next = advanceCpuPhase(next, program);
        if (next.phaseIndex === 0 || next.halted) break;
      }

      return next;
    });
  }

  async function generateProgram(event) {
    event?.preventDefault();
    const prompt = aiPrompt.trim();
    if (!prompt || isGenerating) return;

    setIsGenerating(true);
    setMessages((items) => [...items, { role: 'user', text: prompt }]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) throw new Error('OpenAI is not configured yet.');

      const data = await response.json();
      const nextProgram = parseProgram(data.code);
      if (nextProgram.errors.length) throw new Error('OpenAI returned code that needs editing before it can run.');

      setProgramText(data.code);
      setLoadedTitle(data.title);
      setLoadedSource(data.code);
      setProgram(nextProgram);
      setMessages((items) => [...items, { role: 'assistant', text: data.explanation || 'Generated a CPU program for you.' }]);
      resetCpu(nextProgram);
    } catch (error) {
      const fallback = fallbackProgram(prompt);
      const nextProgram = parseProgram(fallback.code);
      setProgramText(fallback.code);
      setLoadedTitle(fallback.title);
      setLoadedSource(fallback.code);
      setProgram(nextProgram);
      setMessages((items) => [
        ...items,
        {
          role: 'assistant',
          text: `${error.message} I loaded a local teaching example instead: ${fallback.title}.`
        }
      ]);
      resetCpu(nextProgram);
    } finally {
      setIsGenerating(false);
    }
  }

  function explainCurrentCode() {
    const op = currentInstruction?.op || 'the next instruction';
    const line = activeLineNumber ? `line ${activeLineNumber}` : 'the next executable line';
    setMessages((items) => [
      ...items,
      {
        role: 'assistant',
        text: `The CPU is tracing ${line}. The current instruction is ${op}. Use Step Phase to inspect the CPU cycle, or Next Line to run one source line.`
      }
    ]);
  }

  useEffect(() => {
    if (!autoRun || cpu.halted || program.errors.length) return undefined;
    const timer = window.setInterval(stepCpu, speed);
    return () => window.clearInterval(timer);
  }, [autoRun, cpu.halted, cpu.phaseIndex, cpu.pc, program.errors.length, speed]);

  useEffect(() => {
    if (cpu.halted) setAutoRun(false);
  }, [cpu.halted]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="chip-icon">CPU</div>
          <div>
            <strong>CPU Visualizer</strong>
            <span>Understand. Visualize. Master.</span>
          </div>
        </div>

        <div className="top-actions">
          <label className="mode-toggle">
            <input type="checkbox" checked={beginnerMode} onChange={(event) => setBeginnerMode(event.target.checked)} />
            Beginner Mode
          </label>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Animation speed">
            <option value="1200">0.75x</option>
            <option value="900">1.0x</option>
            <option value="550">1.5x</option>
          </select>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel assistant-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">AI Code Assistant</p>
              <h2>Generate CPU Code</h2>
            </div>
            <span className="status-dot">OpenAI optional</span>
          </div>

          <div className="message-list" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.text}
              </div>
            ))}
          </div>

          <form className="prompt-box" onSubmit={generateProgram}>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Ask for a program, for example: add two numbers and store the result"
              rows={4}
            />
            <button type="submit" disabled={isGenerating}>{isGenerating ? 'Generating...' : 'Generate'}</button>
          </form>

          <button className="secondary-button" type="button" onClick={explainCurrentCode}>Explain Current Step</button>

          <section className="sample-card">
            <div className="sample-card-heading">
              <span>Prebuilt Samples</span>
              <small>Click one to load it</small>
            </div>
            <div className="sample-grid">
              {Object.entries(SAMPLE_PROGRAMS).map(([key, sample]) => (
                <button
                  className={`sample-button ${loadedTitle === sample.title ? 'active' : ''}`}
                  key={key}
                  type="button"
                  onClick={() => loadSample(key)}
                >
                  <strong>{sample.title}</strong>
                  <span>{sample.description}</span>
                  <small>{sample.difficulty}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="code-card">
            <div className="code-card-heading">
              <span>
                Program Draft
                {hasUnloadedEdits && <small className="draft-status">Not loaded yet</small>}
              </span>
              <button type="button" onClick={() => loadProgram(loadedTitle)} disabled={editorProgram.errors.length > 0}>Load Into CPU</button>
            </div>
            <textarea
              className="code-editor"
              value={programText}
              onChange={(event) => setProgramText(event.target.value)}
              spellCheck="false"
            />
            {editorProgram.errors.length > 0 && (
              <div className="error-box">
                {editorProgram.errors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}
          </section>
        </aside>

        <section className="main-column">
          <section className="panel cpu-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">CPU Architecture</p>
                <h1>{loadedTitle}</h1>
              </div>
              <div className="run-state">
                <span className={cpu.halted ? 'halted' : 'live'}>{cpu.halted ? 'Halted' : 'Live Execution'}</span>
                <button type="button" onClick={() => resetCpu()}>Reset</button>
              </div>
            </div>

            <div className="controls cpu-controls">
              <button type="button" onClick={() => resetCpu()} aria-label="Restart program">Restart</button>
              <button type="button" onClick={() => setAutoRun((value) => !value)} disabled={cpu.halted || program.errors.length > 0}>
                {autoRun ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={stepCpu} disabled={cpu.halted || program.errors.length > 0}>Step Phase</button>
              <button className="primary-button" type="button" onClick={stepLine} disabled={cpu.halted || program.errors.length > 0}>Next Line</button>
              <label className="auto-toggle">
                <input type="checkbox" checked={autoRun} onChange={(event) => setAutoRun(event.target.checked)} disabled={cpu.halted || program.errors.length > 0} />
                Auto
              </label>
            </div>

            <div className="cpu-grid">
              <div className={`cpu-block pc ${activePhase === 'fetch' ? 'active' : ''}`}>
                <InfoTip title="Program Counter" text="Stores which instruction number the CPU will fetch next. When a jump happens, this value changes." />
                <span>Program Counter (PC)</span>
                <strong>{formatValue(cpu.pc)}</strong>
                <small>{activeLineNumber ? `Source line ${activeLineNumber}` : 'Instruction index in loaded program'}</small>
              </div>

              <div className={`cpu-block ir ${activePhase === 'decode' ? 'active' : ''}`}>
                <InfoTip title="Instruction Register" text="Holds the instruction that was just fetched so the Control Unit can decode it." />
                <span>Instruction Register (IR)</span>
                <strong>{cpu.ir?.clean || getFetchText(cpu, program)}</strong>
                <small>Current instruction being read</small>
              </div>

              <div className="cpu-block control active-soft">
                <InfoTip title="Control Unit" text="Directs the CPU cycle. It decides whether data should move between memory, registers and the ALU." />
                <span>Control Unit</span>
                <strong>{PHASE_DETAILS[activePhase].badge}</strong>
                <small>Coordinates each CPU stage</small>
              </div>

              <div className={`cpu-block alu ${activePhase === 'execute' ? 'active' : ''}`}>
                <InfoTip title="ALU" text="The Arithmetic Logic Unit is where calculations happen. ADD, SUB, MUL, DIV and CMP all use this part of the CPU." />
                <span>ALU</span>
                <strong>{currentInstruction?.op || 'Ready'}</strong>
                <small>Arithmetic and logic operations</small>
              </div>

              <div className={`cpu-block cache ${cachePathActive ? `cache-active ${cacheMode}` : ''}`}>
                <InfoTip title="L1 Cache" text="The L1 cache is the fast stop between RAM and the CPU. LOAD brings data RAM to cache to register. STORE sends register to cache to RAM." />
                <span>Cache (L1)</span>
                <strong>{cachePathActive ? 'Moving data' : 'Near CPU'}</strong>
                <small>{cachePathText}</small>
                <div className={`cache-route ${cachePathActive ? 'active' : ''} ${cacheMode}`} aria-label="L1 cache data route">
                  <span>{cacheRouteLabels[0]}</span>
                  <i />
                  <span>{cacheRouteLabels[1]}</span>
                  <i />
                  <span>{cacheRouteLabels[2]}</span>
                </div>
              </div>

              <div className="register-bank">
                <div className="component-heading">
                  <h3>Registers</h3>
                  <InfoTip title="Registers" text="Very small storage inside the CPU. Instructions usually read from and write to these first." />
                </div>
                {cpu.registers.map((value, index) => (
                  <div className={`register-row ${changedRegisters.includes(index) ? 'changed' : ''}`} key={`R${index}`}>
                    <span>R{index}</span>
                    <strong>{formatValue(value)}</strong>
                    {changedRegisters.includes(index) && <em>updated</em>}
                  </div>
                ))}
                <div className="flag-row">
                  <span>ZF</span>
                  <strong>{String(cpu.flags.zero)}</strong>
                </div>
              </div>
            </div>

            <div className="flow-legend" aria-label="CPU flow legend">
              <span><i className="control-line" /> Control signal</span>
              <span><i className="instruction-line" /> Instruction flow</span>
              <span><i className="data-line" /> Data flow</span>
            </div>

            <div className="component-map-note">
              <strong>Component map:</strong>
              <span>Use the ? markers on each CPU part to explain what that part does while the loaded program is running.</span>
            </div>

            <div className={`data-movement-card ${cpu.lastChange ? 'active' : ''}`}>
              <span>Latest Data Movement</span>
              <strong>{cpu.lastChange?.title || 'No register or memory write yet'}</strong>
              <p>{cpu.lastChange?.description || 'Step through an instruction such as LOAD or ADD to see where the data is written.'}</p>
              <div className={`cache-path-callout ${cachePathActive ? 'active' : ''}`}>
                <b>L1 cache path</b>
                <small>{cachePathText}</small>
              </div>
            </div>

            <div className={`memory-card ${activePhase === 'writeBack' ? 'active' : ''} ${cachePathActive ? 'cache-linked' : ''}`}>
              <div className="memory-heading">
                <div className="component-heading">
                  <h3>RAM / Main Memory</h3>
                  <InfoTip title="RAM" text="Main memory stores program data at numbered addresses. LOAD reads from RAM and STORE writes back to RAM." />
                </div>
                <span>Values shown in decimal and hex</span>
              </div>
              <div className="memory-grid">
                {Object.keys(cpu.memory)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .slice(0, 12)
                  .map((address) => (
                    <div className={`memory-cell ${changedMemory.includes(address) ? 'changed' : ''}`} key={address}>
                      <span>{address}</span>
                      <strong>{cpu.memory[address] || 0}</strong>
                      <small>{formatValue(cpu.memory[address] || 0)}</small>
                      {changedMemory.includes(address) && <em>{cpu.lastChange?.memory?.length && cpu.lastChange?.registers?.length ? 'moved' : 'updated'}</em>}
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <section className="panel trace-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Loaded Program Trace</p>
                <h2>The CPU follows this source line by line</h2>
              </div>
              <span className="line-pill">{cpu.halted ? 'Program halted' : activeLineNumber ? `Line ${activeLineNumber}` : 'Ready'}</span>
            </div>

            <div className="trace-summary">
              <div>
                <span>Current source line</span>
                <strong>{currentInstruction?.raw || 'No executable instruction'}</strong>
              </div>
              <div>
                <span>CPU phase</span>
                <strong>{PHASE_DETAILS[activePhase].title}</strong>
              </div>
            </div>

            <div className="trace-list" aria-label="Loaded program line trace">
              {traceLines.map((line) => {
                const isActive = activeLineNumber === line.number;
                const executedCount = executedLineCounts[line.number] || 0;
                const meta = isActive
                  ? PHASE_DETAILS[activePhase].title
                  : executedCount
                    ? `${executedCount} run${executedCount === 1 ? '' : 's'}`
                    : line.kind === 'memory'
                      ? 'RAM init'
                      : line.kind === 'label'
                        ? 'Label'
                        : '';

                return (
                  <div className={`trace-line ${line.kind} ${isActive ? 'current' : ''} ${executedCount ? 'executed' : ''}`} key={`line-${line.number}`}>
                    <span className="trace-gutter">{isActive ? '->' : line.number}</span>
                    <code>{line.text || ' '}</code>
                    <span className="trace-meta">{meta}</span>
                  </div>
                );
              })}
            </div>
          </section>

        </section>

        <aside className="panel explanation-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step Explanation</p>
              <h2>{PHASE_DETAILS[activePhase].subtitle}</h2>
            </div>
          </div>

          <div className="explanation-list">
            {PHASES.map((phase, index) => {
              const detail = PHASE_DETAILS[phase];
              return (
                <article className={`explanation-card ${activePhase === phase ? 'active' : ''}`} key={phase}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{detail.title}</h3>
                    <p>{detail.summary}</p>
                    {beginnerMode && <small>In simple terms: {detail.simple}</small>}
                  </div>
                </article>
              );
            })}
          </div>

          <section className="learn-card">
            <h3>Pro Tip</h3>
            <p>The cycle repeats: Fetch gets the instruction, Decode understands it, Execute performs it, and Write Back saves the result.</p>
          </section>

          <section className="stats-card">
            <div>
              <span>Instructions Executed</span>
              <strong>{cpu.instructionsExecuted}</strong>
            </div>
            <div>
              <span>Cycles</span>
              <strong>{cpu.cycles}</strong>
            </div>
            <div>
              <span>PC</span>
              <strong>{formatValue(cpu.pc)}</strong>
            </div>
          </section>
        </aside>
      </main>

      <footer className="statusbar">
        <span>Program: {loadedTitle}</span>
        <span>Line {activeLineNumber || '-'}: {currentInstruction?.clean || 'None'}</span>
        <span>Cycles: {cpu.cycles}</span>
      </footer>
    </div>
  );
}

export default App;
