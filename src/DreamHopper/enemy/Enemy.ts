import { AbstractMesh, AnimationGroup, AssetContainer, CascadedShadowGenerator, Color3, DynamicTexture, HighlightLayer, Mesh, MeshBuilder, PBRMaterial, Scene, Skeleton, StandardMaterial, Tags, Vector3, Observable } from "@babylonjs/core";
import { AdvancedDynamicTexture, Image as GUIImage } from "@babylonjs/gui";
import { AssetManager } from "../AssetManager";
import { Hoverable, HoverHandler, HoverConfig } from "../HoverableSystem";
import { Targettable } from "../Targettable";
import { TargetingSystem } from "../TargetingSystem";
import { v4 as uuidv4 } from 'uuid';
import { EnemyPhysicsController, PhysicsConfig } from "./EnemyPhysicsController";
import { ColliderType } from "../PhysicsController";
import { EnemyAnimationManager } from "./EnemyAnimationManager";
import { Game } from "../Game";

export class Enemy implements Hoverable, Targettable {
  private id: string;
  private enemyMesh: Mesh | null = null;
  private enemySkeleton: Skeleton | null = null;
  private animationManager: EnemyAnimationManager;
  private physicsController: EnemyPhysicsController | null = null;
  private hoverHandler: HoverHandler;
  private hoverConfig: HoverConfig;
  private targetCircle: Mesh | null = null;
  private hitboxMesh: Mesh | null = null;
  private aggroRadius = 20;
  private attackRange = 10;
  private isAggroed = false;
  private isAttacking = false;
  private behaviorObserver: any = null;
  private isNPC = false;

  isTargetted = false;
  isTransformed = false;

  assetManager!: AssetManager;
  shadowGenerator!: CascadedShadowGenerator;
  highlightLayer: HighlightLayer;
  position: Vector3;
  private game: Game;

  constructor(
    private scene: Scene,
    name: string,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator,
    position: Vector3,
    highlightLayer: HighlightLayer,
    targetingSystem: TargetingSystem,
    game: Game
  ) {
    this.id = uuidv4();
    this.highlightLayer = highlightLayer;
    this.assetManager = assetManager;
    this.shadowGenerator = shadowGenerator;
    this.position = position;
    this.game = game;
    this.animationManager = new EnemyAnimationManager(this.scene, this.game, this);

    this.hoverConfig = {
      highlightColor: Color3.Yellow(),
      customCursorUrl: "./images/cursorTargetAlly.png",
      innerGlow: false,
      outerGlow: false,
      blurHorizontalSize: 0,
      blurVerticalSize: 0,
    };
    this.hoverHandler = new HoverHandler(this.scene, this.highlightLayer, this.hoverConfig);

    targetingSystem.registerTarget(this);

    this.loadCharacter(name);
    this.startWandering();
    this.setupBehavior();
  }

   private setupBehavior(): void {
    if (this.isNPC) {
      // console.log(`Enemy ${this.id}: Skipping behavior setup, is NPC`);
      return;
    }

    this.behaviorObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.enemyMesh || !this.physicsController) return;

      const playerMesh = this.game.getCharacterController()?.characterMeshLoader.getCharacterMesh();
      if (!playerMesh) {
        console.warn(`Enemy ${this.id}: Player mesh not found`);
        return;
      }

      // Check if player is dead
      const player = this.game.getCharacterController()?.getPlayer();
      if (player?.isPlayerDead()) {
        if (this.isAggroed || this.isAttacking) {
          this.isAggroed = false;
          this.isAttacking = false;
          this.physicsController.stopAllMovement();
          this.animationManager.playAnimation("Idle", 1.0, undefined, undefined, true);
          console.log(`Enemy ${this.id}: Player is dead, stopping attack and switching to Idle`);
        }
        return;
      }

      const distanceToPlayer = Vector3.Distance(this.enemyMesh.position, playerMesh.position);
      // console.log(`Enemy ${this.id}: Distance to player = ${distanceToPlayer}`);

