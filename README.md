# CPU Visualizer

An educational web app for showing how a simple CPU fetches, decodes, executes and writes back assembly instructions.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## OpenAI Code Generation

The browser never receives your OpenAI API key. Add it to a local `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

If no key is configured, the app uses a local teaching example so the visualizer still works.

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

Supported instructions: `SET`, `LOAD`, `STORE`, `ADD`, `SUB`, `MUL`, `DIV`, `CMP`, `JMP`, `JZ`, `JNZ`, `HALT`.
