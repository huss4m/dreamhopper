import { AnimationGroup, Scene, Mesh, Sound, Observable } from "@babylonjs/core";
import { Game } from "../Game";
import { Enemy } from "./Enemy";

export class EnemyAnimationManager {
    protected animationGroups: AnimationGroup[] = [];
    public currentAnimationName: string | null = null;
    protected isBlending = false;
    protected blendFrameId: number | null = null;
    protected footstepSounds: Sound[] = [];
    protected footstepFrames: number[] = [];
    protected footstepObserver: any = null;
    protected animationProgressObserver: any = null; // For debug logging only
    protected animationKeyFrameObserver: any = null; // For keyframe events
    public onAnimationProgress: Observable<{ name: string; progress: number }> = new Observable(); // For debug
    public onAnimationKeyFrame: Observable<{ name: string; frame: number }> = new Observable(); // Keyframe events

    constructor(
        protected scene: Scene,
        protected game?: Game,
        protected enemy?: Enemy
    ) {}

    public initialize(animationGroups: AnimationGroup[]): void {
        this.animationGroups = animationGroups;
        // console.log(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Initialized with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

        this.loadFootstepSounds();

        const idleAnim = this.getAnimationByName(this.enemy!.config.animations.idle);
        if (idleAnim) {
            idleAnim.play(true);
            this.currentAnimationName = this.enemy!.config.animations.idle;
        } else {
            console.warn(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Idle animation not found`);
        }
    }

    protected loadFootstepSounds(): void {
        const soundFiles = [
            "./sfx/footstep1.wav",
            "./sfx/footstep2.wav",
            "./sfx/footstep3.wav",
            "./sfx/footstep4.wav"
        ];

        const enemyMesh = this.enemy?.getEnemyMesh();
        if (!enemyMesh) {
            console.warn(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Enemy mesh not available for spatial sound attachment`);
        }

        for (const file of soundFiles) {
            const sound = new Sound(
                `footstep_${file.split('/').pop()}`,
                file,
                this.scene,
                () => {
                    this.footstepSounds.push(sound);
                    if (enemyMesh) {
                        sound.attachToMesh(enemyMesh);
                    }
                    if (this.footstepSounds.length === soundFiles.length) {
                        // console.log(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Successfully loaded ${this.footstepSounds.length} footstep sounds`);
                    }
                },
                {
                    autoplay: false,
                    loop: false,
                    spatialSound: true,
                    maxDistance: 70,
                    volume: 0.5
                }
            );
        }
    }

