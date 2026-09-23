import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import Application from '../Application';
import World from './World';
import Camera, { CameraKey } from '../Camera/Camera';
import Sizes from '../Utils/Sizes';
import AudioManager from '../Audio/AudioManager';
import UIEventBus from '../UI/EventBus';

export interface InteractiveItem {
    id: string;
    mesh: THREE.Mesh;
    title: string;
    icon: string;
    quotes: string[];
    quoteIndex: number;
    basePosition: THREE.Vector3;
    baseRotation: THREE.Euler;
    baseScale: THREE.Vector3;
    yOffset: number;
    isAnimating: boolean;
    playAudio: () => void;
    animate: () => void;
}

export default class DeskInteractions {
    application: Application;
    world: World;
    scene: THREE.Scene;
    camera: Camera;
    sizes: Sizes;
    audioManager: AudioManager;
    tweenGroup: TWEEN.Group;

    raycaster: THREE.Raycaster;
    mouseNDC: THREE.Vector2;
    interactiveItems: Map<THREE.Mesh, InteractiveItem>;
    meshList: THREE.Mesh[];

    hoveredMesh: THREE.Mesh | null;
    activeItem: InteractiveItem | null;
    bubbleElement: HTMLElement | null;
    bubbleContainer: HTMLElement | null;
    bubbleDismissTimeout: any;

    constructor(world: World) {
        this.world = world;
        this.application = new Application();
        this.scene = this.application.scene;
        this.camera = this.application.camera;
        this.sizes = this.application.sizes;
        this.audioManager = this.world.audioManager;

        this.tweenGroup = new TWEEN.Group();
        this.raycaster = new THREE.Raycaster();
        this.mouseNDC = new THREE.Vector2(-999, -999);
        this.interactiveItems = new Map();
        this.meshList = [];
        this.hoveredMesh = null;
        this.activeItem = null;
        this.bubbleDismissTimeout = null;

        this.createBubbleDOM();
        this.registerAllObjects();
        this.setupEventListeners();
    }

    private setupMeshPivot(
        mesh: THREE.Mesh,
        pivotMode: 'center' | 'bottom' = 'center'
    ): { basePosition: THREE.Vector3; baseRotation: THREE.Euler; baseScale: THREE.Vector3 } {
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        if (!box) {
            return {
                basePosition: mesh.position.clone(),
                baseRotation: mesh.rotation.clone(),
                baseScale: mesh.scale.clone(),
            };
        }

        const center = new THREE.Vector3();
        box.getCenter(center);
        const pivotY = pivotMode === 'bottom' ? box.min.y : center.y;

        mesh.geometry.translate(-center.x, -pivotY, -center.z);
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();

        mesh.position.set(
            center.x * mesh.scale.x,
            pivotY * mesh.scale.y,
            center.z * mesh.scale.z
        );
        mesh.updateMatrixWorld(true);

        return {
            basePosition: mesh.position.clone(),
            baseRotation: mesh.rotation.clone(),
            baseScale: mesh.scale.clone(),
        };
    }

    private registerItem(
        mesh: THREE.Mesh | null | undefined,
        id: string,
        title: string,
        icon: string,
        yOffset: number,
        quotes: string[],
        pivotMode: 'center' | 'bottom',
        playAudio: () => void,
        customAnimate?: (item: InteractiveItem) => void,
        skipPivotSetup: boolean = false
    ) {
        if (!mesh) return;

        let basePosition = mesh.position.clone();
        let baseRotation = mesh.rotation.clone();
        let baseScale = mesh.scale.clone();

        if (!skipPivotSetup) {
            const pivot = this.setupMeshPivot(mesh, pivotMode);
            basePosition = pivot.basePosition;
            baseRotation = pivot.baseRotation;
            baseScale = pivot.baseScale;
        }

        const item: InteractiveItem = {
            id,
            mesh,
            title,
            icon,
            quotes,
            quoteIndex: 0,
            basePosition,
            baseRotation,
            baseScale,
            yOffset,
            isAnimating: false,
            playAudio,
            animate: () => {
                if (customAnimate) {
                    customAnimate(item);
                }
            },
        };

        this.interactiveItems.set(mesh, item);
        this.meshList.push(mesh);
    }

