import {
  Scene,
  ArcRotateCamera,
  Vector3,
  CascadedShadowGenerator,
  TransformNode,
  ParticleSystem,
  Texture,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Color3,
  Color4,
  Sound,
} from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { CharacterAnimationManager } from "./CharacterAnimationManager";
import { CharacterPhysicsController, CharacterPhysicsConfig, ColliderType } from "./CharacterPhysicsController";
import { ItemAttachmentManager } from "../items/ItemAttachmentManager";
import { CharacterMeshLoader } from "./CharacterMeshLoader";
import { Character } from "../types";
import { Player } from "./Player";
import { TargetingSystem } from "../TargetingSystem";
import { GameManager } from "../GameManager";
import { Targettable } from "../Targettable";
import { CharacterAttackSystem } from "./CharacterAttackSystem";

import { AbilityConfig, AbilitySoundConfig } from "./AbilityConfig";
import { AssetsManager } from "@babylonjs/core";

interface AnimationData {
  name: string;
  loop?: number;
  speed?: number;
  endFrame?: number;
}

export class CharacterController {
  public animationManager: CharacterAnimationManager;
  public physicsController: CharacterPhysicsController | null = null;
  private itemAttachmentManager: ItemAttachmentManager;
  public characterMeshLoader: CharacterMeshLoader;
  private player: Player;
  private particleSystems: { [key: string]: ParticleSystem } | null = null;
  characterMesh!: Mesh | null;
  private attackSystem: CharacterAttackSystem;
private abilities: Map<string, AbilityConfig> = new Map();


  constructor(
    private scene: Scene,
    private canvas: HTMLCanvasElement,
    private camera: ArcRotateCamera,
    shadowGenerator: CascadedShadowGenerator,
    assetManager: AssetManager,
    private targetingSystem: TargetingSystem,
    private gameManager: GameManager
  ) {
    this.scene.collisionsEnabled = true;
    this.animationManager = new CharacterAnimationManager(scene, this, targetingSystem, gameManager);
    this.characterMeshLoader = new CharacterMeshLoader(scene, assetManager, shadowGenerator);
    this.itemAttachmentManager = new ItemAttachmentManager(scene, shadowGenerator);
    this.player = new Player(scene, assetManager, shadowGenerator, this.gameManager.game);
    this.attackSystem = new CharacterAttackSystem(scene, this, targetingSystem, gameManager);
   // this.initialize();
  }


private async loadAbilities(): Promise<void> {
  const assetsManager = new AssetsManager(this.scene);
  const assetTask = assetsManager.addTextFileTask("abilities", "./abilities.json");
  await assetsManager.loadAsync();
  const abilities: AbilityConfig[] = JSON.parse(assetTask.text);
  abilities.forEach(ability => this.abilities.set(ability.id, ability));
}



  public async initialize(): Promise<void> {
  await this.loadAbilities();
  await this.characterMeshLoader.loadCharacter(new Vector3(5, 5, 0));

  this.attackSystem.initialize(); // NEW: Kept initialization
  this.animationManager.setAttackSystem(this.attackSystem); // NEW: Kept setting attack system

  const characterMesh = this.characterMeshLoader.getCharacterMesh();
  this.characterMesh = characterMesh;
  const skeleton = this.characterMeshLoader.getSkeleton();

  if (characterMesh && skeleton) {
    const physicsConfig: CharacterPhysicsConfig = {
      colliderType: ColliderType.Capsule,
      colliderParams: {
        auto: false,
        pointA: new Vector3(0, 0.35, 0),
        pointB: new Vector3(0, 2, 0),
        radius: 0.35,
      },
      physicsProps: {
        mass: 100,
        restitution: -1,
        friction: 1,
        inertia: new Vector3(0, 1, 0),
      },
      enableCharacterMovement: true,
      initialForwardDirection: Vector3.Forward(),
    };
    this.physicsController = new CharacterPhysicsController(this.scene, characterMesh, physicsConfig, this.animationManager);

    this.animationManager.initialize(this.characterMeshLoader.getAnimationGroups());

    const targetMesh = characterMesh.getChildMeshes()[0];
    const cameraTarget = new TransformNode("cameraTarget", this.scene);
    this.camera.setTarget(cameraTarget);
    const offset = new Vector3(0, 0.85, 0);
    this.scene.onBeforeRenderObservable.add(() => {
      const meshPos = targetMesh.getAbsolutePosition();
      cameraTarget.position.copyFrom(meshPos.add(offset));
    });

    await this.updateSwordAttachment();

    this.setupParticleSystem();
    this.animationManager.onAbilityAnimationState.add(({ abilityId, isPlaying }) => { // NEW: Changed to onAbilityAnimationState
      if (abilityId === "dreambolt" && this.particleSystems) { // NEW: Changed to particleSystems
        if (isPlaying) {
          this.particleSystems.rightHand.start();
          this.particleSystems.leftHand.start();
        } else {
          this.particleSystems.rightHand.stop();
          this.particleSystems.leftHand.stop();
        }
      }
    });
  }
}

