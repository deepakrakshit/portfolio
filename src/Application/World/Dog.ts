import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import Application from '../Application';
import Time from '../Utils/Time';
import ToyBone, { addOutline, createCapsuleGeometry, createContactShadow, createMatcapTexture, ss } from './ToyBone';

export type DogPosture = 'alert' | 'sleep' | 'stretch' | 'fetch';

/* ========================================================================== */
/*  Constants & palette                                                       */
/* ========================================================================== */

const BASE_POSITION = new THREE.Vector3(-1150, -450, 720);
const BASE_ROTATION_Y = Math.PI * 0.16;
const IDLE_SLEEP_MS = 40000;

const PAD_RADIUS = 128; // charging ring radius
const PAD_TOP = 32; // height of the cushion surface above the desk
const RUN_SPEED = 380;
const MOUTH_REACH = 138; // distance from Byte's origin to his mouth while he stands
const DROP_LOCAL = new THREE.Vector3(150, 0, 62); // where the bone is dropped, in model space
const GLOW = 0x39e5ff;

const COL_ORANGE = new THREE.Color(0xf6a04a);
const COL_ORANGE_DEEP = new THREE.Color(0xd9732a);
const COL_CREAM = new THREE.Color(0xfff2df);

type MatcapKind = 'soft' | 'glossy' | 'plush';
type ParticleKind = 'heart' | 'spark' | 'zzz';
type FetchPhase = 'idle' | 'wait' | 'run' | 'grab' | 'carry' | 'drop';

interface Particle {
    sprite: THREE.Sprite;
    vel: THREE.Vector3;
    kind: ParticleKind;
    active: boolean;
    age: number;
    life: number;
    baseScale: number;
    phase: number;
}

interface EyeRig {
    root: THREE.Group;
    inner: THREE.Group;
    arc: THREE.Mesh;
    side: number;
}

interface EarRig {
    pivot: THREE.Group;
    side: number;
}

interface FrontLegRig {
    pivot: THREE.Group;
    stretch: THREE.Group;
    paw: THREE.Mesh;
    side: number;
}

interface HindLegRig {
    pivot: THREE.Group;
    thigh: THREE.Mesh;
    leg: THREE.Group;
    side: number;
}

interface FetchState {
    phase: FetchPhase;
    toy: ToyBone | null;
    timer: number;
    grabbed: boolean;
    dropped: boolean;
    onDone?: () => void;
}

const damp = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

