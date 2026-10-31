// Pre-defined replies knowledge engine for Byte Cyber Companion
// Matches the intelligent built-in replies defined in byte-companion.js

function getBuiltInByteAnswer(rawQuery) {
    const q = (rawQuery || '').toLowerCase();

    // Treat & pet
    if (q.includes('treat') || q.includes('bone') || q.includes('snack') || q.includes('food') || q.includes('eat') || q.includes('pet')) {
        return "*Chomp chomp!* 🦴✨ *Does a 360 spin on the desk!* Woof! That treat is delicious! Thank you! Byte's processor is purring happily!";
    }

    // Greetings
    if (q.match(/\b(hi|hello|hey|yo|sup|greetings|namaste|ola)\b/)) {
        return "*Wags tail excitedly* Woof! Hello there! Great to meet you! I'm **Byte**, Deepak's cyber pup. Ask me anything about Deepak's projects, background, skills, or hackathons!";
    }

    // Identity & Who is Deepak
    if (q.includes('who is deepak') || q.includes('about deepak') || q.includes('who are you') || q.includes('introduce') || q.includes('tell me about yourself') || q.includes('background')) {
        return "**Deepak Rakshit** is an AI Engineer Intern specializing in **Agentic AI Systems**, **Full-Stack Development**, and **Computer Vision**.\n\n• **Education**: B.Tech in Computer Science & Engineering (AI Twin) 2nd Year at **Noida Institute of Engineering and Technology (NIET)**, Greater Noida, India.\n• **Passions**: Autonomous agents, voice-driven operating systems, high-speed web apps, and immersive 3D graphics.\n• **Flagship Work**: Creator of **JARVIS** and **PdfORBIT**!\n\nWhat would you like to dive into next?";
    }

    // JARVIS
    if (q.includes('jarvis')) {
        return "🚀 **JARVIS (Personal AI Operating System)**:\n\nJARVIS is Deepak's autonomous AI assistant for Windows! It provides seamless voice command orchestration, system-level automation, and agentic workflows to control developer environments and everyday computing.\n\n• **Repository**: [github.com/deepakrakshit/jarvis-ai](https://github.com/deepakrakshit/jarvis-ai)\n• **Tech**: Python, PyTorch, Speech Recognition, Windows Automation APIs, Agentic Workflows.";
    }

    // PdfORBIT
    if (q.includes('pdforbit') || q.includes('pdf orbit') || q.includes('pdf')) {
        return "📄 **PdfORBIT (Production PDF SaaS)**:\n\nPdfORBIT is Deepak's high-speed web application for document processing. It provides ultra-fast client and server workflows for PDF merging, page reordering, format conversions, compression, and smart document utilities.\n\n• **Live Site**: [pdforbit.app](https://pdforbit.app)\n• **Repository**: [github.com/deepakrakshit/pdforbit](https://github.com/deepakrakshit/pdforbit)\n• **Tech**: Modern Web Architecture, High-performance PDF pipelines, Responsive UI.";
    }

    // All Projects
    if (q.includes('project') || q.includes('work') || q.includes('built') || q.includes('showcase')) {
        return "Here are Deepak's featured engineering projects:\n\n1. **JARVIS** — Personal AI Operating System for Windows with voice control and automated agentic flows: [github.com/deepakrakshit/jarvis-ai](https://github.com/deepakrakshit/jarvis-ai)\n\n2. **PdfORBIT** — Production PDF SaaS for instant document merging and conversions: [pdforbit.app](https://pdforbit.app) & [github.com/deepakrakshit/pdforbit](https://github.com/deepakrakshit/pdforbit)\n\n3. **3D Developer Workstation** — The interactive spatial portfolio you are browsing right now, built with Three.js, GSAP, and retro Windows 95 aesthetics!\n\nWould you like more details on JARVIS or PdfORBIT?";
    }

    // Hackathon / SIH
    if (q.includes('hackathon') || q.includes('sih') || q.includes('smart india') || q.includes('unit8')) {
        return "🏆 **Smart India Hackathon 2026 (SIH 2026)**:\n\nDeepak is competing with **Team Unit8** under Problem Statement **SIH26117**: *Sovereign On-Premise Agentic AI Workbench for Confidential Industrial Work*!\n\n• **Core Focus**: Developing an on-premise, privacy-preserving AI agentic workbench for high-security enterprise environments.\n• **Architectural Pillars**: Air-gapped model execution, strict data residency, and audit-compliant agent orchestrators.";
    }

    // Skills & Tech Stack
    if (q.includes('skill') || q.includes('stack') || q.includes('tech') || q.includes('language') || q.includes('tool') || q.includes('framework')) {
        return "💻 **Deepak's Technical Arsenal**:\n\n• **Languages**: Python, TypeScript, JavaScript, C++, SQL\n• **AI & Machine Learning**: Agentic AI Architectures, PyTorch, LangChain, LlamaIndex, Ollama, Hugging Face, Computer Vision\n• **Frontend & 3D**: React, Next.js, Three.js, GSAP, WebGL, Tailwind CSS, HTML5/CSS3\n• **Backend & Databases**: Node.js, Express, Docker, PostgreSQL, RESTful APIs\n• **Tools**: Git, Linux, Vercel, VS Code";
    }

    // Education & College
    if (q.includes('education') || q.includes('college') || q.includes('university') || q.includes('degree') || q.includes('niet') || q.includes('study')) {
        return "🎓 **Education**:\n\nDeepak is currently pursuing his **B.Tech in Computer Science & Engineering (AI Twin)** (2nd Year) at **Noida Institute of Engineering and Technology (NIET)**, Greater Noida, India.";
    }

    // Certificate & Credentials
    if (q.includes('certificate') || q.includes('certification') || q.includes('deloitte') || q.includes('forage') || q.includes('credential')) {
        return "🏆 **Deloitte Technology Job Simulation Certificate**:\n\nDeepak completed the practical Technology Job Simulation with **Deloitte** (via Forage) in **October 2026**, covering hands-on Coding and Software Development tasks!\n\n• **Verified PDF**: [Click here to view Certificate PDF](/certificate.pdf)\n• You can also inspect the full certificate preview inside **My Showcase > CERTIFICATES**!";
    }

    // Resume
    if (q.includes('resume') || q.includes('cv')) {
        return "📄 **Deepak's Resume**:\n\nYou can view and download his complete verified resume here: [Click here to open Resume PDF](/resume.pdf)! You can also print it via the My Showcase printer icon.";
    }

    // Contact & Hire
    if (q.includes('contact') || q.includes('email') || q.includes('hire') || q.includes('reach') || q.includes('message') || q.includes('linkedin') || q.includes('github')) {
        return "📬 **Get in Touch with Deepak**:\n\n• 📧 **Email**: [deepakrakshit505@gmail.com](mailto:deepakrakshit505@gmail.com)\n• 💼 **LinkedIn**: [linkedin.com/in/deepakrakshit](https://linkedin.com/in/deepakrakshit)\n• 🐙 **GitHub**: [github.com/deepakrakshit](https://github.com/deepakrakshit)\n\nHe is open to exciting opportunities in AI Engineering and Full-Stack development!";
    }

    // Location
    if (q.includes('location') || q.includes('where') || q.includes('india') || q.includes('delhi') || q.includes('noida')) {
        return "📍 Deepak is based in Greater Noida / Delhi NCR, India.";
    }

    // Default canine fallback
    return "*Tilts head curiously* Woof! I'm Deepak's cyber pup Byte. I know all about his projects (**JARVIS** & **PdfORBIT**), his **skills in AI & Web Development**, his **Smart India Hackathon** work, or his **contact details**! Click one of the quick chips above or ask about any of those!";
}

module.exports = { getBuiltInByteAnswer };
