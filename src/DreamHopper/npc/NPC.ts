import { AbstractMesh, ActionManager, AnimationGroup, AssetContainer, CascadedShadowGenerator, Color3, DynamicTexture, ExecuteCodeAction, HighlightLayer, Mesh, MeshBuilder, PBRMaterial, PointerEventTypes, Scene, Skeleton, Sprite, SpriteManager, StandardMaterial, Tags, Texture, Vector3, Observable, Quaternion } from "@babylonjs/core";
import { AdvancedDynamicTexture, Image as GUIImage } from "@babylonjs/gui";
import { AssetManager } from "../AssetManager";
import { Hoverable, HoverHandler, HoverConfig } from "../HoverableSystem";
import { Targettable } from "../Targettable";
import { TargetingSystem } from "../TargetingSystem";
import { v4 as uuidv4 } from 'uuid';
import { NPCPhysicsController, PhysicsConfig } from "./NPCPhysicsController";
import { ColliderType } from "../PhysicsController";
import { NPCAnimationManager } from "./NPCAnimationManager";

export class NPC implements Hoverable, Targettable {
  private id: string; // Unique identifier for the NPC
  private npcMesh: Mesh | null = null;
  private npcSkeleton: Skeleton | null = null;
  private animationManager: NPCAnimationManager;
  private physicsController: NPCPhysicsController | null = null;
  private hoverHandler: HoverHandler;
  private targetCircle: Mesh | null = null; // Mesh for the gradient disc
  private questMarker: Sprite | null = null; // Sprite for the quest marker
  private questMarkerObserver: any | null = null; // Store the render loop observer

  isTargetted = false;

  assetManager!: AssetManager;
  shadowGenerator!: CascadedShadowGenerator;
  highlightLayer: HighlightLayer;
  static availableSpriteManager: SpriteManager | null = null; // SpriteManager for "available" marker
  static completedSpriteManager: SpriteManager | null = null; // SpriteManager for "completed" marker
  position: Vector3;

  constructor(
    private scene: Scene,
    name: string,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator,
    position: Vector3,
    highlightLayer: HighlightLayer,
    targetingSystem: TargetingSystem
  ) {
    this.id = uuidv4(); // Generate a unique ID for the NPC
    this.highlightLayer = highlightLayer;
    this.assetManager = assetManager;
    this.shadowGenerator = shadowGenerator;
    this.position = position;
    this.animationManager = new NPCAnimationManager(this.scene);

    // Initialize hover handler
    const hoverConfig: HoverConfig = {
      highlightColor: Color3.Yellow(),
      customCursorUrl: "./images/cursorTargetAlly.png",
      innerGlow: true,
      outerGlow: false,
      blurHorizontalSize: 0.5,
      blurVerticalSize: 0.5,
    };
    this.hoverHandler = new HoverHandler(this.scene, this.highlightLayer, hoverConfig);

    // Automatically register with TargetingSystem
    targetingSystem.registerTarget(this);

    this.loadCharacter(name, position);
    //this.startWandering();
  }

  public async loadCharacter(name: string, position: Vector3): Promise<void> {
    try {
      const npcAssetContainer = this.assetManager.getAssetContainer(name);
      if (!npcAssetContainer) {
        console.error(`Failed to load the ${name} asset container for NPC ID: ${this.id}`);
        return;
      }

      const clones = this.duplicate(npcAssetContainer, position);
      this.npcMesh = clones.rootNodes[0] as Mesh;
      this.npcSkeleton = clones.skeletons[0];
      const animationGroups = clones.animationGroups || [];

      this.npcMesh.position = position;
      this.npcMesh.checkCollisions = true;

      // Apply material properties
      this.npcMesh.getChildMeshes().forEach((mesh) => {
        const mat = mesh.material as PBRMaterial;
        if (mat) {
          mat.metallic = 0.2;
          mat.roughness = 0.4;
          mat.albedoColor = mat.albedoColor || new Color3(1, 1, 1);
          mat.reflectivityColor = new Color3(0.3, 0.3, 0.3);
          mat.microSurface = 0.8;
        }
      });

      // Add to compil generator
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(this.npcMesh!);
        this.npcMesh!.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
      }

      // Enable and add tags to root mesh and all child meshes
      Tags.EnableFor(this.npcMesh);
      Tags.AddTagsTo(this.npcMesh, `npcID:${this.id}`);
      this.npcMesh.getChildMeshes().forEach((mesh) => {
        Tags.EnableFor(mesh);
        Tags.AddTagsTo(mesh, `npcID:${this.id}`);
      });

      // Initialize physics
      this.setupPhysics();

      // Initialize animations
      this.animationManager.initialize(animationGroups);

      // Setup hover
      this.hoverHandler.setupHover(this);
    } catch (error) {
      console.error(`Failed to load character for NPC ID: ${this.id}`, error);
    }