    private registerAllObjects() {
        const decorGroup = this.world.decor?.bakedModel?.getModel();
        const compGroup = this.world.computerSetup?.bakedModel?.getModel();
        const envGroup = this.world.environment?.bakedModel?.getModel();

        // 1. Coffee Mug
        const coffeeMesh = decorGroup?.getObjectByName('coffee') as THREE.Mesh;
        this.registerItem(
            coffeeMesh,
            'coffee',
            'Coffee Mug',
            '☕',
            140,
            [
                'Still warm.',
                'Black coffee, freshly poured.',
                'Refilled earlier.',
            ],
            'bottom',
            () => this.audioManager.playSynthesized('coffee', 0.8),
            (item) => this.animateCoffee(item)
        );

        // 2. Monstera Plant
        const plantMesh = decorGroup?.getObjectByName('plant') as THREE.Mesh;
        this.registerItem(
            plantMesh,
            'plant',
            'Houseplant',
            '🌿',
            320,
            [
                'Watered weekly.',
                'Growing well by the window.',
                'A little greenery next to the setup.',
            ],
            'bottom',
            () => this.audioManager.playSynthesized('plant', 0.75),
            (item) => this.animatePlant(item)
        );

        // 3. Ergonomic Swivel Chair
        const chairSeatMesh = envGroup?.getObjectByName('chair_seat') as THREE.Mesh;
        this.registerItem(
            chairSeatMesh,
            'chair_seat',
            'Desk Chair',
            '💺',
            260,
            [
                'Spins smoothly.',
                'Adjusted to desk height.',
                'Comfortable for long coding sessions.',
            ],
            'bottom',
            () => this.audioManager.playSynthesized('chair', 0.8),
            (item) => this.animateChair(item)
        );

        // 4. Mechanical Keyboard
        const keyboardMesh = compGroup?.getObjectByName('keyboard') as THREE.Mesh;
        this.registerItem(
            keyboardMesh,
            'keyboard',
            'Keyboard',
            '⌨️',
            110,
            [
                'Tactile mechanical keys.',
                'Classic beige keycaps.',
                'Quiet and responsive.',
            ],
            'center',
            () => {
                this.audioManager.playAudio('keyboardKeydown', { volume: 0.9 });
            },
            (item) => this.animateKeyboard(item)
        );

        // 5. Vintage Ball Mouse
        const mouseMesh = compGroup?.getObjectByName('mouse') as THREE.Mesh;
        this.registerItem(
            mouseMesh,
            'mouse',
            'Mouse',
            '🖱️',
            90,
            [
                'Vintage trackball mouse.',
                'Glides smoothly on the pad.',
                'Classic two-button clicker.',
            ],
            'center',
            () => {
                this.audioManager.playAudio('mouseDown', { volume: 0.85 });
                setTimeout(() => {
                    this.audioManager.playAudio('mouseUp', { volume: 0.85 });
                }, 90);
            },
            (item) => this.animateMouse(item)
        );

        // 6. Project Binders
        const binder1Mesh = decorGroup?.getObjectByName('binder_1') as THREE.Mesh;
        this.registerItem(
            binder1Mesh,
            'binder_1',
            'Project Binder',
            '📁',
            170,
            [
                'Project notes and reference docs.',
                'System drafts and sketches.',
                'Archived technical specs.',
            ],
            'bottom',
            () => this.audioManager.playSynthesized('binder', 0.75),
            (item) => this.animateBinder(item)
        );

        const binder2Mesh = decorGroup?.getObjectByName('binder_2') as THREE.Mesh;
        this.registerItem(
            binder2Mesh,
            'binder_2',
            'Project Binder',
            '📁',
            170,
            [
                'Reference guides and documentation.',
                'System drafts and sketches.',
                'Archived technical specs.',
            ],
            'bottom',
            () => this.audioManager.playSynthesized('binder', 0.75),
            (item) => this.animateBinder(item)
        );

        // 7. Documents & Notes
        const paperMesh = decorGroup?.getObjectByName('paper') as THREE.Mesh;
        this.registerItem(
            paperMesh,
            'paper',
            'Notes',
            '📄',
            110,
            [
                'Scratchpad with ideas and to-dos.',
                'Printed documentation.',
                "A copy of Deepak's resume.",
            ],
            'center',
            () => this.audioManager.playSynthesized('paper', 0.8),
            (item) => this.animatePaper(item)
        );

        const paperStackMesh = decorGroup?.getObjectByName('paper_stack_1') as THREE.Mesh;
        this.registerItem(
            paperStackMesh,
            'paper_stack_1',
            'Documents',
            '📚',
            130,
            [
                'Printed documentation.',
                'Scratchpad with ideas and to-dos.',
            ],
            'center',
            () => this.audioManager.playSynthesized('paper', 0.8),
            (item) => this.animatePaper(item)
        );

        // 8. Byte (Deepak's AI Companion Dog)
        if (this.world.dog) {
            this.registerItem(
                this.world.dog.getHitMesh(),
                'dog',
                'Byte (AI Companion)',
                '🐶',
                240,
                [
                    "Woof! I'm Byte, Deepak's coding buddy.",
                    "Sitting right here on the desk while Deepak builds.",
                    "Need help? I'm connected to the AI terminal.",
                    "Tail wagging at 60 FPS.",
                    "Here to keep you company while you explore the workspace.",
                ],
                'center',
                () => this.audioManager.playSynthesized('dog', 0.85),
                (item) => this.animateDog(item),
                true
            );
        }

        // 9. Chew Bone (Byte's Favorite Toy)
        if (this.world.toyBone) {
            this.registerItem(
                this.world.toyBone.getHitMesh(),
                'toy_bone',
                'Chew Bone',
                '🦴',
                115,
                [
                    '*Flicks bone across the table!* Fetch, Byte! 🦴',
                    "Byte's favorite chew bone. Ready for a game of fetch!",
                    'Toss it across the desk and watch Byte sprint!',
                ],
                'center',
                () => {},
                (item) => this.animateToyBone(item),
                true
            );
        }
    }

