import * as THREE from 'three';
import Application from '../Application';
import { AmbienceAudio, ComputerAudio } from './AudioSources';
import UIEventBus from '../UI/EventBus';

const POS_DEBUG = false;
const DEFAULT_REF_DISTANCE = 10000;
export default class Audio {
    application: Application;
    listener: THREE.AudioListener;
    context: AudioContext;
    loadedAudio: { [key in string]: LoadedAudio };
    audioPool: { [key in string]: THREE.PositionalAudio | THREE.Audio };
    audioSources: {
        computer: ComputerAudio;
        ambience: AmbienceAudio;
    };
    scene: THREE.Scene;

    constructor() {
        this.application = new Application();
        this.listener = new THREE.AudioListener();
        this.application.camera.instance.add(this.listener);
        this.loadedAudio = this.application.resources.items.audio;
        this.scene = this.application.scene;
        this.audioPool = {};

        this.audioSources = {
            computer: new ComputerAudio(this),
            ambience: new AmbienceAudio(this),
        };

        UIEventBus.on('loadingScreenDone', () => {
            setTimeout(() => {
                const AudioContext =
                    // @ts-ignore
                    window.AudioContext || window.webkitAudioContext;
                this.context = new AudioContext();
                this.context.resume();
            }, 100);
        });

        UIEventBus.on('muteToggle', (mute: boolean) => {
            this.listener.setMasterVolume(mute ? 0 : 1);
        });
    }

    playAudio(
        sourceName: string,
        options: {
            volume?: number;
            randDetuneScale?: number;
            loop?: boolean;
            filter?: {
                type: BiquadFilterType;
                frequency: number;
            };
            position?: THREE.Vector3;
            refDistance?: number;
            pitch?: number;
        } = {}
    ) {
        // Resume context if it's suspended
        if (this.context) this.context.resume();

        // Get the audio source
        sourceName = this.getRandomVariant(sourceName);

        // Setup
        const buffer = this.loadedAudio[sourceName];
        const poolKey = sourceName + '_' + Object.keys(this.audioPool).length;

        let audio: THREE.Audio<any> | THREE.PositionalAudio = new THREE.Audio(
            this.listener
        );

        if (options.position) {
            audio = new THREE.PositionalAudio(this.listener);

            // @ts-ignore
            audio.setRefDistance(options.refDistance || DEFAULT_REF_DISTANCE);
            // @ts-ignore
            // audio.setDistanceModel('linear');

            const extraMaterialOptions = !POS_DEBUG
                ? {
                      transparent: true,
                      opacity: 0,
                  }
                : {};

            const sphere = new THREE.SphereGeometry(100, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                ...extraMaterialOptions,
            });
            const mesh = new THREE.Mesh(sphere, material);

            mesh.position.copy(options.position);
            mesh.name = poolKey;
            this.scene.add(mesh);
        }
        audio.setBuffer(buffer);

        if (options.filter) {
            const ac = audio.context;
            const filter = ac.createBiquadFilter();
            filter.type = options.filter.type; // Low pass filter
            filter.frequency.setValueAtTime(
                options.filter.frequency,
                ac.currentTime
            );
            // filter.frequency.linearRampToValueAtTime(2400, ac.currentTime + 2);

            audio.setFilter(filter);
        }

        // Set options
        audio.setLoop(options.loop ? true : false);
        audio.setVolume(options.volume || 1);

        audio.play();

        // add a filter to the audio

        // Calculate detune
        const detuneAmount =
            (Math.random() * 200 - 100) *
            (options.randDetuneScale ? options.randDetuneScale : 0);

        // Set detune after .play is called
        audio.setDetune(detuneAmount);

        if (options.pitch) {
            audio.setDetune(options.pitch * 100);
        }

