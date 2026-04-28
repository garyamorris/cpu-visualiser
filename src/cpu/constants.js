export const REGISTER_COUNT = 8;
export const MEMORY_ADDRESSES = [100, 101, 102, 103, 104, 105, 106, 107];
export const PHASES = ['fetch', 'decode', 'execute', 'writeBack'];

export const INSTRUCTION_ARITY = {
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
};

export const REGISTER_REGEX = new RegExp(`^R([0-${REGISTER_COUNT - 1}])$`, 'i');
