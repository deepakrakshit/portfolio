import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import Application from '../Application';
import AudioManager from '../Audio/AudioManager';

export default class ToyBone {
    application: Application;
    scene: THREE.Scene;
    audioManager: AudioManager;

    group: THREE.Group;
    hitMesh: THREE.Mesh;
    boneMeshGroup: THREE.Group;

    basePosition: THREE.Vector3;
    baseRotation: THREE.Euler;
    isThrown: boolean;
    isHeldByDog: boolean;

    tweenGroup: TWEEN.Group;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.audioManager = this.application.world?.audioManager;

        this.basePosition = new THREE.Vector3(-1060, -428, 980);
        this.baseRotation = new THREE.Euler(0, Math.PI * 0.22, 0);
        this.isThrown = false;
        this.isHeldByDog = false;

        this.tweenGroup = new TWEEN.Group();

        this.buildModel();
        this.scene.add(this.group);
    }

    private buildModel() {
        this.group = new THREE.Group();
        this.group.name = 'toy_bone_group';
        this.group.position.copy(this.basePosition);
        this.group.rotation.copy(this.baseRotation);

        this.boneMeshGroup = new THREE.Group();
        this.group.add(this.boneMeshGroup);

        // Warm stylized bone ivory material & vibrant cyan rubber grip
        const boneMat = new THREE.MeshBasicMaterial({ color: 0xfff8ee });
        const boneShaftMat = new THREE.MeshBasicMaterial({ color: 0xf4ebd8 });
        const rubberGripMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

        // Center cylindrical shaft (enlarged for high visibility)
        const shaftGeo = new THREE.CylinderGeometry(15, 15, 115, 20);
        const shaft = new THREE.Mesh(shaftGeo, boneShaftMat);
        shaft.rotation.z = Math.PI / 2;
        this.boneMeshGroup.add(shaft);

        // Colorful center rubber chew grip band
        const gripGeo = new THREE.CylinderGeometry(16.5, 16.5, 34, 20);
        const grip = new THREE.Mesh(gripGeo, rubberGripMat);
        grip.rotation.z = Math.PI / 2;
        this.boneMeshGroup.add(grip);

        const ringGeo = new THREE.TorusGeometry(17.5, 3.2, 12, 24);
        const ringLeft = new THREE.Mesh(ringGeo, rubberGripMat);
        ringLeft.rotation.y = Math.PI / 2;
        ringLeft.position.x = -17;
        this.boneMeshGroup.add(ringLeft);

        const ringRight = new THREE.Mesh(ringGeo, rubberGripMat);
        ringRight.rotation.y = Math.PI / 2;
        ringRight.position.x = 17;
        this.boneMeshGroup.add(ringRight);

        // 4 Rounded bone end knobs (substantially enlarged)
        const knobGeo = new THREE.SphereGeometry(22, 16, 16);

        // Left knobs
        const knobTL = new THREE.Mesh(knobGeo, boneMat);
        knobTL.position.set(-58, 14, -10);
        this.boneMeshGroup.add(knobTL);

        const knobBL = new THREE.Mesh(knobGeo, boneMat);
        knobBL.position.set(-58, -14, 10);
        this.boneMeshGroup.add(knobBL);

        // Right knobs
        const knobTR = new THREE.Mesh(knobGeo, boneMat);
        knobTR.position.set(58, 14, -10);
        this.boneMeshGroup.add(knobTR);

        const knobBR = new THREE.Mesh(knobGeo, boneMat);
        knobBR.position.set(58, -14, 10);
        this.boneMeshGroup.add(knobBR);

        // Generous Raycast Hit Box for easy clicking & tossing
        const hitGeo = new THREE.BoxGeometry(180, 75, 80);
        const hitMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
        this.hitMesh.name = 'toy_bone';
        this.group.add(this.hitMesh);
    }

    public getHitMesh(): THREE.Mesh {
        return this.hitMesh;
    }

    public toss(
        targetPos: THREE.Vector3,
        onLanded?: () => void
    ) {
        if (this.isThrown || this.isHeldByDog) return;
        this.isThrown = true;

        const startPos = this.group.position.clone();
        const startRot = this.group.rotation.clone();

        // Parabolic trajectory progress: 0 -> 1
        const progressObj = { t: 0 };
        const peakY = -180; // higher dramatic arc above desk

        new TWEEN.Tween(progressObj, this.tweenGroup)
            .to({ t: 1 }, 720)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                const p = progressObj.t;
                // Horizontal linear lerp
                this.group.position.x = THREE.MathUtils.lerp(startPos.x, targetPos.x, p);
                this.group.position.z = THREE.MathUtils.lerp(startPos.z, targetPos.z, p);

                // Parabolic vertical arc: 4 * h * p * (1 - p)
                const arc = 4 * (peakY - startPos.y) * p * (1 - p);
                this.group.position.y = startPos.y + arc;

                // Mid-air tumbling spin
                this.group.rotation.x = startRot.x + p * Math.PI * 4;
                this.group.rotation.y = startRot.y + p * Math.PI * 2;
                this.group.rotation.z = startRot.z + p * Math.PI * 3;
            })
            .onComplete(() => {
                this.group.position.copy(targetPos);
                this.group.rotation.set(0, Math.PI * 0.4, 0);

                // Play desk toy bounce sound
                this.application.world?.audioManager?.playSynthesized('toy_bounce', 0.85);

                // Little bounce squash
                new TWEEN.Tween(this.group.position, this.tweenGroup)
                    .to({ y: targetPos.y + 18 }, 120)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onComplete(() => {
                        new TWEEN.Tween(this.group.position, this.tweenGroup)
                            .to({ y: targetPos.y }, 140)
                            .easing(TWEEN.Easing.Bounce.Out)
                            .onComplete(() => {
                                if (onLanded) onLanded();
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    public attachToMouth(mouthObj: THREE.Object3D) {
        this.isHeldByDog = true;
        this.group.position.set(0, -5, 32);
        this.group.rotation.set(0, 0, 0);
        this.group.scale.set(0.72, 0.72, 0.72);
        mouthObj.add(this.group);
    }

    public resetToDesk() {
        this.isHeldByDog = false;
        this.isThrown = false;
        this.group.scale.set(1, 1, 1);
        this.scene.add(this.group);

        new TWEEN.Tween(this.group.position, this.tweenGroup)
            .to(
                {
                    x: this.basePosition.x,
                    y: this.basePosition.y,
                    z: this.basePosition.z,
                },
                320
            )
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(this.group.rotation, this.tweenGroup)
            .to(
                {
                    x: this.baseRotation.x,
                    y: this.baseRotation.y,
                    z: this.baseRotation.z,
                },
                320
            )
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    }

    public update() {
        this.tweenGroup.update();
    }
}

// Parabolic desk toss physics

// Scaled up and repositioned to open desk area (-1060, -428, 980)
