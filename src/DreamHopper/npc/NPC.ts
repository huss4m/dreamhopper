import { AbstractMesh, ActionManager, AnimationGroup, AssetContainer, CascadedShadowGenerator, Color3, DynamicTexture, ExecuteCodeAction, HighlightLayer, Mesh, MeshBuilder, PBRMaterial, PointerEventTypes, Scene, Skeleton, Sprite, SpriteManager, StandardMaterial, Tags, Texture, Vector3, Observable, Quaternion, Animation } from "@babylonjs/core";
import { AdvancedDynamicTexture, Image as GUIImage } from "@babylonjs/gui";
import { AssetManager } from "../AssetManager";
import { Hoverable, HoverHandler, HoverConfig } from "../HoverableSystem";
import { Targettable } from "../Targettable";
import { TargetingSystem } from "../TargetingSystem";
import { v4 as uuidv4 } from 'uuid';
import { NPCPhysicsController, PhysicsConfig } from "./NPCPhysicsController";
import { ColliderType } from "../PhysicsController";
import { NPCAnimationManager } from "./NPCAnimationManager";
import { Game } from "../Game";

export class NPC implements Hoverable, Targettable {
  private id: string;
  private npcMesh: Mesh | null = null;
  private npcSkeleton: Skeleton | null = null;
  private animationManager: NPCAnimationManager;
  private physicsController: NPCPhysicsController | null = null;
  private hoverHandler: HoverHandler;
  private targetCircle: Mesh | null = null;
  private questMarker: Sprite | null = null;
  private questMarkerObserver: any | null = null;
  private dialogToggleObserver: any | null = null;

  isTargetted = false;

  assetManager!: AssetManager;
  shadowGenerator!: CascadedShadowGenerator;
  highlightLayer: HighlightLayer;
  static availableSpriteManager: SpriteManager | null = null;
  static completedSpriteManager: SpriteManager | null = null;
  position: Vector3;

  constructor(
    private scene: Scene,
    name: string,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator,
    position: Vector3,
    highlightLayer: HighlightLayer,
    targetingSystem: TargetingSystem,
    private game: Game
  ) {
    this.id = uuidv4();
    this.highlightLayer = highlightLayer;
    this.assetManager = assetManager;
    this.shadowGenerator = shadowGenerator;
    this.position = position;
    this.animationManager = new NPCAnimationManager(this.scene);

    const hoverConfig: HoverConfig = {
      highlightColor: Color3.Yellow(),
      customCursorUrl: "./images/cursorTargetAlly.png",
      innerGlow: true,
      outerGlow: false,
      blurHorizontalSize: 0.5,
      blurVerticalSize: 0.5,
    };
    this.hoverHandler = new HoverHandler(this.scene, this.highlightLayer, hoverConfig);

    targetingSystem.registerTarget(this);

    this.dialogToggleObserver = this.game.getOnQuestDialogToggled().add((isVisible) => {
      if (isVisible && this.game.getTargetingSystem().getCurrentTarget()?.getId() === this.id) {
        this.rotateToFacePlayer();
      }
    });

    this.loadCharacter(name, position);
  }

  private rotateToFacePlayer(): void {
    if (!this.npcMesh) {
      console.error(`Cannot rotate NPC ${this.id}: Mesh is null`);
      return;
    }

    if (!this.physicsController) {
      console.error(`Cannot rotate NPC ${this.id}: Physics controller is null`);
      return;
    }

    const playerMesh = this.game.getCharacterController()?.characterMeshLoader.getCharacterMesh();
    if (!playerMesh) {
      console.error(`Cannot rotate NPC ${this.id}: Player mesh not found`);
      return;
    }

    const direction = playerMesh.position.subtract(this.npcMesh.position);
    direction.y = 0; // Restrict to XZ plane
    if (direction.lengthSquared() < 0.01) {
      console.log(`NPC ${this.id}: Player too close, skipping rotation`);
      return;
    }

    // Use physics controller to rotate (compatible with physics engine)
    this.physicsController.orientToForwardDirection(direction);

    console.log(`NPC ${this.id}: Rotated to face player`);
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

      this.npcMesh.getChildMeshes().forEach((mesh) => {
        const mat = mesh.material as PBRMaterial;
        if (mat) {
          mat.metallic = 0.2;
          mat.roughness = 0.4;
          mat.albedoColor = mat.albedoColor || new Color3(1, 1, 1);
          mat.reflectivityColor = new Color3(0.3, 0.3, 0.3);
          mat.microSurface = 0.8;
        }
        mesh.checkCollisions = true;
      });

      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(this.npcMesh!);
        this.npcMesh!.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
      }

