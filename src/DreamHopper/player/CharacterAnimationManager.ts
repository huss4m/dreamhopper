import { AnimationGroup, Scene } from "@babylonjs/core";

export class CharacterAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isJumping = false;

  constructor(private scene: Scene) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing AnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    if (this.animationGroups.length < 6) {
      console.warn(`Expected at least 6 animation groups, found ${this.animationGroups.length}. Animations may not work as expected.`);
      return;
    }

    const idleAnimation = this.getAnimationByName("IdleGreatSword");
    if (idleAnimation) {
      idleAnimation.play(true);
    } else {
      console.warn("Idle animation not found");
    }

    this.setupJumpDetection();
  }

  private setupJumpDetection(): void {
    const jumpAnim = this.getAnimationByName("Jump");
    if (jumpAnim) {
      jumpAnim.onAnimationGroupEndObservable.add(() => {
        this.isJumping = false;
        this.currentAnimationName = null; // Allow idle animation to play
        const idleAnimation = this.getAnimationByName("IdleGreatSword");
        if (idleAnimation && !this.keyStatesActive()) {
          idleAnimation.play(true);
        }
      });
    } else {
      console.warn("Jump animation not found");
    }
  }

  private keyStatesActive(): boolean {
    // This method should be updated to check actual key states via InputHandler
    // For now, assume no movement keys are pressed
    return false;
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number,
    blendDuration = 0.3
  ): void {
    const newAnimation = this.getAnimationByName(name);
    if (!newAnimation) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    if (name === this.currentAnimationName) {
      return;
    }

    const isJumpAnimation = name === "Jump";

    // Stop all animations except the new one
    this.animationGroups.forEach(group => {
      if (group.name !== name && group.isPlaying) {
        if (isJumpAnimation) {
          // For jump, stop other animations immediately without blending
          group.stop();
          group.weight = -1; // Disable influence
        } else {
          // Blend for non-jump animations
          this.blendAnimation(group, newAnimation, blendDuration);
        }
      }
    });

    newAnimation.speedRatio = speed;
    const from = fromFrame ?? 0;
    const to = toFrame ?? newAnimation.to;

    newAnimation.start(!isJumpAnimation, speed, from, to, false);
    newAnimation.weight = 1; // Ensure full influence
    this.currentAnimationName = name;

    if (isJumpAnimation) {
      this.isJumping = true;
    }
  }

  private blendAnimation(
    fromAnim: AnimationGroup,
    toAnim: AnimationGroup,
    blendDuration: number
  ): void {
    const frameRate = this.scene.getEngine().getFps();
    const blendFrames = blendDuration * frameRate;

    // Start the new animation with initial weight of 0
    toAnim.start(true, toAnim.speedRatio, toAnim.from, toAnim.to, false);
    toAnim.weight = 0;

    // Create a blending animation
    let currentFrame = 0;
    const onAnimationFrame = () => {
      currentFrame++;
      const t = currentFrame / blendFrames;
      
      // Linear interpolation for blending
      const fromWeight = 1 - t;
      const toWeight = t;

      fromAnim.weight = fromWeight;
      toAnim.weight = toWeight;

      if (currentFrame >= blendFrames) {
        fromAnim.stop();
        fromAnim.weight = -1; // Disable influence
        toAnim.weight = 1;
        this.scene.onBeforeRenderObservable.removeCallback(onAnimationFrame);
      }
    };

    this.scene.onBeforeRenderObservable.add(onAnimationFrame);
  }

  public isCharacterJumping(): boolean {
    return this.isJumping;
  }

  public hasAnimationEnded(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim ? !anim.isPlaying : true;
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
  }
}