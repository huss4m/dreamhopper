import {
  Scene,
  ArcRotateCamera,
  Vector3,
  CascadedShadowGenerator,
  TransformNode,
  PhysicsMotionType,
} from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { CharacterAnimationManager } from "./CharacterAnimationManager";
import { CharacterPhysicsController, CharacterPhysicsConfig, ColliderType } from "./CharacterPhysicsController";
import { ItemAttachmentManager } from "../items/ItemAttachmentManager";
import { CharacterMeshLoader } from "./CharacterMeshLoader";
import { Character } from "../types";
import { Player } from "./Player";

export class CharacterController {
  private animationManager: CharacterAnimationManager;
  public physicsController: CharacterPhysicsController | null = null;
  private itemAttachmentManager: ItemAttachmentManager;
  public characterMeshLoader: CharacterMeshLoader;
  private player: Player;

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

      // Equip items from player's inventory
      const inventory = this.player.getInventory();
      for (const item of inventory) {
        const itemName = item.getName();
        if (itemName === "sword") {
          await this.itemAttachmentManager.attachItemToHand(
            item,
            "mixamorig:RightHand",
            skeleton,
            characterMesh
          );
        } else if (itemName === "sword_of_artorias") {
          await this.itemAttachmentManager.attachItemToHand(
            item,
            "mixamorig:LeftHand",
            skeleton,
            characterMesh
          );
        }
      }
    }
  }

  public playAnimation(name: string, speedRatio = 1, fromFrame?: number, toFrame?: number): void {
    this.animationManager.playAnimation(name, speedRatio, fromFrame, toFrame);
  }

  public jump(): void {
    if (this.physicsController) {
      this.physicsController.applyJumpForce();
    }
  }

  public moveForward(speed: number): void {
    this.physicsController?.moveForward(speed);
  }

  public moveDiagonallyRight(speed: number): void {
    this.physicsController?.moveDiagonallyRight(speed);
  }

  public moveDiagonallyLeft(speed: number): void {
    this.physicsController?.moveDiagonallyLeft(speed);
  }

  public strafeLeft(speed: number): void {
    this.physicsController?.strafeLeft(speed);
  }

  public strafeRight(speed: number): void {
    this.physicsController?.strafeRight(speed);
  }

  public backPedal(speed: number): void {
    this.physicsController?.backPedal(speed);
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

  public dispose(): void {
    this.animationManager.dispose();
    this.physicsController?.dispose();
    this.itemAttachmentManager.dispose();
    this.characterMeshLoader.dispose();
    this.player.getInventory().forEach(item => item.dispose()); // Dispose inventory items
  }
}