  private async updateSwordAttachment(): Promise<void> {
    const characterMesh = this.characterMeshLoader.getCharacterMesh();
    const skeleton = this.characterMeshLoader.getSkeleton();
    if (!characterMesh || !skeleton) return;

    const inventory = this.player.getInventory();
  }

  public toggleSheathe(): void {
    if (this.player.isSheathed) {
      this.player.unSheathe();
    } else {
      this.player.sheathe();
    }
    this.player.posOffset = this.player.isSheathed
      ? new Vector3(0, 0, -0.21)
      : new Vector3(0.8, 0.05, 0.05);
    this.player.rotOffset = this.player.isSheathed
      ? new Vector3((-11 * Math.PI) / 12, Math.PI / 11, Math.PI / 3)
      : new Vector3(Math.PI, 0, 0);
    this.updateSwordAttachment();
  }

  public getCurrentTarget(): Targettable | null {
    return this.targetingSystem.getCurrentTarget();
  }

  private playAnimationWithData(animationData?: AnimationData): void {
    if (animationData && !this.getCharacter().isJumping && !this.player.isPlayerDead()) {
      const { name, loop = 1, speed = 1, endFrame } = animationData;
      this.animationManager.playAnimation(name, speed, undefined, endFrame);
    }
  }

  public playIdleAnimation(): void {
    if (!this.getCharacter().isJumping && !this.isAnimationPlaying("Dreambolt") && !this.player.isPlayerDead()) {
      if (this.animationManager.getAnimationByName("Death")?.isPlaying) {
        this.animationManager.stopAllAnimations();
      }
      this.animationManager.playAnimation("Idle", 1);
    }
  }

  public playDeathAnimation(): void {
    if (!this.player.isPlayerDead()) {
      console.warn("CharacterController: Cannot play Death animation, player is not dead");
      return;
    }

    this.animationManager.getAnimationGroups().forEach(group => {
      if (group.isPlaying) {
        group.stop();
      }
    });

    const deathAnim = this.animationManager.getAnimationByName("Death");
    if (deathAnim) {
      deathAnim.play(false);
    } else {
      console.warn("CharacterController: Death animation not found");
    }
  }

  public jump(animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      if (animationData) {
        const { name, speed = 1 } = animationData;
        this.animationManager.playAnimation(name, speed, 8, 95);
      } else {
        this.animationManager.playAnimation("Jump", 1, 8, 95);
      }
      if (this.physicsController) {
        this.physicsController.applyJumpForce();
      }
    }
  }

  public castDreambolt(animationData?: AnimationData): void {
  if (!this.player.isPlayerDead()) {
    const ability = this.abilities.get("dreambolt"); // NEW: Get Dreambolt ability from abilities Map
    if (!ability) {
      console.warn("Dreambolt ability not found"); // NEW: Warn if ability is missing
      return;
    }
   

    
    if (animationData) {
      const { name, speed = 1 } = animationData;
      this.animationManager.playAnimation(name, speed); // NEW: Keep support for animationData override
    } else {
      this.animationManager.playAnimation(ability.animation.name); // NEW: Use JSON-defined animation name
    }
  }
}