      Tags.EnableFor(this.npcMesh);
      Tags.AddTagsTo(this.npcMesh, `npcID:${this.id}`);
      this.npcMesh.getChildMeshes().forEach((mesh) => {
        Tags.EnableFor(mesh);
        Tags.AddTagsTo(mesh, `npcID:${this.id}`);
      });

      this.setupPhysics();
      this.animationManager.initialize(animationGroups);
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
      mesh.isPickable = true;
    });

    entries.animationGroups.forEach((animGroup) => {
      if (animGroup.name.startsWith("Clone of ")) {
        animGroup.name = animGroup.name.replace("Clone of ", "");
      }
    });

    return entries;
  }

  public setQuestMarker(markerType: "available" | "completed" | null): void {
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
      let spriteManager: SpriteManager | null = null;
      if (markerType === "available") {
        if (!NPC.availableSpriteManager) {
          NPC.availableSpriteManager = new SpriteManager(
            `availableSpriteManager_${this.id}`,
            "./images/exclamation.png",
            10,
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
            10,
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

      this.questMarker = new Sprite(`questMarker_${this.id}`, spriteManager);
      this.questMarker.width = 1;
      this.questMarker.height = 1;
      this.questMarker.isPickable = false;

      this.npcMesh.refreshBoundingInfo();
      const boundingBox = this.npcMesh.getBoundingInfo().boundingBox;
      const headPosition = new Vector3(
        this.npcMesh.position.x,
        boundingBox.maximumWorld.y + 3,
        this.npcMesh.position.z
      );

      this.questMarker.position = headPosition;

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
      this.npcMesh.refreshBoundingInfo();
      const boundingBox = this.npcMesh.getBoundingInfo().boundingBox;
      const feetPosition = new Vector3(
        this.npcMesh.position.x,
        boundingBox.minimumWorld.y + 0.05,
        this.npcMesh.position.z
      );

      console.log(`NPC ${this.id} position:`, this.npcMesh.position);
      console.log(`NPC ${this.id} feet position:`, feetPosition);
      console.log(`NPC ${this.id} bounding box min:`, boundingBox.minimumWorld);
      console.log(`NPC ${this.id} bounding box max:`, boundingBox.maximumWorld);

      if (isTargetted) {
        console.log(`Adding target circle to NPC ${this.id} at`, feetPosition);
        this.targetCircle = MeshBuilder.CreateDisc(`targetCircle_${this.id}`, {
          radius: 0.5,
          tessellation: 32,
        }, this.scene);
        this.targetCircle.position = feetPosition;
        this.targetCircle.rotation.x = Math.PI / 2;

        const textureSize = 512;
        const dynamicTexture = new DynamicTexture(`targetCircleTex_${this.id}`, textureSize, this.scene, true);
        const ctx = dynamicTexture.getContext();
        const gradient = ctx.createRadialGradient(
          textureSize / 2, textureSize / 2, 0,
          textureSize / 2, textureSize / 2, textureSize / 2
        );
        gradient.addColorStop(0.2, "rgba(0, 255, 0, 0)");
        gradient.addColorStop(0.8, "rgba(0, 255, 0, 0.4)");
        gradient.addColorStop(0.95, "rgba(0, 255, 0, 0.8)");
        gradient.addColorStop(1, "rgba(0, 255, 0, 1)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, textureSize, textureSize);
        dynamicTexture.update();

        const circleMaterial = new StandardMaterial(`targetCircleMat_${this.id}`, this.scene);
        circleMaterial.diffuseTexture = dynamicTexture;
        circleMaterial.opacityTexture = dynamicTexture;
        circleMaterial.backFaceCulling = false;
        this.targetCircle.material = circleMaterial;
        this.targetCircle.isPickable = false;
        this.targetCircle.alwaysSelectAsActiveMesh = true;

        const observer = this.scene.onBeforeRenderObservable.add(() => {
          if (this.targetCircle && this.npcMesh) {
            this.npcMesh.refreshBoundingInfo();
            const updatedFeetPosition = new Vector3(
              this.npcMesh.position.x,
              this.npcMesh.getBoundingInfo().boundingBox.minimumWorld.y + 0.05,
              this.npcMesh.position.z
            );
            this.targetCircle.position = updatedFeetPosition;
            this.targetCircle.rotation.y += 0.01;
          }
        });

        this.targetCircle.metadata = { observer };

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
    if (this.dialogToggleObserver) {
      this.game.getOnQuestDialogToggled().remove(this.dialogToggleObserver);
      this.dialogToggleObserver = null;
    }

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