        // Add to pool
        if (audio.source) {
            audio.source.onended = () => {
                delete this.audioPool[poolKey];
                if (options.position) {
                    const positionalObject =
                        this.scene.getObjectByName(poolKey);
                    if (positionalObject) {
                        this.scene.remove(positionalObject);
                    }
                }
            };
            this.audioPool[poolKey] = audio;
        }
        return poolKey;
    }

    setAudioFilterFrequency(audio: string, frequency: number) {
        const a = this.audioPool[audio];

        if (a) {
            const ac = a.context;
            const filter = a.getFilter() as BiquadFilterNode;
            // clamp the frequency between 0 and 22500
            const f = Math.max(0, Math.min(22050, frequency));

            filter.frequency.setValueAtTime(f, ac.currentTime);
        }
    }

    setAudioVolume(audio: string, volume: number) {
        const a = this.audioPool[audio];
        if (a) {
            a.setVolume(volume);
        }
    }

    getRandomVariant(sourceName: string) {
        const variants = [];
        for (const key in this.loadedAudio) {
            if (key.includes(sourceName)) {
                variants.push(key);
            }
        }
        return variants[Math.floor(Math.random() * variants.length)];
    }

    playSynthesized(type: string, volume: number = 0.7) {
        try {
            const ctx = this.listener.context;
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const masterInput = this.listener.getInput();
            const now = ctx.currentTime;

            if (type === 'coffee') {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const clinkGain = ctx.createGain();
                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(2200, now);
                osc2.frequency.setValueAtTime(3400, now);
                clinkGain.gain.setValueAtTime(0.6 * volume, now);
                clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc1.connect(clinkGain);
                osc2.connect(clinkGain);
                clinkGain.connect(masterInput);
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.2);
                osc2.stop(now + 0.2);

                const bufferSize = Math.floor(ctx.sampleRate * 0.25);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(520, now + 0.08);
                filter.Q.setValueAtTime(4.0, now + 0.08);
                const gulpGain = ctx.createGain();
                gulpGain.gain.setValueAtTime(0.4 * volume, now + 0.08);
                gulpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                noise.connect(filter);
                filter.connect(gulpGain);
                gulpGain.connect(masterInput);
                noise.start(now + 0.08);
                noise.stop(now + 0.3);
            } else if (type === 'plant') {
                const bufferSize = Math.floor(ctx.sampleRate * 0.35);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1400, now);
                filter.frequency.exponentialRampToValueAtTime(700, now + 0.35);
                filter.Q.setValueAtTime(2.5, now);
                const rustleGain = ctx.createGain();
                rustleGain.gain.setValueAtTime(0.45 * volume, now);
                rustleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                noise.connect(filter);
                filter.connect(rustleGain);
                rustleGain.connect(masterInput);
                noise.start(now);
                noise.stop(now + 0.35);

                const chime = ctx.createOscillator();
                const chimeGain = ctx.createGain();
                chime.type = 'sine';
                chime.frequency.setValueAtTime(1760, now + 0.05);
                chimeGain.gain.setValueAtTime(0.2 * volume, now + 0.05);
                chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                chime.connect(chimeGain);
                chimeGain.connect(masterInput);
                chime.start(now + 0.05);
                chime.stop(now + 0.4);
            } else if (type === 'chair') {
                const osc = ctx.createOscillator();
                const squeakGain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(420, now);
                osc.frequency.linearRampToValueAtTime(780, now + 0.12);
                osc.frequency.exponentialRampToValueAtTime(320, now + 0.28);
                squeakGain.gain.setValueAtTime(0.35 * volume, now);
                squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(squeakGain);
                squeakGain.connect(masterInput);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'paper') {
                const bufferSize = Math.floor(ctx.sampleRate * 0.2);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(2400, now);
                filter.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
                filter.Q.setValueAtTime(3.0, now);
                const paperGain = ctx.createGain();
                paperGain.gain.setValueAtTime(0.5 * volume, now);
                paperGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                noise.connect(filter);
                filter.connect(paperGain);
                paperGain.connect(masterInput);
                noise.start(now);
                noise.stop(now + 0.2);
            } else if (type === 'computer') {
                for (let step = 0; step < 5; step++) {
                    const stepTime = now + step * 0.045;
                    const osc = ctx.createOscillator();
                    const stepGain = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(180 + step * 25, stepTime);
                    stepGain.gain.setValueAtTime(0.25 * volume, stepTime);
                    stepGain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.035);
                    osc.connect(stepGain);
                    stepGain.connect(masterInput);
                    osc.start(stepTime);
                    osc.stop(stepTime + 0.04);
                }
            } else if (type === 'binder') {
                const osc = ctx.createOscillator();
                const snapGain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);
                snapGain.gain.setValueAtTime(0.4 * volume, now);
                snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.connect(snapGain);
                snapGain.connect(masterInput);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'degauss') {
                const osc = ctx.createOscillator();
                const degaussGain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(90, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.7);
                degaussGain.gain.setValueAtTime(0.7 * volume, now);
                degaussGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
                osc.connect(degaussGain);
                degaussGain.connect(masterInput);
                osc.start(now);
                osc.stop(now + 0.8);
            } else if (type === 'desk') {
                const osc = ctx.createOscillator();
                const tapGain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
                tapGain.gain.setValueAtTime(0.5 * volume, now);
                tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.connect(tapGain);
                tapGain.connect(masterInput);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'dog') {
                // Cheerful puppy bark / yip
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(520, now);
                osc1.frequency.exponentialRampToValueAtTime(780, now + 0.05);
                osc1.frequency.exponentialRampToValueAtTime(380, now + 0.12);
                gain1.gain.setValueAtTime(0.55 * volume, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc1.connect(gain1);
                gain1.connect(masterInput);
                osc1.start(now);
                osc1.stop(now + 0.15);

                // Second playful yip
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(620, now + 0.11);
                osc2.frequency.exponentialRampToValueAtTime(880, now + 0.16);
                osc2.frequency.exponentialRampToValueAtTime(460, now + 0.22);
                gain2.gain.setValueAtTime(0.5 * volume, now + 0.11);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
                osc2.connect(gain2);
                gain2.connect(masterInput);
                osc2.start(now + 0.11);
                osc2.stop(now + 0.25);

                // Collar brass bell jingle
                const bell = ctx.createOscillator();
                const bellGain = ctx.createGain();
                bell.type = 'sine';
                bell.frequency.setValueAtTime(3200, now + 0.04);
                bellGain.gain.setValueAtTime(0.25 * volume, now + 0.04);
                bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                bell.connect(bellGain);
                bellGain.connect(masterInput);
                bell.start(now + 0.04);
                bell.stop(now + 0.36);
            } else if (type === 'treat') {
                // 1. Crunchy dog biscuit bites (two quick crunches)
                for (let bite = 0; bite < 2; bite++) {
                    const biteTime = now + bite * 0.08;
                    const bufferSize = Math.floor(ctx.sampleRate * 0.05);
                    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                    const output = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1400 + bite * 300, biteTime);
                    filter.Q.setValueAtTime(3, biteTime);

                    const crunchGain = ctx.createGain();
                    crunchGain.gain.setValueAtTime(0.45 * volume, biteTime);
                    crunchGain.gain.exponentialRampToValueAtTime(0.001, biteTime + 0.045);

                    noise.connect(filter);
                    filter.connect(crunchGain);
                    crunchGain.connect(masterInput);
                    noise.start(biteTime);
                    noise.stop(biteTime + 0.05);
                }

                // 2. Cheerful sparkling rising chime (3-note happy arpeggio)
                const notes = [1046.5, 1318.5, 1567.98]; // C6, E6, G6
                notes.forEach((freq, idx) => {
                    const noteTime = now + 0.14 + idx * 0.07;
                    const chimeOsc = ctx.createOscillator();
                    const chimeGain = ctx.createGain();
                    chimeOsc.type = 'sine';
                    chimeOsc.frequency.setValueAtTime(freq, noteTime);
                    chimeGain.gain.setValueAtTime(0.32 * volume, noteTime);
                    chimeGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

                    chimeOsc.connect(chimeGain);
                    chimeGain.connect(masterInput);
                    chimeOsc.start(noteTime);
                    chimeOsc.stop(noteTime + 0.3);
                });
            } else if (type === 'dog_yawn') {
                // Soft puppy yawn / sleepy sigh
                const yawnOsc = ctx.createOscillator();
                const yawnGain = ctx.createGain();
                yawnOsc.type = 'sine';
                yawnOsc.frequency.setValueAtTime(420, now);
                yawnOsc.frequency.exponentialRampToValueAtTime(220, now + 0.45);
                yawnGain.gain.setValueAtTime(0.001, now);
                yawnGain.gain.linearRampToValueAtTime(0.22 * volume, now + 0.12);
                yawnGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

                yawnOsc.connect(yawnGain);
                yawnGain.connect(masterInput);
                yawnOsc.start(now);
                yawnOsc.stop(now + 0.52);
            } else if (type === 'dog_purr') {
                // Gentle rhythmic puppy purr / happy flutter
                const bufferSize = Math.floor(ctx.sampleRate * 0.35);
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    const flutter = Math.sin((i / ctx.sampleRate) * Math.PI * 32);
                    data[i] = (Math.random() * 2 - 1) * 0.4 * (0.5 + 0.5 * flutter);
                }
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(320, now);
                const purrGain = ctx.createGain();
                purrGain.gain.setValueAtTime(0.001, now);
                purrGain.gain.linearRampToValueAtTime(0.28 * volume, now + 0.05);
                purrGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
                noise.connect(filter);
                filter.connect(purrGain);
                purrGain.connect(masterInput);
                noise.start(now);
                noise.stop(now + 0.35);

                // Sweet subtle heart harmonic chime
                const osc = ctx.createOscillator();
                const oscGain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.2);
                oscGain.gain.setValueAtTime(0.12 * volume, now);
                oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
                osc.connect(oscGain);
                oscGain.connect(masterInput);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'toy_bounce') {
                // Cheerful toy bounce with subtle rubber squeak
                const squeak = ctx.createOscillator();
                const squeakGain = ctx.createGain();
                squeak.type = 'sine';
                squeak.frequency.setValueAtTime(980, now);
                squeak.frequency.exponentialRampToValueAtTime(1450, now + 0.04);
                squeak.frequency.exponentialRampToValueAtTime(720, now + 0.12);
                squeakGain.gain.setValueAtTime(0.35 * volume, now);
                squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                squeak.connect(squeakGain);
                squeakGain.connect(masterInput);
                squeak.start(now);
                squeak.stop(now + 0.15);

                // Desk thud bounce
                const thud = ctx.createOscillator();
                const thudGain = ctx.createGain();
                thud.type = 'triangle';
                thud.frequency.setValueAtTime(220, now + 0.02);
                thud.frequency.exponentialRampToValueAtTime(90, now + 0.1);
                thudGain.gain.setValueAtTime(0.4 * volume, now + 0.02);
                thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                thud.connect(thudGain);
                thudGain.connect(masterInput);
                thud.start(now + 0.02);
                thud.stop(now + 0.13);
            } else if (type === 'dog_stretch') {
                // Puppy wake-up stretch yawn with sweet pitch glide
                const stretchOsc = ctx.createOscillator();
                const stretchGain = ctx.createGain();
                stretchOsc.type = 'sine';
                stretchOsc.frequency.setValueAtTime(320, now);
                stretchOsc.frequency.exponentialRampToValueAtTime(480, now + 0.2);
                stretchOsc.frequency.exponentialRampToValueAtTime(260, now + 0.55);
                stretchGain.gain.setValueAtTime(0.001, now);
                stretchGain.gain.linearRampToValueAtTime(0.3 * volume, now + 0.15);
                stretchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                stretchOsc.connect(stretchGain);
                stretchGain.connect(masterInput);
                stretchOsc.start(now);
                stretchOsc.stop(now + 0.62);
            }
        } catch (e) {
            console.warn('Audio synthesis fallback error:', e);
        }
    }

    update() {
        for (const key in this.audioSources) {
            const _key = key as keyof typeof this.audioSources;
            this.audioSources[_key].update();
        }
    }
}

// AudioContext resume on interaction gesture
