import { stripComment } from './parser.js';

export function buildTraceLines(source, program) {
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
