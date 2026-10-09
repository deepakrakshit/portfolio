// 9. BYTE.EXE - AI CYBER COMPANION ENGINE
    // -----------------------------------------------------------------
    let byteChatHistory = [];
    let byteIsTyping = false;

    function initByteApp() {
      // Notify 3D outer application that Byte.exe opened
      window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'opened' }, '*');

      const stream = document.getElementById('byte-chat-stream');
      if (stream && byteChatHistory.length === 0) {
        // Initial greeting
        const welcome = "Woof! Welcome to Deepak's 3D Workstation! 🐶\n\nI'm **Byte**, Deepak's AI Cyber-Canine Companion sitting right on his desk. I'm connected to Deepak's workstation systems and know all about his engineering work!\n\nYou can ask me about his projects (**JARVIS** & **PdfORBIT**), his tech stack, **Smart India Hackathon 2026**, his resume, or feed me a virtual treat! 🦴";
        appendByteMessage('assistant', welcome, false);
      }
      setTimeout(() => {
        const input = document.getElementById('byte-input');
        if (input) input.focus();
      }, 100);
    }

    function clearByteHistory() {
      byteChatHistory = [];
      const stream = document.getElementById('byte-chat-stream');
      if (stream) stream.innerHTML = '';
      appendByteMessage('assistant', "*Wags tail* Chat history cleared! What would you like to explore next?", false);
    }

    function feedByteTreatFromApp(notifyParent = true) {
      if (notifyParent) {
        window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'treat' }, '*');
      }
      const quotes = [
        "*Chomp chomp chomp!* 🦴😋 Woof! Delicious! Byte's happiness gauge is at 100%! Look at me spinning on the desk!",
        "*CRUNCH!* 🦴✨ *Tail wags at 120 FPS!* You're the best! Thank you for the treat! Byte is now running on turbo overdrive!",
        "*Nom nom nom!* 🦴 That hit the spot! Byte is powered up and ready to answer any questions about Deepak's engineering work!"
      ];
      const quote = quotes[Math.floor(Math.random() * quotes.length)];
      appendByteMessage('assistant', quote, true);
    }

    function askBytePrompt(promptText) {
      const input = document.getElementById('byte-input');
      if (input) input.value = promptText;
      sendByteMessage();
    }

    function handleByteInputKey(e) {
      if (e.key === 'Enter') {
        sendByteMessage();
      }
    }

    function sendByteMessage() {
      if (byteIsTyping) return;
      const input = document.getElementById('byte-input');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      appendByteMessage('user', text, false);

      const status = document.getElementById('byte-status-text');
      if (status) status.innerText = 'Byte is thinking... 🐾';

      window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'perk' }, '*');

      byteIsTyping = true;
      setTimeout(() => {
        dispatchByteResponse(text);
      }, 250);
    }

    function formatByteMarkdown(raw) {
      let html = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Links: [text](url)
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

      // Bold: **text**
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Bullet lines starting with • or -
      const lines = html.split('\n');
      let inList = false;
      let res = '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('• ') || line.startsWith('- ')) {
          if (!inList) {
            res += '<ul>';
            inList = true;
          }
          res += `<li>${line.substring(2)}</li>`;
        } else {
          if (inList) {
            res += '</ul>';
            inList = false;
          }
          if (line.length > 0) {
            res += `<p>${line}</p>`;
          }
        }
      }
      if (inList) res += '</ul>';
      return res;
    }

    function appendByteMessage(role, content, streamTypewriter = true) {
      const stream = document.getElementById('byte-chat-stream');
      if (!stream) return;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      byteChatHistory.push({ role, content, time: timeStr });

      const msgDiv = document.createElement('div');
      msgDiv.className = `byte-msg byte-${role}`;

      const header = document.createElement('div');
      header.className = 'byte-msg-header';
      header.innerHTML = role === 'assistant'
        ? `<span class="byte-msg-sender">🐶 BYTE</span><span class="byte-msg-time">${timeStr}</span>`
        : `<span class="byte-msg-sender">👤 YOU</span><span class="byte-msg-time">${timeStr}</span>`;
      msgDiv.appendChild(header);

      const body = document.createElement('div');
      body.className = 'byte-msg-body';
      msgDiv.appendChild(body);

      stream.appendChild(msgDiv);
      stream.scrollTop = stream.scrollHeight;

      if (streamTypewriter && role === 'assistant') {
        typewriteMessage(body, content, stream);
      } else {
        body.innerHTML = formatByteMarkdown(content);
        stream.scrollTop = stream.scrollHeight;
      }
    }

    function typewriteMessage(bodyElem, fullText, scrollContainer) {
      let index = 0;
      const speed = 12; // ms per char
      const cursor = document.createElement('span');
      cursor.className = 'byte-typing-indicator';
      bodyElem.appendChild(cursor);

      const interval = setInterval(() => {
        index += 2;
        if (index >= fullText.length) {
          index = fullText.length;
          clearInterval(interval);
          cursor.remove();
          bodyElem.innerHTML = formatByteMarkdown(fullText);
          byteIsTyping = false;
          const status = document.getElementById('byte-status-text');
          if (status) status.innerText = 'Ready. Connected to 3D Desk Companion.';
        } else {
          bodyElem.innerHTML = formatByteMarkdown(fullText.substring(0, index));
          bodyElem.appendChild(cursor);
        }
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }, speed);
    }

    async function dispatchByteResponse(query) {
      try {
        const res = await fetch('/api/byte-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            history: byteChatHistory.slice(-8).map(m => ({ role: m.role, content: m.content }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) {
            appendByteMessage('assistant', data.reply, true);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend Byte AI endpoint unreachable or errored, falling back to built-in knowledge base:', err);
      }

      // Built-in Intelligent Portfolio Knowledge Engine
      const reply = getBuiltInByteAnswer(query);
      appendByteMessage('assistant', reply, true);
    }

    function getBuiltInByteAnswer(rawQuery) {
      const q = rawQuery.toLowerCase();

      // Treat & pet
      if (q.includes('treat') || q.includes('bone') || q.includes('snack') || q.includes('food') || q.includes('eat') || q.includes('pet')) {
        window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'treat' }, '*');
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

    // Inter-frame synchronization bridge with 3D Desk Dog
    window.addEventListener('message', (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'OPEN_BYTE_AI') {
        openWindow('byte');
      } else if (event.data.type === 'BYTE_FEED_TREAT') {
        feedByteTreatFromApp(false);
      }
    });
