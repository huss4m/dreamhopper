import { AbstractMesh, ActionManager, AnimationGroup, AssetContainer, CascadedShadowGenerator, Color3, ExecuteCodeAction, HighlightLayer, Mesh, PBRMaterial, PointerEventTypes, Scene, Skeleton, Tags, Vector3 } from "@babylonjs/core";
import { AssetManager } from "./AssetManager";
import { PhysicsController, PhysicsConfig, ColliderType } from "./PhysicsController";
import { Hoverable, HoverHandler, HoverConfig } from "./HoverableSystem";
import { v4 as uuidv4 } from 'uuid';

export class NPC implements Hoverable {
  private id: string; // Unique identifier for the NPC
  private npcMesh: Mesh | null = null;
  private npcSkeleton: Skeleton | null = null;
  private animationGroups: AnimationGroup[] = [];
  private physicsController: PhysicsController | null = null;
  private hoverHandler: HoverHandler;

  isTargetted = false;

  assetManager!: AssetManager;
  shadowGenerator!: CascadedShadowGenerator;
  highlightLayer: HighlightLayer;

  constructor(
    private scene: Scene,
    name: string,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator,
    position: Vector3,
    highlightLayer: HighlightLayer
  ) {
    this.id = uuidv4(); // Generate a unique ID for the NPC
    this.highlightLayer = highlightLayer;
    this.assetManager = assetManager;
    this.shadowGenerator = shadowGenerator;

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

    this.loadCharacter(name, position);
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
      this.animationGroups = clones.animationGroups || [];

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

      // Add to shadow generator
      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(this.npcMesh!);
        this.npcMesh!.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
      }

      // Add tags including ID
      Tags.AddTagsTo(this.npcMesh, `npcID:${this.id}`);

      // Initialize physics
      this.setupPhysics();

      // Setup hover
      this.hoverHandler.setupHover(this);

      // Start idle animation
      this.getAnimationByName('Idle')?.start(true);
    } catch (error) {
      console.error(`Failed to load character for NPC ID: ${this.id}`, error);
    }
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

    this.physicsController = new PhysicsController(this.scene, this.npcMesh, physicsConfig);
    this.physicsController.getPhysicsAggregate()?.body.setMassProperties({
      inertia: new Vector3(0, 1, 0),
    });
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
    });

    entries.animationGroups.forEach((animGroup) => {
      if (animGroup.name.startsWith("Clone of ")) {
        animGroup.name = animGroup.name.replace("Clone of ", "");
      }
    });

    return entries;
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

  public getAnimationGroups(): AnimationGroup[] {
    return this.animationGroups;
  }

  public hasAnimationEnded(index: number): boolean {
    const anim = this.animationGroups[index];
    return anim.isPlaying === false;
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public getPhysicsController(): PhysicsController | null {
    return this.physicsController;
  }

  public getMesh(): Mesh | null {
    return this.npcMesh;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public dispose(): void {
    if (this.physicsController) {
      this.physicsController.dispose();
      this.physicsController = null;
    }

    if (this.npcMesh) {
      this.npcMesh.dispose();
      this.npcMesh = null;
    }

    this.animationGroups.forEach(anim => anim.dispose());
    this.animationGroups = [];

    this.npcSkeleton = null;
  }



}