function approachAngle(cur: number, target: number, rate: number, dt: number): number {
    const d = ((((target - cur + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    return cur + d * (1 - Math.exp(-rate * dt));
}

/** Unit sphere stretched to an ellipsoid with painted vertex colours + analytic normals (no seam artefacts). */
function paintedEllipsoid(
    rx: number,
    ry: number,
    rz: number,
    paint: (p: THREE.Vector3, out: THREE.Color) => void,
    wSeg = 48,
    hSeg = 32,
): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(1, wSeg, hSeg);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        paint(p, c);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        n.set(p.x / rx, p.y / ry, p.z / rz).normalize();
        nor.setXYZ(i, n.x, n.y, n.z);
        pos.setXYZ(i, p.x * rx, p.y * ry, p.z * rz);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
}

const paintTorso = (p: THREE.Vector3, out: THREE.Color): void => {
    const cream = Math.max(ss(0.0, -0.5, p.y), ss(0.35, 0.8, p.z) * ss(0.55, -0.05, p.y));
    const deep = ss(0.2, 0.85, p.y) * 0.55;
    out.copy(COL_ORANGE).lerp(COL_ORANGE_DEEP, deep).lerp(COL_CREAM, cream);
};

const paintHead = (p: THREE.Vector3, out: THREE.Color): void => {
    const ax = Math.abs(p.x);
    const muzzle = ss(0.12, -0.35, p.y) * ss(0.15, 0.55, p.z);
    const cheek = ss(0.42, 0.78, ax) * ss(0.25, -0.2, p.y) * ss(-0.25, 0.3, p.z);
    const blaze = ss(0.17, 0.06, ax) * ss(0.35, 0.75, p.y) * ss(0.0, 0.45, p.z) * 0.9;
    const cream = Math.max(muzzle, cheek, blaze);
    const deep = ss(-0.1, -0.8, p.z) * 0.45 + ss(0.5, 0.95, p.y) * 0.25;
    out.copy(COL_ORANGE).lerp(COL_ORANGE_DEEP, deep).lerp(COL_CREAM, cream);
};

/* ========================================================================== */
/*  Dog                                                                       */
/* ========================================================================== */

export default class Dog {
    private application: Application;
    private scene: THREE.Scene;
    protected time: Time;
    private cameraInstance: THREE.Camera;

    private localTweenGroup: TWEEN.Group = new TWEEN.Group();

    /* ---- scene graph ---- */
    private model = new THREE.Group(); // base transform on the desk
    private cushion!: THREE.Mesh;
    private rig = new THREE.Group(); // walks around the desk, faces travel direction
    private bodyRoot = new THREE.Group(); // hop / squash / spin
    private torso = new THREE.Group();
    private torsoMesh!: THREE.Mesh;
    private head = new THREE.Group();
    private headCenter = new THREE.Group();
    private mouthObj = new THREE.Object3D();
    private tongue!: THREE.Mesh;
    private mouthInside!: THREE.Mesh;
    private smileArcs: THREE.Mesh[] = [];
    private blushes: THREE.Mesh[] = [];
    private eyes: EyeRig[] = [];
    private ears: EarRig[] = [];
    private frontLegs: FrontLegRig[] = [];
    private hindLegs: HindLegRig[] = [];
    private tailBase = new THREE.Group();
    private tailJoints: THREE.Group[] = [];
    private tuft = new THREE.Group();
    private tag = new THREE.Group();
    private hitMesh!: THREE.Mesh;
    private dogShadow!: THREE.Mesh;
    private glowMat = new THREE.MeshBasicMaterial({ color: GLOW });
    private ledMats: THREE.MeshBasicMaterial[] = [];

    /* ---- particles ---- */
    private particles: Particle[] = [];
    private heartTex!: THREE.CanvasTexture;
    private sparkTex!: THREE.CanvasTexture;
    private zTexA!: THREE.CanvasTexture;
    private zTexB!: THREE.CanvasTexture;

    /* ---- state ---- */
    private posture: DogPosture = 'alert';
    private lastFrame = performance.now();
    private elapsed = 0;
    private lastInteraction = performance.now();

    private hovering = false;
    private petHold = 0;
    private petAmt = 0;
    private happy = 0;
    private lastHeartAt = 0;

    private excite = 0.15;
    private tailBoostUntil = 0;
    private wagPhase = 0;
    private breathPhase = 0;
    private gaitPhase = 0;

    private sitAmt = 1;
    private sleepAmt = 0;
    private runAmt = 0;
    private bowAmt = 0;
    private bowTarget = 0;
    private speed = 0;
    private facingTarget = 0;

    private blinkClock = 2.5;
    private blinkProgress = -1;
    private earPerk = 0;
    private earTwitch = [0, 0];
    private nextTwitchIn = 5;
    private headRoll = 0;
    private gazeYaw = 0;
    private gazePitch = 0;
    private zzzTimer = 0.4;
    private nextSparkAt = 0;

    private fx = { hop: 0, squash: 0, spin: 0, stretch: 0 };
    private isBouncing = false;
    private isSpinning = false;

    private fetch: FetchState = { phase: 'idle', toy: null, timer: 0, grabbed: false, dropped: false };

    private mouse = new THREE.Vector2(0, 0);
    private tmpV = new THREE.Vector3();
    private tmpV2 = new THREE.Vector3();
    private tmpV3 = new THREE.Vector3();

    private onMessage = (event: MessageEvent): void => {
        if (event.data?.type === 'BYTE_APP_EVENT') {
            const action = event.data.action;
            if (action === 'opened' || action === 'perk') this.wakeUp(false);
            else if (action === 'treat') this.spin(this.localTweenGroup);
        }
    };

    private onPointerMove = (event: PointerEvent): void => {
        this.mouse.set((event.clientX / window.innerWidth) * 2 - 1, -((event.clientY / window.innerHeight) * 2 - 1));
    };

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.time = this.application.time;
        this.cameraInstance = this.application.camera.instance;

        this.buildPad();
        this.buildDog();
        this.buildHitMesh();
        this.buildParticles();

        this.model.position.copy(BASE_POSITION);
        this.model.rotation.y = BASE_ROTATION_Y;
        this.scene.add(this.model);

        window.addEventListener('message', this.onMessage);
        window.addEventListener('pointermove', this.onPointerMove);

        this.applyPose(0.016);
    }

    /* ======================================================================== */
    /*  Public API                                                              */
    /* ======================================================================== */

    public getHitMesh(): THREE.Mesh {
        return this.hitMesh;
    }

    public update(): void {
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.0001, (now - this.lastFrame) / 1000));
        this.lastFrame = now;
        this.elapsed += dt;

        this.localTweenGroup.update();

        // Idle -> sleep
        if (
            this.posture === 'alert' &&
            this.fetch.phase === 'idle' &&
            !this.isSpinning &&
            !this.isBouncing &&
            !this.hovering &&
            this.petHold <= 0 &&
            now - this.lastInteraction > IDLE_SLEEP_MS
        ) {
            this.goToSleep();
        }

        this.updateFetch(dt);
        this.updateStates(dt, now);
        this.updateGaze(dt);
        this.applyPose(dt);
        this.updateEmitters(dt, now);
        this.updateParticles(dt);
        this.updatePad(dt);
    }

    public handleHoverEnter(): void {
        this.hovering = true;
        this.registerInteraction();
        if (this.posture === 'sleep') {
            this.wakeUp(true);
            return;
        }
        this.earPerk = 1;
        this.emitSparkles(2, 36);
    }

    public handleHoverLeave(): void {
        this.hovering = false;
    }

    public handlePetStroke(deltaDistance: number): void {
        this.registerInteraction();
        if (this.posture === 'sleep') {
            this.wakeUp(true);
            return;
        }
        // Works whether the caller sends pixels or normalised units.
        this.petAmt = Math.min(1, this.petAmt + clamp(Math.abs(deltaDistance) * 0.02, 0.01, 0.12));
        this.petHold = 0.35;
    }

    public stopPetting(): void {
        this.petHold = 0;
    }

    public get isPetting(): boolean {
        return this.petHold > 0;
    }

    public bounce(tweenGroup?: TWEEN.Group, onComplete?: () => void): void {
        this.registerInteraction();
        if (this.posture === 'sleep') {
            this.wakeUp(true);
            onComplete?.();
            return;
        }
        if (this.isBouncing || this.isSpinning) {
            onComplete?.();
            return;
        }
        this.isBouncing = true;
        const group = tweenGroup ?? this.localTweenGroup;
        const fx = this.fx;

        this.bark(0.85);
        this.earPerk = 1;
        this.emitHeartBurst(3);

        const land = new TWEEN.Tween(fx, group).to({ squash: 0 }, 380).easing(TWEEN.Easing.Elastic.Out).onComplete(() => {
            this.isBouncing = false;
            onComplete?.();
        });
        const fall = new TWEEN.Tween(fx, group).to({ hop: 0, squash: 0.8 }, 210).easing(TWEEN.Easing.Quadratic.In).chain(land);
        const up = new TWEEN.Tween(fx, group).to({ hop: 1, squash: -0.6 }, 230).easing(TWEEN.Easing.Quadratic.Out).chain(fall);
        new TWEEN.Tween(fx, group).to({ squash: 1 }, 110).easing(TWEEN.Easing.Quadratic.Out).chain(up).start();
    }

    public spin(tweenGroup: TWEEN.Group, onComplete?: () => void): void {
        this.registerInteraction();
        if (this.posture === 'sleep') this.wakeUp(false);
        if (this.isSpinning || this.isBouncing) {
            onComplete?.();
            return;
        }
        this.isSpinning = true;
        const group = tweenGroup ?? this.localTweenGroup;
        const fx = this.fx;

        this.bark(0.85);
        this.earPerk = 1;
        this.tailBoostUntil = Math.max(this.tailBoostUntil, performance.now() + 2200);
        this.emitSparkles(10, 60);
        this.emitHeartBurst(4);

        const hopDown = new TWEEN.Tween(fx, group).to({ hop: 0 }, 450).easing(TWEEN.Easing.Bounce.Out);
        new TWEEN.Tween(fx, group).to({ hop: 1 }, 330).easing(TWEEN.Easing.Quadratic.Out).chain(hopDown).start();

        new TWEEN.Tween(fx, group)
            .to({ spin: Math.PI * 2 }, 900)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                fx.spin = 0;
                this.isSpinning = false;
                this.emitSparkles(6, 50);
                onComplete?.();
            })
            .start();
    }

    public fetchToy(toy: ToyBone, onDone?: () => void): void {
        this.registerInteraction();
        if (this.fetch.phase !== 'idle') return;
        this.fetch = { phase: 'wait', toy, timer: 0, grabbed: false, dropped: false, onDone };
        if (this.posture === 'sleep') this.wakeUp(false);
    }

    public wakeUp(playAudio = true): void {
        this.registerInteraction();
        if (this.posture === 'stretch') return;

        if (this.posture === 'sleep') {
            this.posture = 'stretch';
            if (playAudio) this.bark(0.6);
            this.emitSparkles(4, 44);
            const fx = this.fx;
            const g = this.localTweenGroup;
            const release = new TWEEN.Tween(fx, g)
                .to({ stretch: 0 }, 600)
                .easing(TWEEN.Easing.Cubic.InOut)
                .onComplete(() => {
                    if (this.posture === 'stretch') this.posture = 'alert';
                    this.registerInteraction();
                });
            const hold = new TWEEN.Tween(fx, g).to({ stretch: 1 }, 450).chain(release);
            new TWEEN.Tween(fx, g).to({ stretch: 1 }, 650).easing(TWEEN.Easing.Cubic.Out).chain(hold).start();
            return;
        }

        // Already awake: just perk up.
        this.earPerk = 1;
        this.tailBoostUntil = Math.max(this.tailBoostUntil, performance.now() + 1400);
        this.miniHop(0.35);
    }

    public goToSleep(): void {
        if (this.posture !== 'alert' || this.fetch.phase !== 'idle' || this.isSpinning || this.isBouncing) return;
        this.posture = 'sleep';
        this.zzzTimer = 0.5;
    }

    public registerInteraction(): void {
        this.lastInteraction = performance.now();
    }

    public accelerateTail(durationMs = 1500): void {
        this.tailBoostUntil = Math.max(this.tailBoostUntil, performance.now() + durationMs);
    }

    /** Optional clean-up (not part of the contract). */
    public dispose(): void {
        window.removeEventListener('message', this.onMessage);
        window.removeEventListener('pointermove', this.onPointerMove);
        this.scene.remove(this.model);
        for (const p of this.particles) this.scene.remove(p.sprite);
    }

    /* ======================================================================== */
    /*  Building: pad                                                           */
    /* ======================================================================== */

    private mat(kind: MatcapKind, color: number | THREE.Color, vertexColors = false): THREE.MeshMatcapMaterial {
        return new THREE.MeshMatcapMaterial({ matcap: createMatcapTexture(kind), color, vertexColors });
    }

    private makeTextTexture(text: string, w: number, h: number, font: string, color: string): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d') as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, w, h);
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, h / 2 + 1);
        return new THREE.CanvasTexture(c);
    }

    private buildPad(): void {
        const pad = new THREE.Group();
        this.model.add(pad);

        const navy = this.mat('glossy', 0x2a3150);
        const navyDark = this.mat('soft', 0x1f2644);

        // Charging platform
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(142, 150, 9, 72), navy);
        plate.position.y = 4.5;
        addOutline(plate, 2.2);
        pad.add(plate);

        const plateTop = new THREE.Mesh(new THREE.CylinderGeometry(132, 141, 5, 72), navyDark);
        plateTop.position.y = 11.5;
        pad.add(plateTop);

        // Glowing inductive ring + chasing LEDs
        const ring = new THREE.Mesh(new THREE.TorusGeometry(PAD_RADIUS, 2.4, 10, 96), this.glowMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 14.4;
        pad.add(ring);

        const ledGeo = new THREE.SphereGeometry(3.4, 12, 10);
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const m = new THREE.MeshBasicMaterial({ color: GLOW });
            const led = new THREE.Mesh(ledGeo, m);
            led.position.set(Math.cos(a) * 139, 10.5, Math.sin(a) * 139);
            this.ledMats.push(m);
            pad.add(led);
        }

        // Etched label on the front edge
        const strip = new THREE.Mesh(
            new THREE.PlaneGeometry(54, 6),
            new THREE.MeshBasicMaterial({
                map: this.makeTextTexture('BYTE // CHARGING', 512, 56, '700 40px monospace', '#46f0ff'),
                transparent: true,
                depthWrite: false,
            }),
        );
        strip.position.set(0, 4.6, 148.6);
        pad.add(strip);

        // Quilted plush cushion (real geometry displacement -> diamond puffs)
        const R = 112;
        const squash = 20 / R;
        const geo = new THREE.SphereGeometry(R, 72, 32);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const colors = new Float32Array(pos.count * 3);
        const base = new THREE.Color(0x4cb7c9);
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const r = Math.hypot(x, z) / R;
            let ny = y * squash;
            let puff = 0;
            if (y > 0) {
                const u = (x + z) * 0.05;
                const v = (x - z) * 0.05;
                puff = Math.pow(Math.abs(Math.sin(u)), 0.7) * Math.pow(Math.abs(Math.sin(v)), 0.7);
                ny += 4.2 * puff * ss(1.0, 0.72, r) * ss(0, 14, y);
            }
            pos.setY(i, ny);
            const shade = y > 0 ? 0.72 + 0.28 * puff : 0.8;
            c.copy(base).multiplyScalar(shade);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        this.cushion = new THREE.Mesh(geo, this.mat('plush', 0xffffff, true));
        this.cushion.position.y = 12;
        pad.add(this.cushion);

        // Cream piping around the cushion edge
        const piping = new THREE.Mesh(new THREE.TorusGeometry(108, 6, 14, 96), this.mat('soft', 0xfff2df));
        piping.rotation.x = Math.PI / 2;
        piping.position.y = 14;
        addOutline(piping, 1.6);
        pad.add(piping);

        // Soft contact shadow under the whole pad
        const shadow = createContactShadow(205, 0.85);
        shadow.position.y = 1.4;
        this.model.add(shadow);
    }

    /* ======================================================================== */
    /*  Building: Byte                                                          */
    /* ======================================================================== */

    private buildDog(): void {
        this.model.add(this.rig);
        this.rig.add(this.bodyRoot);
        this.bodyRoot.add(this.torso);

        const fur = this.mat('soft', 0xffffff, true);

        // Torso (ellipsoid, hip pivot at torso origin)
        this.torsoMesh = new THREE.Mesh(paintedEllipsoid(50, 47, 64, paintTorso), fur);
        this.torsoMesh.position.z = 10;
        addOutline(this.torsoMesh, 2.4);
        this.torso.add(this.torsoMesh);

        this.buildTail();
        this.buildLegs();
        this.buildHead(fur);
        this.buildCollar();

        // Soft shadow that follows Byte around the desk
        this.dogShadow = createContactShadow(98, 0.9);
        this.dogShadow.position.y = 1.5;
        this.rig.add(this.dogShadow);
    }

    private buildTail(): void {
        const orange = this.mat('soft', 0xf6a04a);
        const cream = this.mat('soft', 0xfff2df);
        const sphere = new THREE.SphereGeometry(1, 24, 18);
        const radii = [13, 12.5, 12, 11, 10.5];

        this.tailBase.position.set(0, 4, -56);
        this.torso.add(this.tailBase);

        let parent: THREE.Object3D = this.tailBase;
        radii.forEach((r, i) => {
            const joint = new THREE.Group();
            if (i > 0) joint.position.z = -15;
            parent.add(joint);
            const seg = new THREE.Mesh(sphere, i === radii.length - 1 ? cream : orange);
            seg.scale.setScalar(r);
            addOutline(seg, 1.8);
            joint.add(seg);
            this.tailJoints.push(joint);
            parent = joint;
        });

        // Cyber LED on the tail tip
        const led = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 12), this.glowMat);
        led.position.set(0, 8.5, -3);
        this.tailJoints[this.tailJoints.length - 1].add(led);
    }

    private buildLegs(): void {
        const orange = this.mat('soft', 0xf6a04a);
        const orangeDeep = this.mat('soft', 0xe08330);
        const cream = this.mat('soft', 0xfff2df);
        const sphere = new THREE.SphereGeometry(1, 24, 16);
        const legGeo = createCapsuleGeometry(13.5, 30, 20, 8);
        const shinGeo = createCapsuleGeometry(11, 16, 18, 8);

        for (const side of [1, -1]) {
            // Front leg
            const pivot = new THREE.Group();
            pivot.position.set(side * 27, -10, 40);
            this.torso.add(pivot);
            const stretch = new THREE.Group();
            pivot.add(stretch);
            const leg = new THREE.Mesh(legGeo, orange);
            leg.position.y = -26;
            addOutline(leg, 2);
            stretch.add(leg);
            const paw = new THREE.Mesh(sphere, cream);
            paw.scale.set(15.5, 11, 19);
            paw.position.set(0, -47, 5);
            addOutline(paw, 1.8);
            stretch.add(paw);
            this.frontLegs.push({ pivot, stretch, paw, side });
        }

        for (const side of [1, -1]) {
            // Hind leg (haunch + shin + foot)
            const pivot = new THREE.Group();
            this.bodyRoot.add(pivot);
            const thigh = new THREE.Mesh(sphere, orangeDeep);
            thigh.scale.set(30, 34, 36);
            addOutline(thigh, 2);
            pivot.add(thigh);
            const leg = new THREE.Group();
            pivot.add(leg);
            const shin = new THREE.Mesh(shinGeo, orange);
            shin.position.y = -22;
            leg.add(shin);
            const foot = new THREE.Mesh(sphere, cream);
            foot.scale.set(14, 10, 20);
            foot.position.set(0, -40, 8);
            addOutline(foot, 1.6);
            leg.add(foot);
            this.hindLegs.push({ pivot, thigh, leg, side });
        }
    }

    private buildHead(fur: THREE.MeshMatcapMaterial): void {
        const cream = this.mat('soft', 0xfff2df);
        const orangeDeep = this.mat('soft', 0xe08330);
        const pink = this.mat('soft', 0xff8fa8);
        const dark = this.mat('glossy', 0x24182e);
        const sphere = new THREE.SphereGeometry(1, 28, 20);

        this.head.rotation.order = 'YXZ';
        this.head.position.set(0, 28, 54);
        this.torso.add(this.head);
        this.headCenter.position.set(0, 22, 16);
        this.head.add(this.headCenter);
        const hc = this.headCenter;

        // Skull
        const skull = new THREE.Mesh(paintedEllipsoid(58, 51, 54, paintHead, 56, 40), fur);
        addOutline(skull, 2.6);
        hc.add(skull);

        // Chubby cheek fluff
        for (const side of [1, -1]) {
            const cheek = new THREE.Mesh(sphere, cream);
            cheek.scale.set(16, 14, 18);
            cheek.position.set(side * 42, -14, 16);
            hc.add(cheek);
        }

        // Muzzle, nose, mouth
        const muzzle = new THREE.Mesh(sphere, cream);
        muzzle.scale.set(27, 20, 29);
        muzzle.position.set(0, -17, 34);
        addOutline(muzzle, 2);
        hc.add(muzzle);

        const nose = new THREE.Mesh(sphere, dark);
        nose.scale.set(9.5, 7, 7);
        nose.position.set(0, -6, 61.5);
        hc.add(nose);

        const philtrum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 8, 6), dark);
        philtrum.position.set(0, -15, 61.8);
        hc.add(philtrum);

        const arcGeo = new THREE.TorusGeometry(6.5, 1.5, 8, 20, Math.PI);
        for (const side of [1, -1]) {
            const arc = new THREE.Mesh(arcGeo, dark);
            arc.position.set(side * 6.8, -20.5, 61.6);
            arc.rotation.z = Math.PI;
            hc.add(arc);
            this.smileArcs.push(arc);
        }

        this.mouthInside = new THREE.Mesh(sphere, this.mat('soft', 0x5c1830));
        this.mouthInside.scale.set(7.5, 0.01, 4);
        this.mouthInside.position.set(0, -24, 58);
        this.mouthInside.visible = false;
        hc.add(this.mouthInside);

        this.tongue = new THREE.Mesh(sphere, pink);
        this.tongue.scale.set(5.4, 0.01, 5.5);
        this.tongue.position.set(0, -26, 60);
        this.tongue.visible = false;
        hc.add(this.tongue);

        this.mouthObj.position.set(0, -25, 64);
        hc.add(this.mouthObj);

        // Brow spots
        for (const side of [1, -1]) {
            const spot = new THREE.Mesh(sphere, cream);
            spot.scale.set(7, 5, 3);
            spot.position.set(side * 24, 22, 44);
            spot.rotation.y = side * 0.35;
            hc.add(spot);
        }

        // Blush
        for (const side of [1, -1]) {
            const blush = new THREE.Mesh(
                new THREE.CircleGeometry(8, 20),
                new THREE.MeshBasicMaterial({ color: 0xff7a9a, transparent: true, opacity: 0, depthWrite: false }),
            );
            blush.scale.set(1.5, 0.85, 1);
            blush.position.set(side * 38, -9, 41);
            blush.rotation.y = side * 1.0;
            hc.add(blush);
            this.blushes.push(blush);
        }

        // Eyes
        const eyeMat = this.mat('glossy', 0x1d1430);
        const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const irisMat = new THREE.MeshBasicMaterial({ color: 0x2fb4d6, transparent: true, opacity: 0.8 });
        const arcMat = new THREE.MeshBasicMaterial({ color: 0x2a1a30 });
        const lidGeo = new THREE.TorusGeometry(8.5, 2.1, 8, 22, Math.PI);
        for (const side of [1, -1]) {
            const root = new THREE.Group();
            root.position.set(side * 26, 5, 45.5);
            root.rotation.y = side * 0.42;
            hc.add(root);
            const inner = new THREE.Group();
            root.add(inner);

            const ball = new THREE.Mesh(sphere, eyeMat);
            ball.scale.set(10.5, 13.5, 6.5);
            inner.add(ball);
            const iris = new THREE.Mesh(sphere, irisMat);
            iris.scale.set(6.8, 5.2, 1.2);
            iris.position.set(0, -4, 6.0);
            inner.add(iris);
            const g1 = new THREE.Mesh(sphere, glint);
            g1.scale.setScalar(3.6);
            g1.position.set(3.2, 5.2, 6.1);
            inner.add(g1);
            const g2 = new THREE.Mesh(sphere, glint);
            g2.scale.setScalar(1.8);
            g2.position.set(-3.6, -2.8, 6.3);
            inner.add(g2);

            const arc = new THREE.Mesh(lidGeo, arcMat);
            arc.position.z = 5.5;
            arc.visible = false;
            root.add(arc);

            this.eyes.push({ root, inner, arc, side });
        }

        // Ears
        const earGeo = new THREE.CylinderGeometry(4.5, 24, 50, 28, 1);
        for (const side of [1, -1]) {
            const pivot = new THREE.Group();
            pivot.position.set(side * 36, 37, -6);
            hc.add(pivot);
            const ear = new THREE.Mesh(earGeo, orangeDeep);
            ear.position.y = 23;
            ear.scale.z = 0.52;
            addOutline(ear, 1.8);
            pivot.add(ear);
            const inner = new THREE.Mesh(earGeo, pink);
            inner.position.set(0, 20, 8);
            inner.scale.set(0.62, 0.76, 0.3);
            pivot.add(inner);
            this.ears.push({ pivot, side });
        }

        // Cowlick tuft with a glowing LED tip
        this.tuft.position.set(0, 49, 14);
        hc.add(this.tuft);
        const tuftMesh = new THREE.Mesh(createCapsuleGeometry(3.4, 12, 12, 6), orangeDeep);
        tuftMesh.position.y = 8;
        this.tuft.add(tuftMesh);
        const tuftLed = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), this.glowMat);
        tuftLed.position.y = 18;
        this.tuft.add(tuftLed);
    }

    private buildCollar(): void {
        const collar = new THREE.Group();
        collar.position.set(0, 8, 40);
        collar.rotation.x = -0.9;
        this.torso.add(collar);

        const band = new THREE.Mesh(new THREE.TorusGeometry(44, 5.8, 14, 64), this.mat('glossy', 0x25305a));
        collar.add(band);

        // Glowing stripe (flattened torus, sits proud of the band)
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(44, 6.3, 8, 64), this.glowMat);
        stripe.scale.z = 0.32;
        collar.add(stripe);

        // Dangling tag with a canvas-drawn face
        this.tag.position.set(0, -47, 2);
        collar.add(this.tag);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 3.4, 28), this.glowMat);
        this.tag.add(rim);

        const tagTex = this.makeTagTexture();
        const face = new THREE.Mesh(new THREE.CircleGeometry(12.4, 28), new THREE.MeshBasicMaterial({ map: tagTex }));
        face.rotation.x = Math.PI / 2;
        face.position.y = -1.9;
        this.tag.add(face);

        const hook = new THREE.Mesh(new THREE.TorusGeometry(3.2, 1, 8, 16), this.glowMat);
        hook.position.y = 15;
        hook.rotation.y = Math.PI / 2;
        this.tag.add(hook);
    }

    private makeTagTexture(): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d') as CanvasRenderingContext2D;
        const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
        g.addColorStop(0, '#27406e');
        g.addColorStop(1, '#101a38');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(64, 64, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#46f0ff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(64, 64, 54, 0, Math.PI * 2);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#46f0ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#c9fbff';
        ctx.font = '900 34px "Trebuchet MS", Arial, sans-serif';
        ctx.fillText('BYTE', 64, 56);
        ctx.font = '700 17px monospace';
        ctx.fillText('01001', 64, 86);
        return new THREE.CanvasTexture(c);
    }

    private buildHitMesh(): void {
        this.hitMesh = new THREE.Mesh(
            new THREE.BoxGeometry(170, 250, 170),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        this.hitMesh.name = 'dog';
        this.hitMesh.position.set(0, 110, 20);
        this.rig.add(this.hitMesh);
    }

    /* ======================================================================== */
    /*  Particles (hearts, sparkles, Zzz)                                       */
    /* ======================================================================== */

    private buildParticles(): void {
        this.heartTex = this.makeHeartTexture();
        this.sparkTex = this.makeSparkTexture();
        this.zTexA = this.makeZTexture('Z');
        this.zTexB = this.makeZTexture('z');

        for (let i = 0; i < 44; i++) {
            const m = new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, depthWrite: false, opacity: 0 });
            const sprite = new THREE.Sprite(m);
            sprite.visible = false;
            sprite.renderOrder = 20;
            this.scene.add(sprite);
            this.particles.push({ sprite, vel: new THREE.Vector3(), kind: 'heart', active: false, age: 0, life: 1, baseScale: 30, phase: 0 });
        }
    }

    private makeHeartTexture(): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d') as CanvasRenderingContext2D;
        ctx.translate(64, 70);
        ctx.shadowColor = 'rgba(255,90,140,0.9)';
        ctx.shadowBlur = 14;
        const g = ctx.createLinearGradient(-30, -40, 30, 30);
        g.addColorStop(0, '#ffb3cf');
        g.addColorStop(1, '#ff3d7f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.bezierCurveTo(-52, -14, -30, -52, 0, -26);
        ctx.bezierCurveTo(30, -52, 52, -14, 0, 22);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(-20, -22, 9, 5, -0.6, 0, Math.PI * 2);
        ctx.fill();
        return new THREE.CanvasTexture(c);
    }

    private makeSparkTexture(): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d') as CanvasRenderingContext2D;
        ctx.translate(64, 64);
        ctx.shadowColor = 'rgba(70,240,255,0.95)';
        ctx.shadowBlur = 16;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, '#a8f6ff');
        g.addColorStop(1, '#46f0ff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -52);
        ctx.quadraticCurveTo(5, -5, 52, 0);
        ctx.quadraticCurveTo(5, 5, 0, 52);
        ctx.quadraticCurveTo(-5, 5, -52, 0);
        ctx.quadraticCurveTo(-5, -5, 0, -52);
        ctx.fill();
        return new THREE.CanvasTexture(c);
    }

    private makeZTexture(letter: string): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d') as CanvasRenderingContext2D;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'italic 900 96px "Trebuchet MS", "Comic Sans MS", Arial, sans-serif';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(70,240,255,0.95)';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#2a1f55';
        ctx.strokeText(letter, 64, 68);
        ctx.shadowBlur = 0;
        const g = ctx.createLinearGradient(0, 20, 0, 110);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#8cefff');
        ctx.fillStyle = g;
        ctx.fillText(letter, 64, 68);
        return new THREE.CanvasTexture(c);
    }

    private emit(kind: ParticleKind, pos: THREE.Vector3, vel: THREE.Vector3, life: number, scale: number): void {
        const p = this.particles.find((q) => !q.active);
        if (!p) return;
        p.active = true;
        p.kind = kind;
        p.age = 0;
        p.life = life;
        p.baseScale = scale;
        p.phase = Math.random() * 6.28;
        p.sprite.position.copy(pos);
        p.vel.copy(vel);
        const m = p.sprite.material as THREE.SpriteMaterial;
        m.map = kind === 'heart' ? this.heartTex : kind === 'spark' ? this.sparkTex : Math.random() < 0.5 ? this.zTexA : this.zTexB;
        m.rotation = kind === 'spark' ? rand(0, 3) : rand(-0.25, 0.25);
        m.opacity = 0;
        p.sprite.scale.setScalar(0.01);
        p.sprite.visible = true;
    }

    private emitHeart(): void {
        this.headCenter.getWorldPosition(this.tmpV);
        const toCam = this.tmpV2.copy(this.cameraInstance.position).sub(this.tmpV).normalize();
        const pos = this.tmpV.clone().addScaledVector(toCam, 40);
        pos.x += rand(-46, 46);
        pos.y += rand(52, 82);
        pos.z += rand(-20, 20);
        this.emit('heart', pos, new THREE.Vector3(rand(-14, 14), rand(46, 72), 0), rand(1.1, 1.6), rand(26, 38));
    }

    private emitHeartBurst(count: number): void {
        for (let i = 0; i < count; i++) this.emitHeart();
    }

    private emitSparkles(count: number, radius: number): void {
        this.headCenter.getWorldPosition(this.tmpV);
        const toCam = this.tmpV2.copy(this.cameraInstance.position).sub(this.tmpV).normalize();
        for (let i = 0; i < count; i++) {
            const dir = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize();
            const pos = this.tmpV.clone().addScaledVector(toCam, 30).addScaledVector(dir, radius * rand(0.5, 1.1));
            pos.y += 20;
            this.emit('spark', pos, dir.multiplyScalar(rand(40, 110)), rand(0.6, 1.1), rand(12, 22));
        }
    }

    private emitZzz(): void {
        this.headCenter.getWorldPosition(this.tmpV);
        const pos = this.tmpV.clone();
        pos.x += rand(18, 34);
        pos.y += rand(46, 60);
        this.emit('zzz', pos, new THREE.Vector3(rand(14, 22), rand(30, 42), 0), rand(2.4, 3.1), rand(22, 30));
    }

    private updateParticles(dt: number): void {
        for (const p of this.particles) {
            if (!p.active) continue;
            p.age += dt;
            const k = p.age / p.life;
            if (k >= 1) {
                p.active = false;
                p.sprite.visible = false;
                continue;
            }
            const m = p.sprite.material as THREE.SpriteMaterial;
            p.sprite.position.addScaledVector(p.vel, dt);

            if (p.kind === 'heart') {
                p.sprite.position.x += Math.sin(p.age * 5 + p.phase) * 18 * dt;
                p.sprite.scale.setScalar(p.baseScale * ss(0, 0.18, k) * (1 + 0.12 * Math.sin(p.age * 9)));
                m.opacity = 1 - ss(0.65, 1, k);
            } else if (p.kind === 'spark') {
                p.vel.y -= 120 * dt;
                p.vel.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
                m.rotation += 3 * dt;
                p.sprite.scale.setScalar(p.baseScale * Math.pow(1 - k, 0.6) * (0.8 + 0.2 * Math.sin(p.age * 24)));
                m.opacity = 1;
            } else {
                p.sprite.position.x += Math.sin(p.age * 2.4 + p.phase) * 10 * dt;
                p.sprite.scale.setScalar(p.baseScale * (0.55 + 0.95 * k));
                m.opacity = ss(0, 0.12, k) * (1 - ss(0.6, 1, k));
            }
        }
    }

    /* ======================================================================== */
    /*  Behaviour                                                               */
    /* ======================================================================== */

    private bark(volume = 0.85): void {
        this.application.world?.audioManager?.playSynthesized('dog', volume);
    }

    private miniHop(height: number): void {
        if (this.isBouncing || this.isSpinning) return;
        this.isBouncing = true;
        const down = new TWEEN.Tween(this.fx, this.localTweenGroup)
            .to({ hop: 0 }, 180)
            .easing(TWEEN.Easing.Quadratic.In)
            .onComplete(() => {
                this.isBouncing = false;
            });
        new TWEEN.Tween(this.fx, this.localTweenGroup).to({ hop: height }, 140).easing(TWEEN.Easing.Quadratic.Out).chain(down).start();
    }

    private toyLocal(toy: ToyBone, out: THREE.Vector3): THREE.Vector3 {
        toy.getHitMesh().getWorldPosition(out);
        this.model.updateWorldMatrix(true, false);
        return this.model.worldToLocal(out);
    }

    private finishFetch(): void {
        const cb = this.fetch.onDone;
        this.fetch = { phase: 'idle', toy: null, timer: 0, grabbed: false, dropped: false };
        this.bowTarget = 0;
        this.posture = 'alert';
        this.registerInteraction();
        this.earPerk = 1;
        cb?.();
    }

    private updateFetch(dt: number): void {
        const f = this.fetch;
        let desired = 0;

        switch (f.phase) {
            case 'idle': {
                this.facingTarget = 0;
                break;
            }
            case 'wait': {
                if (this.posture === 'sleep') {
                    this.wakeUp(false);
                    break;
                }
                if (this.posture === 'stretch') break;
                if (!f.toy) {
                    this.finishFetch();
                    break;
                }
                if (f.toy.isFlying()) {
                    // Watch the bone sail through the air.
                    const tp = this.toyLocal(f.toy, this.tmpV3);
                    this.facingTarget = Math.atan2(tp.x - this.rig.position.x, tp.z - this.rig.position.z);
                    break;
                }
                this.posture = 'fetch';
                f.phase = 'run';
                f.timer = 0;
                this.bark(0.85);
                this.earPerk = 1;
                this.miniHop(0.4);
                break;
            }
            case 'run': {
                f.timer += dt;
                if (!f.toy || f.timer > 9) {
                    f.phase = 'carry'; // give up and trot home
                    break;
                }
                const tp = this.toyLocal(f.toy, this.tmpV3);
                const dx = tp.x - this.rig.position.x;
                const dz = tp.z - this.rig.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist > 6) this.facingTarget = Math.atan2(dx, dz);
                if (dist > MOUTH_REACH + 4) {
                    desired = RUN_SPEED * (0.35 + 0.65 * clamp((dist - MOUTH_REACH) / 90, 0, 1));
                } else if (!f.toy.isFlying()) {
                    f.phase = 'grab';
                    f.timer = 0;
                    this.bowTarget = 1;
                }
                break;
            }
            case 'grab': {
                f.timer += dt;
                if (f.toy) {
                    const tp = this.toyLocal(f.toy, this.tmpV3);
                    const dx = tp.x - this.rig.position.x;
                    const dz = tp.z - this.rig.position.z;
                    if (Math.hypot(dx, dz) > 6) this.facingTarget = Math.atan2(dx, dz);
                }
                if (!f.grabbed && f.timer > 0.32 && f.toy) {
                    f.grabbed = true;
                    f.toy.attachToMouth(this.mouthObj);
                    this.emitSparkles(5, 40);
                }
                if (f.timer > 0.62) {
                    f.phase = 'carry';
                    this.bowTarget = 0;
                }
                break;
            }
            case 'carry': {
                const dx = -this.rig.position.x;
                const dz = -this.rig.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist > 14) {
                    this.facingTarget = Math.atan2(dx, dz);
                    desired = RUN_SPEED * (0.3 + 0.7 * clamp((dist - 14) / 90, 0, 1));
                } else {
                    f.phase = 'drop';
                    f.timer = 0;
                }
                break;
            }
            case 'drop': {
                f.timer += dt;
                this.facingTarget = 0;
                if (f.timer > 0.2) this.bowTarget = 1;
                if (!f.dropped && f.timer > 0.6) {
                    f.dropped = true;
                    if (f.grabbed && f.toy) {
                        const world = this.model.localToWorld(DROP_LOCAL.clone());
                        f.toy.resetToDesk(world);
                    }
                    this.emitHeartBurst(3);
                    this.emitSparkles(5, 44);
                    this.bark(0.5);
                }
                if (f.timer > 0.95) this.bowTarget = 0;
                if (f.timer > 1.3) this.finishFetch();
                break;
            }
        }

        // Locomotion
        this.speed = damp(this.speed, desired, desired > this.speed ? 6 : 10, dt);
        if (this.speed > 0.4) {
            const yaw = this.rig.rotation.y;
            this.rig.position.x += Math.sin(yaw) * this.speed * dt;
            this.rig.position.z += Math.cos(yaw) * this.speed * dt;
        }
        this.rig.rotation.y = approachAngle(this.rig.rotation.y, this.facingTarget, 11, dt);
    }

    private updateStates(dt: number, now: number): void {
        const phase = this.fetch.phase;
        const moving = phase === 'run' || phase === 'carry' || phase === 'grab';

        // Excitement drives tail speed
        let target = 0.14;
        if (this.hovering) target = 0.5;
        if (this.petHold > 0) target = 1;
        if (now < this.tailBoostUntil) target = Math.max(target, 0.95);
        if (this.isSpinning) target = 1;
        if (moving) target = Math.max(target, 0.9);
        if (this.posture === 'sleep') target = 0;
        this.excite = damp(this.excite, target, 5, dt);

        // Petting
        if (this.petHold > 0) this.petHold -= dt;
        this.petAmt = Math.max(0, this.petAmt - dt * 0.5);
        this.happy = damp(this.happy, this.petHold > 0 || this.petAmt > 0.15 ? 1 : 0, 7, dt);

        // Posture blends
        this.sitAmt = damp(this.sitAmt, moving ? 0 : 1, moving ? 9 : 5, dt);
        this.sleepAmt = damp(this.sleepAmt, this.posture === 'sleep' ? 1 : 0, this.posture === 'sleep' ? 2.2 : 6, dt);
        this.runAmt = damp(this.runAmt, clamp(this.speed / (RUN_SPEED * 0.7), 0, 1), 10, dt);
        this.bowAmt = damp(this.bowAmt, this.bowTarget, 9, dt);

        // Ears & curiosity
        this.earPerk = Math.max(0, this.earPerk - dt * 1.4);
        this.headRoll = damp(this.headRoll, this.hovering && this.posture !== 'sleep' ? 0.2 : 0, 6, dt);
        this.nextTwitchIn -= dt;
        if (this.nextTwitchIn <= 0 && this.posture !== 'sleep') {
            this.earTwitch[Math.random() < 0.5 ? 0 : 1] = 1;
            this.nextTwitchIn = rand(4, 9);
        }
        this.earTwitch[0] = Math.max(0, this.earTwitch[0] - dt * 3);
        this.earTwitch[1] = Math.max(0, this.earTwitch[1] - dt * 3);

        // Blinking
        this.blinkClock -= dt;
        if (this.blinkClock <= 0 && this.blinkProgress < 0) this.blinkProgress = 0;
        if (this.blinkProgress >= 0) {
            this.blinkProgress += dt / 0.2;
            if (this.blinkProgress >= 1) {
                this.blinkProgress = -1;
                this.blinkClock = Math.random() < 0.2 ? 0.18 : rand(2.2, 5.2);
            }
        }
    }

    private updateEmitters(dt: number, now: number): void {
        if (this.petHold > 0 && now - this.lastHeartAt > 170) {
            this.lastHeartAt = now;
            this.emitHeart();
            if (Math.random() < 0.4) this.emitSparkles(1, 40);
        }
        if (this.isSpinning && now > this.nextSparkAt) {
            this.nextSparkAt = now + 110;
            this.emitSparkles(2, 70);
        }
        if (this.sleepAmt > 0.7 && this.posture === 'sleep') {
            this.zzzTimer -= dt;
            if (this.zzzTimer <= 0) {
                this.zzzTimer = rand(1.1, 1.6);
                this.emitZzz();
            }
        }
    }

    /** Head + eyes follow the cursor (cursor is unprojected into a point in front of Byte, then converted to rig space). */
    private updateGaze(dt: number): void {
        let yawT = 0;
        let pitchT = 0;
        const awake = 1 - this.sleepAmt;

        if (awake > 0.05) {
            this.rig.updateWorldMatrix(true, false);
            this.headCenter.getWorldPosition(this.tmpV);
            const camPos = this.cameraInstance.position;
            const dist = camPos.distanceTo(this.tmpV);

            this.tmpV2.set(this.mouse.x, this.mouse.y, 0.5).unproject(this.cameraInstance);
            this.tmpV2.sub(camPos).normalize().multiplyScalar(dist * 0.6).add(camPos);

            const headL = this.rig.worldToLocal(this.tmpV.clone());
            const tgtL = this.rig.worldToLocal(this.tmpV2.clone());
            const dx = tgtL.x - headL.x;
            const dy = tgtL.y - headL.y;
            const dz = tgtL.z - headL.z;
            if (dz > -20) {
                yawT = clamp(Math.atan2(dx, Math.max(dz, 1)), -1.0, 1.0);
                pitchT = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.35, 0.5);
            }
        }
        this.gazeYaw = damp(this.gazeYaw, yawT * awake, 7, dt);
        this.gazePitch = damp(this.gazePitch, pitchT * awake, 7, dt);
    }

    /* ======================================================================== */
    /*  Pose solver                                                             */
    /* ======================================================================== */

    private applyPose(dt: number): void {
        const t = this.elapsed;
        const sit = this.sitAmt;
        const sleep = this.sleepAmt;
        const stretch = this.fx.stretch;
        const run = this.runAmt;
        const happy = this.happy;

        // Blend (stand, sit, sleep, stretch) with sit -> sleep -> stretch priority.
        const mix = (stand: number, sitV: number, sleepV: number, stretchV: number): number => {
            const a = stand + (sitV - stand) * sit;
            const b = a + (sleepV - a) * sleep;
            return b + (stretchV - b) * stretch;
        };

        // --- gait & breathing ---
        this.gaitPhase += dt * 15 * run;
        const g1 = Math.sin(this.gaitPhase);
        const g2 = -g1;
        const bob = Math.abs(Math.sin(this.gaitPhase));

        this.breathPhase += dt * (mix(2.2, 2.2, 1.15, 2.6) + run * 6);
        const breath = Math.sin(this.breathPhase);
        const bs = breath * (mix(0.016, 0.016, 0.04, 0.03) + run * 0.02);

        // --- tail wag speed ---
        this.wagPhase += dt * (sleep > 0.5 ? 1.1 : 4.5 + 11 * this.excite);

        // --- body root: hop, squash, spin ---
        const sq = this.fx.squash;
        this.bodyRoot.scale.set(1 + 0.09 * sq, 1 - 0.18 * sq, 1 + 0.09 * sq);
        this.bodyRoot.position.y = this.fx.hop * 56 + bob * 7 * run;
        this.bodyRoot.rotation.y = this.fx.spin;

        // --- torso ---
        const bowS = this.bowAmt * (1 - sit) * (1 - sleep);
        const hipY = mix(68, 55, 40, 72) - 20 * bowS;
        const pitch = mix(0, -0.55, -0.06, 0.5) + 0.5 * bowS + Math.sin(this.gaitPhase * 2 + 1.2) * 0.07 * run + 0.06 * run;
        this.torso.position.y = hipY;
        this.torso.rotation.x = pitch;
        this.torso.rotation.z = Math.sin(t * 5.5) * 0.035 * happy * (1 - sleep);
        this.torso.rotation.y = Math.sin(this.wagPhase) * 0.05 * this.excite * (1 - run) * (1 - sleep);
        this.torsoMesh.scale.set(1 + bs * 0.8, mix(1, 1, 0.8, 1) * (1 + bs), 1 + bs * 0.6);

        // --- head ---
        this.head.position.set(0, mix(28, 28, 12, 22), mix(54, 54, 62, 58));
        const headDip = this.bowAmt * (1 - sleep) * (0.38 * (1 - sit) + 0.25 * sit);
        const hx =
            -pitch * mix(1, 1, 0.3, 0.9) +
            mix(0, 0, 0.3, -0.05) +
            headDip +
            0.1 * happy +
            breath * 0.01 -
            this.gazePitch * 0.65 * (1 - sleep);
        const sway = Math.sin(t * 0.7) * 0.025 * (1 - sleep);
        this.head.rotation.set(
            hx,
            this.gazeYaw * 0.72 + mix(0, 0, 0.55, 0) + sway,
            this.headRoll + mix(0, 0, 0.32, 0) - this.gazeYaw * 0.08 + Math.sin(t * 7) * 0.045 * happy,
        );

        // --- eyes ---
        const blinkClosed = this.blinkProgress >= 0 ? Math.sin(this.blinkProgress * Math.PI) : 0;
        const squint = Math.max(happy, sleep, ss(0.35, 0.9, stretch));
        const arcOn = squint > 0.5;
        const sleepyArc = sleep > happy && sleep > 0.5;
        const gx = clamp(this.gazeYaw, -1, 1) * 3.2 * (1 - sleep);
        const gy = clamp(this.gazePitch, -0.6, 0.6) * 4 * (1 - sleep);
        for (const eye of this.eyes) {
            eye.arc.visible = arcOn;
            eye.inner.visible = !arcOn;
            eye.arc.rotation.z = sleepyArc ? Math.PI : 0;
            eye.inner.position.set(gx, gy, 0);
            eye.inner.scale.y = Math.max(0.06, 1 - blinkClosed);
        }

        // --- mouth ---
        const carrying = this.fetch.grabbed && !this.fetch.dropped;
        let mouthOpen = Math.max(this.excite > 0.8 ? 0.3 : 0, happy * 0.55, ss(0.4, 1, stretch));
        mouthOpen += (0.2 + 0.2 * Math.sin(t * 18)) * run;
        if (sleep > 0.6) mouthOpen = 0;
        mouthOpen = clamp(mouthOpen, 0, 1);
        if (carrying) mouthOpen = 0;
        this.mouthInside.visible = mouthOpen > 0.05;
        this.mouthInside.scale.set(7.5, 0.01 + mouthOpen * 8.5, 4);
        this.tongue.visible = mouthOpen > 0.12;
        this.tongue.scale.set(5.4, 0.01 + mouthOpen * 4.2, 5.5);
        this.tongue.position.y = -26 - mouthOpen * 3;
        for (const arc of this.smileArcs) arc.visible = mouthOpen < 0.3;
        for (const b of this.blushes) (b.material as THREE.MeshBasicMaterial).opacity = happy * 0.7;

        // --- ears ---
        const flare = mix(0.34, 0.34, 0.95, 0.5) + happy * 0.35 + run * 0.4 - this.earPerk * 0.22;
        const earX = mix(0.12, 0.12, -0.28, 0.25) + this.earPerk * 0.25 + this.fx.hop * 0.4 - run * 0.45;
        this.ears.forEach((ear, i) => {
            const tw = this.earTwitch[i];
            ear.pivot.rotation.z = -ear.side * (flare + Math.sin(t * 14 + i) * 0.05 * run);
            ear.pivot.rotation.x = earX + Math.sin(tw * Math.PI) * 0.5;
        });
        this.tuft.rotation.z = Math.sin(t * 2.2) * 0.12 + Math.sin(t * 9) * 0.05 * run + happy * Math.sin(t * 8) * 0.2;
        this.tuft.rotation.x = -0.15 + breath * 0.05;

        // --- tail ---
        const wagAmp = (0.08 + 0.24 * this.excite) * (1 - 0.85 * sleep);
        const curl = mix(0.26, 0.26, 0.1, 0.3);
        this.tailBase.rotation.x = mix(0.5, 1.35, 0.4, 0.8);
        this.tailJoints.forEach((joint, i) => {
            joint.rotation.y = Math.sin(this.wagPhase - i * 0.6) * wagAmp * (0.55 + 0.18 * i) + sleep * 0.38;
            joint.rotation.x = curl + i * 0.02;
        });

        // --- front legs ---
        const legStretch = mix(1, 1.17, 1, 1);
        const legExtra = mix(0, 0, -1.5, -1.05);
        this.frontLegs.forEach((leg, i) => {
            const swing = (i === 0 ? g1 : g2) * 0.95 * run;
            leg.pivot.position.y = mix(-10, -10, -22, -10);
            leg.pivot.rotation.x = -pitch + legExtra + swing;
            leg.stretch.scale.y = legStretch;
            leg.paw.scale.set(15.5, 11 / legStretch, 19);
        });

        // --- hind legs ---
        this.hindLegs.forEach((hl, i) => {
            const swing = (i === 0 ? g2 : g1) * 0.95 * run * (1 - sit) * (1 - sleep);
            hl.pivot.position.set(hl.side * mix(34, 40, 38, 36), mix(50, 12, 12, 56), mix(-34, -24, -22, -36));
            hl.leg.rotation.x = mix(0, -1.4, -1.1, 0) + swing;
            hl.thigh.scale.y = mix(34, 24, 22, 34);
            hl.thigh.position.y = mix(0, 12, 12, 0);
        });

        // --- collar tag swing ---
        this.tag.rotation.x = Math.sin(t * 3 + 1) * 0.06 + Math.sin(this.gaitPhase * 2) * 0.25 * run;

        // --- rig height: step up onto the cushion, down onto the desk ---
        const distPad = Math.hypot(this.rig.position.x, this.rig.position.z);
        const onPad = 1 - ss(PAD_RADIUS - 30, PAD_RADIUS + 14, distPad);
        this.rig.position.y = PAD_TOP * onPad;
        this.cushion.scale.y = 1 - 0.07 * onPad * sit;

        // --- shadow shrinks while airborne ---
        const air = this.fx.hop * 0.6 + bob * 0.08 * run;
        this.dogShadow.position.y = 1.5 + 2.7 * onPad;
        this.dogShadow.scale.setScalar(1 / (1 + air));
        (this.dogShadow.material as THREE.MeshBasicMaterial).opacity = (0.9 - 0.3 * onPad) / (1 + air);
    }

    /* ======================================================================== */
    /*  Pad animation                                                           */
    /* ======================================================================== */

    private updatePad(dt: number): void {
        void dt;
        const t = this.elapsed;
        const asleep = this.sleepAmt;
        const speed = 2.2 + this.excite * 4;
        const pulse = (0.72 + 0.28 * Math.sin(t * speed)) * (1 - 0.35 * asleep);
        this.glowMat.color.setRGB(0.16 * pulse, 0.88 * pulse, pulse);

        this.ledMats.forEach((m, i) => {
            const chase = Math.pow(Math.max(0, Math.sin(t * (3 + this.excite * 4) - i * 0.4)), 2);
            const calm = 0.3 + 0.2 * Math.sin(t * 1.2 + i * 0.3);
            const b = asleep > 0.5 ? calm * 0.8 : 0.25 + 0.75 * chase;
            m.color.setRGB(0.1 * b, 0.9 * b, b);
        });
    }
}