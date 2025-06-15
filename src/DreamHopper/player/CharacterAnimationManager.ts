import { AnimationGroup, Scene, Sound, Observable, Vector3, AssetsManager } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { CharacterAttackSystem } from "./CharacterAttackSystem";
import { TargetingSystem } from "../TargetingSystem";
import { GameManager } from "../GameManager";
import { AbilityConfig } from "./AbilityConfig";

export class CharacterAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isJumping = false;
  private isBlending = false;
  private blendFrameId: number | null = null;
  private abilitySpawned = false;
  private footstepSounds: Sound[] = [];
  private footstepFrames: number[] = [];
  private footstepObserver: any = null;
  // MODIFIED: Added triggerFrame to AbilityAnimationState
  public onAbilityAnimationState = new Observable<{
    abilityId: string;
    abilityName: string;
    isPlaying: boolean;
    progress?: number;
    triggerFrame?: number;
  }>();
  private attackSystem: CharacterAttackSystem | null = null;
  private abilities: Map<string, AbilityConfig> = new Map();

  constructor(
    private scene: Scene,
    public characterController?: CharacterController,
    private targetingSystem?: TargetingSystem,
    private gameManager?: GameManager
  ) {
    if (characterController) {
      this.attackSystem = new CharacterAttackSystem(scene, characterController, targetingSystem, gameManager);
    }
  }

  public setAttackSystem(attackSystem: CharacterAttackSystem): void {
    this.attackSystem = attackSystem;
  }

  public async initialize(animationGroups: AnimationGroup[]): Promise<void> {
    this.animationGroups = animationGroups;
    await this.loadAbilities();
    this.loadFootstepSounds();

    if (this.getAnimationByName("Idle")) {
      this.getAnimationByName("Idle")!.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("CharacterAnimationManager: Idle animation not found");
    }

    this.setupJumpDetection();
    this.setupAbilityDetection();
  }

  private async loadAbilities(): Promise<void> {
    const assetsManager = new AssetsManager(this.scene);
    const assetTask = assetsManager.addTextFileTask("abilities", "./abilities.json");
    await assetsManager.loadAsync();
    const abilities: AbilityConfig[] = JSON.parse(assetTask.text);
    abilities.forEach(ability => this.abilities.set(ability.id, ability));
  }

  private loadFootstepSounds(): void {
    const soundFiles = [
      "./sfx/footstep1.wav",
      "./sfx/footstep2.wav",
      "./sfx/footstep3.wav",
      "./sfx/footstep4.wav",
    ];

    const characterMesh = this.characterController?.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.warn("Character mesh not available for spatial sound attachment");
    }

    for (const file of soundFiles) {
      const sound = new Sound(
        `footstep_${file.split("/").pop()}`,
        file,
        this.scene,
        () => {
          this.footstepSounds.push(sound);
          if (characterMesh) sound.attachToMesh(characterMesh);
          if (this.footstepSounds.length === soundFiles.length) {
            // console.log(`Successfully loaded ${this.footstepSounds.length} footstep sounds`);
          }
        },
        { autoplay: false, loop: false, spatialSound: true, maxDistance: 20, volume: 0.5 }
      );
    }
  }

  private setupJumpDetection(): void {
    const jumpAnim = this.getAnimationByName("Jump");
    if (jumpAnim) {
      jumpAnim.onAnimationGroupEndObservable.add(() => {
        this.isJumping = false;
        this.currentAnimationName = null;
      });
    } else {
      console.warn("Jump animation not found");
    }
  }

  private setupAbilityDetection(): void {
    this.abilities.forEach(ability => {
      const anim = this.getAnimationByName(ability.animation.name);
      if (anim) {
        anim.onAnimationEndObservable.add(() => {
          console.log(`[${ability.id}] Animation ${ability.name} ended`);
          this.onAbilityAnimationState.notifyObservers({ abilityId: ability.id, abilityName: ability.name, isPlaying: false });
          if (this.attackSystem) this.attackSystem.stopSounds();
        });
      }
    });
  }

  public cancelAbility(abilityId: string): boolean {
    const ability = this.abilities.get(abilityId);
    if (!ability) {
      console.warn(`Ability ${abilityId} not found`);
      return false;
    }

    const anim = this.getAnimationByName(ability.animation.name);
    if (anim && anim.isPlaying) {
      console.log(`Canceling ability: abilityId=${abilityId}, abilityName=${ability.name}`);
      anim.stop();
      this.onAbilityAnimationState.notifyObservers({ abilityId, abilityName: ability.name, isPlaying: false });
      this.abilitySpawned = false;
      this.currentAnimationName = null;
      if (this.blendFrameId !== null) {
        cancelAnimationFrame(this.blendFrameId);
        this.blendFrameId = null;
        this.isBlending = false;
      }
      if (this.attackSystem) this.attackSystem.stopSounds();
      if (this.getAnimationByName("Idle")) {
        this.getAnimationByName("Idle")!.play(true);
        this.currentAnimationName = "Idle";
      }
      return true;
    }
    return false;
  }


  public getAbility(id: string): AbilityConfig | undefined {
    return this.abilities.get(id);
  }

  public getAbilities(): Map<string, AbilityConfig> {
    return this.abilities;
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number,
    loop?: boolean,
    abilityId?: string
  ): void {
    const newAnim = this.getAnimationByName(name);
    if (!newAnim) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    if (this.characterController?.getPlayer().isPlayerDead() && name !== "Death" && name !== "Idle") {
      console.log(`Cannot play ${name}: player is dead`);
      return;
    }

    let ability: AbilityConfig | undefined;
    if (abilityId) {
      ability = this.abilities.get(abilityId);
      if (!ability) {
        console.warn(`Ability ${abilityId} not found for animation ${name}`);
      } else if (ability.animation.name !== name) {
        console.warn(`Ability ${abilityId} animation mismatch: expected ${ability.animation.name}, got ${name}`);
      }
    } else {
      ability = Array.from(this.abilities.values()).find(a => a.animation.name === name);
    }

    if (ability) {
      const characterMesh = this.characterController?.characterMeshLoader.getCharacterMesh();
      if (!this.characterController || !this.characterController.physicsController || !characterMesh) {
        console.warn(`Cannot play ${name}; missing characterController, physicsController, or character mesh`);
        return;
      }
      const target = this.targetingSystem?.getCurrentTarget();
      if (!target || !target.getMesh()) {
        console.warn(`Cannot play ${name}; no target selected or target has no mesh`);
        return;
      }
      const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
      const charPos = characterMesh.getAbsolutePosition();
      const targetPos = target.getMesh()!.getAbsolutePosition();
      const toTarget = targetPos.subtract(charPos).normalize();
      const dot = Vector3.Dot(forward, toTarget);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > Math.PI / 2) {
        console.warn(`Cannot play ${name}; target ${target.getId()} is outside front 180° arc`);
        return;
      }
      speed = ability.animation.speed;
      loop = ability.animation.loop;

      if (this.attackSystem) {
        const castSound = this.attackSystem.sounds.get(`${ability.id}_cast`);
        if (castSound && castSound.isReady()) {
          console.log(`Playing cast sound for ability: ${ability.id}`);
          castSound.play();
        }
      }
    }

    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      this.footstepFrames = [];
    }

    const walkingAnimations = ["Run", "RunBackwards", "RightStrafe", "StrafeLeft"];
    if (walkingAnimations.includes(name) && this.footstepSounds.length > 0) {
      const frameRange = (toFrame ?? newAnim.to) - (fromFrame ?? newAnim.from);
      this.footstepFrames = [
        (fromFrame ?? newAnim.from) + 0.25 * frameRange,
        (fromFrame ?? newAnim.from) + 0.75 * frameRange,
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
              if (newAnim.isStarted && (loop ?? true)) {
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

    const skipBlending = this.currentAnimationName === "Death";

    if ((ability || name === "Jump" || name === "Death") && this.currentAnimationName !== name) {
      const prevAnim = this.getAnimationByName(this.currentAnimationName || "");
      if (prevAnim) {
        prevAnim.stop();
        prevAnim.setWeightForAllAnimatables(0);
      }
    } else if (name === this.currentAnimationName && newAnim.isPlaying) {
      return;
    }

    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }

    const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

    if (prevAnim && !skipBlending && !ability && name !== "Jump" && name !== "Death") {
      prevAnim.setWeightForAllAnimatables(0);
      prevAnim.stop();
    }

    newAnim.stop();
    const isLooping = name === "Death" ? false : loop ?? !(name === "Jump" || ability);
    newAnim.start(isLooping, speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
    newAnim.setWeightForAllAnimatables(skipBlending ? 1 : 0);

    this.currentAnimationName = name;

    if (skipBlending) {
      if (prevAnim) prevAnim.stop();
      newAnim.setWeightForAllAnimatables(1);
      this.isBlending = false;
    } else {
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

    if (newAnim.name === "Jump") {
      this.isJumping = true;
    }

    if (ability!) {
      this.abilitySpawned = false;
      console.log(`Notifying ability state: abilityId=${ability!.id}, abilityName=${ability!.name}, isPlaying=true, progress=0, triggerFrame=${ability!.animation.triggerFrame}`);
      this.onAbilityAnimationState.notifyObservers({
        abilityId: ability!.id,
        abilityName: ability!.name,
        isPlaying: true,
        progress: 0,
        triggerFrame: ability!.animation.triggerFrame,
      });
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;
          const from = newAnim.from;
          const to = newAnim.to;
          const progress = (currentFrame - from) / (to - from);
          console.log(`Notifying ability state: abilityId=${ability!.id}, abilityName=${ability!.name}, isPlaying=true, progress=${progress}, triggerFrame=${ability!.animation.triggerFrame}`);
          this.onAbilityAnimationState.notifyObservers({
            abilityId: ability!.id,
            abilityName: ability!.name,
            isPlaying: true,
            progress,
            triggerFrame: ability!.animation.triggerFrame,
          });
          if (ability!.animation.triggerFrame && progress >= ability!.animation.triggerFrame && !this.abilitySpawned) {
            if (this.attackSystem) {
              this.attackSystem.triggerAbility(ability!.id);
              const castSound = this.attackSystem.sounds.get(`${ability!.id}_cast`);
              if (castSound) {
                castSound.stop();
              }
            }
            this.abilitySpawned = true;
            console.log(`Notifying ability state: abilityId=${ability!.id}, abilityName=${ability!.name}, isPlaying=true, progress=${ability!.animation.triggerFrame}, triggerFrame=${ability!.animation.triggerFrame}`);
            this.onAbilityAnimationState.notifyObservers({
              abilityId: ability!.id,
              abilityName: ability!.name,
              isPlaying: true,
              progress: ability!.animation.triggerFrame,
              triggerFrame: ability!.animation.triggerFrame,
            });
            this.scene.onBeforeRenderObservable.remove(observer);
          }
        } else {
          console.log(`Notifying ability state: abilityId=${ability!.id}, abilityName=${ability!.name}, isPlaying=false`);
          this.onAbilityAnimationState.notifyObservers({
            abilityId: ability!.id,
            abilityName: ability!.name,
            isPlaying: false,
            triggerFrame: ability!.animation.triggerFrame,
          });
          if (this.attackSystem) this.attackSystem.stopSounds();
          this.scene.onBeforeRenderObservable.remove(observer);
        }
      });
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
      yield;
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

  public hasAnimationEnded(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying === false;
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public getAnimationGroups() {
    return this.animationGroups;
  }

  public stopAllAnimations(): void {
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }
    this.isBlending = false;
    this.animationGroups.forEach(group => {
      if (group.isPlaying || group.animatables.length > 0) {
        group.stop();
        group.setWeightForAllAnimatables(0);
        group.animatables.forEach(anim => anim.stop());
      }
    });
    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      this.footstepFrames = [];
    }
    if (this.attackSystem) this.attackSystem.stopSounds();
    this.currentAnimationName = null;
    this.abilitySpawned = false;
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
    this.footstepSounds.forEach(sound => sound.dispose());
    this.footstepSounds = [];
    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
    }
    if (this.attackSystem) this.attackSystem.dispose();
    this.onAbilityAnimationState.clear();
  }
}