# Deepak Rakshit — 3D Developer Portfolio

An immersive 3D developer portfolio and retro desktop operating system experience.

Features an interactive 3D workstation environment rendered with Three.js, depth-occluded CSS3D CRT monitor integration, positional 3D audio, and an embedded retro Windows 95 workstation environment showcasing Deepak Rakshit's technical background, agentic AI architectures, and full-stack software systems.

---

## Technical Architecture

* **Outer 3D Environment:** Built with Three.js and WebGL. Features baked lighting maps, physical CRT curvature and scanline shaders, camera animation controls, and spatial Web Audio effects (keyboard typing, mouse clicks).
* **Display Integration:** Hybrid CSS3DRenderer seamlessly blended into the 3D scene via occlusion planes, hosting the inner desktop workstation.
* **Inner Operating System:** Self-contained retro Windows 95 desktop environment featuring interactive window management, CLI developer terminal, project showcases (JARVIS AI, PdfORBIT SaaS, Smart India Hackathon 2026), skill matrices, and embedded document viewing (`/resume.pdf`).
* **Bidirectional Event Bridge:** Real-time `window.postMessage` communication synchronizing cursor movement, keyboard events, and spatial audio between the inner OS and 3D camera rig.

---

## Author & Engineering Profile

* **Developer:** Deepak Rakshit
* **Role:** AI Engineer Intern | Agentic AI Systems | Full-Stack Development
* **Institution:** Noida Institute of Engineering and Technology (NIET), Greater Noida
* **Degree:** B.Tech in Computer Science & Engineering (AI Twin)
* **GitHub:** [github.com/deepakrakshit](https://github.com/deepakrakshit)
* **LinkedIn:** [linkedin.com/in/deepakrakshit](https://linkedin.com/in/deepakrakshit)
* **Email:** deepakrakshit505@gmail.com

---

## Featured Systems

1. **JARVIS — Personal Windows AI Operating System**
   * Control-plane-first personal AI operating system for Windows with multimodal streaming on Gemini 3.8 Live API.
   * Low-latency WASAPI loopback audio capture with PBFDAF echo cancellation (16 kHz mono PCM with barge-in).
   * 4-tier execution hierarchy: Native CLI, COM UI Automation, Playwright DOM, and Node.js JSON-RPC 2.0 CUA with closed-loop Observe-Act-Verify.
   * Autonomous WhatsApp VoIP calling and Telegram remote control.
   * [Repository: github.com/deepakrakshit/jarvis-ai](https://github.com/deepakrakshit/jarvis-ai)

2. **PdfORBIT — Production PDF SaaS Engine**
   * Production PDF utility platform with 30+ tools across 6 core categories.
   * Distributed asynchronous worker queue pipeline (Redis/RQ) with HMAC-signed download security.
   * JWT authentication with token rotation, rate limiting, and server-side Razorpay webhook validation.
   * [Live Platform: pdforbit.app](https://www.pdforbit.app/) | [Repository: github.com/deepakrakshit/pdforbit](https://github.com/deepakrakshit/pdforbit)

3. **Smart India Hackathon 2026 (SIH26117)**
   * National Finalist, Team Unit8.
   * Problem Statement SIH26117: Sovereign On-Premise Agentic AI Workbench for Confidential Industrial Work.

---

## Local Development & Setup

### Prerequisites
* Node.js 16+
* npm

### Installation

```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```

### Production Build

```bash
# Build the production assets
npm run build

# Start the production server
npm start
```

### Environment Configuration

The application supports flexible runtime configuration via environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listening port | `8080` |
| `INNER_OS_URL` | Custom Inner OS URL override | `./inner/index.html` |
| `FOLIO_EMAIL` / `SMTP_USER` | SMTP username for contact form | (Optional) |
| `FOLIO_PASSWORD` / `SMTP_PASS` | SMTP password for contact form | (Optional) |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `CONTACT_RECEIVER` | Contact form submission recipient | `deepakrakshit505@gmail.com` |

---

## Creative Attributions & Acknowledgments

* **Original 3D Workstation Concept & Architecture:** Deepak Rakshit (Open Source 2022)
* **3D Computer Model:** Mickael Boitte
* **3D Room Environment Assets:** Sean Nicolas
* **Creative WebGL Inspiration:** Bruno Simon

---

## License

This project is open-source and licensed under the [MIT License](LICENSE.md).

