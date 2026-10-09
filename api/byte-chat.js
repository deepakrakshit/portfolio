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

    const { message, history } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel = process.env.GEMINI_MODEL || 'gemma-4-31b-it';
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
        return res.json({ fallback: true, message: 'No API key in environment' });
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
};
