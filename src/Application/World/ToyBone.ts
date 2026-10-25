import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import Application from '../Application';
import AudioManager from '../Audio/AudioManager';

/* ========================================================================== */
/*  Shared procedural helpers (also imported by Dog.ts)                       */
/* ========================================================================== */

export type MatcapKind = 'soft' | 'glossy' | 'plush';

/** Smoothstep that also works with reversed edges (e0 > e1). */
export function ss(e0: number, e1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
}

const MATCAP_CONFIG: Record<MatcapKind, { bands: number; spec: number; shin: number; rim: number; wrap: number }> = {
    soft: { bands: 0.55, spec: 0.14, shin: 22, rim: 0.3, wrap: 0.5 },
    glossy: { bands: 0.7, spec: 1.0, shin: 70, rim: 0.34, wrap: 0.5 },
    plush: { bands: 0.15, spec: 0.04, shin: 8, rim: 0.5, wrap: 0.62 },
};

const matcapCache = new Map<MatcapKind, THREE.CanvasTexture>();

/**
 * Generates a lightless "matcap" sphere on a canvas: soft cel-banded diffuse,
 * cool violet shadows, warm rim light, cyan bounce light and a sharp specular.
 * MeshMatcapMaterial needs no scene lights, so the models look volumetric even
 * though the desk uses baked lighting.
 */
export function createMatcapTexture(kind: MatcapKind = 'soft'): THREE.CanvasTexture {
    const cached = matcapCache.get(kind);
    if (cached) return cached;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.createImageData(size, size);
    const cfg = MATCAP_CONFIG[kind];

    const L = new THREE.Vector3(-0.45, 0.7, 0.55).normalize();
    const H = L.clone().add(new THREE.Vector3(0, 0, 1)).normalize();
    const n = new THREE.Vector3();
    const shadow = new THREE.Color(0.52, 0.47, 0.7);
    const light = new THREE.Color(1.0, 0.985, 0.95);

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const nx = ((px + 0.5) / size) * 2 - 1;
            const ny = 1 - ((py + 0.5) / size) * 2;
            const r2 = nx * nx + ny * ny;
            if (r2 < 1) n.set(nx, ny, Math.sqrt(1 - r2));
            else n.set(nx, ny, 0).normalize();

            const ndl = n.dot(L);
            const wrapped = Math.min(1, Math.max(0, (ndl + cfg.wrap) / (1 + cfg.wrap)));
            const stepped = ss(0.34, 0.6, wrapped);
            const d = stepped * cfg.bands + wrapped * (1 - cfg.bands);
            const rim = Math.pow(1 - n.z, 2.8) * cfg.rim;
            const spec = Math.pow(Math.max(0, n.dot(H)), cfg.shin) * cfg.spec;
            const bounce = Math.max(0, -n.y) * 0.1;

            const r = shadow.r + (light.r - shadow.r) * d + rim * 0.9 + spec + bounce * 0.2;
            const g = shadow.g + (light.g - shadow.g) * d + rim * 0.75 + spec + bounce * 0.85;
            const b = shadow.b + (light.b - shadow.b) * d + rim * 0.6 + spec + bounce * 1.0;

            const i = (py * size + px) * 4;
            img.data[i] = Math.min(255, Math.max(0, r * 255));
            img.data[i + 1] = Math.min(255, Math.max(0, g * 255));
            img.data[i + 2] = Math.min(255, Math.max(0, b * 255));
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    matcapCache.set(kind, tex);
    return tex;
}

let shadowTexture: THREE.CanvasTexture | null = null;

/** Soft radial blob used for fake contact shadows on the desk. */
export function createShadowTexture(): THREE.CanvasTexture {
    if (shadowTexture) return shadowTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(24,12,36,0.62)');
    g.addColorStop(0.5, 'rgba(24,12,36,0.3)');
    g.addColorStop(1, 'rgba(24,12,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    shadowTexture = new THREE.CanvasTexture(canvas);
    return shadowTexture;
}

/** Flat plane (lying on XZ) carrying the soft shadow texture. */
export function createContactShadow(radius: number, opacity = 1): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
}

/** CapsuleGeometry only exists from three r139, so build one with a lathe. Axis = Y, centred on origin. */
export function createCapsuleGeometry(radius: number, length: number, radialSegments = 20, capSegments = 8): THREE.LatheGeometry {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= capSegments; i++) {
        const a = -Math.PI / 2 + (i / capSegments) * (Math.PI / 2);
        pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * radius), -length / 2 + Math.sin(a) * radius));
    }
    for (let i = 0; i <= capSegments; i++) {
        const a = (i / capSegments) * (Math.PI / 2);
        pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * radius), length / 2 + Math.sin(a) * radius));
    }
    return new THREE.LatheGeometry(pts, radialSegments);
}

