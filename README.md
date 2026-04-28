# CPU Visualizer

An educational web app for showing how a simple CPU fetches, decodes, executes and writes back assembly instructions.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Express + Vite dev server. |
| `npm run build` | Build the SPA into `dist/`. |
| `npm start` | Serve `dist/` with the production Express server. |
| `npm test` | Run the Vitest suite (parser + emulator). |
| `npm run lint` | Run ESLint with the project config. |

## Project Layout

```
src/
  cpu/
    constants.js   - Register count, instruction arity, phase names
    parser.js      - Source -> instructions/labels/memory/errors
    emulator.js    - Pure CPU state machine (createCpu, advanceCpuPhase, executeInstruction)
    samples.js     - Built-in teaching programs and prompt fallback
    trace.js       - Source-line annotation for the execution feed
    format.js      - Hex display helpers
    __tests__/     - Vitest unit tests for parser and emulator
  App.jsx          - React UI shell (uses cpu/* as a pure library)
  main.jsx         - React entry point
server.mjs         - Express server, /api/generate proxy, dev/prod modes
```

The `cpu/` modules are pure JS with no React dependency, so they can be unit tested in isolation.

## OpenAI Code Generation

The browser never receives your OpenAI API key. Add it to a local `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1            # optional override
HOST=127.0.0.1                  # default: bind to localhost only
PORT=5173                       # default
GENERATE_RATE_LIMIT=10          # requests/min/IP for /api/generate
```

If no key is configured, the app falls back to a local teaching example so the visualizer still works.

`/api/generate` is rate-limited (default 10 req/min/IP) and rejects prompts longer than 500 characters. The server binds to `127.0.0.1` by default; set `HOST=0.0.0.0` only when you intentionally want to expose it.

## Teaching CPU Instruction Set

```asm
MEM[100] = 5
MEM[101] = 3

LOAD R1, [100]
LOAD R2, [101]
ADD R3, R1, R2
STORE R3, [102]
HALT
```

### Semantics

- **Registers**: `R0`-`R7`. All start at 0. Values are stored as truncated integers (`Math.trunc`).
- **Memory**: addresses 100-107 are exposed by default; `MEM[addr] = value` and `.DATA addr value` initialise memory before execution.
- **Comments**: `;` and `#` start line comments.
- **Labels**: `name:` on its own line or before an instruction.

| Instruction | Effect |
|---|---|
| `SET Rn, value` | `Rn := value` |
| `LOAD Rn, [addr]` | `Rn := MEM[addr]` |
| `STORE Rn, [addr]` | `MEM[addr] := Rn` |
| `ADD Rd, Ra, Rb` | `Rd := Ra + Rb`, updates Z/N flags |
| `SUB Rd, Ra, Rb` | `Rd := Ra - Rb`, updates Z/N flags |
| `MUL Rd, Ra, Rb` | `Rd := Ra * Rb`, updates Z/N flags |
| `DIV Rd, Ra, Rb` | `Rd := trunc(Ra / Rb)`; `0` when `Rb == 0` |
| `CMP Ra, Rb` | Z := `Ra == Rb`, N := `Ra < Rb` |
| `JMP label` | unconditional jump |
| `JZ label` | jump if Z is true |
| `JNZ label` | jump if Z is false |
| `HALT` | stop the program |

### Flags

- `Z` (zero flag): set by `CMP` and ALU ops when the result is `0`.
- `N` (negative flag): set when the result is negative. Currently informational only.

## Development Notes

- Editor draft is autosaved to `localStorage` under `cpu-visualiser:draft`.
- The "Step Back" button keeps a 32-step history of CPU snapshots and is the safe way to undo accidental steps.
- Auto-run uses a single `setInterval` that reads the current program from a ref, so changing the program does not restart the timer mid-cycle.

## Contributing

1. Run `npm install`.
2. Add tests under `src/cpu/__tests__/` for any change to parser or emulator semantics.
3. Run `npm run lint && npm test && npm run build` before opening a PR.
