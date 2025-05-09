import {
  Scene,
  ArcRotateCamera,
  Vector3,
  CascadedShadowGenerator,
  TransformNode,
  PhysicsMotionType,
  ParticleSystem,
  Texture,
  MeshBuilder,
} from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { CharacterAnimationManager } from "./CharacterAnimationManager";
import { CharacterPhysicsController, CharacterPhysicsConfig, ColliderType } from "./CharacterPhysicsController";
import { ItemAttachmentManager } from "../items/ItemAttachmentManager";
import { CharacterMeshLoader } from "./CharacterMeshLoader";
import { Character } from "../types";
import { Player } from "./Player";

interface AnimationData {
  name: string;
  loop?: number;
  speed?: number;
  endFrame?: number;
}

export class CharacterController {
  private animationManager: CharacterAnimationManager;
  public physicsController: CharacterPhysicsController | null = null;
  private itemAttachmentManager: ItemAttachmentManager;
  public characterMeshLoader: CharacterMeshLoader;
  private player: Player;
  particleSystem: any;

  constructor(
    private scene: Scene,
    private canvas: HTMLCanvasElement,
    private camera: ArcRotateCamera,
    shadowGenerator: CascadedShadowGenerator,
    assetManager: AssetManager
  ) {
    this.scene.collisionsEnabled = true;
    this.animationManager = new CharacterAnimationManager(scene);
    this.characterMeshLoader = new CharacterMeshLoader(scene, assetManager, shadowGenerator);
    this.itemAttachmentManager = new ItemAttachmentManager(scene, shadowGenerator);
    this.player = new Player(scene, assetManager, shadowGenerator);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.characterMeshLoader.loadCharacter(new Vector3(13, 5, 0));
    const characterMesh = this.characterMeshLoader.getCharacterMesh();
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

      const inventory = this.player.getInventory();
      for (const item of inventory) {
        const itemName = item.getName();
        if (itemName === "sword1") {
          /*
          await this.itemAttachmentManager.attachItemToHand(
            item,
            "mixamorig:RightHand",
            skeleton,
            characterMesh
          );
*/
          await this.itemAttachmentManager.attachItemToHand(
            item,
            (this.player.isSheathed?"mixamorig:Spine":"mixamorig:RightHand"),
            skeleton,
            characterMesh
          );
        } else if (itemName === "sword2") {
          console.log("ph");
          /*
          await this.itemAttachmentManager.attachItemToHand(
            item,
            "mixamorig:LeftHand",
            skeleton,
            characterMesh
          );
          */
        }
      }

      this.setupParticleSystem();
    }
  }

  private playAnimationWithData(animationData?: AnimationData): void {
    if (animationData && !this.getCharacter().isJumping) {
      const { name, loop = 1, speed = 1, endFrame } = animationData;
      this.animationManager.playAnimation(name, speed, undefined, endFrame);
    }
  }

  public playIdleAnimation(): void {
    if (!this.getCharacter().isJumping) {
      this.animationManager.playAnimation("IdleGreatSword", 1);
    }
  }

  public jump(animationData?: AnimationData): void {
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

  public moveForward(speed: number, animationData?: AnimationData): void {
    this.physicsController?.moveForward(speed);
    this.playAnimationWithData(animationData);
  }

  public moveDiagonallyRight(speed: number, animationData?: AnimationData): void {
    this.physicsController?.moveDiagonallyRight(speed);
    this.playAnimationWithData(animationData);
  }

  public moveDiagonallyLeft(speed: number, animationData?: AnimationData): void {
    this.physicsController?.moveDiagonallyLeft(speed);
    this.playAnimationWithData(animationData);
  }

  public strafeLeft(speed: number, animationData?: AnimationData): void {
    this.physicsController?.strafeLeft(speed);
    this.playAnimationWithData(animationData);
  }

  public strafeRight(speed: number, animationData?: AnimationData): void {
    this.physicsController?.strafeRight(speed);
    this.playAnimationWithData(animationData);
  }

  public backPedal(speed: number, animationData?: AnimationData): void {
    this.physicsController?.backPedal(speed);
    this.playAnimationWithData(animationData);
  }

  public rotateLeft(yaw: number): void {
    this.physicsController?.rotateLeft(yaw);
  }

  public rotateRight(yaw: number): void {
    this.physicsController?.rotateRight(yaw);
  }

  public syncRotationWithCamera(): void {
    this.physicsController?.syncRotationWithCamera(this.camera);
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

      const dummyMesh = MeshBuilder.CreateBox(`${boneName}_emitter`, { size: 0.01 }, this.scene);
      dummyMesh.isVisible = false;
      dummyMesh.parent = handBone.getTransformNode();
      dummyMesh.position = new Vector3(0, 10, 0);

      particleSystem.emitter = dummyMesh;
      particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
      particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
      particleSystem.minAngularSpeed = 0;
      particleSystem.maxAngularSpeed = Math.PI;
      particleSystem.minEmitPower = 10;
      particleSystem.maxEmitPower = 50;
      particleSystem.updateSpeed = 0.005;
      particleSystem.minSize = 0.2;
      particleSystem.maxSize = 0.5;
      particleSystem.gravity = new Vector3(0, 0, 0);
      particleSystem.direction1 = new Vector3(0, 0, 0);
      particleSystem.direction2 = new Vector3(0, 0, 0);
      particleSystem.isLocal = true;
      particleSystem.start();

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
    this.itemAttachmentManager.dispose();
    this.characterMeshLoader.dispose();
    this.player.getInventory().forEach(item => item.dispose());
  }
}