    this.setQuestMarker("available");
  }

  private setupPhysics(): void {
    if (!this.npcMesh) {
      console.error(`Cannot setup physics: NPC mesh is null for NPC ID: ${this.id}`);
      return;
    }

    const physicsConfig: PhysicsConfig = {
      colliderType: ColliderType.Capsule,
      colliderParams: {
        auto: false,
        pointA: new Vector3(0, 0.2, 0),
        pointB: new Vector3(0, 1.75, 0),
        radius: 0.2,
      },
      physicsProps: {
        mass: 75,
        friction: 1,
        restitution: 0,
      },
    };

    this.physicsController = new NPCPhysicsController(this.scene, this.npcMesh, physicsConfig);
    this.physicsController.setInertia(new Vector3(0, 1, 0));
    this.physicsController.orientToForwardDirection(Vector3.Left());
  }

  private duplicate(container: AssetContainer, position: Vector3) {
    const entries = container.instantiateModelsToScene(undefined, false, { doNotInstantiate: false });

    const rootMesh = entries.rootNodes[0] as Mesh;
    this.npcMesh = rootMesh;
    this.npcMesh.isPickable = true;
    this.npcSkeleton = entries.skeletons[0];
    rootMesh.setEnabled(true);
    rootMesh.position = position;

    entries.rootNodes[0].getChildMeshes().forEach((mesh: AbstractMesh) => {
      mesh.setEnabled(true);
      mesh.isPickable = true; // Ensure child meshes are pickable
    });

    entries.animationGroups.forEach((animGroup) => {
      if (animGroup.name.startsWith("Clone of ")) {
        animGroup.name = animGroup.name.replace("Clone of ", "");
      }
    });

    return entries;
  }

  public setQuestMarker(markerType: "available" | "completed" | null): void {
    // Dispose of any existing quest marker to avoid duplicates
    if (this.questMarker) {
      if (this.questMarkerObserver) {
        this.scene.onBeforeRenderObservable.remove(this.questMarkerObserver);
        this.questMarkerObserver = null;
      }
      this.questMarker.dispose();
      this.questMarker = null;
    }

    if (!markerType || !this.npcMesh) {
      return;
    }

    try {
      // Select the appropriate SpriteManager based on markerType
      let spriteManager: SpriteManager | null = null;
      if (markerType === "available") {
        if (!NPC.availableSpriteManager) {
          NPC.availableSpriteManager = new SpriteManager(
            `availableSpriteManager_${this.id}`,
            "./images/exclamation.png",
            10, // Max capacity for sprites
            { width: 512, height: 512 },
            this.scene
          );
        }
        spriteManager = NPC.availableSpriteManager;
      } else if (markerType === "completed") {
        if (!NPC.completedSpriteManager) {
          NPC.completedSpriteManager = new SpriteManager(
            `completedSpriteManager_${this.id}`,
            "./images/question.png",
            10, // Max capacity for sprites
            { width: 512, height: 512 },
            this.scene
          );
        }
        spriteManager = NPC.completedSpriteManager;
      }

      if (!spriteManager) {
        console.error(`No SpriteManager created for markerType: ${markerType}`);
        return;
      }

      // Create a new sprite for the quest marker
      this.questMarker = new Sprite(`questMarker_${this.id}`, spriteManager);
      this.questMarker.width = 1; // Adjust size in world units
      this.questMarker.height = 1;
      this.questMarker.isPickable = false;

      // Compute the NPC's bounding box in world space
      this.npcMesh.refreshBoundingInfo();
      const boundingBox = this.npcMesh.getBoundingInfo().boundingBox;

      // Calculate the head position in world space
      const headPosition = new Vector3(
        this.npcMesh.position.x,
        boundingBox.maximumWorld.y + 3, // Offset above head
        this.npcMesh.position.z
      );

      // Position the sprite
      this.questMarker.position = headPosition;

      // Update sprite position in render loop
      this.questMarkerObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (this.questMarker && this.npcMesh) {
          this.npcMesh.refreshBoundingInfo();
          const updatedBoundingBox = this.npcMesh.getBoundingInfo().boundingBox;
          const updatedHeadPosition = new Vector3(
            this.npcMesh.position.x,
            updatedBoundingBox.maximumWorld.y + 3,
            this.npcMesh.position.z
          );
          this.questMarker.position = updatedHeadPosition;
        }
      });

    } catch (error) {
      console.error(`Failed to set quest marker sprite for NPC ID: ${this.id}`, error);
    }
  }

  public setTargetted(isTargetted: boolean): void {
    this.isTargetted = isTargetted;
    if (this.npcMesh) {
      // Compute bounding box to find the NPC's feet
      this.npcMesh.refreshBoundingInfo();
      const boundingBox = this.npcMesh.getBoundingInfo().boundingBox;
      const feetPosition = new Vector3(
        this.npcMesh.position.x,
        boundingBox.minimumWorld.y + 0.05, // Increased offset to prevent clipping
        this.npcMesh.position.z
      );

      console.log(`NPC ${this.id} position:`, this.npcMesh.position);
      console.log(`NPC ${this.id} feet position:`, feetPosition);
      console.log(`NPC ${this.id} bounding box min:`, boundingBox.minimumWorld);
      console.log(`NPC ${this.id} bounding box max:`, boundingBox.maximumWorld);

      // Create or remove the target circle
      if (isTargetted) {
        console.log(`Adding target circle to NPC ${this.id} at`, feetPosition);
        // Create a disc mesh for the gradient circle
        this.targetCircle = MeshBuilder.CreateDisc(`targetCircle_${this.id}`, {
          radius: 0.5, // Adjust radius as needed
          tessellation: 32,
        }, this.scene);
        this.targetCircle.position = feetPosition;
        this.targetCircle.rotation.x = Math.PI / 2;

        // Create a dynamic texture for the gradient with border
        const textureSize = 512;
        const dynamicTexture = new DynamicTexture(`targetCircleTex_${this.id}`, textureSize, this.scene, true);
        const ctx = dynamicTexture.getContext();
        const gradient = ctx.createRadialGradient(
          textureSize / 2, textureSize / 2, 0, // Center, inner radius
          textureSize / 2, textureSize / 2, textureSize / 2 // Center, outer radius
        );
        gradient.addColorStop(0.2, "rgba(0, 255, 0, 0)"); // Transparent center
        gradient.addColorStop(0.8, "rgba(0, 255, 0, 0.4)"); // Gradient green
        gradient.addColorStop(0.95, "rgba(0, 255, 0, 0.8)"); // Near edge
        gradient.addColorStop(1, "rgba(0, 255, 0, 1)"); // Solid green border
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, textureSize, textureSize);
        dynamicTexture.update();

        // Apply material with gradient texture
        const circleMaterial = new StandardMaterial(`targetCircleMat_${this.id}`, this.scene);
        circleMaterial.diffuseTexture = dynamicTexture;
        circleMaterial.opacityTexture = dynamicTexture; // Use texture for transparency
        circleMaterial.backFaceCulling = false; // Ensure visibility from all angles
        this.targetCircle.material = circleMaterial;
        this.targetCircle.isPickable = false;
        this.targetCircle.alwaysSelectAsActiveMesh = true; // Force render on top to prevent clipping

        // Update circle position in render loop
        const observer = this.scene.onBeforeRenderObservable.add(() => {
          if (this.targetCircle && this.npcMesh) {
            this.npcMesh.refreshBoundingInfo();
            const updatedFeetPosition = new Vector3(
              this.npcMesh.position.x,
              this.npcMesh.getBoundingInfo().boundingBox.minimumWorld.y + 0.05,
              this.npcMesh.position.z
            );
            this.targetCircle.position = updatedFeetPosition;
            // Add subtle rotation for visual flair
            this.targetCircle.rotation.y += 0.01;
          }
        });

        // Store observer to remove it later
        this.targetCircle.metadata = { observer };

        // Keep HighlightLayer code for reference
        console.log(`Adding highlight to NPC ${this.id} and its children`);
        this.highlightLayer.addMesh(this.npcMesh, Color3.Red(), true);
        this.npcMesh.getChildMeshes().forEach((mesh) => {
          this.highlightLayer.addMesh(mesh as Mesh, Color3.Red(), true);
        });
      } else {
        console.log(`Removing target circle from NPC ${this.id}`);
        if (this.targetCircle) {
          if (this.targetCircle.metadata?.observer) {
            this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
          }
          this.targetCircle.dispose();
          this.targetCircle = null;
        }

        // Keep HighlightLayer code for reference
        console.log(`Removing highlight from NPC ${this.id} and its children`);
        this.highlightLayer.removeMesh(this.npcMesh);
        this.npcMesh.getChildMeshes().forEach((mesh) => {
          this.highlightLayer.removeMesh(mesh as Mesh);
        });
      }
    } else {
      console.error(`Cannot set target circle or highlight: NPC mesh is null for NPC ID: ${this.id}`);
    }
  }

  public getId(): string {
    return this.id;
  }

  public getNPCMesh(): Mesh | null {
    return this.npcMesh;
  }

  public getSkeleton(): Skeleton | null {
    return this.npcSkeleton;
  }

  public getAnimationManager(): NPCAnimationManager {
    return this.animationManager;
  }

  public hasAnimationEnded(name: string): boolean {
    return this.animationManager.hasAnimationEnded(name);
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationManager.getAnimationByName(name);
  }

  public getPhysics(): NPCPhysicsController | null {
    return this.physicsController;
  }

  public getMesh(): Mesh | null {
    return this.npcMesh;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getPosition() {
    return this.position;
  }

  public dispose(): void {
    if (this.physicsController) {
      this.physicsController.dispose();
      this.physicsController = null;
    }

    if (this.targetCircle) {
      if (this.targetCircle.metadata?.observer) {
        this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
      }
      this.targetCircle.dispose();
      this.targetCircle = null;
    }

    if (this.questMarker) {
      if (this.questMarkerObserver) {
        this.scene.onBeforeRenderObservable.remove(this.questMarkerObserver);
        this.questMarkerObserver = null;
      }
      this.questMarker.dispose();
      this.questMarker = null;
    }

    // Clean up SpriteManagers if no other NPCs are using them
    if (NPC.availableSpriteManager && NPC.availableSpriteManager.sprites.length === 0) {
      NPC.availableSpriteManager.dispose();
      NPC.availableSpriteManager = null;
    }
    if (NPC.completedSpriteManager && NPC.completedSpriteManager.sprites.length === 0) {
      NPC.completedSpriteManager.dispose();
      NPC.completedSpriteManager = null;
    }

    if (this.npcMesh) {
      this.npcMesh.dispose();
      this.npcMesh = null;
    }

    this.animationManager.dispose();
    this.npcSkeleton = null;
  }

  public moveTo(position: Vector3): void {
    if (this.physicsController) {
      this.physicsController.moveTo(position);
    }
  }

  public startWandering(maxDistance = 10): void {
    if (this.physicsController) {
      this.physicsController.startWandering(maxDistance);
    }
  }

  public stopWandering(): void {
    if (this.physicsController) {
      this.physicsController.stopWandering();
    }
  }
}