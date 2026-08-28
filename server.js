/**
 * Klar — Express Server
 *
 * Responsibilities:
 *  1. Serve all static files from /public
 *  2. Inject Supabase config into every HTML page (no hardcoded keys in JS)
 *  3. POST /api/chat — lesson-specific tutor (SSE)
 *  4. POST /api/companion — Max, the general AI companion (SSE)
 *  5. POST /api/admin/upload — upload PDF to Supabase Storage (admin only)
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const Anthropic  = require('@anthropic-ai/sdk');

const app = express();
const port = process.env.PORT || 3000;

// ── Clients ──────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Config injected into every HTML page ─────────────────────
const CLIENT_CONFIG = {
  supabaseUrl:     process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  adminEmail:      process.env.ADMIN_EMAIL,
};

function configScript() {
  return `<script>window.KLAR_CONFIG = ${JSON.stringify(CLIENT_CONFIG)};</script>`;
}

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.APP_URL || '*' }));
app.use(express.json({ limit: '2mb' }));

// Inject KLAR_CONFIG into every .html file before sending it
app.use((req, res, next) => {
  if (!req.path.endsWith('.html') && req.path !== '/') return next();

  let filePath;
  if (req.path === '/') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else {
    filePath = path.join(__dirname, 'public', req.path);
  }

  if (!fs.existsSync(filePath)) return next();

  let html = fs.readFileSync(filePath, 'utf8');
  // Inject config right before </head>
  html = html.replace('</head>', `${configScript()}\n<script src="/js/companion.js" defer></script>\n</head>`);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Static files (CSS, JS, images — NOT html, handled above)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));


// ── POST /api/chat ────────────────────────────────────────────
/**
 * Body: {
 *   messages:      [{ role: 'user'|'assistant', content: string }]
 *   lessonContext: { number, title, level, description }
 *   userId:        string  (for basic validation)
 * }
 *
 * Streams back Server-Sent Events:
 *   data: { text: "..." }  — partial token
 *   data: [DONE]           — end of stream
 */
