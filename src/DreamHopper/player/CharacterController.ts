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
  particleSystem: { rightHand: ParticleSystem; leftHand: ParticleSystem } | null = null;
  characterMesh!: Mesh | null;

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
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.characterMeshLoader.loadCharacter(new Vector3(5, 5, 0));

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
      this.animationManager.onDreamboltAnimationState.add(({ isPlaying }) => {
        if (this.particleSystem) {
          if (isPlaying) {
            this.particleSystem.rightHand.start();
            this.particleSystem.leftHand.start();
            // // // console.log("Started hand particle systems for Dreambolt animation");
          } else {
            this.particleSystem.rightHand.stop();
            this.particleSystem.leftHand.stop();
            // // // console.log("Stopped hand particle systems after Dreambolt animation");
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
      ? new Vector3(-11 * Math.PI / 12, Math.PI / 11, Math.PI / 3)
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
      if(this.animationManager.getAnimationByName("Death")?.isPlaying) {
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

    // Stop all other animations
    this.animationManager.getAnimationGroups().forEach(group => {
      if (group.isPlaying) {
        group.stop();
      }
    });

    // Play the Death animation (non-looping)
    const deathAnim = this.animationManager.getAnimationByName("Death");
    if (deathAnim) {
      deathAnim.play(false);
      // // console.log("CharacterController: Playing Death animation");
    } else {
      console.warn("CharacterController: Death animation not found");
    }
  }

  public jump(animationData?: AnimationData): void {
    if(!this.player.isPlayerDead()) {
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
     if(!this.player.isPlayerDead()) {
          if (animationData) {
      const { name, speed = 1 } = animationData;
      this.animationManager.playAnimation(name, speed);
    } else {
      this.animationManager.playAnimation("Dreambolt", 1);
    }
     }


  }

  public moveForward(speed: number, animationData?: AnimationData): void {
    if(!this.player.isPlayerDead()) {

      this.physicsController?.moveForward(speed);
          if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
            this.playAnimationWithData(animationData);
          }

    }
   
  }

  public moveDiagonallyRight(speed: number, animationData?: AnimationData): void {

    if(!this.player.isPlayerDead()) {
          this.physicsController?.moveDiagonallyRight(speed);
    if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
      this.playAnimationWithData(animationData);
    }

    }
  }

  public moveDiagonallyLeft(speed: number, animationData?: AnimationData): void {

     if(!this.player.isPlayerDead()) {
          this.physicsController?.moveDiagonallyLeft(speed);
    if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
      this.playAnimationWithData(animationData);
     }

    }
  }

  public strafeLeft(speed: number, animationData?: AnimationData): void {

     if(!this.player.isPlayerDead()) {

         this.physicsController?.strafeLeft(speed);
    if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
      this.playAnimationWithData(animationData);
     }
 
    }
  }

  public strafeRight(speed: number, animationData?: AnimationData): void {

     if(!this.player.isPlayerDead()) {
    this.physicsController?.strafeRight(speed);
    if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
      this.playAnimationWithData(animationData);

     }

    }
  }

  public backPedal(speed: number, animationData?: AnimationData): void {

     if(!this.player.isPlayerDead()) {
    this.physicsController?.backPedal(speed);
    if (!this.isAnimationPlaying("Dreambolt") && !this.isAnimationPlaying("Jump")) {
      this.playAnimationWithData(animationData);

     }

    }
  }

  public rotateLeft(yaw: number): void {

     if(!this.player.isPlayerDead()) {
  
    this.physicsController?.rotateLeft(yaw);
     }
  }

  public rotateRight(yaw: number): void {

     if(!this.player.isPlayerDead()) {
          this.physicsController?.rotateRight(yaw);
     }

  }

  public syncRotationWithCamera(): void {

     if(!this.player.isPlayerDead()) {
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

  public setupParticleSystem(): void {
    const skeleton = this.characterMeshLoader.getSkeleton();
    const characterMesh = this.characterMeshLoader.getCharacterMesh();

    if (!skeleton || !characterMesh) {
      console.error("Skeleton or character mesh not loaded.");
      return;
    }

    const createHandParticleSystem = (boneName: string, systemName: string): ParticleSystem => {
      const particleSystem = new ParticleSystem(systemName, 5, this.scene);
      particleSystem.particleTexture = new Texture("./Flare.png", this.scene);

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
      particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
      particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
      particleSystem.minAngularSpeed = 0;
      particleSystem.maxAngularSpeed = Math.PI;
      particleSystem.minEmitPower = 10;
      particleSystem.maxEmitPower = 50;
      particleSystem.updateSpeed = 0.005;
      particleSystem.minSize = 0.5;
      particleSystem.maxSize = 1;
      particleSystem.gravity = new Vector3(0, 0, 0);
      particleSystem.direction1 = new Vector3(0, 0, 0);
      particleSystem.direction2 = new Vector3(0, 0, 0);
      particleSystem.isLocal = true;
      particleSystem.color1 = new Color4(0.9, 0.2, 1.0, 1.0);
      particleSystem.color2 = new Color4(0.8, 0.0, 0.5, 0.9);
      particleSystem.colorDead = new Color4(0, 0, 0.2, 0.0);
      particleSystem.minLifeTime = 0.5;
      particleSystem.maxLifeTime = 0.9;
      return particleSystem;
    };

    this.particleSystem = {
      rightHand: createHandParticleSystem("mixamorig:RightHand", "rightHandParticles"),
      leftHand: createHandParticleSystem("mixamorig:LeftHand", "leftHandParticles"),
    };
  }

  public dispose(): void {
    this.animationManager.dispose();
    this.physicsController?.dispose();
    this.itemAttachmentManager?.dispose();
    this.characterMeshLoader.dispose();
    this.player.getInventory().forEach(item => item.dispose());
    if (this.particleSystem) {
      this.particleSystem.rightHand.stop();
      this.particleSystem.rightHand.dispose();
      this.particleSystem.leftHand.stop();
      this.particleSystem.leftHand.dispose();
      this.particleSystem = null;
    }
  }
}