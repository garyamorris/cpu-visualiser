import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES } from './cpu/constants.js';
import { advanceCpuPhase, createCpu } from './cpu/emulator.js';
import { formatValue } from './cpu/format.js';
import { parseAddress, parseProgram } from './cpu/parser.js';
import { SAMPLE_PROGRAMS, fallbackProgram } from './cpu/samples.js';
import { buildTraceLines } from './cpu/trace.js';

const DRAFT_STORAGE_KEY = 'cpu-visualiser:draft';

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


function getFetchText(cpu, program) {
  const instruction = program.instructions[cpu.pc];
  if (cpu.halted) return 'CPU halted';
  if (!instruction) return 'No instruction';
  return instruction.clean;
}

function InfoTip({ title, text, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`info-tip ${className} ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="info-dot"
        aria-expanded={open}
        aria-label={`${title}: ${text}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        ?
      </button>
      <span className="info-popover" role="tooltip" aria-hidden={!open}>
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
    </span>
  );
}

function readDraft() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function App() {
  const initialDraft = useMemo(() => readDraft(), []);
  const [programText, setProgramText] = useState(initialDraft || SAMPLE_PROGRAMS.add.code);
  const [loadedSource, setLoadedSource] = useState(SAMPLE_PROGRAMS.add.code);
  const [loadedTitle, setLoadedTitle] = useState(SAMPLE_PROGRAMS.add.title);
  const [aiPrompt, setAiPrompt] = useState(SAMPLE_PROGRAMS.add.prompt);
  const [activeSidebar, setActiveSidebar] = useState('samples');
  const [sampleFilter, setSampleFilter] = useState('all');
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
  const [history, setHistory] = useState([]);
  const programRef = useRef(program);
  programRef.current = program;

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
  const sampleEntries = Object.entries(SAMPLE_PROGRAMS);
  const visibleSamples = sampleEntries.filter(([, sample]) => sampleFilter === 'all' || sample.difficulty === sampleFilter);
  const currentSample = sampleEntries.find(([, sample]) => sample.title === loadedTitle)?.[1];
  const programFeedRows = traceLines.map((line) => {
    const runs = executedLineCounts[line.number] || 0;
    const active = activeLineNumber === line.number;
    const executable = line.kind === 'instruction';
    const status = active
      ? PHASE_DETAILS[activePhase].title
      : runs
        ? `${runs} run${runs === 1 ? '' : 's'}`
        : line.kind === 'memory'
          ? 'RAM init'
          : line.kind === 'label'
            ? 'Label'
            : line.kind === 'comment'
              ? 'Comment'
              : '';
    const detail = active
      ? `${PHASE_DETAILS[activePhase].subtitle}: ${line.instruction?.clean || currentInstruction?.clean || 'waiting'}${cachePathActive ? ` | ${cachePathText}` : ''}`
      : runs
        ? `Already executed ${runs} time${runs === 1 ? '' : 's'}.`
        : executable
          ? `Instruction ${line.instruction.op} is waiting for the Program Counter.`
          : line.kind === 'memory'
            ? 'Initial memory value loaded before execution starts.'
            : line.kind === 'label'
              ? 'A jump target for branch or loop instructions.'
              : '';

    return {
      ...line,
      active,
      runs,
      status,
      detail
    };
  });

  function resetCpu(nextProgram = program) {
    setAutoRun(false);
    setCpu(createCpu(nextProgram));
    setHistory([]);
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

  function pushHistory(snapshot) {
    setHistory((items) => [snapshot, ...items].slice(0, 32));
  }

  function stepCpu() {
    const activeProgram = programRef.current;
    if (activeProgram.errors.length || cpu.halted) return;

    pushHistory(cpu);
    setCpu((current) => advanceCpuPhase(current, activeProgram));
  }

  function stepLine() {
    const activeProgram = programRef.current;
    if (activeProgram.errors.length || cpu.halted) return;

    pushHistory(cpu);
    setCpu((current) => {
      let next = current;

      for (let steps = 0; steps < PHASES.length; steps += 1) {
        next = advanceCpuPhase(next, activeProgram);
        if (next.phaseIndex === 0 || next.halted) break;
      }

      return next;
    });
  }

  function stepBack() {
    if (!history.length) return;
    const [previous, ...rest] = history;
    setAutoRun(false);
    setCpu(previous);
    setHistory(rest);
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
    if (!autoRun || program.errors.length) return undefined;
    const timer = window.setInterval(() => {
      const activeProgram = programRef.current;
      setCpu((current) => {
        if (current.halted) return current;
        return advanceCpuPhase(current, activeProgram);
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [autoRun, program.errors.length, speed]);

  useEffect(() => {
    if (cpu.halted) setAutoRun(false);
  }, [cpu.halted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, programText);
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }, [programText]);

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
          <span className={cpu.halted ? 'halted' : 'live'}>{cpu.halted ? 'Halted' : 'Live Execution'} <InfoTip className="inline" title="Execution Status" text="Shows whether the CPU is still running instructions or has reached HALT." /></span>
          <button type="button" onClick={() => resetCpu()}>Reset <InfoTip className="button-tip" title="Reset" text="Restarts the loaded program with registers, memory and counters reset to their initial state." /></button>
          <label className="mode-toggle">
            <input type="checkbox" checked={beginnerMode} onChange={(event) => setBeginnerMode(event.target.checked)} />
            Beginner Mode
            <InfoTip className="inline" title="Beginner Mode" text="Adds plain-English explanations to each CPU step for first-time learners." />
          </label>
          <label className="speed-select">
            <span>Speed</span>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Animation speed">
              <option value="1200">0.75x</option>
              <option value="900">1.0x</option>
              <option value="550">1.5x</option>
            </select>
            <InfoTip className="inline" title="Speed" text="Controls how quickly Auto mode advances through Fetch, Decode, Execute and Write Back." />
          </label>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel sidebar-panel">
          <div className="sidebar-tabs" role="tablist" aria-label="Tool selector">
            <button className={activeSidebar === 'samples' ? 'active' : ''} type="button" onClick={() => setActiveSidebar('samples')}>Samples <InfoTip className="button-tip" title="Samples" text="Load ready-made programs that demonstrate memory, ALU, branch and loop behavior." /></button>
            <button className={activeSidebar === 'assistant' ? 'active' : ''} type="button" onClick={() => setActiveSidebar('assistant')}>AI Assistant <InfoTip className="button-tip" title="AI Assistant" text="Ask OpenAI to generate a small teaching CPU program, then step through it visually." /></button>
            <button className={activeSidebar === 'program' ? 'active' : ''} type="button" onClick={() => setActiveSidebar('program')}>Program <InfoTip className="button-tip" title="Program Editor" text="Edit assembly code directly and load it into the simulated CPU." /></button>
          </div>

          {activeSidebar === 'samples' && (
            <section className="sidebar-section">
              <div className="section-title">
                <span>Sample Programs</span>
                <small>{visibleSamples.length}</small>
                <InfoTip className="inline" title="Sample Programs" text="These programs are intentionally small so students can follow each instruction line by line." />
              </div>
              <select value={sampleFilter} onChange={(event) => setSampleFilter(event.target.value)} aria-label="Filter sample programs">
                <option value="all">All Samples</option>
                <option value="Starter">Starter</option>
                <option value="Builder">Builder</option>
                <option value="Branching">Branching</option>
                <option value="Looping">Looping</option>
              </select>
              <div className="sample-grid">
                {visibleSamples.map(([key, sample]) => (
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
              <button className="add-program-button" type="button" onClick={() => setActiveSidebar('program')}>+ Add Custom Program <InfoTip className="button-tip" title="Custom Program" text="Switches to the editor so you can paste or write your own CPU assembly." /></button>
            </section>
          )}

          {activeSidebar === 'assistant' && (
            <section className="sidebar-section">
              <div className="section-title">
                <span>AI Code Assistant</span>
                <small>OpenAI optional</small>
                <InfoTip className="inline" title="AI Generation" text="The server sends your prompt to OpenAI using gpt-4.1 when an API key is configured." />
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
              <button className="secondary-button" type="button" onClick={explainCurrentCode}>Explain Current Step <InfoTip className="button-tip" title="Explain Current Step" text="Adds a plain-language explanation for the source line currently highlighted in the trace." /></button>
            </section>
          )}

          {activeSidebar === 'program' && (
            <section className="sidebar-section">
              <div className="section-title">
                <span>Program Draft</span>
                {hasUnloadedEdits && <small>Not loaded</small>}
                <InfoTip className="inline" title="Program Draft" text="Editing here does not affect the CPU until you press Load Into CPU." />
              </div>
              <textarea
                className="code-editor"
                value={programText}
                onChange={(event) => setProgramText(event.target.value)}
                spellCheck="false"
              />
              <button className="load-program-button" type="button" onClick={() => loadProgram(loadedTitle)} disabled={editorProgram.errors.length > 0}>Load Into CPU <InfoTip className="button-tip" title="Load Into CPU" text="Parses the draft code, initializes memory, and resets the CPU to the first instruction." /></button>
              {editorProgram.errors.length > 0 && (
                <div className="error-box">
                  {editorProgram.errors.map((error) => <p key={error}>{error}</p>)}
                </div>
              )}
            </section>
          )}

          <section className="program-info-card">
            <div className="section-title">
              <span>Program Info</span>
              <InfoTip className="inline" title="Program Info" text="Quick summary of the loaded program and how far the CPU has progressed." />
            </div>
            <dl>
              <div><dt>Program:</dt><dd>{loadedTitle}</dd></div>
              <div><dt>Instructions:</dt><dd>{program.instructions.length}</dd></div>
              <div><dt>Cycles:</dt><dd>{cpu.cycles}</dd></div>
              <div><dt>Description:</dt><dd>{currentSample?.description || 'Custom program loaded into the teaching CPU.'}</dd></div>
            </dl>
          </section>

          <section className="tip-card">
            <strong>Tip <InfoTip className="inline" title="Teaching Tip" text="Start with Load A Number, then move to Add Two Numbers before introducing branches and loops." /></strong>
            <p>Select a sample to see it visualized step-by-step.</p>
          </section>
        </aside>

        <section className="main-column">
          <section className="panel cpu-panel">
            <div className="panel-heading">
              <div>
                <h1>{loadedTitle}</h1>
              </div>
            </div>

            <div className="controls cpu-controls">
              <button type="button" onClick={() => resetCpu()} aria-label="Restart program">Restart <InfoTip className="button-tip" title="Restart" text="Returns to the start of the loaded program without changing the selected sample or editor text." /></button>
              <button type="button" onClick={stepBack} disabled={!history.length}>Step Back <InfoTip className="button-tip" title="Step Back" text="Restores the CPU to the previous phase. Up to 32 steps of history are kept." /></button>
              <button type="button" onClick={() => setAutoRun((value) => !value)} disabled={cpu.halted || program.errors.length > 0}>
                {autoRun ? 'Pause' : 'Play'}
                <InfoTip className="button-tip" title="Play / Pause" text="Automatically advances through CPU phases until you pause or the program halts." />
              </button>
              <button type="button" onClick={stepCpu} disabled={cpu.halted || program.errors.length > 0}>Step Phase <InfoTip className="button-tip" title="Step Phase" text="Moves one CPU phase at a time: Fetch, Decode, Execute, then Write Back." /></button>
              <button className="primary-button" type="button" onClick={stepLine} disabled={cpu.halted || program.errors.length > 0}>Next Line <InfoTip className="button-tip" title="Next Line" text="Runs the current source instruction through all CPU phases and highlights the next instruction line." /></button>
              <label className="auto-toggle">
                <input type="checkbox" checked={autoRun} onChange={(event) => setAutoRun(event.target.checked)} disabled={cpu.halted || program.errors.length > 0} />
                Auto
                <InfoTip className="inline" title="Auto Mode" text="Keeps stepping through phases using the selected speed until the program stops." />
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
              <span><i className="control-line" /> Control signal <InfoTip className="inline" title="Control Signal" text="Purple lines represent the Control Unit coordinating which component should act next." /></span>
              <span><i className="instruction-line" /> Instruction flow <InfoTip className="inline" title="Instruction Flow" text="Blue lines represent the instruction moving from memory into the Instruction Register." /></span>
              <span><i className="data-line" /> Data flow <InfoTip className="inline" title="Data Flow" text="Green lines represent values moving between RAM, cache, registers and the ALU." /></span>
            </div>

            <div className="component-map-note">
              <strong>Component map:</strong>
              <span>Use the ? markers on each CPU part to explain what that part does while the loaded program is running.</span>
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

          <section className="panel execution-feed-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Execution Feed</p>
                <h2>Loaded Program Trace</h2>
              </div>
              <InfoTip className="inline" title="Loaded Program Trace" text="This is the actual loaded program. The highlighted row is the line currently being processed by the CPU." />
              <span className="line-pill">{cpu.halted ? 'Program halted' : activeLineNumber ? `Line ${activeLineNumber}` : 'Ready'}</span>
            </div>

            <div className="execution-feed">
              {programFeedRows.map((item) => (
                <article className={`feed-row source-line ${item.kind} ${item.active ? 'active' : ''} ${item.runs ? 'executed' : ''}`} key={`feed-line-${item.number}`}>
                  <div className="feed-step-dot">{item.active ? '>' : item.number}</div>
                  <strong>Line {item.number}</strong>
                  <span>{item.status}</span>
                  <code className="program-source">{item.text || ' '}</code>
                  <small>{item.detail}</small>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="panel explanation-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step Explanation</p>
              <h2>{PHASE_DETAILS[activePhase].subtitle}</h2>
            </div>
            <InfoTip className="inline" title="Step Explanation" text="Explains the active CPU phase separately from the program trace so students can connect code to hardware behavior." />
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
            <h3>Pro Tip <InfoTip className="inline" title="CPU Cycle" text="Every instruction repeats the same cycle, even when the instruction is a jump, load or arithmetic operation." /></h3>
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

    </div>
  );
}

export default App;
