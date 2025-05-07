import {
  Scene,
  ArcRotateCamera,
  Vector3,
  CascadedShadowGenerator,
  TransformNode,
  PhysicsMotionType,
  ParticleSystem,
  Texture,
  NoiseProceduralTexture,
  MeshBuilder,
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

      // Equip items from player's inventory
      const inventory = this.player.getInventory();
      for (const item of inventory) {
        const itemName = item.getName();
        if (itemName === "sword1") {
          await this.itemAttachmentManager.attachItemToHand(
            item,
            "mixamorig:RightHand",
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


  public setupParticleSystem(): void {
    const skeleton = this.characterMeshLoader.getSkeleton();
    const characterMesh = this.characterMeshLoader.getCharacterMesh();
  
    if (!skeleton || !characterMesh) {
      console.error("Skeleton or character mesh not loaded.");
      return;
    }
  
    // Helper function to create a particle system for a given hand bone
    const createHandParticleSystem = (boneName: string, systemName: string): ParticleSystem => {
      const particleSystem = new ParticleSystem(systemName, 5, this.scene);
  
      // Set particle texture
      particleSystem.particleTexture = new Texture("./Flare.png", this.scene);
  
      // Find the hand bone in the skeleton
      const handBone = skeleton.bones.find(bone => bone.name === boneName);
      if (!handBone) {
        console.error(`Bone ${boneName} not found in skeleton.`);
        return particleSystem;
      }
  
      // dummy mesh to act as the emitter
      const dummyMesh = MeshBuilder.CreateBox(`${boneName}_emitter`, { size: 0.01 }, this.scene);
      dummyMesh.isVisible = false; // Hide 
      dummyMesh.parent = handBone.getTransformNode(); // Parent to the hand bone's transform node
      dummyMesh.position = new Vector3(0, 10, 0);

      // Set the dummy mesh as the emitter
      particleSystem.emitter = dummyMesh;
  
      // Emission box for particles relative to the hand bone
      particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1); // Smaller box for hand
      particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
  
      // Angular speed in radians
      particleSystem.minAngularSpeed = 0;
      particleSystem.maxAngularSpeed = Math.PI;
  
      // Speed
      particleSystem.minEmitPower = 10; 
      particleSystem.maxEmitPower = 50;
      particleSystem.updateSpeed = 0.005;
  
      // Size of each particle
      particleSystem.minSize = 0.2; 
      particleSystem.maxSize = 0.5;
  
      particleSystem.gravity = new Vector3(0, 0, 0)

      
      particleSystem.direction1 = new Vector3(0, 0, 0); 
      particleSystem.direction2 = new Vector3(0, 0, 0); 


      particleSystem.isLocal = true;
  
      // Start the particle system
      particleSystem.start();
  
      return particleSystem;
    };
  
    // Create particle systems for both hands
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
    this.player.getInventory().forEach(item => item.dispose()); // Dispose inventory items
  }
}