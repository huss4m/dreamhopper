import { AnimationGroup, Scene } from "@babylonjs/core";

export class NPCAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isBlending = false;
  private blendFrameId: number | null = null; // Track requestAnimationFrame ID

  constructor(private scene: Scene) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing NPCAnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    // Start with the Idle animation if available
    const idleAnim = this.getAnimationByName("Idle");
    if (idleAnim) {
      idleAnim.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("Idle animation not found for NPC");
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
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    // Skip if already playing the same animation
    if (name === this.currentAnimationName && newAnim.isPlaying) {
      return;
    }

    // Cancel any ongoing blending
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }

    const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

    // Stop previous animation and reset weights
    if (prevAnim) {
      prevAnim.setWeightForAllAnimatables(0);
      prevAnim.stop();
    }

    // Start the new animation
    newAnim.stop(); // Ensure clean start
    newAnim.start(loop, speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
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

  public dispose(): void {
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
  }
}