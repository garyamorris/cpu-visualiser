import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5173);
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

const systemPrompt = `You generate tiny programs for a teaching CPU simulator.
Return only valid JSON with this shape:
{"title":"short title","explanation":"brief beginner explanation","code":"assembly program"}

Use this instruction set only:
SET Rn, number        ; put a number into a register
LOAD Rn, [address]    ; copy memory[address] into a register
STORE Rn, [address]   ; copy a register into memory[address]
ADD Rd, Ra, Rb        ; Rd = Ra + Rb
SUB Rd, Ra, Rb        ; Rd = Ra - Rb
MUL Rd, Ra, Rb        ; Rd = Ra * Rb
DIV Rd, Ra, Rb        ; Rd = floor(Ra / Rb), or 0 when dividing by zero
CMP Ra, Rb            ; compare two registers and update flags
JMP label             ; jump to a label
JZ label              ; jump when zero flag is true
JNZ label             ; jump when zero flag is false
HALT                  ; stop the program

Programs may include labels like loop: and memory initializers like MEM[100] = 5.
Keep programs under 16 executable instructions. Prefer addresses 100-107. Include comments that help first-year students.`;

function stripJsonFence(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

app.post('/api/generate', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();

  if (!prompt) {
    return res.status(400).json({ error: 'Enter a short description of the program you want.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(stripJsonFence(raw));

    if (!parsed.code) {
      return res.status(502).json({ error: 'OpenAI did not return a program.' });
    }

    return res.json({
      title: String(parsed.title || 'Generated CPU Program'),
      explanation: String(parsed.explanation || 'A short generated program for the teaching CPU.'),
      code: String(parsed.code)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'OpenAI generation failed. Try a simpler prompt.' });
  }
});

if (!production) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.use((_, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  if (!fs.existsSync(distPath)) {
    console.warn('dist/ was not found. Run npm run build before npm run start.');
  }
}

app.listen(port, () => {
  console.log(`CPU Visualizer running at http://localhost:${port}`);
});
