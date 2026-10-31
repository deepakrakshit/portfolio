// -----------------------------------------------------------------
// BYTE.EXE - CLEAN WINDOWS 95 CANINE COMPANION LOGIC
// -----------------------------------------------------------------
let byteChatHistory = [];
let byteIsTyping = false;

function initByteApp() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'opened' }, '*');
  }

  const stream = document.getElementById('byte-chat-stream');
  if (stream && byteChatHistory.length === 0) {
    const welcome = "*Woof woof!* 🐶 Welcome! I'm Byte, Deepak's cyber pup and desktop companion. *Wags tail happily*\n\nAsk me anything about Deepak's engineering projects, tech stack, hackathon awards, or how to reach him!";
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
  appendByteMessage('assistant', '*Woof!* *Wags tail* Chat cleared and ready for new questions! 🐾', false);
}

function feedByteTreatFromApp(notifyParent = true) {
  if (notifyParent && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'treat' }, '*');
  }
  const treatQuotes = [
    "*Nom nom nom!* 🦴 *Chomp!* Woof! Delicious virtual treat! *Happy tail wagging* 🐶",
    "*CRUNCH!* 🦴 *Woof woof!* That hit the spot! Byte is energized and ready to help!",
    "*Sniffs treat excitedly* *Chomp!* 🦴 Woof! Thank you! *Perks ears attentively*"
  ];
  const quote = treatQuotes[Math.floor(Math.random() * treatQuotes.length)];
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
  if (status) status.innerText = 'Byte is sniffing out the answer... 🐾';

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'BYTE_APP_EVENT', action: 'perk' }, '*');
  }

  byteIsTyping = true;
  setTimeout(() => {
    dispatchByteResponse(text);
  }, 180);
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
    ? `<span class="byte-msg-sender">🐶 Byte</span><span class="byte-msg-time">${timeStr}</span>`
    : `<span class="byte-msg-sender">👤 You</span><span class="byte-msg-time">${timeStr}</span>`;
  msgDiv.appendChild(header);

  const body = document.createElement('div');
  body.className = 'byte-msg-body';
  msgDiv.appendChild(body);

  stream.appendChild(msgDiv);
  stream.scrollTop = stream.scrollHeight;

  if (role === 'assistant' && streamTypewriter) {
    typewriteMessage(body, content, stream);
  } else {
    body.innerHTML = formatByteMarkdown(content);
    stream.scrollTop = stream.scrollHeight;
  }
}

function typewriteMessage(element, text, scrollContainer) {
  const formatted = formatByteMarkdown(text);
  let index = 0;
  const step = Math.max(2, Math.floor(text.length / 40));
  element.innerHTML = '<span class="byte-typing-indicator"></span>';

  const timer = setInterval(() => {
    index += step;
    if (index >= text.length) {
      clearInterval(timer);
      element.innerHTML = formatted;
      byteIsTyping = false;
      const status = document.getElementById('byte-status-text');
      if (status) status.innerText = 'Ready 🐾';
    } else {
      const partial = text.substring(0, index);
      element.innerHTML = formatByteMarkdown(partial) + '<span class="byte-typing-indicator"></span>';
    }
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, 12);
}

async function dispatchByteResponse(userQuery) {
  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/byte-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userQuery, query: userQuery, history: byteChatHistory })
      });
      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || data.answer;
        if (replyText) {
          appendByteMessage('assistant', replyText, true);
          return;
        }
      }
    } catch (err) {
      // Fallback to local response engine
    }
  }

  const fallbackAns = getLocalByteAnswer(userQuery);
  appendByteMessage('assistant', fallbackAns, true);
}

