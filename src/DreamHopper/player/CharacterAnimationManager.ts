import { AnimationGroup, Scene } from "@babylonjs/core";

export class CharacterAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isJumping = false;

  public idle: AnimationGroup | null = null;
  public jump: AnimationGroup | null = null;
  public walk: AnimationGroup | null = null;
  public strafeLeftAnim: AnimationGroup | null = null;
  public strafeRightAnim: AnimationGroup | null = null;
  public backPedalAnim: AnimationGroup | null = null;

  constructor(private scene: Scene) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing AnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    if (this.animationGroups.length < 6) {
      console.warn(`Expected at least 6 animation groups, found ${this.animationGroups.length}. Animations may not work as expected.`);
      return;
    }

    this.idle = this.animationGroups[0];
    this.jump = this.animationGroups[1];
    this.walk = this.animationGroups[2];
    this.backPedalAnim = this.animationGroups[3];
    this.strafeLeftAnim = this.animationGroups[4];
    this.strafeRightAnim = this.animationGroups[5];

    if (this.idle) {
      this.idle.play(true);
      console.log("Playing idle animation");
    } else {
      console.warn("Idle animation not found");
    }

    this.setupJumpDetection();
  }

  private setupJumpDetection(): void {
    if (this.jump) {
      this.jump.onAnimationGroupEndObservable.add(() => {
        this.isJumping = false;
      });
    } else {
      console.warn("Jump animation not found");
    }
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number
  ): void {
    const animationGroup = this.getAnimationByName(name);
    if (!animationGroup) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    if (name === this.currentAnimationName) {
      return;
    }

    this.animationGroups.forEach(group => {
      if (group.name !== name) {
        group.stop();
      }
    });

    animationGroup.speedRatio = speed;
    const from = fromFrame ?? 0;
    const to = toFrame ?? animationGroup.to;

    const isJumpAnimation = animationGroup === this.jump;
    animationGroup.start(!isJumpAnimation, 1.0, from, to, false);
    this.currentAnimationName = name;

    if (isJumpAnimation) {
      this.isJumping = true;
    }

    console.log(`Playing animation group '${name}' from ${from} to ${to} at speed ${speed}`);
  }

  public isCharacterJumping(): boolean {
    return this.isJumping;
  }

  hasAnimationEnded(index: number): boolean {
    const anim = this.animationGroups[index];
    return anim.isPlaying === false;
  }

  getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
  }
}