    // --- Animations using dedicated this.tweenGroup ---

    private animateDog(item: InteractiveItem) {
        this.world.dog.bounce(this.tweenGroup, () => {
            item.isAnimating = false;
        });
        setTimeout(() => {
            item.isAnimating = false;
        }, 320);
    }

    private animateToyBone(item: InteractiveItem) {
        if (item.isAnimating || !this.world.toyBone || this.world.toyBone.isThrown) return;
        item.isAnimating = true;

        // Toss across the open desk surface in front of Byte (unobstructed by keyboard)
        const tossTarget = new THREE.Vector3(-1300, -428, 1150);
        this.world.toyBone.toss(tossTarget, () => {
            if (this.world.dog) {
                this.world.dog.fetchToy(this.world.toyBone, () => {
                    item.isAnimating = false;
                });
            } else {
                setTimeout(() => {
                    this.world.toyBone.resetToDesk();
                    item.isAnimating = false;
                }, 800);
            }
        });
    }

    private animateCoffee(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        this.world.coffeeSteam?.accelerateSteam(4.0, 2000);

        const startPos = item.basePosition.clone();
        const startRot = item.baseRotation.clone();

        // Lift & Tilt
        new TWEEN.Tween(item.mesh.position, this.tweenGroup)
            .to({ y: startPos.y + 35 }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
            .to({ z: startRot.z - 0.16 }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                // Pause for sip then lower & upright
                setTimeout(() => {
                    new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
                        .to({ z: startRot.z }, 200)
                        .easing(TWEEN.Easing.Quadratic.In)
                        .start();

                    new TWEEN.Tween(item.mesh.position, this.tweenGroup)
                        .to({ y: startPos.y }, 260)
                        .easing(TWEEN.Easing.Bounce.Out)
                        .onComplete(() => {
                            item.mesh.position.copy(item.basePosition);
                            item.mesh.rotation.copy(item.baseRotation);
                            item.isAnimating = false;
                        })
                        .start();
                }, 180);
            })
            .start();
    }