const outlineMaterials = new Map<number, THREE.MeshBasicMaterial>();

/** Inverted-hull outline (a soft plum ink line) so the characters read like polished vinyl toys. */
export function addOutline(mesh: THREE.Mesh, width = 2, color = 0x3a2038): THREE.Mesh {
    let mat = outlineMaterials.get(color);
    if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
        outlineMaterials.set(color, mat);
    }
    mesh.geometry.computeBoundingSphere();
    const r = Math.max(1, mesh.geometry.boundingSphere ? mesh.geometry.boundingSphere.radius : 10);
    const hull = new THREE.Mesh(mesh.geometry, mat);
    hull.scale.setScalar(1 + width / r);
    hull.name = 'outline';
    mesh.add(hull);
    return hull;
}

/* ========================================================================== */
/*  ToyBone                                                                   */
/* ========================================================================== */

const DESK_Y = -450;
const REST_POS = new THREE.Vector3(-1060, -428, 980);
const REST_ROT_Y = Math.PI * 0.22;
/** Lowers the visual so the lobes actually touch the desk when the group sits at y = -428. */
const FLOOR_OFFSET = -5;

interface BounceSpec {
    height: number;
    drift: number;
    ms: number;
    volume: number;
}

const BOUNCES: BounceSpec[] = [
    { height: 46, drift: 40, ms: 330, volume: 0.5 },
    { height: 18, drift: 16, ms: 230, volume: 0.3 },
    { height: 5, drift: 5, ms: 150, volume: 0.18 },
];

export default class ToyBone {
    private application: Application;
    private scene: THREE.Scene;
    protected cameraInstance: THREE.Camera;

    private tweens = new TWEEN.Group();
    public group = new THREE.Group();
    private body = new THREE.Group();
    private hitMesh: THREE.Mesh;
    private shadow: THREE.Mesh;
    private shadowMat: THREE.MeshBasicMaterial;
    private glowMat = new THREE.MeshBasicMaterial({ color: 0x35e6ff });

    private flying = false;
    private carried = false;
    private settled = false;
    private restY = REST_POS.y;

    public get isThrown(): boolean {
        return this.flying;
    }

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.cameraInstance = this.application.camera.instance;

        this.buildModel();
        this.group.add(this.body);
        this.group.position.copy(REST_POS);
        this.group.rotation.set(0, REST_ROT_Y, 0);

        // Large invisible hit box for raycasting (never drawn, still raycastable).
        this.hitMesh = new THREE.Mesh(
            new THREE.BoxGeometry(136, 54, 86),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        this.hitMesh.name = 'toy_bone';
        this.group.add(this.hitMesh);

        this.shadow = createContactShadow(78, 0.9);
        this.shadowMat = this.shadow.material as THREE.MeshBasicMaterial;
        this.shadow.position.set(REST_POS.x, DESK_Y + 1.6, REST_POS.z);
        this.shadow.scale.set(1.35, 1, 1);

        this.scene.add(this.shadow);
        this.scene.add(this.group);
    }

    /* ----------------------------------------------------------------------- */
    /*  Model                                                                  */
    /* ----------------------------------------------------------------------- */