public cancelDreambolt(): void {
  this.animationManager.cancelAbility("dreambolt"); // NEW: Call cancelAbility to stop Dreambolt animation
}

  public moveForward(speed: number, animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.moveForward(speed);
      if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
        this.playAnimationWithData(animationData);
      }
    }
  }

  public moveDiagonallyRight(speed: number, animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.moveDiagonallyRight(speed);
      if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
        this.playAnimationWithData(animationData);
      }
    }
  }

  public moveDiagonallyLeft(speed: number, animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.moveDiagonallyLeft(speed);
      if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
        this.playAnimationWithData(animationData);
      }
    }
  }

  public strafeLeft(speed: number, animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.strafeLeft(speed);
      if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
        this.playAnimationWithData(animationData);
      }
    }
  }

  public strafeRight(speed: number, animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.strafeRight(speed);
      if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
        this.playAnimationWithData(animationData);
      }
    }
  }

  public backPedal(speed: number, animationData?: AnimationData): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.backPedal(speed);
      if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
        this.playAnimationWithData(animationData);
      }
    }
  }

  public rotateLeft(yaw: number): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.rotateLeft(yaw);
    }
  }

  public rotateRight(yaw: number): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.rotateRight(yaw);
    }
  }

  public syncRotationWithCamera(): void {
    if (!this.player.isPlayerDead()) {
      this.physicsController?.syncRotationWithCamera(this.camera);
    }
  }

  public getCharacter(): Character {
    return {
      colliderBox: this.characterMeshLoader.getCharacterMesh(),
      isJumping: this.animationManager.isCharacterJumping(),
    };
  }

  public getPlayer(): Player {
    return this.player;
  }

  public isAnimationPlaying(name: string): boolean {
    return this.animationManager.isAnimationPlaying(name);
  }

  private setupParticleSystem(): void {
     const skeleton = this.characterMeshLoader.getSkeleton();
     const characterMesh = this.characterMeshLoader.getCharacterMesh();

     if (!skeleton || !characterMesh) {
       console.error("Skeleton or character mesh not loaded.");
       return;
     }

     const ability = this.abilities.get("dreambolt");
     if (!ability) {
       console.warn("Dreambolt ability not found");
       return;
     }

     if (!ability.particles?.cast) {
       console.warn("No cast particles defined for Dreambolt; skipping particle setup");
       return;
     }

     const createParticleSystem = (boneName: string, systemName: string): ParticleSystem => {
       const config = ability.particles!.cast;
       const particleSystem = new ParticleSystem(systemName, 1000, this.scene);
       particleSystem.particleTexture = new Texture(config!.texture, this.scene);

       const handBone = skeleton.bones.find(bone => bone.name === boneName);
       if (!handBone) {
         console.error(`Bone ${boneName} not found in skeleton.`);
         return particleSystem;
       }

       const dummyMesh = MeshBuilder.CreateBox(`${boneName}_emitter`, { size: 0.1 }, this.scene);
       dummyMesh.isVisible = false;
       dummyMesh.parent = handBone.getTransformNode();
       dummyMesh.position = new Vector3(0, 0, 0);

       particleSystem.emitter = dummyMesh;
       particleSystem.minSize = config!.minSize;
       particleSystem.maxSize = config!.maxSize;
       particleSystem.minLifeTime = config!.minLifeTime;
       particleSystem.maxLifeTime = config!.maxLifeTime;
       particleSystem.emitRate = config!.emitRate;
       particleSystem.blendMode = config!.blendMode;
       if (config!.gravity) particleSystem.gravity = new Vector3(config!.gravity.x, config!.gravity.y, config!.gravity.z);
       if (config!.direction1) particleSystem.direction1 = new Vector3(config!.direction1.x, config!.direction1.y, config!.direction1.z);
       if (config!.direction2) particleSystem.direction2 = new Vector3(config!.direction2.x, config!.direction2.y, config!.direction2.z);
       if (config!.minEmitBox) particleSystem.minEmitBox = new Vector3(config!.minEmitBox.x, config!.minEmitBox.y, config!.minEmitBox.z);
       if (config!.maxEmitBox) particleSystem.maxEmitBox = new Vector3(config!.maxEmitBox.x, config!.maxEmitBox.y, config!.maxEmitBox.z);
       if (config!.minAngularSpeed) particleSystem.minAngularSpeed = config!.minAngularSpeed;
       if (config!.maxAngularSpeed) particleSystem.maxAngularSpeed = config!.maxAngularSpeed;
       if (config!.minEmitPower) particleSystem.minEmitPower = config!.minEmitPower;
       if (config!.maxEmitPower) particleSystem.maxEmitPower = config!.maxEmitPower;
       if (config!.updateSpeed) particleSystem.updateSpeed = config!.updateSpeed;
       particleSystem.color1 = new Color4(config!.color1.r, config!.color1.g, config!.color1.b, config!.color1.a);
       particleSystem.color2 = new Color4(config!.color2.r, config!.color2.g, config!.color2.b, config!.color2.a);
       particleSystem.colorDead = new Color4(config!.colorDead.r, config!.colorDead.g, config!.colorDead.b, config!.colorDead.a);
       return particleSystem;
     };

     this.particleSystems = {
       rightHand: createParticleSystem("mixamorig:RightHand", "rightHandParticles"),
       leftHand: createParticleSystem("mixamorig:LeftHand", "leftHandParticles"),
     };

     this.animationManager.onAbilityAnimationState.add(({ abilityId, isPlaying }) => {
       if (abilityId === "dreambolt" && this.particleSystems) {
         if (isPlaying) {
           this.particleSystems.rightHand.start();
           this.particleSystems.leftHand.start();
         } else {
           this.particleSystems.rightHand.stop();
           this.particleSystems.leftHand.stop();
         }
       }
     });
   }

  public dispose(): void {
  this.animationManager.dispose();
  this.physicsController?.dispose();
  this.itemAttachmentManager?.dispose();
  this.characterMeshLoader.dispose();
  this.player.getInventory().forEach(item => item.dispose());
  if (this.particleSystems) {
    this.particleSystems.rightHand?.stop(); // NEW: Updated to particleSystems
    this.particleSystems.rightHand?.dispose(); // NEW: Updated to particleSystems
    this.particleSystems.leftHand?.stop(); // NEW: Updated to particleSystems
    this.particleSystems.leftHand?.dispose(); // NEW: Updated to particleSystems
    this.particleSystems = null; // NEW: Updated to particleSystems
  }
  this.attackSystem.dispose();
}
}