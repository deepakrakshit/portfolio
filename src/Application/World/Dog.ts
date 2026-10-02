import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import Application from '../Application';
import Time from '../Utils/Time';
import ToyBone from './ToyBone';

export type DogPosture = 'alert' | 'sleep' | 'stretch' | 'fetch';

interface PetParticle {
    sprite: THREE.Sprite;
    active: boolean;
    life: number;
    maxLife: number;
    vx: number;
    vy: number;
    vz: number;
    baseScale: number;
}

export default class Dog {
    application: Application;
    scene: THREE.Scene;
    time: Time;
    cameraInstance: THREE.PerspectiveCamera;

    model: THREE.Group;
    dogGroup: THREE.Group;
    body: THREE.Group;
    head: THREE.Group;
    snout: THREE.Mesh;
    ears: THREE.Group;
    leftEar: THREE.Mesh;
    rightEar: THREE.Mesh;
    tail: THREE.Group;
    frontLeftPaw: THREE.Mesh;
    frontRightPaw: THREE.Mesh;
    backLeftHaunch: THREE.Mesh;
    backRightHaunch: THREE.Mesh;
    eyeLeft: THREE.Mesh;
    eyeRight: THREE.Mesh;
    glintLeft: THREE.Mesh;
    glintRight: THREE.Mesh;
    tongue: THREE.Mesh;
    hitMesh: THREE.Mesh;

    mode: DogPosture;
    lastInteractionTime: number;
    idleSleepDelayMs: number;
    isExcited: boolean;
    excitedTimeout: any;
    baseY: number;

    // Movement & state flags
    isBouncing: boolean;
    isSpinning: boolean;
    isStretching: boolean;
    isFetchingToy: boolean;

    // Blinking
    isBlinking: boolean;
    nextBlinkTime: number;

    // Gaze tracking
    mouseNDC: THREE.Vector2;
    isMouseActive: boolean;
    currentLookYaw: number;
    currentLookPitch: number;
    currentLookRoll: number;
    gazeRay: THREE.Ray;
    tempHeadWorld: THREE.Vector3;
    tempLookTarget: THREE.Vector3;
    tempLocalTarget: THREE.Vector3;

    // Petting state & particles
    isHovered: boolean;
    isPetting: boolean;
    petStrokeDistance: number;
    lastStrokeTime: number;
    lastPurrTime: number;
    lastPetParticleSpawn: number;
    petParticlesGroup: THREE.Group;
    petSprites: PetParticle[];

    localTweenGroup: TWEEN.Group;
    zzzGroup: THREE.Group;
    zzzItems: Array<{
        sprite: THREE.Sprite;
        phaseOffset: number;
        speed: number;
        xAmp: number;
        baseScale: number;
    }>;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.time = this.application.time;
        this.cameraInstance = this.application.camera.instance;

        this.mode = 'alert';
        this.lastInteractionTime = performance.now();
        this.idleSleepDelayMs = 40000;
        this.isExcited = false;
        this.excitedTimeout = null;
        this.baseY = 32;

        this.isBouncing = false;
        this.isSpinning = false;
        this.isStretching = false;
        this.isFetchingToy = false;

        this.isBlinking = false;
        this.nextBlinkTime = performance.now() + 3500;

        // Gaze tracking initialization
        this.mouseNDC = new THREE.Vector2(0, 0);
        this.isMouseActive = false;
        this.currentLookYaw = 0;
        this.currentLookPitch = 0;
        this.currentLookRoll = 0;
        this.gazeRay = new THREE.Ray();
        this.tempHeadWorld = new THREE.Vector3();
        this.tempLookTarget = new THREE.Vector3();
        this.tempLocalTarget = new THREE.Vector3();

        // Petting & hover initialization
        this.isHovered = false;
        this.isPetting = false;
        this.petStrokeDistance = 0;
        this.lastStrokeTime = 0;
        this.lastPurrTime = 0;
        this.lastPetParticleSpawn = 0;
        this.petSprites = [];

        this.localTweenGroup = new TWEEN.Group();
        this.zzzItems = [];

