import {
  Scene,
  ArcRotateCamera,
  Vector3,
  CascadedShadowGenerator,
  TransformNode,
  PhysicsMotionType
} from "@babylonjs/core";
import { AssetManager } from "./AssetManager";
import { AnimationManager } from "./AnimationManager";
import { CharacterPhysicsController, CharacterPhysicsConfig, ColliderType } from "./CharacterPhysicsController";
import { ItemAttachmentManager } from "./ItemAttachmentManager";
import { CharacterMeshLoader } from "./CharacterMeshLoader";
import { Character } from "./types";

export class CharacterController {
  private animationManager: AnimationManager;
  public physicsController: CharacterPhysicsController | null = null;
  private itemAttachmentManager: ItemAttachmentManager;
  public characterMeshLoader: CharacterMeshLoader;

  constructor(
    private scene: Scene,
    private canvas: HTMLCanvasElement,
    private camera: ArcRotateCamera,
    shadowGenerator: CascadedShadowGenerator,
    assetManager: AssetManager
  ) {
    this.scene.collisionsEnabled = true;
    this.animationManager = new AnimationManager(scene);
    this.characterMeshLoader = new CharacterMeshLoader(scene, assetManager, shadowGenerator);
    this.itemAttachmentManager = new ItemAttachmentManager(scene, assetManager, shadowGenerator);
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
          auto: false, // Use manual parameters
          pointA: new Vector3(0, 0.35, 0),
         pointB: new Vector3(0, 2, 0),
          radius: 0.35,
         // mesh: characterMesh

       
        },
        physicsProps: {
          mass: 100,
          restitution: -1,
          friction: 1,
          inertia: new Vector3(0, 1, 0)
        },
        enableCharacterMovement: true,
        initialForwardDirection: Vector3.Forward()
      };
      this.physicsController = new CharacterPhysicsController(this.scene, characterMesh, physicsConfig);

      console.log("THIS IS THE COMPUTED AUTOMATICALLY CENTERMASS: ", this.physicsController.getPhysicsAggregate()!.body.getMassProperties())
/*
      this.physicsController.getPhysicsAggregate()!.body.setMassProperties({
          centerOfMass: new Vector3(0, 0.5, 0)
      });
*/

      //console.log("PHYSICSMOTIONTYPE : ", this.physicsController.getPhysicsAggregate()?.body.getMotionType());
      //this.physicsController.getPhysicsAggregate()?.body.setMotionType(PhysicsMotionType.ANIMATED)
      this.animationManager.initialize(this.characterMeshLoader.getAnimationGroups());

      const targetMesh = characterMesh.getChildMeshes()[0];
      const cameraTarget = new TransformNode("cameraTarget", this.scene);
      this.camera.setTarget(cameraTarget);
      const offset = new Vector3(0, 0.85, 0);
      this.scene.onBeforeRenderObservable.add(() => {
          const meshPos = targetMesh.getAbsolutePosition();
          cameraTarget.position.copyFrom(meshPos.add(offset));
      });




      await this.itemAttachmentManager.attachItemToHand(
        "sword",
        "mixamorig:RightHand",
        skeleton,
        characterMesh,
        new Vector3(45, 8, 3),
        new Vector3(0, 0, -Math.PI / 2),
        new Vector3(3, 3, 3)
      );


      await this.itemAttachmentManager.attachItemToHand(
        "sword_of_artorias",
        "mixamorig:LeftHand",
        skeleton,
        characterMesh,
        new Vector3(-27, 15, -8),
        new Vector3(Math.PI/5, Math.PI/2, 2*Math.PI/3),
        new Vector3(5, 5, 5)
      );
    }
  }

  public playAnimation(index: number): void {
    this.animationManager.playAnimation(index);
    if (index === 1 && this.physicsController) {
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
      isJumping: this.animationManager.isCharacterJumping()
    };
  }

  public dispose(): void {
    this.animationManager.dispose();
    this.physicsController?.dispose();
    this.itemAttachmentManager.dispose();
    this.characterMeshLoader.dispose();
  }
}