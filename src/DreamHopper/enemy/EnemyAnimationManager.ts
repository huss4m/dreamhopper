import { AnimationGroup, Scene } from "@babylonjs/core";

export class EnemyAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isBlending = false;
  private blendFrameId: number | null = null;

  constructor(private scene: Scene) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing EnemyAnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    const idleAnim = this.getAnimationByName("Idle");
    if (idleAnim) {
      idleAnim.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("Idle animation not found for Enemy");
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

    if (name === this.currentAnimationName && newAnim.isPlaying) {
      return;
    }

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

  public dispose(): void {
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
  }
}