function getLocalByteAnswer(query) {
  const q = query.toLowerCase();

  // Specific Projects
  if (q.includes('jarvis')) {
    return "*Woof!* 🤖 *Perks ears excitedly* Here's the scoop on **JARVIS AI OS** (*Sep 2026 – Present*):\n\nDeepak's flagship autonomous agentic desktop operating system for Windows:\n• **Agentic Architecture**: Multi-agent capability firewalls, policy gating, and autonomous tool calling.\n• **Low-Latency WASAPI Audio**: Direct Windows loopback capture and PBFDAF acoustic echo cancellation for sub-second voice interactions.\n• **Neural Storage**: Hybrid SQLite FTS5 search index for instant cross-session context retrieval.\n• **Strict Quality Gates**: 100% test pass rate and strict type safety.";
  }

  if (q.includes('swara')) {
    return "*Woof woof!* 🛡️ *Wags tail proudly* Let me tell you about **Swara AI** (*Aug 2026 – Sep 2026*):\n\nSovereign on-premise industrial AI workbench nominated for **Smart India Hackathon 2026** (Team Unit8):\n• **Air-Gapped Sovereign AI**: Complete on-premise execution with zero external data egress.\n• **Industrial Audio & Document Analysis**: Deep neural parsing for mission-critical industrial workflows.\n• **Production Architecture**: High-concurrency FastAPI microservices with local inference engines.";
  }

  if (q.includes('skilllens')) {
    return "*Woof!* 🔍 *Sniffs code repository* Here is **SkillLens** (*May 2026*):\n\nEvidence-based candidate qualification engine:\n• **GitHub AST Analysis**: Deep syntax-tree traversal across repositories to verify authentic coding skills.\n• **Automated Scoring**: Multi-metric evaluation of commit history, architecture design, and code quality.";
  }

  if (q.includes('pdforbit')) {
    return "*Woof!* ⚡ *Paws at document* Here's **PdfORBIT High-Throughput SaaS**:\n\nProduction SaaS document transformation platform:\n• **Distributed Workers**: Asynchronous Redis and RQ task queues handling heavy document conversion pipelines.\n• **Monetization & Scalability**: Complete Razorpay subscription lifecycle and automated webhook processing.";
  }

  if (q.includes('project') || q.includes('work') || q.includes('built')) {
    return "*Woof woof!* 🚀 *Wags tail* Here are Deepak's 4 featured projects:\n\n• **JARVIS AI OS** (*Sep 2026 – Present*): Windows agentic OS with capability firewalls, Win32 COM automation, and live WASAPI voice loop.\n• **Swara AI** (*Aug 2026 – Sep 2026*): Sovereign on-premise industrial AI workbench for **SIH 2026** with zero data egress.\n• **SkillLens** (*May 2026*): Evidence-based candidate qualification engine with GitHub AST analysis.\n• **PdfORBIT**: High-throughput SaaS document engine running Redis/RQ workers and Razorpay subscriptions.";
  }

  // Hackathons & Awards
  if (q.includes('hackathon') || q.includes('sih') || q.includes('prize') || q.includes('award') || q.includes('unit8') || q.includes('winner')) {
    return "*Barks excitedly!* 🏆 *Tail wags fast* Deepak's hackathon achievements:\n\n• **1st Prize Winner 🥇**: Mind to Machine Hackathon\n• **Team Unit8 🎯**: Nominated for Smart India Hackathon (SIH 2026)\n• **Finalist 🏅**: Code2Career, Segue 3.0, and InnovateX\n\nHe builds zero-compromise, production-grade systems even under tight 24-hour hackathon clocks!";
  }

  // Certifications
  if (q.includes('certificate') || q.includes('certification') || q.includes('deloitte') || q.includes('forage') || q.includes('credential')) {
    return "*Woof!* 📜 *Paws at certificate* Check out Deepak's **Deloitte Technology Job Simulation**:\n\nCompleted in **October 2026** via Forage, covering software architecture and practical coding tasks.\n\n• [View Verified Deloitte PDF](/certificate.pdf)\n• You can also view the certificate in **My Showcase > CERTIFICATES**!";
  }

  // Tech Stack & Skills
  if (q.includes('skill') || q.includes('stack') || q.includes('tech') || q.includes('language') || q.includes('python')) {
    return "*Woof woof!* 💻 *Sniffs out the tech stack* Here is Deepak's technical arsenal:\n\n• **Languages**: Python, TypeScript, JavaScript, SQL, C++, HTML/CSS\n• **AI & Agents**: Agentic Architectures, Tool Calling, Hybrid Search (SQLite FTS5), Local Model Inference\n• **Backend & Systems**: FastAPI, Node.js, PostgreSQL, Redis, Docker, Windows WASAPI, Win32 COM\n• **Engineering Practices**: Strict typing, automated testing, Conventional Commits";
  }

  // Education
  if (q.includes('education') || q.includes('college') || q.includes('university') || q.includes('niet') || q.includes('study')) {
    return "*Woof!* 🎓 *Sits attentively* Deepak is pursuing his **B.Tech in Computer Science & Engineering (AI Twin)** at **Noida Institute of Engineering and Technology (NIET)**, Greater Noida.";
  }

  // Resume
  if (q.includes('resume') || q.includes('cv')) {
    return "*Woof woof!* 📄 *Fetches resume* You can view and download Deepak's verified resume right here: [Open Resume PDF](/resume.pdf)!";
  }

  // Contact
  if (q.includes('contact') || q.includes('email') || q.includes('reach') || q.includes('hire') || q.includes('linkedin') || q.includes('github')) {
    return "*Woof!* 📬 *Wags tail happily* You can contact Deepak here:\n\n• **Email**: [deepakrakshit505@gmail.com](mailto:deepakrakshit505@gmail.com)\n• **LinkedIn**: [linkedin.com/in/deepakrakshit](https://linkedin.com/in/deepakrakshit)\n• **GitHub**: [github.com/deepakrakshit](https://github.com/deepakrakshit)\n• **Portfolio**: [www.deepakrakshit.me](https://www.deepakrakshit.me)";
  }

  // Identity & Who is Deepak
  if (q.includes('who is') || q.includes('about') || q.includes('deepak')) {
    return "*Woof!* 🐶 *Perks ears attentively* **Deepak Rakshit** is an **AI Engineer Intern** and Systems Developer pursuing a B.Tech in CSE (AI Twin) at **NIET**, Greater Noida.\n\nHe specializes in:\n• **Agentic AI & Reasoning**: Autonomous tool calling, policy guardrails, and hybrid retrieval.\n• **Low-Latency Audio**: Windows WASAPI loopback capture and acoustic echo cancellation.\n• **Distributed Systems**: Production FastAPI and Node.js microservices with Redis worker queues.\n\nHe won **1st Prize** at Mind to Machine and his team **Unit8** is nominated for **Smart India Hackathon 2026**!";
  }

  return "*Tilts head curiously* *Woof?* I didn't quite catch that! Ask me about Deepak's projects (JARVIS, Swara AI, PdfORBIT), tech stack, hackathons, or contact details!";
}

// Inter-frame synchronization bridge with 3D Desk
window.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'OPEN_BYTE_AI') {
    if (typeof openWindow === 'function') openWindow('byte');
  } else if (event.data.type === 'BYTE_FEED_TREAT') {
    feedByteTreatFromApp(false);
  }
});