      if (distanceToPlayer <= this.aggroRadius && !this.isAggroed) {
        this.isAggroed = true;
        this.physicsController.stopAllMovement();
        // console.log(`Enemy ${this.id}: Aggroed on player at distance ${distanceToPlayer}`);
      } else if (distanceToPlayer > this.aggroRadius && this.isAggroed) {
        this.isAggroed = false;
        this.isAttacking = false;
        this.startWandering();
        // console.log(`Enemy ${this.id}: Lost aggro, resuming wander`);
      }

      if (this.isAggroed) {
        if (distanceToPlayer <= this.attackRange) {
          this.physicsController.stopAllMovement();
          const directionToPlayer = playerMesh.position.subtract(this.enemyMesh.position);
          this.physicsController.orientToForwardDirection(directionToPlayer);
          if (!this.isAttacking) {
            this.isAttacking = true;
            const animationName = this.animationManager.getAnimationByName("NightmareBolt") ? "NightmareBolt" : "Idle";
            this.animationManager.playAnimation(animationName, 1.0, undefined, undefined, true);
            // console.log(`Enemy ${this.id}: In attack range (${distanceToPlayer}), playing ${animationName}, facing player`);
          }
        } else {
          this.isAttacking = false;
          this.moveTo(playerMesh.position);
          this.animationManager.playAnimation("Run");
          // console.log(`Enemy ${this.id}: Chasing player at distance ${distanceToPlayer}`);
        }
      }
    });
  }

  public async loadCharacter(name: string): Promise<void> {
    try {
      const enemyAssetContainer = this.assetManager.getAssetContainer(name);
      if (!enemyAssetContainer) {
        console.error(`Failed to load the ${name} asset container for Enemy ${this.id}`);
        return;
      }

      const clones = this.duplicate(enemyAssetContainer, this.position);
      this.enemyMesh = clones.rootNodes[0] as Mesh;
      this.enemySkeleton = clones.skeletons[0];
      const animationGroups = clones.animationGroups || [];

      this.enemyMesh.position = this.position;
      this.enemyMesh.checkCollisions = true;
      this.enemyMesh.isPickable = true;
      // console.log(`Root mesh: ${this.enemyMesh.name}, isVisible: ${this.enemyMesh.isVisible}, isPickable: ${this.enemyMesh.isPickable}`);

      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        const mat = mesh.material as PBRMaterial;
        mesh.checkCollisions = true;
        mesh.isPickable = true;
        // console.log(`Child mesh: ${mesh.name}, isVisible: ${mesh.isVisible}, isPickable: ${mesh.isPickable}, material: ${mesh.material?.name}, tags: ${Tags.GetTags(mesh)}`);
      });

      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(this.enemyMesh!);
        this.enemyMesh!.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
      }

      Tags.EnableFor(this.enemyMesh);
      Tags.AddTagsTo(this.enemyMesh, `enemyID:${this.id}`);
      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        Tags.EnableFor(mesh);
        Tags.AddTagsTo(mesh, `enemyID:${this.id}`);
      });

      this.hitboxMesh = MeshBuilder.CreateBox(`hitbox_${this.id}`, {
        height: 2, width: 1,
      }, this.scene);
      this.hitboxMesh.parent = this.enemyMesh;
      this.hitboxMesh.position = new Vector3(0, 1, 0);
      this.hitboxMesh.checkCollisions = false;
      this.hitboxMesh.isPickable = true;
      this.hitboxMesh.isVisible = false;

      const hitboxMaterial = new StandardMaterial(`hitboxMat_${this.id}`, this.scene);
      hitboxMaterial.alpha = 0;
      this.hitboxMesh.material = hitboxMaterial;

      Tags.EnableFor(this.hitboxMesh);
      Tags.AddTagsTo(this.hitboxMesh, `enemyID:${this.id} hitbox`);
      // console.log(`Hitbox: ${this.hitboxMesh.name}, isVisible: ${this.hitboxMesh.isVisible}, isPickable: ${this.hitboxMesh.isPickable}, tags: ${Tags.GetTags(this.hitboxMesh)}`);

      this.hitboxMesh.receiveShadows = false;
      this.shadowGenerator.removeShadowCaster(this.hitboxMesh);

      this.setupPhysics();
      this.animationManager.initialize(animationGroups);

      const hoverable: Hoverable = {
        getMesh: () => this.enemyMesh,
        getScene: () => this.scene,
        getHighlightMesh: () => this.enemyMesh,
      };
      this.hoverHandler.setupHover(hoverable);
    } catch (error) {
      console.error(`Failed to load character for Enemy ${this.id}`, error);
    }
  }

  private setupPhysics(): void {
    if (!this.enemyMesh) {
      console.error(`Cannot setup physics: Enemy mesh is null for Enemy ${this.id}`);
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

    this.physicsController = new EnemyPhysicsController(this.scene, this.enemyMesh, physicsConfig);
    this.physicsController.setInertia(new Vector3(0, 1, 0));
    this.physicsController.orientToForwardDirection(Vector3.Left());
    // console.log(`Enemy ${this.id}: PhysicsController initialized, instance: ${this.physicsController}`);
  }

  private duplicate(container: AssetContainer, position: Vector3) {
    const entries = container.instantiateModelsToScene(undefined, false, { doNotInstantiate: false });

    const rootMesh = entries.rootNodes[0] as Mesh;
    this.enemyMesh = rootMesh;
    this.enemyMesh.isPickable = true;
    this.enemySkeleton = entries.skeletons[0];
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

  public setTargetted(isTargetted: boolean): void {
    this.isTargetted = isTargetted;
  
    if (this.enemyMesh) {
      this.enemyMesh.refreshBoundingInfo();
      const boundingBox = this.enemyMesh.getBoundingInfo().boundingBox;
      const feetPosition = new Vector3(
        this.enemyMesh.position.x,
        boundingBox.minimumWorld.y + 0.05,
        this.enemyMesh.position.z
      );
  
      if (isTargetted) {
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
        gradient.addColorStop(0.2, "rgba(255, 0, 0, 0)");
        gradient.addColorStop(0.8, "rgba(255, 0, 0, 0.4)");
        gradient.addColorStop(0.95, "rgba(255, 0, 0, 0.8)");
        gradient.addColorStop(1, "rgba(255, 0, 0, 1)");
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
          if (this.targetCircle && this.enemyMesh && !this.enemyMesh.isDisposed()) {
            this.enemyMesh.refreshBoundingInfo();
            const updatedFeetPosition = new Vector3(
              this.enemyMesh.position.x,
              this.enemyMesh.getBoundingInfo().boundingBox.minimumWorld.y + 0.05,
              this.enemyMesh.position.z,
            );
            this.targetCircle.position = updatedFeetPosition;
            this.targetCircle.rotation.y += 0.01;
          }
        });
  
        this.targetCircle.metadata = { observer };
  
        try {
          if (this.highlightLayer && !this.enemyMesh.isDisposed()) {
            if ((this.highlightLayer as any)._thicknessLayer?._engine?._gl) {
              this.highlightLayer.addMesh(this.enemyMesh, Color3.Red(), true);
              this.enemyMesh.getChildMeshes().forEach((mesh) => {
                if (!mesh.isDisposed() && mesh instanceof Mesh) {
                  this.highlightLayer.addMesh(mesh, Color3.Red(), true);
                }
              });
            } else {
              console.warn("HighlightLayer internals appear to be disposed or invalid.");
            }
          }
        } catch (err) {
          console.error("Error while applying highlight to enemy:", err);
        }
      } else {
        if (this.targetCircle) {
          if (this.targetCircle.metadata?.observer) {
            this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
          }
          this.targetCircle.dispose();
          this.targetCircle = null;
        }
  
        if (this.highlightLayer && this.enemyMesh && !this.enemyMesh.isDisposed()) {
          this.highlightLayer.removeMesh(this.enemyMesh);
          this.enemyMesh.getChildMeshes().forEach((mesh) => {
            if (!mesh.isDisposed() && mesh instanceof Mesh) {
              this.highlightLayer.removeMesh(mesh);
            }
          });
        }
      }
    } else {
      console.error(`Cannot set target circle or highlight: Enemy mesh is null for Enemy ${this.id}`);
    }
  }

  public getId(): string {
    return this.id;
  }

  public getEnemyMesh(): Mesh | null {
    return this.enemyMesh;
  }

  public getSkeleton(): Skeleton | null {
    return this.enemySkeleton;
  }

  public getAnimationManager(): EnemyAnimationManager {
    return this.animationManager;
  }

  public hasAnimationEnded(name: string): boolean {
    return this.animationManager.hasAnimationEnded(name);
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationManager.getAnimationByName(name);
  }

  public getPhysics(): EnemyPhysicsController | null {
    return this.physicsController;
  }

  public getMesh(): Mesh | null {
    return this.enemyMesh;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getPosition() {
    return this.position;
  }

  public dispose(): void {
    if (this.behaviorObserver) {
      this.scene.onBeforeRenderObservable.remove(this.behaviorObserver);
      this.behaviorObserver = null;
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
    if (this.hitboxMesh) {
      this.hitboxMesh.dispose();
      this.hitboxMesh = null;
    }
    if (this.enemyMesh) {
      this.enemyMesh.dispose();
      this.enemyMesh = null;
    }
    this.animationManager.dispose();
    this.enemySkeleton = null;
  }

  public moveTo(position: Vector3): void {
    if (this.physicsController) {
      this.physicsController.moveTo(position);
    }
  }

  public startWandering(maxDistance = 10): void {
    if (!this.physicsController) {
      console.warn(`Enemy ${this.id}: Cannot start wandering, physicsController is null`);
      return;
    }
    this.physicsController.startWandering(maxDistance);
    this.animationManager.playAnimation("Run");
  }

  public stopWandering(): void {
    if (this.physicsController) {
      this.physicsController.stopWandering();
    }
  }

  public async swapToNPCModel(): Promise<void> {
    if (this.isTransformed) {
      // console.log(`Enemy ${this.id}: Already transformed to NPC, skipping swap`);
      return;
    }

    if (!this.assetManager) {
      console.error(`Cannot swap model: AssetManager is not defined for Enemy ${this.id}`);
      return;
    }
  
    try {
      // console.log(`Enemy ${this.id}: Attempting to swap to NPC, isTransformed: ${this.isTransformed}`);
      const currentPosition = this.enemyMesh ? this.enemyMesh.position.clone() : this.position;
      const wasWandering = this.isAggroed ? false : true;

      if (this.behaviorObserver) {
        this.scene.onBeforeRenderObservable.remove(this.behaviorObserver);
        this.behaviorObserver = null;
      }

      if (this.physicsController) {
        this.physicsController.stopAllMovement();
        this.physicsController.dispose();
        this.physicsController = null;
        // console.log(`Enemy ${this.id}: PhysicsController stopped and disposed`);
      }

      if (this.targetCircle) {
        if (this.targetCircle.metadata?.observer) {
          this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
        }
        this.targetCircle.dispose();
        this.targetCircle = null;
      }

      if (this.hitboxMesh) {
        this.hitboxMesh.dispose();
        this.hitboxMesh = null;
      }

      if (this.enemyMesh && this.highlightLayer && !this.enemyMesh.isDisposed()) {
        this.highlightLayer.removeMesh(this.enemyMesh);
        this.enemyMesh.getChildMeshes().forEach((mesh) => {
          if (!mesh.isDisposed() && mesh instanceof Mesh) {
            this.highlightLayer.removeMesh(mesh);
          }
        });
      }

      if (this.enemyMesh) {
        this.enemyMesh.dispose();
        this.enemyMesh = null;
      }

      this.animationManager.dispose();
      this.enemySkeleton = null;

      const npcAssetContainer = this.assetManager.getAssetContainer("plushUnicorn");
      if (!npcAssetContainer) {
        console.error(`Failed to load npc asset container for Enemy ${this.id}`);
        this.position = currentPosition;
        return;
      }

      const clones = this.duplicate(npcAssetContainer, currentPosition);
      this.enemyMesh = clones.rootNodes[0] as Mesh;
      this.enemySkeleton = clones.skeletons[0];
      const animationGroups = clones.animationGroups || [];

      this.enemyMesh.position = currentPosition;
      this.enemyMesh.checkCollisions = true;
      this.enemyMesh.isPickable = false; // Make unicorn model non-pickable
      this.enemyMesh.scaling = new Vector3(3, 3, 3);

      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        mesh.checkCollisions = true;
        mesh.isPickable = false; // Make child meshes non-pickable
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(mesh);
        }
      });

      Tags.EnableFor(this.enemyMesh);
      Tags.AddTagsTo(this.enemyMesh, `enemyID:${this.id}`);
      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        Tags.EnableFor(mesh);
        Tags.AddTagsTo(mesh, `enemyID:${this.id}`);
      });

      this.hitboxMesh = MeshBuilder.CreateBox(`hitbox_${this.id}`, {
        height: 0.4, // 5x smaller than 2
        width: 0.3,  // 5x smaller than 1.5
      }, this.scene);
      this.hitboxMesh.parent = this.enemyMesh;
      this.hitboxMesh.position = new Vector3(0, 0.2, 0); // Adjusted for smaller height
      this.hitboxMesh.checkCollisions = false;
      this.hitboxMesh.isPickable = true;
      this.hitboxMesh.isVisible = false;

      const hitboxMaterial = new StandardMaterial(`hitboxMat_${this.id}`, this.scene);
      hitboxMaterial.alpha = 0;
      this.hitboxMesh.material = hitboxMaterial;

      Tags.EnableFor(this.hitboxMesh);
      //Tags.AddTagsTo(this.hitboxMesh, `enemyID:${this.id} hitbox`);
      // console.log(`Enemy ${this.id}: Unicorn hitbox created, height: 0.4, width: 0.3, isPickable: ${this.hitboxMesh.isPickable}, mesh isPickable: ${this.enemyMesh.isPickable}`);

      this.shadowGenerator.removeShadowCaster(this.hitboxMesh);

      this.setupPhysics();

      this.animationManager.initialize(animationGroups);

      const hoverable: Hoverable = {
        getMesh: () => this.hitboxMesh, // Use hitbox for hovering
        getScene: () => this.scene,
        getHighlightMesh: () => this.enemyMesh,
      };
      this.hoverHandler.setupHover(hoverable);

      if (this.isTargetted) {
        if (!this.highlightLayer) {
          console.error(`HighlightLayer is undefined before reapplying targeting for Enemy ${this.id}`);
          this.isTargetted = false;
        } else {
          this.setTargetted(true);
        }
      }

      // Set NPC state
      this.isNPC = true;
      this.isAggroed = false;
      this.isAttacking = false;
      this.isTransformed = true;

      // Play appropriate animation (default to Idle)
      this.physicsController!.stopAllMovement();
      this.animationManager.playAnimation("Idle", 1.0, undefined, undefined, true);
      // console.log(`Enemy ${this.id}: Set to Idle as NPC`);

      if (wasWandering) {
        this.physicsController!.startWandering();
        this.animationManager.playAnimation("Run", 1.0, undefined, undefined, true);
        // console.log(`Enemy ${this.id}: Resumed wandering as NPC`);
      }

      // console.log(`Enemy ${this.id} model swapped to plushUnicorn at position`, currentPosition);
    } catch (error) {
      console.error(`Failed to swap model to npc for Enemy ${this.id}`, error);
    }
  }
}