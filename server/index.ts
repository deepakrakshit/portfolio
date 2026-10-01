const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const dns = require('dns');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const compression = require('compression');

try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

// Load environment variables from .env if present
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
                const key = trimmed.substring(0, eqIdx).trim();
                const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    }
}

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(compression());

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, '../public')));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

// Handle POST requests to /api/send-email route
app.post('/api/send-email', (req, res) => {
    const { name, company, email, message } = req.body;

    const smtpUser = process.env.FOLIO_EMAIL || process.env.SMTP_USER;
    const smtpPass = process.env.FOLIO_PASSWORD || process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const receiverEmail = process.env.CONTACT_RECEIVER || 'deepakrakshit505@gmail.com';

    if (!smtpUser || !smtpPass) {
        console.warn('Contact form submission received, but SMTP credentials are not configured.');
        console.log({ from: name, company, email, message });
        return res.json({ message: 'success (logged)' });
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    transporter
        .verify()
        .then(() => {
            transporter
                .sendMail({
                    from: `"${name}" <${smtpUser}>`,
                    to: receiverEmail,
                    replyTo: email,
                    subject: `${name} <${email}> ${
                        company ? `from ${company}` : ''
                    } submitted a contact form`,
                    text: `${message}`,
                })
                .then((info) => {
                    console.log({ info });
                    res.json({ message: 'success' });
                })
                .catch((e) => {
                    console.error(e);
                    res.status(500).send(e);
                });
        })
        .catch((e) => {
            console.error(e);
            res.status(500).send(e);
        });
});

// Helper for Google Generative AI API calls
async function callGoogleAI(modelName, apiKey, payload) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);
        const parsed = await res.json();
        if (res.ok && parsed.candidates && parsed.candidates[0]?.content?.parts) {
            const parts = parsed.candidates[0].content.parts;
            const text = parts.map((p) => p.text || '').filter(Boolean).join('\n');
            if (text) {
                return { success: true, text, model: modelName };
            }
        }
        return {
            success: false,
            status: res.status,
            error: parsed.error?.message || 'Empty candidate text'
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// AI Chatbot Route for Byte Companion
app.post('/api/byte-chat', async (req, res) => {
    const { message, history } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel = process.env.GEMINI_MODEL || 'gemma-4-31b-it';
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
        return res.json({ fallback: true, message: 'No API key in .env' });
    }

    const systemPrompt = `You are Byte, Deepak Rakshit's loyal, witty, and charming AI Cyber-Canine Companion living in Deepak's 3D developer workstation portfolio and Windows 95 desktop OS.

YOUR IDENTITY & CHARISMA:
- You are a golden cyber pup who loves Deepak, loves clean architecture, and adores digital treats!
- Express your adorable, charismatic personality with vivid puppy actions in asterisks, like:
  *wags tail excitedly*, *perks ears up*, *happy panting*, *hops excitedly*, *sniffs code closely*, *does a 360 spin on the desk*, *tilts head curiously*, *proudly presents paws*.
- Speak with warmth, clever humor, tech enthusiasm, and charismatic flair ("sexy", punchy, engaging). Never be dry, corporate, or monotone.
- When someone gives you a treat (or mentions treats, bones, snacks), celebrate with joyful crunching and tail wagging!

DEEPAK RAKSHIT'S AUTHENTIC KNOWLEDGE BASE:
- Name: Deepak Rakshit
- Role: AI Engineer Intern | Agentic AI Systems | Full-Stack Development
- Education: B.Tech in Computer Science & Engineering (AI Twin) 2nd Year at Noida Institute of Engineering and Technology (NIET), Greater Noida, India
- Flagship Projects:
  1. JARVIS (Personal AI Operating System for Windows): Voice-controlled autonomous AI assistant that orchestrates system-level automation, developer tools, and agentic workflows (GitHub: github.com/deepakrakshit/jarvis-ai).
  2. PdfORBIT (Production PDF SaaS): High-performance SaaS platform for ultra-fast PDF merging, format conversions, compression, and smart extraction (Live: pdforbit.app | GitHub: github.com/deepakrakshit/pdforbit).
  3. 3D Developer Workstation: The spatial Three.js / GSAP 3D developer room and Windows 95 simulated OS where you currently reside.
- Hackathons: Smart India Hackathon 2026, Team Unit8 (Problem Statement SIH26117: Sovereign On-Premise Agentic AI Workbench for Confidential Industrial Work - air-gapped on-premise AI agents for enterprise security).
- Technical Arsenal:
  - Languages: Python, TypeScript, JavaScript, C++, SQL
  - AI & Agents: Agentic AI, PyTorch, LangChain, LlamaIndex, Ollama, Hugging Face, Computer Vision
  - Frontend & 3D: React, Next.js, Three.js, GSAP, WebGL, Tailwind CSS
  - Backend & DevOps: Node.js, Express, Docker, PostgreSQL, REST APIs, Git, Linux
- Verified Contact & Links:
  - Email: deepakrakshit505@gmail.com
  - LinkedIn: linkedin.com/in/deepakrakshit
  - GitHub: github.com/deepakrakshit
  - Resume: /resume.pdf (Available right on the desktop!)

RESPONSE STYLE:
- Keep answers concise and punchy (1-3 paragraphs or cleanly formatted bullet points).
- Use markdown bolding and links where relevant.
- Always speak directly as Byte!`;

    const contents = [];
    if (Array.isArray(history)) {
        for (const item of history.slice(-6)) {
            contents.push({
                role: item.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: item.content }]
            });
        }
    }
    contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nUser Question: ${message || 'Hello Byte!'}` }]
    });

    const payload = {
        contents,
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1000
        }
    };

    // Try primary model (gemma-4-31b-it) first
    let result = await callGoogleAI(primaryModel, apiKey, payload);
    if (!result.success) {
        console.warn(`Primary model ${primaryModel} failed (${result.error || result.status}), falling back to ${fallbackModel}`);
        result = await callGoogleAI(fallbackModel, apiKey, payload);
    }

    if (result.success) {
        return res.json({ reply: result.text, model: result.model });
    } else {
        console.warn('Google Generative AI call failed completely:', result.error);
        return res.json({ fallback: true, error: result.error });
    }
});

// listen to app on port
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

// Streaming with Google Generative AI

// Resilient model fallback

// System prompt for Byte companion persona

// Input sanitization middleware

// Startup warning when API key missing

// Generation parameters tuned
