import { AnimationGroup, Scene } from "@babylonjs/core";

export class CharacterAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isJumping = false;
  private isBlending = false;
  private blendFrameId: number | null = null; // Track requestAnimationFrame ID

  constructor(private scene: Scene) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing AnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    if (this.animationGroups.length < 6) {
      console.warn(`Expected at least 6 animation groups, found ${this.animationGroups.length}. Animations may not work as expected.`);
      return;
    }

    if (this.getAnimationByName("IdleGreatSword")) {
      this.getAnimationByName("IdleGreatSword")!.play(true);
      this.currentAnimationName = "IdleGreatSword";
    } else {
      console.warn("Idle animation not found");
    }

    this.setupJumpDetection();
    this.setupSlashDetection();
  }

  private setupJumpDetection(): void {
    if (this.getAnimationByName("Jump")) {
      this.getAnimationByName("Jump")!.onAnimationGroupEndObservable.add(() => {
        this.isJumping = false;
        this.currentAnimationName = null;
      });
    } else {
      console.warn("Jump animation not found");
    }
  }

  private setupSlashDetection(): void {
    if (this.getAnimationByName("Slash")) {
      this.getAnimationByName("Slash")!.onAnimationGroupEndObservable.add(() => {
        this.currentAnimationName = null;
      });
    } else {
      console.warn("Slash animation not found");
    }
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number
  ): void {
    const newAnim = this.getAnimationByName(name);
    if (!newAnim) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    // Allow Slash or Jump to interrupt other animations
    if ((name === "Slash" || name === "Jump") && this.currentAnimationName !== name) {
      const prevAnim = this.getAnimationByName(this.currentAnimationName || "");
      if (prevAnim) {
        prevAnim.stop();
        prevAnim.setWeightForAllAnimatables(0);
      }
    } else if (name === this.currentAnimationName && newAnim.isPlaying) {
      return; // Skip if already playing the same animation
    }

    // Cancel any ongoing blending
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }

    const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

    // Stop previous animation and reset weights (unless Slash or Jump already handled it)
    if (prevAnim && name !== "Slash" && name !== "Jump") {
      prevAnim.setWeightForAllAnimatables(0);
      prevAnim.stop();
    }

    // Start the new animation
    newAnim.stop(); // Ensure clean start
    newAnim.start(!(newAnim.name === "Jump" || newAnim.name === "Slash"), speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
    newAnim.setWeightForAllAnimatables(0);

    this.currentAnimationName = name;
    this.isBlending = true;

    // Perform blending over 300ms
    const blendDuration = 300;
    const startTime = performance.now();

    const blendStep = (now: number) => {
      const t = Math.min((now - startTime) / blendDuration, 1); // Normalize 0 -> 1
      newAnim.setWeightForAllAnimatables(t);
      if (prevAnim) prevAnim.setWeightForAllAnimatables(1 - t);

      if (t < 1) {
        this.blendFrameId = requestAnimationFrame(blendStep);
      } else {
        // Blending complete
        if (prevAnim) prevAnim.stop();
        newAnim.setWeightForAllAnimatables(1);
        this.isBlending = false;
        this.blendFrameId = null;
      }
    };

    this.blendFrameId = requestAnimationFrame(blendStep);

    // If it's a jump animation, mark jumping
    if (newAnim === this.getAnimationByName("Jump")) {
      this.isJumping = true;
    }
  }

  public* animationBlending(toAnim: AnimationGroup, fromAnim: AnimationGroup): Generator<any, void, unknown> {
    let currentWeight = 1;
    let newWeight = 0;

    toAnim.play(true);

    while (newWeight < 1) {
      newWeight += 0.01;
      currentWeight -= 0.01;
      toAnim.setWeightForAllAnimatables(newWeight);
      fromAnim.setWeightForAllAnimatables(currentWeight);
      yield; // Pause execution until next frame
    }

    toAnim.setWeightForAllAnimatables(1);
    fromAnim.setWeightForAllAnimatables(0);
  }

  public blendAnimations(fromAnimName: string, toAnimName: string): void {
    const fromAnim = this.getAnimationByName(fromAnimName);
    const toAnim = this.getAnimationByName(toAnimName);

    if (!fromAnim || !toAnim) {
      console.warn("One or both animations not found for blending");
      return;
    }

    if (this.isBlending) {
      console.warn("Already blending animations");
      return;
    }

    this.isBlending = true;
    this.currentAnimationName = toAnimName;

    const blendGen = this.animationBlending(toAnim, fromAnim);

    const blendStep = () => {
      if (!blendGen.next().done) {
        this.blendFrameId = requestAnimationFrame(blendStep);
      } else {
        this.isBlending = false;
        this.blendFrameId = null;
      }
    };

    this.blendFrameId = requestAnimationFrame(blendStep);
  }

  public isCharacterJumping(): boolean {
    return this.isJumping;
  }

  public isAnimationPlaying(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying || false;
  }

  hasAnimationEnded(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying === false;
  }

  getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
  }
}