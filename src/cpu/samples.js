export const SAMPLE_PROGRAMS = {
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

export function fallbackProgram(prompt) {
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