        this.buildModel();
        this.setupZzzParticles();
        this.setupPetParticles();
        this.setupGazeListeners();
        this.setupInnerMessageBridge();
        this.scene.add(this.model);
    }

    private buildModel() {
        this.model = new THREE.Group();
        this.model.name = 'dog_setup';

        // Position on top of Deepak's desk table
        this.model.position.set(-1150, -450, 720);
        this.model.rotation.y = Math.PI * 0.16;

        // --- Materials (Palette matching the baked room) ---
        const woodMat = new THREE.MeshBasicMaterial({ color: 0x5c3b24 });
        const cushionMat = new THREE.MeshBasicMaterial({ color: 0x3d5366 });
        const cushionPipingMat = new THREE.MeshBasicMaterial({ color: 0xd9cca9 });
        const furMat = new THREE.MeshBasicMaterial({ color: 0xce853b }); // warm golden fur
        const creamMat = new THREE.MeshBasicMaterial({ color: 0xfbf1dc }); // soft cream muzzle/chest
        const noseMat = new THREE.MeshBasicMaterial({ color: 0x1f1712 }); // dark nose
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x120d0a }); // glossy dark eye
        const eyeGlintMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // specular glint
        const tongueMat = new THREE.MeshBasicMaterial({ color: 0xeb7883 }); // pink tongue
        const earInnerMat = new THREE.MeshBasicMaterial({ color: 0xe59f9c }); // inner ear
        const collarMat = new THREE.MeshBasicMaterial({ color: 0xc43232 }); // red collar
        const goldTagMat = new THREE.MeshBasicMaterial({ color: 0xf5c238 }); // brass tag

        // --- 1. Cozy Desk Pet Cushion (Resting flat on the table) ---
        const bedGroup = new THREE.Group();

        // Round wooden coaster base
        const baseGeo = new THREE.CylinderGeometry(175, 185, 12, 28);
        const baseMesh = new THREE.Mesh(baseGeo, woodMat);
        baseMesh.position.y = 6;
        bedGroup.add(baseMesh);

        // Soft circular quilted desk cushion
        const cushionGeo = new THREE.CylinderGeometry(165, 175, 22, 28);
        const cushion = new THREE.Mesh(cushionGeo, cushionMat);
        cushion.position.y = 12 + 11;
        bedGroup.add(cushion);

        const cushionPipingGeo = new THREE.TorusGeometry(170, 5, 8, 36);
        const cushionPiping = new THREE.Mesh(cushionPipingGeo, cushionPipingMat);
        cushionPiping.rotation.x = Math.PI / 2;
        cushionPiping.position.y = 12 + 20;
        bedGroup.add(cushionPiping);

        this.model.add(bedGroup);

        // --- 2. Dog Character ---
        this.dogGroup = new THREE.Group();
        this.dogGroup.position.y = this.baseY;
        this.dogGroup.scale.set(0.9, 0.9, 0.9);

        // Torso / Body Group
        this.body = new THREE.Group();
        this.dogGroup.add(this.body);

        const bodyGeo = new THREE.BoxGeometry(130, 160, 150);
        const bodyMesh = new THREE.Mesh(bodyGeo, furMat);
        bodyMesh.position.y = 80;
        this.body.add(bodyMesh);

        // Soft chest patch
        const chestGeo = new THREE.BoxGeometry(90, 120, 20);
        const chestMesh = new THREE.Mesh(chestGeo, creamMat);
        chestMesh.position.set(0, 80, 72);
        this.body.add(chestMesh);

        // Front paws (stored on class for stretch animation)
        const pawGeo = new THREE.BoxGeometry(36, 32, 60);
        this.frontLeftPaw = new THREE.Mesh(pawGeo, creamMat);
        this.frontLeftPaw.position.set(-42, 16, 68);
        this.dogGroup.add(this.frontLeftPaw);

        this.frontRightPaw = new THREE.Mesh(pawGeo, creamMat);
        this.frontRightPaw.position.set(42, 16, 68);
        this.dogGroup.add(this.frontRightPaw);

        // Sitting hind haunches
        const haunchGeo = new THREE.BoxGeometry(38, 70, 90);
        this.backLeftHaunch = new THREE.Mesh(haunchGeo, furMat);
        this.backLeftHaunch.position.set(-66, 45, -15);
        this.dogGroup.add(this.backLeftHaunch);

        this.backRightHaunch = new THREE.Mesh(haunchGeo, furMat);
        this.backRightHaunch.position.set(66, 45, -15);
        this.dogGroup.add(this.backRightHaunch);

        // Collar & Tag
        const collarGeo = new THREE.CylinderGeometry(60, 62, 16, 20);
        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.set(0, 155, 12);
        this.body.add(collar);

        const tagGeo = new THREE.CylinderGeometry(10, 10, 4, 16);
        const tag = new THREE.Mesh(tagGeo, goldTagMat);
        tag.rotation.x = Math.PI / 2;
        tag.position.set(0, 146, 70);
        this.body.add(tag);

        // --- Head Group ---
        this.head = new THREE.Group();
        this.head.position.set(0, 195, 20);
        this.dogGroup.add(this.head);

        const headGeo = new THREE.BoxGeometry(130, 125, 125);
        const headMesh = new THREE.Mesh(headGeo, furMat);
        this.head.add(headMesh);

        // White muzzle & cheeks
        const muzzleGeo = new THREE.BoxGeometry(100, 65, 30);
        const muzzleMesh = new THREE.Mesh(muzzleGeo, creamMat);
        muzzleMesh.position.set(0, -22, 58);
        this.head.add(muzzleMesh);

        // Snout box protruding forward
        const snoutGeo = new THREE.BoxGeometry(60, 45, 50);
        this.snout = new THREE.Mesh(snoutGeo, creamMat);
        this.snout.position.set(0, -18, 72);
        this.head.add(this.snout);

        // Nose button
        const noseGeo = new THREE.BoxGeometry(26, 18, 16);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, -5, 96);
        this.head.add(nose);

        // Eyes with glint (stored for sleeping & squinting)
        const eyeGeo = new THREE.BoxGeometry(16, 20, 10);
        this.eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
        this.eyeLeft.position.set(-35, 14, 62);
        this.head.add(this.eyeLeft);

        const glintGeo = new THREE.BoxGeometry(5, 6, 6);
        this.glintLeft = new THREE.Mesh(glintGeo, eyeGlintMat);
        this.glintLeft.position.set(-33, 18, 66);
        this.head.add(this.glintLeft);

        this.eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
        this.eyeRight.position.set(35, 14, 62);
        this.head.add(this.eyeRight);

        this.glintRight = new THREE.Mesh(glintGeo, eyeGlintMat);
        this.glintRight.position.set(37, 18, 66);
        this.head.add(this.glintRight);

        // Playful tongue
        const tongueGeo = new THREE.BoxGeometry(24, 10, 32);
        this.tongue = new THREE.Mesh(tongueGeo, tongueMat);
        this.tongue.position.set(6, -42, 82);
        this.tongue.rotation.x = 0.2;
        this.head.add(this.tongue);

        // Ears Group
        this.ears = new THREE.Group();
        this.head.add(this.ears);

        const earGeo = new THREE.ConeGeometry(25, 55, 4);
        this.leftEar = new THREE.Mesh(earGeo, furMat);
        this.leftEar.position.set(-50, 78, -10);
        this.leftEar.rotation.z = 0.2;
        this.leftEar.rotation.x = -0.1;
        this.ears.add(this.leftEar);

        const earInnerGeo = new THREE.ConeGeometry(16, 40, 4);
        const leftEarInner = new THREE.Mesh(earInnerGeo, earInnerMat);
        leftEarInner.position.set(-49, 75, -5);
        leftEarInner.rotation.z = 0.2;
        leftEarInner.rotation.x = -0.1;
        this.ears.add(leftEarInner);

        this.rightEar = new THREE.Mesh(earGeo, furMat);
        this.rightEar.position.set(50, 78, -10);
        this.rightEar.rotation.z = -0.2;
        this.rightEar.rotation.x = -0.1;
        this.ears.add(this.rightEar);

        const rightEarInner = new THREE.Mesh(earInnerGeo, earInnerMat);
        rightEarInner.position.set(49, 75, -5);
        rightEarInner.rotation.z = -0.2;
        rightEarInner.rotation.x = -0.1;
        this.ears.add(rightEarInner);

        // --- Tail Group ---
        this.tail = new THREE.Group();
        this.tail.position.set(0, 40, -70);
        this.dogGroup.add(this.tail);

        const tailBaseGeo = new THREE.CylinderGeometry(14, 18, 70, 10);
        const tailBase = new THREE.Mesh(tailBaseGeo, furMat);
        tailBase.position.set(0, 35, -20);
        tailBase.rotation.x = -0.8;
        this.tail.add(tailBase);

        const tailTipGeo = new THREE.SphereGeometry(18, 12, 12);
        const tailTip = new THREE.Mesh(tailTipGeo, creamMat);
        tailTip.position.set(0, 68, -42);
        this.tail.add(tailTip);

        this.model.add(this.dogGroup);

        // --- 3. Invisible Hit Mesh for Smooth Raycasting ---
        const hitGeo = new THREE.BoxGeometry(380, 380, 360);
        const hitMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
        this.hitMesh.name = 'dog';
        this.hitMesh.position.set(0, 160, 20);
        this.model.add(this.hitMesh);
    }

    public getHitMesh(): THREE.Mesh {
        return this.hitMesh;
    }

    // --- Particle Systems ---

    private createZzzTexture(text: string, fontSize: number): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, 256, 256);

            // Dreamy cyan / electric white glowing gradient
            const grad = ctx.createLinearGradient(40, 40, 210, 220);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.35, '#bae6fd');
            grad.addColorStop(0.7, '#38bdf8');
            grad.addColorStop(1, '#0284c7');

            ctx.font = `900 ${fontSize}px "Segoe UI", -apple-system, BlinkMacSystemFont, "Trebuchet MS", Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Radiant outer glow
            ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
            ctx.shadowBlur = 24;

            // Thick dark border for ultra-crisp comic readability
            ctx.strokeStyle = 'rgba(5, 23, 44, 0.95)';
            ctx.lineWidth = 18;
            ctx.lineJoin = 'round';
            ctx.strokeText(text, 128, 128);

            // Vibrant gradient fill
            ctx.fillStyle = grad;
            ctx.fillText(text, 128, 128);

            // Subtle inner shine highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = `900 ${Math.round(fontSize * 0.94)}px "Segoe UI", -apple-system, BlinkMacSystemFont, "Trebuchet MS", Impact, sans-serif`;
            ctx.fillText(text, 125, 124);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    private setupZzzParticles() {
        this.zzzGroup = new THREE.Group();
        this.zzzGroup.name = 'dog_zzz';
        this.zzzGroup.visible = false;
        this.model.add(this.zzzGroup);

        const configs = [
            { text: 'z', size: 90, baseScale: 75, phase: 0.0, speed: 0.00045, xAmp: 20 },
            { text: 'Z', size: 110, baseScale: 105, phase: 0.25, speed: 0.00045, xAmp: 28 },
            { text: 'Zz', size: 125, baseScale: 135, phase: 0.5, speed: 0.00045, xAmp: 36 },
            { text: 'Zzz', size: 140, baseScale: 165, phase: 0.75, speed: 0.00045, xAmp: 44 },
        ];

        configs.forEach((cfg) => {
            const tex = this.createZzzTexture(cfg.text, cfg.size);
            const mat = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(cfg.baseScale, cfg.baseScale, 1);
            this.zzzGroup.add(sprite);
            this.zzzItems.push({
                sprite,
                phaseOffset: cfg.phase,
                speed: cfg.speed,
                xAmp: cfg.xAmp,
                baseScale: cfg.baseScale,
            });
        });
    }

    private createEmojiTexture(char: string, isHeart: boolean = true): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, 256, 256);
            ctx.font = '150px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Radiant primary glow
            ctx.shadowColor = isHeart ? 'rgba(255, 45, 115, 0.95)' : 'rgba(255, 215, 20, 0.95)';
            ctx.shadowBlur = 28;
            ctx.fillText(char, 128, 134);

            // Secondary softer aura glow
            ctx.shadowColor = isHeart ? 'rgba(255, 140, 180, 0.8)' : 'rgba(255, 245, 130, 0.8)';
            ctx.shadowBlur = 14;
            ctx.fillText(char, 128, 134);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    private setupPetParticles() {
        this.petParticlesGroup = new THREE.Group();
        this.petParticlesGroup.name = 'dog_pet_particles';
        this.model.add(this.petParticlesGroup);

        const heartTex = this.createEmojiTexture('❤️', true);
        const starTex = this.createEmojiTexture('✨', false);

        for (let i = 0; i < 28; i++) {
            const isHeart = i % 2 === 0;
            const mat = new THREE.SpriteMaterial({
                map: isHeart ? heartTex : starTex,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(0, 0, 1);
            sprite.visible = false;
            this.petParticlesGroup.add(sprite);

            this.petSprites.push({
                sprite,
                active: false,
                life: 0,
                maxLife: 1250,
                vx: 0,
                vy: 0,
                vz: 0,
                baseScale: isHeart ? 125 : 105,
            });
        }
    }

    public spawnHoverParticles(count: number = 5) {
        for (let i = 0; i < count; i++) {
            const inactive = this.petSprites.find((p) => !p.active);
            if (inactive) {
                inactive.active = true;
                inactive.life = 0;
                inactive.maxLife = 1100 + Math.random() * 400;
                inactive.sprite.visible = true;
                inactive.sprite.position.set(
                    (Math.random() - 0.5) * 80,
                    200 + Math.random() * 40,
                    20 + (Math.random() - 0.5) * 60
                );
                inactive.vx = (Math.random() - 0.5) * 0.06;
                inactive.vy = 0.09 + Math.random() * 0.05;
                inactive.vz = (Math.random() - 0.5) * 0.06;
            }
        }
    }

    private setupGazeListeners() {
        window.addEventListener('mousemove', (e) => {
            this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.isMouseActive = true;
        });

        window.addEventListener('mouseleave', () => {
            this.isMouseActive = false;
        });
    }

    private setupInnerMessageBridge() {
        window.addEventListener('message', (event) => {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type === 'BYTE_APP_EVENT') {
                this.registerInteraction();
                const deskTweenGroup =
                    this.application.world?.deskInteractions?.tweenGroup || this.localTweenGroup;

                if (event.data.action === 'opened') {
                    this.accelerateTail(4000);
                    this.bounce(deskTweenGroup);
                    this.application.world?.audioManager?.playSynthesized('dog', 0.85);
                } else if (event.data.action === 'treat') {
                    this.spin(deskTweenGroup);
                    this.application.world?.audioManager?.playSynthesized('treat', 0.9);
                } else if (event.data.action === 'perk') {
                    this.accelerateTail(3000);
                    this.wakeUp(true);
                }
            }
        });
    }

    // --- Interaction & Posture Controls ---

    public registerInteraction() {
        this.lastInteractionTime = performance.now();
        if (this.mode === 'sleep') {
            this.wakeUp(true);
        }
    }

    public handleHoverEnter() {
        this.isHovered = true;
        this.lastInteractionTime = performance.now();
        this.accelerateTail(4000);

        // If sleeping, softly open eyes to sleepy squint
        if (this.mode === 'sleep') {
            this.eyeLeft.scale.y = 0.45;
            this.eyeRight.scale.y = 0.45;
            if (this.glintLeft) this.glintLeft.visible = true;
            if (this.glintRight) this.glintRight.visible = true;
        }

        // Prominent physical hover reaction when not locked in full-body animations
        if (!this.isBouncing && !this.isSpinning && !this.isStretching && !this.isFetchingToy) {
            // Cheerful micro-hop: Byte perks up enthusiastically
            new TWEEN.Tween(this.dogGroup.position, this.localTweenGroup)
                .to({ y: this.baseY + 24 }, 150)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onComplete(() => {
                    if (this.isHovered && !this.isBouncing && !this.isSpinning && !this.isStretching && !this.isFetchingToy) {
                        new TWEEN.Tween(this.dogGroup.position, this.localTweenGroup)
                            .to({ y: this.baseY + 8 }, 160)
                            .easing(TWEEN.Easing.Quadratic.InOut)
                            .start();
                    }
                })
                .start();

            // Joyful squish-stretch
            new TWEEN.Tween(this.body.scale, this.localTweenGroup)
                .to({ x: 1.05, y: 1.08, z: 1.05 }, 140)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onComplete(() => {
                    new TWEEN.Tween(this.body.scale, this.localTweenGroup)
                        .to({ x: 1, y: 1, z: 1 }, 180)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .start();
                })
                .start();

            // Attentive high head lift
            new TWEEN.Tween(this.head.position, this.localTweenGroup)
                .to({ y: 218 }, 160)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();

            // Perk ears forward eagerly
            new TWEEN.Tween(this.ears.rotation, this.localTweenGroup)
                .to({ x: -0.38 }, 150)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        }

        // Play gentle welcoming chirp/purr
        const now = performance.now();
        if (now - this.lastPurrTime > 1000) {
            this.application.world?.audioManager?.playSynthesized('dog_purr', 0.7);
            this.lastPurrTime = now;
        }

        // Spawn a burst of prominent large heart & sparkle particles immediately upon hover!
        this.spawnHoverParticles(5);
    }

    public handleHoverLeave() {
        this.isHovered = false;
        if (this.isPetting) {
            this.stopPetting();
        }

        // If in sleep mode, close eyes back down
        if (this.mode === 'sleep') {
            this.eyeLeft.scale.y = 0.06;
            this.eyeRight.scale.y = 0.06;
            if (this.glintLeft) this.glintLeft.visible = false;
            if (this.glintRight) this.glintRight.visible = false;
        }

        if (!this.isBouncing && !this.isSpinning && !this.isStretching && !this.isFetchingToy) {
            // Restore dogGroup vertical position to resting baseline
            new TWEEN.Tween(this.dogGroup.position, this.localTweenGroup)
                .to({ y: this.baseY }, 200)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();

            new TWEEN.Tween(this.body.scale, this.localTweenGroup)
                .to({ x: 1, y: 1, z: 1 }, 180)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();

            // Restore ears & head
            new TWEEN.Tween(this.ears.rotation, this.localTweenGroup)
                .to({ x: 0 }, 220)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();

            new TWEEN.Tween(this.head.position, this.localTweenGroup)
                .to({ y: 195 }, 220)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        }
    }

    public handlePetStroke(deltaDistance: number) {
        this.registerInteraction();
        this.lastStrokeTime = performance.now();

        this.petStrokeDistance += deltaDistance;
        if (this.petStrokeDistance > 10 && !this.isPetting) {
            this.startPetting();
        }
    }

    private startPetting() {
        if (this.isBouncing || this.isSpinning || this.isStretching || this.isFetchingToy) return;
        this.isPetting = true;
        this.accelerateTail(5000);

        // Sound throttling
        const now = performance.now();
        if (now - this.lastPurrTime > 650) {
            this.application.world?.audioManager?.playSynthesized('dog_purr', 0.85);
            this.lastPurrTime = now;
        }
    }

    public stopPetting() {
        if (!this.isPetting) return;
        this.isPetting = false;
        this.petStrokeDistance = 0;

        // Smoothly restore eyes
        new TWEEN.Tween(this.eyeLeft.scale, this.localTweenGroup)
            .to({ y: 1 }, 200)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(this.eyeRight.scale, this.localTweenGroup)
            .to({ y: 1 }, 200)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        // Restore ears
        new TWEEN.Tween(this.ears.rotation, this.localTweenGroup)
            .to({ x: 0 }, 220)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    }

    public wakeUp(playAudio: boolean = false) {
        this.lastInteractionTime = performance.now();
        if (this.mode === 'alert') return;

        // Trigger rich downward-dog stretch sequence
        this.playWakeUpStretch(playAudio);
    }

    private playWakeUpStretch(playAudio: boolean = true) {
        if (this.isStretching) return;
        this.isStretching = true;
        this.mode = 'stretch';
        this.zzzGroup.visible = false;
        this.zzzItems.forEach((item) => {
            item.sprite.material.opacity = 0;
        });

        // Open eyes and glints as Byte wakes up
        if (this.glintLeft) this.glintLeft.visible = true;
        if (this.glintRight) this.glintRight.visible = true;
        new TWEEN.Tween(this.eyeLeft.scale, this.localTweenGroup)
            .to({ y: 1 }, 320)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
        new TWEEN.Tween(this.eyeRight.scale, this.localTweenGroup)
            .to({ y: 1 }, 320)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        if (playAudio) {
            this.application.world?.audioManager?.playSynthesized('dog_stretch', 0.9);
        }

        // Sequence Phase 1: Downward-dog stretch
        // Front paws slide forward
        new TWEEN.Tween(this.frontLeftPaw.position, this.localTweenGroup)
            .to({ z: 112 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(this.frontRightPaw.position, this.localTweenGroup)
            .to({ z: 112 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        // Body tilts down and forward
        new TWEEN.Tween(this.body.position, this.localTweenGroup)
            .to({ y: 48 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(this.body.rotation, this.localTweenGroup)
            .to({ x: 0.2 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        // Head extends low with stretch angle
        new TWEEN.Tween(this.head.position, this.localTweenGroup)
            .to({ y: 130, z: 75 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
            .to({ x: -0.16 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        // Tongue extends out for sleepy yawn
        new TWEEN.Tween(this.tongue.position, this.localTweenGroup)
            .to({ z: 96 }, 360)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                // Hold stretch pose for 220ms
                setTimeout(() => {
                    // Sequence Phase 2: Spring back upright & coat shake
                    new TWEEN.Tween(this.frontLeftPaw.position, this.localTweenGroup)
                        .to({ z: 68 }, 280)
                        .easing(TWEEN.Easing.Back.Out)
                        .start();

                    new TWEEN.Tween(this.frontRightPaw.position, this.localTweenGroup)
                        .to({ z: 68 }, 280)
                        .easing(TWEEN.Easing.Back.Out)
                        .start();

                    new TWEEN.Tween(this.body.position, this.localTweenGroup)
                        .to({ y: 0 }, 280)
                        .easing(TWEEN.Easing.Back.Out)
                        .start();

                    new TWEEN.Tween(this.body.rotation, this.localTweenGroup)
                        .to({ x: 0 }, 280)
                        .easing(TWEEN.Easing.Back.Out)
                        .start();

                    new TWEEN.Tween(this.head.position, this.localTweenGroup)
                        .to({ y: 195, z: 20 }, 280)
                        .easing(TWEEN.Easing.Back.Out)
                        .start();

                    new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
                        .to({ x: 0, z: 0 }, 280)
                        .easing(TWEEN.Easing.Back.Out)
                        .start();

                    new TWEEN.Tween(this.tongue.position, this.localTweenGroup)
                        .to({ z: 82 }, 240)
                        .easing(TWEEN.Easing.Quadratic.In)
                        .start();

                    // Ears snap straight up
                    new TWEEN.Tween(this.ears.rotation, this.localTweenGroup)
                        .to({ x: -0.22 }, 200)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => {
                            new TWEEN.Tween(this.ears.rotation, this.localTweenGroup)
                                .to({ x: 0 }, 160)
                                .easing(TWEEN.Easing.Quadratic.In)
                                .start();
                        })
                        .start();

                    // Cute rapid coat shake
                    let shakeCount = 0;
                    const shakeInterval = setInterval(() => {
                        shakeCount++;
                        this.dogGroup.rotation.y = (shakeCount % 2 === 0 ? 1 : -1) * 0.08;
                        if (shakeCount >= 6) {
                            clearInterval(shakeInterval);
                            this.dogGroup.rotation.y = 0;
                            this.isStretching = false;
                            this.mode = 'alert';
                            this.accelerateTail(2500);
                        }
                    }, 45);
                }, 220);
            })
            .start();
    }

    public goToSleep() {
        if (
            this.mode === 'sleep' ||
            this.isBouncing ||
            this.isSpinning ||
            this.isStretching ||
            this.isFetchingToy
        )
            return;
        this.mode = 'sleep';
        this.zzzGroup.visible = true;

        // Smoothly close eyes into relaxed sleeping slits and hide eye reflections
        new TWEEN.Tween(this.eyeLeft.scale, this.localTweenGroup)
            .to({ y: 0.06 }, 600)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(this.eyeRight.scale, this.localTweenGroup)
            .to({ y: 0.06 }, 600)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                if (this.glintLeft) this.glintLeft.visible = false;
                if (this.glintRight) this.glintRight.visible = false;
            })
            .start();

        if (this.glintLeft) this.glintLeft.visible = false;
        if (this.glintRight) this.glintRight.visible = false;

        // Head rests down near paws
        new TWEEN.Tween(this.head.position, this.localTweenGroup)
            .to({ y: 140, z: 46 }, 850)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();

        new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
            .to({ x: 0.28, z: 0.06 }, 850)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();

        // Relaxed folded back ears
        new TWEEN.Tween(this.ears.rotation, this.localTweenGroup)
            .to({ x: 0.22 }, 850)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();

        this.application.world?.audioManager?.playSynthesized('dog_yawn', 0.55);
    }

    public accelerateTail(durationMs: number = 2000) {
        this.isExcited = true;
        if (this.excitedTimeout) clearTimeout(this.excitedTimeout);
        this.excitedTimeout = setTimeout(() => {
            this.isExcited = false;
        }, durationMs);
    }

    public bounce(tweenGroup?: TWEEN.Group, onComplete?: () => void) {
        this.lastInteractionTime = performance.now();

        // If sleeping or stretching, immediately wake up and reset posture
        if (this.mode === 'sleep' || this.isStretching) {
            this.mode = 'alert';
            this.isStretching = false;
            this.zzzGroup.visible = false;
            this.zzzItems.forEach((item) => {
                item.sprite.material.opacity = 0;
            });
            this.frontLeftPaw.position.z = 68;
            this.frontRightPaw.position.z = 68;
            this.body.position.set(0, 0, 0);
            this.body.rotation.set(0, 0, 0);
            this.head.position.set(0, 195, 20);
            this.head.rotation.set(0, 0, 0);
        }

        this.eyeLeft.scale.y = 1;
        this.eyeRight.scale.y = 1;
        if (this.glintLeft) this.glintLeft.visible = true;
        if (this.glintRight) this.glintRight.visible = true;
        this.accelerateTail(3000);

        // Sound on click jump
        this.application.world?.audioManager?.playSynthesized('dog', 0.9);

        // Don't interrupt toy fetch
        if (this.isFetchingToy) {
            if (onComplete) onComplete();
            return;
        }

        this.isBouncing = true;
        const targetGroup = tweenGroup || this.localTweenGroup;

        // Reset dog vertical position to baseY before launching
        this.dogGroup.position.y = this.baseY;

        // Hop upwards
        new TWEEN.Tween(this.dogGroup.position, targetGroup)
            .to({ y: this.baseY + 48 }, 130)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.dogGroup.position, targetGroup)
                    .to({ y: this.baseY }, 160)
                    .easing(TWEEN.Easing.Bounce.Out)
                    .onComplete(() => {
                        this.dogGroup.position.y = this.baseY;
                        this.isBouncing = false;
                        if (onComplete) onComplete();
                    })
                    .start();
            })
            .start();

        // Cheerful head nod & ear perk during hop
        new TWEEN.Tween(this.ears.rotation, targetGroup)
            .to({ x: -0.28 }, 110)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.ears.rotation, targetGroup)
                    .to({ x: 0 }, 150)
                    .easing(TWEEN.Easing.Quadratic.In)
                    .start();
            })
            .start();

        new TWEEN.Tween(this.head.rotation, targetGroup)
            .to({ x: -0.18 }, 110)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.head.rotation, targetGroup)
                    .to({ x: 0 }, 150)
                    .easing(TWEEN.Easing.Quadratic.In)
                    .start();
            })
            .start();
    }

    public spin(tweenGroup: TWEEN.Group, onComplete?: () => void) {
        this.wakeUp();
        this.eyeLeft.scale.y = 1;
        this.eyeRight.scale.y = 1;
        if (this.glintLeft) this.glintLeft.visible = true;
        if (this.glintRight) this.glintRight.visible = true;
        if (this.isSpinning || this.isBouncing || this.isStretching || this.isFetchingToy) return;
        this.isSpinning = true;
        this.accelerateTail(3000);

        this.dogGroup.position.y = this.baseY;
        new TWEEN.Tween(this.dogGroup.position, tweenGroup)
            .to({ y: this.baseY + 45 }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.dogGroup.position, tweenGroup)
                    .to({ y: this.baseY }, 260)
                    .easing(TWEEN.Easing.Bounce.Out)
                    .onComplete(() => {
                        this.dogGroup.position.y = this.baseY;
                    })
                    .start();
            })
            .start();

        // 360 Spin
        new TWEEN.Tween(this.dogGroup.rotation, tweenGroup)
            .to({ y: Math.PI * 2 }, 540)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                this.dogGroup.rotation.y = 0;
                this.isSpinning = false;
                if (onComplete) onComplete();
            })
            .start();

        // Flap ears excitedly
        new TWEEN.Tween(this.ears.rotation, tweenGroup)
            .to({ x: -0.3, z: 0.2 }, 160)
            .yoyo(true)
            .repeat(2)
            .start();
    }

    // --- Physical Toy Fetch Routine ---

    public fetchToy(toy: ToyBone, onDone?: () => void) {
        this.registerInteraction();
        this.wakeUp();
        this.eyeLeft.scale.y = 1;
        this.eyeRight.scale.y = 1;
        if (this.glintLeft) this.glintLeft.visible = true;
        if (this.glintRight) this.glintRight.visible = true;
        if (this.isFetchingToy || this.isSpinning || this.isStretching) return;
        this.isFetchingToy = true;
        this.accelerateTail(8000);

        // Convert toy target position into this.model local space
        const targetLocal = new THREE.Vector3();
        this.model.worldToLocal(targetLocal.copy(toy.group.position));

        const startLocal = new THREE.Vector3(0, this.baseY, 0);

        // Step 1: Bark and scamper across desk to the toy
        this.application.world?.audioManager?.playSynthesized('dog', 0.95);

        // Angle facing the toy
        const angleToToy = Math.atan2(targetLocal.x - startLocal.x, targetLocal.z - startLocal.z);
        new TWEEN.Tween(this.dogGroup.rotation, this.localTweenGroup)
            .to({ y: angleToToy }, 180)
            .start();

        const scamperProgress = { t: 0 };
        new TWEEN.Tween(scamperProgress, this.localTweenGroup)
            .to({ t: 1 }, 580)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                const p = scamperProgress.t;
                this.dogGroup.position.x = THREE.MathUtils.lerp(startLocal.x, targetLocal.x - 40, p);
                this.dogGroup.position.z = THREE.MathUtils.lerp(startLocal.z, targetLocal.z - 30, p);
                // Scampering bob
                this.dogGroup.position.y = this.baseY + Math.abs(Math.sin(p * Math.PI * 5)) * 18;
            })
            .onComplete(() => {
                // Step 2: Bend down and grab the bone in mouth
                new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
                    .to({ x: 0.38 }, 160)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onComplete(() => {
                        toy.attachToMouth(this.snout);

                        // Head lifts up proudly with bone
                        new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
                            .to({ x: -0.15 }, 180)
                            .easing(TWEEN.Easing.Back.Out)
                            .onComplete(() => {
                                // Step 3: Happy 360 victory spin with bone
                                const spinTarget = angleToToy + Math.PI * 2;
                                new TWEEN.Tween(this.dogGroup.rotation, this.localTweenGroup)
                                    .to({ y: spinTarget }, 520)
                                    .easing(TWEEN.Easing.Cubic.InOut)
                                    .onComplete(() => {
                                        // Turn towards cushion
                                        const angleToBed = Math.atan2(
                                            startLocal.x - this.dogGroup.position.x,
                                            startLocal.z - this.dogGroup.position.z
                                        );
                                        this.dogGroup.rotation.y = angleToBed;

                                        // Step 4: Run back to cushion
                                        const returnStart = this.dogGroup.position.clone();
                                        const returnProgress = { t: 0 };
                                        new TWEEN.Tween(returnProgress, this.localTweenGroup)
                                            .to({ t: 1 }, 580)
                                            .easing(TWEEN.Easing.Quadratic.InOut)
                                            .onUpdate(() => {
                                                const p = returnProgress.t;
                                                this.dogGroup.position.x = THREE.MathUtils.lerp(
                                                    returnStart.x,
                                                    startLocal.x,
                                                    p
                                                );
                                                this.dogGroup.position.z = THREE.MathUtils.lerp(
                                                    returnStart.z,
                                                    startLocal.z,
                                                    p
                                                );
                                                this.dogGroup.position.y =
                                                    this.baseY + Math.abs(Math.sin(p * Math.PI * 5)) * 18;
                                            })
                                            .onComplete(() => {
                                                // Step 5: Settle on cushion, set bone down
                                                this.dogGroup.position.copy(startLocal);
                                                this.dogGroup.rotation.y = 0;

                                                new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
                                                    .to({ x: 0.3 }, 160)
                                                    .onComplete(() => {
                                                        toy.resetToDesk();
                                                        new TWEEN.Tween(this.head.rotation, this.localTweenGroup)
                                                            .to({ x: 0 }, 200)
                                                            .easing(TWEEN.Easing.Back.Out)
                                                            .onComplete(() => {
                                                                this.isFetchingToy = false;
                                                                this.accelerateTail(3000);
                                                                if (onDone) onDone();
                                                            })
                                                            .start();
                                                    })
                                                    .start();
                                            })
                                            .start();
                                    })
                                    .start();
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    // --- Main Frame Update Loop ---

    public update() {
        this.localTweenGroup.update();

        const now = performance.now();
        const delta = this.time.delta;
        const t = this.time.elapsed;

        // Auto sleep timer
        if (
            this.mode === 'alert' &&
            !this.isBouncing &&
            !this.isSpinning &&
            !this.isStretching &&
            !this.isFetchingToy
        ) {
            if (now - this.lastInteractionTime > this.idleSleepDelayMs) {
                this.goToSleep();
            }
        }

        // Check if petting timed out (stopped stroking for >900ms)
        if (this.isPetting && now - this.lastStrokeTime > 900) {
            this.stopPetting();
        }

        // --- 1. SLEEP MODE ---
        if (this.mode === 'sleep') {
            this.body.scale.y = 1 + Math.sin(t * 0.0013) * 0.032;
            this.tail.rotation.y = Math.sin(t * 0.0008) * (this.isHovered ? 0.35 : 0.08);

            // While hovering in sleep mode, show a sleepy peek squint; otherwise keep eyes closed
            const targetEyeY = this.isHovered ? 0.45 : 0.06;
            this.eyeLeft.scale.y = targetEyeY;
            this.eyeRight.scale.y = targetEyeY;
            const glintVis = this.isHovered;
            if (this.glintLeft) this.glintLeft.visible = glintVis;
            if (this.glintRight) this.glintRight.visible = glintVis;

            this.zzzItems.forEach((item) => {
                const cycle = (t * item.speed + item.phaseOffset) % 1.0;
                // Floats from snout height (160) up high into the room air (440)
                item.sprite.position.y = 160 + cycle * 280;
                item.sprite.position.x = 28 + Math.sin(cycle * Math.PI * 2) * item.xAmp;
                item.sprite.position.z = 45 + cycle * 35;

                // Scale gently expands as snooze bubble ascends
                const currentScale = item.baseScale * (0.65 + cycle * 0.55);
                item.sprite.scale.set(currentScale, currentScale, 1);

                // Bright opacity bell-curve with high sustained clarity
                const alpha = Math.sin(cycle * Math.PI);
                item.sprite.material.opacity = Math.pow(alpha, 0.75) * 0.95;
            });

            this.updatePetParticles(delta, t);
            return;
        }

        // Natural idle blinking in alert posture
        if (
            this.mode === 'alert' &&
            !this.isPetting &&
            !this.isStretching &&
            !this.isBouncing &&
            !this.isSpinning &&
            !this.isFetchingToy
        ) {
            if (now > this.nextBlinkTime) {
                this.isBlinking = true;
                this.eyeLeft.scale.y = 0.08;
                this.eyeRight.scale.y = 0.08;
                if (this.glintLeft) this.glintLeft.visible = false;
                if (this.glintRight) this.glintRight.visible = false;

                setTimeout(() => {
                    if (this.mode === 'alert' && !this.isPetting) {
                        this.eyeLeft.scale.y = 1;
                        this.eyeRight.scale.y = 1;
                        if (this.glintLeft) this.glintLeft.visible = true;
                        if (this.glintRight) this.glintRight.visible = true;
                    }
                    this.isBlinking = false;
                    this.nextBlinkTime = performance.now() + 3500 + Math.random() * 3500;
                }, 130);
                this.nextBlinkTime = now + 999999;
            }
        }

        // --- 2. GAZE TRACKING ---
        const canTrackGaze =
            this.mode === 'alert' &&
            !this.isBouncing &&
            !this.isSpinning &&
            !this.isStretching &&
            !this.isFetchingToy;

        if (canTrackGaze) {
            let targetYaw = 0;
            let targetPitch = 0;
            let targetRoll = 0;

            if (this.isPetting) {
                // Blissful head tilt up into the petting hand
                targetYaw = Math.sin(t * 0.006) * 0.06;
                targetPitch = -0.24;
                targetRoll = 0.12;

                // Squinting eyes in bliss
                this.eyeLeft.scale.y = THREE.MathUtils.lerp(this.eyeLeft.scale.y, 0.28, 0.15);
                this.eyeRight.scale.y = THREE.MathUtils.lerp(this.eyeRight.scale.y, 0.28, 0.15);
                this.ears.rotation.x = THREE.MathUtils.lerp(this.ears.rotation.x, 0.26, 0.15);
            } else if (this.isMouseActive) {
                // Calculate gaze target point in world coordinates
                this.gazeRay.origin.copy(this.cameraInstance.position);
                this.gazeRay.direction
                    .set(this.mouseNDC.x, this.mouseNDC.y, 0.5)
                    .unproject(this.cameraInstance)
                    .sub(this.gazeRay.origin)
                    .normalize();

                this.head.getWorldPosition(this.tempHeadWorld);

                const approxDist = Math.abs(this.cameraInstance.position.z - this.tempHeadWorld.z) + 400;
                this.tempLookTarget
                    .copy(this.gazeRay.origin)
                    .addScaledVector(this.gazeRay.direction, approxDist);

                this.tempLocalTarget.copy(this.tempLookTarget);
                this.dogGroup.worldToLocal(this.tempLocalTarget);

                const dx = this.tempLocalTarget.x - this.head.position.x;
                const dy = this.tempLocalTarget.y - this.head.position.y;
                const dz = this.tempLocalTarget.z - this.head.position.z;

                const rawYaw = Math.atan2(dx, dz);
                const rawPitch = -Math.atan2(dy, Math.hypot(dx, dz));

                targetYaw = Math.max(-0.75, Math.min(0.75, rawYaw));
                targetPitch = Math.max(-0.35, Math.min(0.35, rawPitch));
                targetRoll = -targetYaw * 0.32; // Curiously cock head sideways!
            }

            const dampSpeed = this.isPetting ? 0.08 : 0.12;
            this.currentLookYaw = THREE.MathUtils.lerp(this.currentLookYaw, targetYaw, dampSpeed);
            this.currentLookPitch = THREE.MathUtils.lerp(this.currentLookPitch, targetPitch, dampSpeed);
            this.currentLookRoll = THREE.MathUtils.lerp(this.currentLookRoll, targetRoll, dampSpeed);

            this.head.rotation.set(this.currentLookPitch, this.currentLookYaw, this.currentLookRoll);

            if (!this.isPetting) {
                // Asymmetric Ear Cocking responding to look direction
                const leftEarCock =
                    this.currentLookYaw < -0.1 ? 0.28 : this.currentLookYaw > 0.1 ? 0.12 : 0.2;
                const rightEarCock =
                    this.currentLookYaw > 0.1 ? -0.28 : this.currentLookYaw < -0.1 ? -0.12 : -0.2;
                this.leftEar.rotation.z = THREE.MathUtils.lerp(this.leftEar.rotation.z, leftEarCock, 0.1);
                this.rightEar.rotation.z = THREE.MathUtils.lerp(this.rightEar.rotation.z, rightEarCock, 0.1);
            }
        }

        // --- 3. PETTING PARTICLES (Hearts & Sparkles) ---
        if (this.isPetting) {
            if (now - this.lastPetParticleSpawn > 140) {
                this.lastPetParticleSpawn = now;
                const inactive = this.petSprites.find((p) => !p.active);
                if (inactive) {
                    inactive.active = true;
                    inactive.life = 0;
                    inactive.maxLife = 1100 + Math.random() * 350;
                    inactive.sprite.visible = true;
                    inactive.sprite.position.set(
                        (Math.random() - 0.5) * 75,
                        200 + Math.random() * 35,
                        25 + (Math.random() - 0.5) * 55
                    );
                    inactive.vx = (Math.random() - 0.5) * 0.06;
                    inactive.vy = 0.09 + Math.random() * 0.045;
                    inactive.vz = (Math.random() - 0.5) * 0.06;
                }
            }
        }

        this.updatePetParticles(delta, t);

        // --- 4. IDLE BODY & TAIL DYNAMICS ---
        const isSuperExcited = this.isPetting || this.isExcited;
        const tailSpeed = isSuperExcited ? 0.026 : 0.008;
        const tailAmp = isSuperExcited ? 0.8 : 0.45;
        this.tail.rotation.y = Math.sin(t * tailSpeed) * tailAmp;

        this.body.scale.y = 1 + Math.sin(t * 0.003) * 0.02;

        if (!canTrackGaze && !this.isStretching && !this.isSpinning) {
            this.head.rotation.z = Math.sin(t * 0.0016) * 0.045;
        }
    }

    private updatePetParticles(delta: number, t: number) {
        this.petSprites.forEach((p) => {
            if (!p.active) return;
            p.life += delta;
            const progress = p.life / p.maxLife;

            if (progress >= 1.0) {
                p.active = false;
                p.sprite.visible = false;
                p.sprite.scale.set(0, 0, 1);
            } else {
                p.sprite.position.x += p.vx * delta + Math.sin(t * 0.006) * 0.25;
                p.sprite.position.y += p.vy * delta;
                p.sprite.position.z += p.vz * delta;

                // Prominent scale pop curve and soft fade out
                const scaleProgress = Math.sin(progress * Math.PI);
                const currentScale = p.baseScale * scaleProgress;
                p.sprite.scale.set(currentScale, currentScale, 1);
                p.sprite.material.opacity = Math.max(0, 1 - progress);
            }
        });
    }
}

// Bed coaster and cushion geometry initialized

// Torso and chest patch meshes

// Haunches and front paws

// Red collar and brass ID tag

// Materials aligned with room lighting

// Head, muzzle, and dark nose

// Eyes, specular glints, and tongue

// Perky ears with inner cones

// Tail group and tip

// Invisible hitMesh for raycasting

// Dog cushion flush on desk

// Natural idle breathing scale

// Continuous tail wagging

// Natural eye blink interval

// Bounce hop on click

// Auto-sleep delay timer

// Sleeping posture tweens

// Comic Zzz particle sprites

// Snoring breathing rhythm

// Eyes closed during sleep

// Downward-dog stretch pose

// Paws stretch forward

// Tongue extends during stretch

// Coat shake recovery animation

// Stretch unblocks click bounce

// Smooth downward-dog stretch return easing

// PostMessage bridge for byte.exe events

// Spin animation on treat

// High-res 256x256 Zzz sprite canvas

// Cyan glowing gradient and stroke on Zzz
