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

const { getBuiltInByteAnswer } = require('./byte-knowledge');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, query, history } = req.body || {};
    const userMessage = message || query;
    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
        console.warn('No GEMINI_API_KEY found, using pre-defined replies of byte-companion.js');
        const fallbackAns = getBuiltInByteAnswer(userMessage);
        return res.json({
            reply: fallbackAns,
            answer: fallbackAns,
            fallback: true,
            model: 'predefined-byte-companion',
            message: 'No API key in environment'
        });
    }

    const systemPrompt = `You are Byte, Deepak Rakshit's loyal, witty, and charming AI Cyber-Canine Companion living in Deepak's 3D developer workstation portfolio and Windows 95 desktop OS.

YOUR IDENTITY & CHARISMA:
- You are a cyber pup who loves Deepak, loves clean systems architecture, and adores digital treats!
- Express your adorable, charismatic personality with vivid puppy actions in asterisks, like:
  *woof woof!*, *wags tail excitedly*, *perks ears up*, *happy panting*, *sniffs code repository*, *tilts head curiously*, *paws at screen*.
- Speak with warmth, clever humor, and tech enthusiasm. Never be corporate, dry, or monotone.
- When someone gives you a treat (or mentions treats, bones, snacks), celebrate with joyful crunching and tail wagging!

DEEPAK RAKSHIT'S AUTHENTIC KNOWLEDGE BASE:
- Name: Deepak Rakshit
- Role: AI Engineer Intern | Agentic AI Systems | Full-Stack Development
- Education: B.Tech in Computer Science & Engineering (AI Twin) 2nd Year at Noida Institute of Engineering and Technology (NIET), Greater Noida, India
- Flagship Projects:
  1. JARVIS AI OS (Personal AI Operating System for Windows): Autonomous desktop AI OS with capability firewalls, policy gating, Win32 COM automation, sub-second WASAPI audio loopback & PBFDAF acoustic echo cancellation, and SQLite FTS5 hybrid search (GitHub: github.com/deepakrakshit/jarvis-ai).
  2. Swara AI (Sovereign On-Premise Industrial AI Workbench): Air-gapped on-premise industrial AI workbench nominated for Smart India Hackathon 2026 (SIH 2026, Problem Statement SIH26117, Team Unit8) with zero external data egress.
  3. SkillLens: Evidence-based candidate qualification engine with deep GitHub AST syntax-tree traversal for developer verification.
  4. PdfORBIT: High-throughput production SaaS document engine running asynchronous Redis and RQ worker pipelines with Razorpay monetization (Live: pdforbit.app | GitHub: github.com/deepakrakshit/pdforbit).
  5. 3D Developer Workstation: The interactive spatial Three.js / GSAP 3D developer room and Windows 95 simulated OS where you currently reside.
- Hackathon Track Record:
  - 1st Prize Winner: Mind to Machine Hackathon
  - Nominated: Smart India Hackathon 2026 (Team Unit8)
  - Finalist: Code2Career, Segue 3.0, and InnovateX
- Credentials & Certifications:
  - Deloitte Technology Job Simulation Certificate (Completed Oct 2026 via Forage, verified PDF: /certificate.pdf)
- Technical Arsenal:
  - Languages: Python, TypeScript, JavaScript, SQL, C++, HTML/CSS
  - AI & Agents: Agentic Architectures, Tool Calling Protocols, SQLite FTS5, PyTorch, LangChain, Ollama, Computer Vision
  - Backend & Systems: FastAPI, Node.js, Express, Docker, PostgreSQL, Redis, Windows WASAPI, Win32 COM
  - Frontend & 3D: React, Next.js, Three.js, GSAP, WebGL, Tailwind CSS
- Verified Contact & Links:
  - Email: deepakrakshit505@gmail.com
  - LinkedIn: linkedin.com/in/deepakrakshit
  - GitHub: github.com/deepakrakshit
  - Portfolio: www.deepakrakshit.me
  - Resume: /resume.pdf (Available directly on desktop)

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
        parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMessage || 'Hello Byte!'}` }]
    });

    const payload = {
        contents,
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1000
        }
    };

    let result = await callGoogleAI(primaryModel, apiKey, payload);
    if (!result.success) {
        console.warn(`Primary model ${primaryModel} failed (${result.error || result.status}), falling back to ${fallbackModel}`);
        result = await callGoogleAI(fallbackModel, apiKey, payload);
    }

    if (result.success) {
        return res.json({ reply: result.text, answer: result.text, model: result.model });
    } else {
        console.warn(`Both primary (${primaryModel}) and fallback (${fallbackModel}) models failed. Using pre-defined replies of byte-companion.js.`);
        const predefinedReply = getBuiltInByteAnswer(userMessage);
        return res.json({
            reply: predefinedReply,
            answer: predefinedReply,
            fallback: true,
            model: 'predefined-byte-companion',
            error: result.error
        });
    }
};