    private buildModel(): void {
        const cream = new THREE.MeshMatcapMaterial({ matcap: createMatcapTexture('glossy'), color: 0xfff1dc });
        const teal = new THREE.MeshMatcapMaterial({ matcap: createMatcapTexture('glossy'), color: 0x2fc7cf });

        // Shaft (lathe capsule laid along X)
        const shaft = new THREE.Mesh(createCapsuleGeometry(11.5, 62, 24, 10), teal);
        shaft.rotation.z = Math.PI / 2;
        addOutline(shaft, 1.8);
        this.body.add(shaft);

        // Four plump lobes, two per end
        const lobeGeo = new THREE.SphereGeometry(16.5, 32, 22);
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                const lobe = new THREE.Mesh(lobeGeo, cream);
                lobe.position.set(sx * 36, 0, sz * 12.5);
                addOutline(lobe, 1.8);
                this.body.add(lobe);
            }
        }

        // Glowing grip rings (cyber accent that matches Byte's collar and the charging pad)
        const ringGeo = new THREE.TorusGeometry(12.4, 2.0, 10, 36);
        for (const sx of [-1, 1]) {
            const ring = new THREE.Mesh(ringGeo, this.glowMat);
            ring.rotation.y = Math.PI / 2;
            ring.position.x = sx * 19;
            this.body.add(ring);
        }

        this.body.position.y = FLOOR_OFFSET;
    }

    /* ----------------------------------------------------------------------- */
    /*  Public API                                                             */
    /* ----------------------------------------------------------------------- */

    public getHitMesh(): THREE.Mesh {
        return this.hitMesh;
    }

    /** True while the bone is in the air, bouncing, or being dropped. */
    public isFlying(): boolean {
        return this.flying;
    }

    public isCarried(): boolean {
        return this.carried;
    }

    /** Flips through the air along a parabola, lands with a squash and a few shrinking bounces. */
    public toss(targetPos: THREE.Vector3, onLanded?: () => void): void {
        if (this.carried) return;
        this.stopMotion();
        this.flying = true;

        const start = this.group.position.clone();
        const end = targetPos.clone();
        const planar = Math.hypot(end.x - start.x, end.z - start.z);
        const duration = THREE.MathUtils.clamp(560 + planar * 0.9, 700, 1250);
        const peak = 120 + planar * 0.22;
        const flipDir = end.x >= start.x ? -1 : 1;
        const startYaw = this.group.rotation.y;
        const endYaw = REST_ROT_Y + (Math.random() - 0.5) * 1.4;

        const dir = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
        if (dir.lengthSq() < 1) dir.set(1, 0, 0);
        dir.normalize();

        this.group.rotation.set(0, startYaw, 0);
        this.tweenBodyOffset(FLOOR_OFFSET, 120);

        const prog = { p: 0 };
        new TWEEN.Tween(prog, this.tweens)
            .to({ p: 1 }, duration)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(() => {
                const p = prog.p;
                this.group.position.set(
                    start.x + (end.x - start.x) * p,
                    start.y + (end.y - start.y) * p + 4 * peak * p * (1 - p),
                    start.z + (end.z - start.z) * p,
                );
                this.group.rotation.z = flipDir * Math.PI * 4 * p;
                this.group.rotation.y = startYaw + (endYaw - startYaw) * p;
            })
            .onComplete(() => {
                this.group.position.copy(end);
                this.group.rotation.set(0, endYaw, 0);
                this.restY = end.y;
                this.impact(0.85);
                this.runBounces(end, dir, 0, onLanded);
            })
            .start();
    }

    /** Re-parents the bone into the dog's mouth keeping its world pose, then glides it into the carry pose. */
    public attachToMouth(mouthObj: THREE.Object3D): void {
        this.stopMotion();
        this.carried = true;
        this.settled = false;
        this.shadow.visible = false;
        mouthObj.attach(this.group);

        const s = {
            px: this.group.position.x,
            py: this.group.position.y,
            pz: this.group.position.z,
            rx: this.group.rotation.x,
            ry: this.group.rotation.y,
            rz: this.group.rotation.z,
            by: this.body.position.y,
        };
        new TWEEN.Tween(s, this.tweens)
            .to({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, by: 0 }, 200)
            .easing(TWEEN.Easing.Back.Out)
            .onUpdate(() => {
                this.group.position.set(s.px, s.py, s.pz);
                this.group.rotation.set(s.rx, s.ry, s.rz);
                this.body.position.y = s.by;
            })
            .onComplete(() => {
                this.settled = true;
            })
            .start();
    }

    /**
     * Drops the bone back onto the desk with a little hop and a settle.
     * Pass a world position to drop it somewhere specific (Byte uses this to
     * place it neatly beside his cushion); otherwise it returns to its home spot.
     */
    public resetToDesk(dropWorldPos?: THREE.Vector3): void {
        const wasCarried = this.carried;
        this.tweens.removeAll();
        this.body.scale.set(1, 1, 1);
        if (this.group.parent !== this.scene) this.scene.attach(this.group);
        this.carried = false;
        this.settled = false;
        this.flying = true;
        this.shadow.visible = true;

        const target = dropWorldPos ? dropWorldPos.clone() : REST_POS.clone();
        target.y = REST_POS.y;
        const start = this.group.position.clone();
        const q0 = this.group.quaternion.clone();
        const yaw = dropWorldPos ? REST_ROT_Y + (Math.random() - 0.5) * 0.5 : REST_ROT_Y;
        const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
        const bodyY0 = this.body.position.y;
        const planar = Math.hypot(target.x - start.x, target.z - start.z);
        const arc = wasCarried ? 34 : 16 + planar * 0.1;
        const duration = wasCarried ? 380 : 420 + planar * 0.4;

        const prog = { p: 0 };
        new TWEEN.Tween(prog, this.tweens)
            .to({ p: 1 }, duration)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .onUpdate(() => {
                const p = prog.p;
                this.group.position.set(
                    start.x + (target.x - start.x) * p,
                    start.y + (target.y - start.y) * p + 4 * arc * p * (1 - p),
                    start.z + (target.z - start.z) * p,
                );
                this.group.quaternion.copy(q0).slerp(q1, p);
                this.body.position.y = bodyY0 + (FLOOR_OFFSET - bodyY0) * p;
            })
            .onComplete(() => {
                this.group.position.copy(target);
                this.group.quaternion.copy(q1);
                this.body.position.y = FLOOR_OFFSET;
                this.restY = target.y;
                this.flying = false;
                this.impact(wasCarried ? 0.5 : 0.35);
            })
            .start();
    }

    public update(): void {
        this.tweens.update();
        const t = performance.now() * 0.001;

        // Pulsing cyan glow on the grip rings
        const pulse = 0.72 + 0.28 * Math.sin(t * 3.2);
        this.glowMat.color.setRGB(0.2 * pulse, 0.9 * pulse, pulse);

        if (this.carried) {
            // gentle swing while Byte trots with it
            if (this.settled) {
                this.group.rotation.z = Math.sin(t * 8) * 0.06;
                this.group.rotation.x = Math.sin(t * 6.3 + 1) * 0.04;
            }
            return;
        }

        // Contact shadow follows the bone and fades with height
        const h = Math.max(0, this.group.position.y - this.restY);
        const k = 1 / (1 + h * 0.01);
        this.shadow.position.set(this.group.position.x, DESK_Y + 1.6, this.group.position.z);
        this.shadow.scale.set(1.35 * k, k, 1);
        this.shadow.rotation.z = this.group.rotation.y;
        this.shadowMat.opacity = 0.9 * k;
    }

    /* ----------------------------------------------------------------------- */
    /*  Internals                                                              */
    /* ----------------------------------------------------------------------- */

    private getAudio(): AudioManager | undefined {
        return this.application.world?.audioManager as AudioManager | undefined;
    }

    private stopMotion(): void {
        this.tweens.removeAll();
        this.flying = false;
        this.body.scale.set(1, 1, 1);
    }

    private tweenBodyOffset(to: number, ms: number): void {
        const s = { y: this.body.position.y };
        new TWEEN.Tween(s, this.tweens)
            .to({ y: to }, ms)
            .onUpdate(() => {
                this.body.position.y = s.y;
            })
            .start();
    }

    /** Landing thud: toy_bounce sound + squash & stretch recovery. */
    private impact(volume: number): void {
        this.getAudio()?.playSynthesized('toy_bounce', volume);
        const sq = { k: 1 };
        this.body.scale.set(1.16, 0.74, 1.1);
        new TWEEN.Tween(sq, this.tweens)
            .to({ k: 0 }, 320)
            .easing(TWEEN.Easing.Elastic.Out)
            .onUpdate(() => {
                this.body.scale.set(1 + 0.16 * sq.k, 1 - 0.26 * sq.k, 1 + 0.1 * sq.k);
            })
            .onComplete(() => {
                this.body.scale.set(1, 1, 1);
            })
            .start();
    }

    private runBounces(origin: THREE.Vector3, dir: THREE.Vector3, step: number, onLanded?: () => void): void {
        const spec = BOUNCES[step];
        if (!spec) {
            this.flying = false;
            this.group.position.y = this.restY;
            this.group.rotation.set(0, this.group.rotation.y, 0);
            onLanded?.();
            return;
        }

        const from = origin.clone();
        const to = origin.clone().addScaledVector(dir, spec.drift);
        const tumble = (step % 2 === 0 ? 1 : -1) * 0.3;
        const prog = { p: 0 };

        new TWEEN.Tween(prog, this.tweens)
            .to({ p: 1 }, spec.ms)
            .easing(TWEEN.Easing.Linear.None)
            .onUpdate(() => {
                const p = prog.p;
                this.group.position.set(
                    from.x + (to.x - from.x) * p,
                    this.restY + 4 * spec.height * p * (1 - p),
                    from.z + (to.z - from.z) * p,
                );
                this.group.rotation.z = Math.sin(p * Math.PI) * tumble;
            })
            .onComplete(() => {
                this.group.position.set(to.x, this.restY, to.z);
                this.group.rotation.z = 0;
                if (step < BOUNCES.length - 1) this.impact(spec.volume);
                this.runBounces(to, dir, step + 1, onLanded);
            })
            .start();
    }
}