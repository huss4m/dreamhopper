import { AnimationGroup, Scene } from "@babylonjs/core";

export class AnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationIndex = -1;
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
        this.playAnimation(0);
      });
    } else {
      console.warn("Jump animation not found");
    }
  }

  public playAnimation(index: number): void {
    if (!this.animationGroups[index]) {
      console.warn(`Animation group ${index} not found`);
      return;
    }
    if (index === this.currentAnimationIndex) {
      return;
    }

    this.animationGroups.forEach((group, i) => {
      if (i !== index) {
        group.stop();
      }
    });

    const animationGroup = this.animationGroups[index];
    animationGroup.start(index !== 1, 1.0, 0, undefined, false);
    this.currentAnimationIndex = index;

    if (index === 1) {
      this.isJumping = true;
    }

    console.log(`Playing animation group ${index}: ${animationGroup.name}`);
  }

  public isCharacterJumping(): boolean {
    return this.isJumping;
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
  }
}