    private animatePlant(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        const baseRotZ = item.baseRotation.z;

        new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
            .to({ z: baseRotZ + 0.07 }, 180)
            .easing(TWEEN.Easing.Sinusoidal.Out)
            .onComplete(() => {
                new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
                    .to({ z: baseRotZ - 0.05 }, 220)
                    .easing(TWEEN.Easing.Sinusoidal.InOut)
                    .onComplete(() => {
                        new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
                            .to({ z: baseRotZ + 0.03 }, 240)
                            .easing(TWEEN.Easing.Sinusoidal.InOut)
                            .onComplete(() => {
                                new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
                                    .to({ z: baseRotZ }, 240)
                                    .easing(TWEEN.Easing.Sinusoidal.InOut)
                                    .onComplete(() => {
                                        item.mesh.rotation.copy(item.baseRotation);
                                        item.isAnimating = false;
                                    })
                                    .start();
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    private animateChair(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        const targetRotY = item.mesh.rotation.y + Math.PI * 2;

        new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
            .to({ y: targetRotY }, 1250)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                item.mesh.rotation.y = item.baseRotation.y;
                item.isAnimating = false;
            })
            .start();
    }

    private animateKeyboard(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        const startY = item.basePosition.y;

        new TWEEN.Tween(item.mesh.position, this.tweenGroup)
            .to({ y: startY - 14 }, 60)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                new TWEEN.Tween(item.mesh.position, this.tweenGroup)
                    .to({ y: startY + 4 }, 80)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onComplete(() => {
                        new TWEEN.Tween(item.mesh.position, this.tweenGroup)
                            .to({ y: startY }, 60)
                            .easing(TWEEN.Easing.Quadratic.In)
                            .onComplete(() => {
                                item.mesh.position.copy(item.basePosition);
                                item.isAnimating = false;
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    private animateMouse(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        const startX = item.basePosition.x;
        const startZ = item.basePosition.z;

        new TWEEN.Tween(item.mesh.position, this.tweenGroup)
            .to({ x: startX + 22, z: startZ - 18 }, 120)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                setTimeout(() => {
                    new TWEEN.Tween(item.mesh.position, this.tweenGroup)
                        .to({ x: startX, z: startZ }, 180)
                        .easing(TWEEN.Easing.Cubic.Out)
                        .onComplete(() => {
                            item.mesh.position.copy(item.basePosition);
                            item.isAnimating = false;
                        })
                        .start();
                }, 80);
            })
            .start();
    }

    private animateBinder(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        const startZ = item.basePosition.z;
        const startRotY = item.baseRotation.y;

        new TWEEN.Tween(item.mesh.position, this.tweenGroup)
            .to({ z: startZ + 42 }, 160)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
            .to({ y: startRotY + 0.18 }, 160)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                setTimeout(() => {
                    new TWEEN.Tween(item.mesh.position, this.tweenGroup)
                        .to({ z: startZ }, 160)
                        .easing(TWEEN.Easing.Bounce.Out)
                        .start();

                    new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
                        .to({ y: startRotY }, 160)
                        .easing(TWEEN.Easing.Quadratic.In)
                        .onComplete(() => {
                            item.mesh.position.copy(item.basePosition);
                            item.mesh.rotation.copy(item.baseRotation);
                            item.isAnimating = false;
                        })
                        .start();
                }, 160);
            })
            .start();
    }

    private animatePaper(item: InteractiveItem) {
        if (item.isAnimating) return;
        item.isAnimating = true;

        const startY = item.basePosition.y;
        const startRotY = item.baseRotation.y;
        const startRotZ = item.baseRotation.z;

        new TWEEN.Tween(item.mesh.position, this.tweenGroup)
            .to({ y: startY + 65 }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
            .to({ y: startRotY + 0.22, z: startRotZ + 0.08 }, 240)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                setTimeout(() => {
                    new TWEEN.Tween(item.mesh.position, this.tweenGroup)
                        .to({ y: startY }, 320)
                        .easing(TWEEN.Easing.Quadratic.In)
                        .start();

                    new TWEEN.Tween(item.mesh.rotation, this.tweenGroup)
                        .to({ y: startRotY, z: startRotZ }, 320)
                        .easing(TWEEN.Easing.Quadratic.In)
                        .onComplete(() => {
                            item.mesh.position.copy(item.basePosition);
                            item.mesh.rotation.copy(item.baseRotation);
                            item.isAnimating = false;
                        })
                        .start();
                }, 100);
            })
            .start();
    }

    // --- Retro Speech Bubble DOM ---

    private createBubbleDOM() {
        let container = document.getElementById('desk-dialog-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'desk-dialog-container';
            document.body.appendChild(container);
        }
        this.bubbleContainer = container;

        let bubble = document.getElementById('desk-speech-bubble');
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = 'desk-speech-bubble';
            bubble.className = 'retro-desk-bubble';
            bubble.innerHTML = `
                <div class="bubble-header">
                    <div class="bubble-title"><span class="bubble-icon">☕</span> <span class="bubble-title-text">Item Title</span></div>
                    <button class="bubble-close-btn" type="button" aria-label="Close dialog">✕</button>
                </div>
                <div class="bubble-body">
                    <p class="bubble-text">Dialog quote content goes here.</p>
                    <div class="bubble-actions" style="display: none;">
                        <button class="retro-bubble-action-btn btn-open-byte" type="button">💬 Open Byte.exe</button>
                        <button class="retro-bubble-action-btn btn-treat-dog" type="button">🦴 Give Treat</button>
                    </div>
                </div>
                <div class="bubble-beak"></div>
            `;
            container.appendChild(bubble);

            const closeBtn = bubble.querySelector('.bubble-close-btn');
            closeBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideBubble();
            });

            const openByteBtn = bubble.querySelector('.btn-open-byte');
            openByteBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                const iframe = document.getElementById('computer-screen') as HTMLIFrameElement;
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({ type: 'OPEN_BYTE_AI' }, '*');
                }
                this.camera.transition(CameraKey.MONITOR);
                this.hideBubble();
            });

            const treatBtn = bubble.querySelector('.btn-treat-dog');
            treatBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.world.dog) {
                    this.world.dog.spin(this.tweenGroup);
                }
                this.audioManager.playSynthesized('treat', 0.9);
                const textEl = this.bubbleElement?.querySelector('.bubble-text');
                if (textEl) {
                    textEl.textContent = '*Crunch crunch!* Woof! Byte loved that treat! 🦴✨';
                }
                const iframe = document.getElementById('computer-screen') as HTMLIFrameElement;
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({ type: 'BYTE_APP_EVENT', action: 'treat' }, '*');
                }
                if (this.bubbleDismissTimeout) clearTimeout(this.bubbleDismissTimeout);
                this.bubbleDismissTimeout = setTimeout(() => {
                    this.hideBubble();
                }, 4500);
            });
        }
        this.bubbleElement = bubble;
    }

    public showBubble(item: InteractiveItem) {
        if (!this.bubbleElement) return;

        this.activeItem = item;

        const quote = item.quotes[item.quoteIndex % item.quotes.length];
        item.quoteIndex++;

        const iconEl = this.bubbleElement.querySelector('.bubble-icon');
        const titleEl = this.bubbleElement.querySelector('.bubble-title-text');
        const textEl = this.bubbleElement.querySelector('.bubble-text');
        const actionsEl = this.bubbleElement.querySelector('.bubble-actions') as HTMLElement;

        if (iconEl) iconEl.textContent = item.icon;
        if (titleEl) titleEl.textContent = item.title;
        if (textEl) textEl.textContent = quote;

        if (actionsEl) {
            if (item.id === 'dog') {
                actionsEl.style.display = 'flex';
            } else {
                actionsEl.style.display = 'none';
            }
        }

        this.updateBubblePosition();
        this.bubbleElement.classList.add('visible');

        if (this.bubbleDismissTimeout) {
            clearTimeout(this.bubbleDismissTimeout);
        }
        this.bubbleDismissTimeout = setTimeout(() => {
            this.hideBubble();
        }, item.id === 'dog' ? 6500 : 4500);
    }

    public hideBubble() {
        if (!this.bubbleElement) return;
        this.bubbleElement.classList.remove('visible');
        this.bubbleElement.style.display = 'none';
        this.activeItem = null;
        if (this.bubbleDismissTimeout) {
            clearTimeout(this.bubbleDismissTimeout);
            this.bubbleDismissTimeout = null;
        }
    }

    private updateBubblePosition() {
        if (!this.bubbleElement || !this.activeItem) return;

        const worldPos = new THREE.Vector3();
        this.activeItem.mesh.getWorldPosition(worldPos);
        worldPos.y += this.activeItem.yOffset;

        const projected = worldPos.clone().project(this.camera.instance);

        // If behind camera or monitor view active, hide
        if (projected.z > 1 || this.camera.currentKeyframe === CameraKey.MONITOR) {
            this.bubbleElement.style.display = 'none';
            return;
        }

        const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;

        const bubbleWidth = this.bubbleElement.offsetWidth || 280;
        const bubbleHeight = this.bubbleElement.offsetHeight || 90;

        let left = screenX - bubbleWidth / 2;
        let top = screenY - bubbleHeight - 16;

        left = Math.max(16, Math.min(window.innerWidth - bubbleWidth - 16, left));
        top = Math.max(16, Math.min(window.innerHeight - bubbleHeight - 16, top));

        this.bubbleElement.style.left = `${left}px`;
        this.bubbleElement.style.top = `${top}px`;
        this.bubbleElement.style.display = 'block';
    }

    // --- Hover & Click Event Handling ---

    private setupEventListeners() {
        window.addEventListener('mousemove', (e) => {
            this.onMouseMove(e);
        });

        // Use capture phase on window so deskObjectClicked is set before Camera mousedown bubbles
        window.addEventListener(
            'mousedown',
            (e) => {
                this.onMouseDown(e);
            },
            true
        );

        UIEventBus.on('enterMonitor', () => {
            this.hideBubble();
        });
    }

    private onMouseMove(event: MouseEvent) {
        // If mouse is inside computer screen, do not raycast desk objects
        // @ts-ignore
        if (event.inComputer || this.application.mouse.inComputer) {
            if (this.hoveredMesh) {
                this.setMeshHover(this.hoveredMesh, false);
                this.hoveredMesh = null;
            }
            return;
        }

        this.mouseNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (this.camera.currentKeyframe === CameraKey.MONITOR) {
            return;
        }

        this.raycaster.setFromCamera(this.mouseNDC, this.camera.instance);
        const intersects = this.raycaster.intersectObjects(this.meshList, false);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object as THREE.Mesh;
            if (hitMesh.name === 'dog' && this.world.dog) {
                const deltaMove = Math.hypot(event.movementX || 0, event.movementY || 0);
                this.world.dog.handlePetStroke(deltaMove);
            }
            if (this.hoveredMesh !== hitMesh) {
                if (this.hoveredMesh) {
                    this.setMeshHover(this.hoveredMesh, false);
                }
                this.hoveredMesh = hitMesh;
                this.setMeshHover(hitMesh, true);
            }
            document.body.style.cursor = 'pointer';
        } else {
            if (this.hoveredMesh) {
                this.setMeshHover(this.hoveredMesh, false);
                this.hoveredMesh = null;
                document.body.style.cursor = 'default';
            }
            if (this.world.dog && this.world.dog.isPetting) {
                this.world.dog.stopPetting();
            }
        }
    }

    private setMeshHover(mesh: THREE.Mesh, isHovered: boolean) {
        const item = this.interactiveItems.get(mesh);
        if (!item) return;

        if (item.id === 'dog') {
            if (isHovered && this.world.dog) {
                this.world.dog.handleHoverEnter();
            } else if (!isHovered && this.world.dog) {
                this.world.dog.handleHoverLeave();
            }
            return;
        }

        if (item.isAnimating) return;

        if (item.id === 'toy_bone') {
            if (this.world.toyBone && !this.world.toyBone.isThrown) {
                const targetScaleVal = isHovered ? 1.08 : 1.0;
                new TWEEN.Tween(this.world.toyBone.group.scale, this.tweenGroup)
                    .to({ x: targetScaleVal, y: targetScaleVal, z: targetScaleVal }, 120)
                    .start();
            }
            return;
        }

        const targetScaleVal = isHovered ? 1.035 : 1.0;
        const targetScale = item.baseScale.clone().multiplyScalar(targetScaleVal);

        new TWEEN.Tween(mesh.scale, this.tweenGroup)
            .to(
                {
                    x: targetScale.x,
                    y: targetScale.y,
                    z: targetScale.z,
                },
                140
            )
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    }

    private onMouseDown(event: MouseEvent) {
        // Ignore clicks on retro bubble or UI interactive overlay
        const target = event.target as HTMLElement;
        if (target && target.closest && target.closest('#desk-dialog-container, #ui-interactive, .retro-desk-bubble')) {
            return;
        }

        // Ignore clicks inside the computer screen iframe
        // @ts-ignore
        if (event.inComputer || this.application.mouse.inComputer) {
            return;
        }

        if (this.camera.currentKeyframe === CameraKey.MONITOR) {
            return;
        }

        this.mouseNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouseNDC, this.camera.instance);
        const intersects = this.raycaster.intersectObjects(this.meshList, false);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object as THREE.Mesh;
            const item = this.interactiveItems.get(hitMesh);
            if (item) {
                if (item.id === 'dog' && this.world.dog) {
                    this.world.dog.registerInteraction();
                    item.isAnimating = false;
                }
                // Inform Camera.ts not to transition back to IDLE
                // @ts-ignore
                event.deskObjectClicked = true;

                // If currently in IDLE view, zoom into DESK view
                if (
                    this.camera.currentKeyframe === CameraKey.IDLE ||
                    this.camera.targetKeyframe === CameraKey.IDLE
                ) {
                    this.camera.transition(CameraKey.DESK);
                }

                // Trigger audio, animation, and speech bubble
                item.playAudio();
                item.animate();
                this.showBubble(item);
            }
        } else {
            // Clicked empty space on desk/wall: smoothly hide any open dialog
            this.hideBubble();
        }
    }

    public update() {
        this.tweenGroup.update();
        if (this.activeItem) {
            this.updateBubblePosition();
        }
    }
}

// Trackball mouse lift animation

// Project binders inspection animation

// Documents lift animation

// Retro dialog bubble popup

// Hide bubble on MONITOR keyframe entry

// Coffee cup animation and accelerated steam

// Sound synthesis on desk interactions