    public playAnimation(
        name: string,
        speed = 1.0,
        fromFrame?: number,
        toFrame?: number,
        loop = true
    ): void {
        const newAnim = this.getAnimationByName(name);
        if (!newAnim) {
            console.warn(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Animation group '${name}' not found`);
            return;
        }

        if (name === this.currentAnimationName && newAnim.isPlaying) {
            return;
        }

        // Clean up existing observers
        if (this.animationProgressObserver) {
            this.scene.onBeforeRenderObservable.remove(this.animationProgressObserver);
            this.animationProgressObserver = null;
        }
        if (this.animationKeyFrameObserver) {
            this.scene.onBeforeRenderObservable.remove(this.animationKeyFrameObserver);
            this.animationKeyFrameObserver = null;
        }
        if (this.footstepObserver) {
            this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
            this.footstepObserver = null;
            this.footstepFrames = [];
        }

        // Setup footstep logic for walking animations
        const walkingAnimations = ["Run", "RunBackwards", "RightStrafe", "StrafeLeft"];
        if (walkingAnimations.includes(name) && this.footstepSounds.length > 0) {
            const frameRange = (toFrame ?? newAnim.to) - (fromFrame ?? newAnim.from);
            this.footstepFrames = [
                (fromFrame ?? newAnim.from) + 0.25 * frameRange,
                (fromFrame ?? newAnim.from) + 0.75 * frameRange
            ];

            this.footstepObserver = this.scene.onBeforeRenderObservable.add(() => {
                if (newAnim.isPlaying && newAnim.animatables.length > 0) {
                    const animatable = newAnim.animatables[0];
                    const currentFrame = animatable.masterFrame;

                    for (let i = 0; i < this.footstepFrames.length; i++) {
                        const frame = this.footstepFrames[i];
                        if (currentFrame >= frame && currentFrame < frame + 1) {
                            const soundIndex = Math.floor(Math.random() * this.footstepSounds.length);
                            this.footstepSounds[soundIndex].play();
                            if (newAnim.isStarted && loop) {
                                this.footstepFrames[i] += frameRange;
                            }
                        }
                    }
                } else {
                    this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
                    this.footstepObserver = null;
                    this.footstepFrames = [];
                }
            });
        }

        // Setup keyframe monitoring for attack animations
        const attack = this.enemy?.config.attacks.find(a => a.animation === name);
        if (attack) {
            const triggerFrame = attack.triggerFrame;
            let hasTriggered = false; // Prevent multiple triggers per cycle

            this.animationKeyFrameObserver = this.scene.onBeforeRenderObservable.add(() => {
                if (newAnim.isPlaying && newAnim.animatables.length > 0) {
                    const animatable = newAnim.animatables[0];
                    const currentFrame = Math.floor(animatable.masterFrame); // Integer frame

                    if (currentFrame === triggerFrame && !hasTriggered) {
                        this.onAnimationKeyFrame.notifyObservers({ name, frame: currentFrame });
                        hasTriggered = true;
                        // console.log(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Keyframe ${triggerFrame} reached for ${name}`);
                    }

                    // Optional: Keep progress for debug logging
                    const fromFrame = newAnim.from || 0;
                    const toFrame = newAnim.to || 100;
                    const frameRange = toFrame - fromFrame;
                    const progress = frameRange > 0 ? (currentFrame - fromFrame) / frameRange : 0;
                    this.onAnimationProgress.notifyObservers({ name, progress });
                    //// console.log(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Attack animation ${name} frame: ${currentFrame}, progress: ${(progress * 100).toFixed(2)}%`);
                } else {
                    this.scene.onBeforeRenderObservable.remove(this.animationKeyFrameObserver);
                    this.animationKeyFrameObserver = null;
                }
            });

            // Reset hasTriggered on loop
            newAnim.onAnimationGroupLoopObservable.add(() => {
                hasTriggered = false;
                // console.log(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Animation ${name} looped, reset keyframe trigger`);
            });
        }

        // Stop previous animation and start new one
        if (this.blendFrameId !== null) {
            cancelAnimationFrame(this.blendFrameId);
            this.blendFrameId = null;
        }

        const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

        if (prevAnim) {
            prevAnim.setWeightForAllAnimatables(0);
            prevAnim.stop();
        }

        newAnim.stop();
        newAnim.start(loop, speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
        newAnim.setWeightForAllAnimatables(0);

        this.currentAnimationName = name;
        this.isBlending = true;

        const blendDuration = 300;
        const startTime = performance.now();

        const blendStep = (now: number) => {
            const t = Math.min((now - startTime) / blendDuration, 1);
            newAnim.setWeightForAllAnimatables(t);
            if (prevAnim) prevAnim.setWeightForAllAnimatables(1 - t);

            if (t < 1) {
                this.blendFrameId = requestAnimationFrame(blendStep);
            } else {
                if (prevAnim) prevAnim.stop();
                newAnim.setWeightForAllAnimatables(1);
                this.isBlending = false;
                this.blendFrameId = null;
            }
        };

        this.blendFrameId = requestAnimationFrame(blendStep);
    }

    public hasAnimationEnded(name: string): boolean {
        const anim = this.getAnimationByName(name);
        return anim?.isPlaying === false;
    }

    public getAnimationByName(name: string): AnimationGroup | undefined {
        return this.animationGroups.find(group => group.name === name);
    }

    public getAnimationGroups(): AnimationGroup[] {
        return this.animationGroups;
    }

    public isAnimationPlaying(name: string): boolean {
      const anim = this.getAnimationByName(name);
      return anim?.isPlaying || false;
    }

      // [NEW] Getter for current animation name
    public getCurrentAnimationName(): string | null {
      return this.currentAnimationName;
    }


    public dispose(): void {
        if (this.blendFrameId !== null) {
            cancelAnimationFrame(this.blendFrameId);
            this.blendFrameId = null;
        }
        if (this.animationProgressObserver) {
            this.scene.onBeforeRenderObservable.remove(this.animationProgressObserver);
            this.animationProgressObserver = null;
        }
        if (this.animationKeyFrameObserver) {
            this.scene.onBeforeRenderObservable.remove(this.animationKeyFrameObserver);
            this.animationKeyFrameObserver = null;
        }
        this.onAnimationProgress.clear();
        this.onAnimationKeyFrame.clear();
        this.animationGroups.forEach(group => group.dispose());
        this.animationGroups = [];
        this.footstepSounds.forEach(sound => sound.dispose());
        this.footstepSounds = [];
        if (this.footstepObserver) {
            this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
            this.footstepObserver = null;
        }
        // console.log(`EnemyAnimationManager for Enemy ${this.enemy?.getId()}: Disposed`);
    }
}