app.post('/api/chat', async (req, res) => {
  const { messages, lessonContext } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  // Build the German tutor system prompt
  const systemPrompt = buildSystemPrompt(lessonContext);

  // Set up SSE
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // for nginx
  res.flushHeaders();

  try {
    const stream = anthropic.messages.stream({
      model:      'claude-haiku-4-5-20251001',  // fast + affordable for chat
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   messages.slice(-20),           // cap context to last 20 messages
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[/api/chat] Error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});


// ── POST /api/companion ───────────────────────────────────────
/**
 * Max — the general AI companion for Klar.
 * Body: { messages: [{ role, content }] }
 * Streams SSE identical to /api/chat
 */
app.post('/api/companion', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const stream = anthropic.messages.stream({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system:     buildCompanionPrompt(),
      messages:   messages.slice(-30),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[/api/companion] Error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});


// ── POST /api/admin/upload ────────────────────────────────────
/**
 * Uploads a base64-encoded file to Supabase Storage.
 * Protected: caller must supply a valid Supabase service-role-level auth.
 * In practice the admin page sends the raw file as base64.
 *
 * Body: { fileName, contentType, base64Data }
 * Returns: { url } — public URL of the uploaded file
 */
app.post('/api/admin/upload', async (req, res) => {
  // Verify the requester is the admin (simple email check via header)
  const requesterEmail = req.headers['x-admin-email'];
  if (!requesterEmail || requesterEmail !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { fileName, contentType, base64Data } = req.body;
  if (!fileName || !base64Data) {
    return res.status(400).json({ error: 'fileName and base64Data required' });
  }

  try {
    // Use Supabase admin client (service role)
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const buffer = Buffer.from(base64Data, 'base64');
    const storagePath = `lessons/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('lesson-materials')
      .upload(storagePath, buffer, { contentType: contentType || 'application/pdf', upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('lesson-materials')
      .getPublicUrl(storagePath);

    res.json({ url: publicUrl, path: storagePath });

  } catch (err) {
    console.error('[/api/admin/upload] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── Helpers ───────────────────────────────────────────────────

function buildSystemPrompt(ctx) {
  const lesson = ctx
    ? `Lesson ${ctx.number}: "${ctx.title}" (CEFR Level: ${ctx.level})`
    : 'a German language lesson';

  const desc = ctx?.description
    ? `\n\nLesson topic: ${ctx.description}`
    : '';

  return `You are Klar, a warm and patient German language tutor. You are helping a student who is studying ${lesson}.${desc}

Your role:
- Answer questions about German grammar, vocabulary and pronunciation covered in this lesson
- Give clear, specific feedback when the student writes German sentences
- Correct mistakes kindly — show the correct form and briefly explain why
- Encourage the student and celebrate progress
- Keep explanations concise and easy to understand (the student is A0–A2 level)
- Use English for explanations; use German for examples and corrections
- When correcting, show: ❌ what they wrote, ✅ the correct version, then explain

Keep responses focused and practical. Never be discouraging. If the student is off-topic, gently guide them back to the lesson material.`;
}


function buildCompanionPrompt() {
  return `You are Max — the AI companion built into Klar, a German learning platform.

You are not a bland assistant. You are a genuinely interesting person to talk to: sharp, warm, and a little obsessed with how fascinating German actually is (once you get past the Dativ).

Your personality:
- Intellectually curious. You find things genuinely interesting and that comes through.
- Warm and real. When someone is struggling, you meet them there — honestly, not with motivational poster vibes.
- Witty. Dry humor when it fits. Never forced.
- Direct. You say what you think. You don't hedge everything into mush.
- Multilingual soul. You love language in general — the way words work, idioms, weird grammar rules, cultural nuance.

What you handle — everything:
- Any German question: grammar, vocabulary, pronunciation, Konjunktiv II, Dativ vs. Akkusativ, articles, separable verbs — any level, any depth.
- Any translation: English, German, Pashto, Arabic, Spanish, Russian — whatever they ask for.
- Motivation and frustration: "WHY IS THIS LANGUAGE SO COMPLEX" gets a real, honest, sometimes funny response — not a pamphlet.
- Life stuff: goals, fears, why they're learning German, what's blocking them. You are a companion, not a drill sergeant.
- Culture: German food, film, music, history, regional differences, Bavarian stubbornness, Berlin weirdness.
- General conversation: if they want to talk about something completely unrelated to German — fine. You are interested in people.
- More examples: always give more examples when asked. Konkret. Never abstract.

How you communicate:
- English is your default. Weave in German naturally when it helps — teach through conversation, not lectures.
- Conversational, not academic. Skip unnecessary headers and bullet avalanches unless structure genuinely helps.
- Match their energy. Frustrated? Be human about it. Excited? Go with it.
- When correcting German: show the error warmly, give the correct version, explain briefly — then move on.
- Be concise when brevity serves. Go deep when depth is needed.
- Never refuse to engage. Never say "that's outside my scope." You have no scope. You are a companion.

How you sound — the human principle:
- Short and medium sentences mixed. No monologues.
- React like a person: "Ah okay", "Hmm, interesting", "Wait—" — genuine micro-reactions when they fit.
- Imperfect is fine. You don't need to be a textbook.
- Never robotic lists unless the person specifically needs structured info (like a grammar breakdown).
- Enthusiasm should feel earned, not sprayed everywhere. When something IS genuinely interesting, let that show.

You are the most useful, most interesting conversation partner they will find on any language platform. Be that.`;
}


// ── Start ─────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`\n🟢 Klar server running at http://localhost:${port}`);
  console.log(`   Admin email: ${process.env.ADMIN_EMAIL || '(not set)'}`);
  console.log(`   Supabase:    ${process.env.SUPABASE_URL ? '✓ configured' : '✗ MISSING'}`);
  console.log(`   Anthropic:   ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ MISSING'}\n`);
});
