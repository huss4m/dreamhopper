import { AbstractMesh, AnimationGroup, AssetContainer, CascadedShadowGenerator, Color3, DynamicTexture, Mesh, MeshBuilder, PBRMaterial, Scene, Skeleton, StandardMaterial, Tags, Vector3, Observable, Ray, RayHelper } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle } from "@babylonjs/gui";
import { AssetManager } from "../AssetManager";
import { Hoverable, HoverHandler, HoverConfig } from "../HoverableSystem";
import { Targettable } from "../Targettable";
import { TargetingSystem } from "../TargetingSystem";
import { v4 as uuidv4 } from 'uuid';
import { EnemyPhysicsController, PhysicsConfig } from "./EnemyPhysicsController";
import { ColliderType } from "../PhysicsController";
import { EnemyAnimationManager } from "./EnemyAnimationManager";
import { Game } from "../Game";
import { EnemyTypeConfig } from "./EnemyTypeConfig";
import { EnemyAttackSystem } from "./EnemyAttackSystem";

export class Enemy implements Hoverable, Targettable {
  protected id: string;
  protected enemyMesh: Mesh | null = null;
  protected enemySkeleton: Skeleton | null = null;
  protected animationManager: EnemyAnimationManager;
  protected physicsController: EnemyPhysicsController | null = null;

  protected attackSystem: EnemyAttackSystem;

  protected hoverHandler: HoverHandler;
  protected hoverConfig: HoverConfig;
  protected targetCircle: Mesh | null = null;
  protected hitboxMesh: Mesh | null = null;
  protected healthBarPlane: Mesh | null = null;
  protected healthBarTexture: AdvancedDynamicTexture | null = null;
  protected healthBarFill: Rectangle | null = null;
  protected healthBarBackground: Rectangle | null = null;
  protected healthBarObserver: any = null;
  protected aggroRadius: number;
  protected attackRange: number;
  protected isAggroed = false;
  protected isAttacking = false;
  protected behaviorObserver: any = null;
  protected isNPC = false;
  protected maxHP : number;
  protected currentHP : number;
  public onDeath: Observable<{ id: string; position: Vector3 }> = new Observable(); // New: Observable for KILL quest

  isTargetted = false;
  isTransformed = false;

  assetManager!: AssetManager;
  shadowGenerator!: CascadedShadowGenerator;
  position: Vector3;
  protected game: Game;


  protected lastLOSCheckTime = 0;
  protected losCheckInterval = 500; 
  protected lastHasLOS: boolean | null = null;

  private lastHealthBarUpdateTime = 0;
  private healthBarUpdateInterval = 100;

  public xpReward = 200;
  public config: EnemyTypeConfig;
  type: string;
  //protected hasTriggeredThisCycle: Map<string, boolean> = new Map();

  //protected lastAttackProgress: Map<string, number> = new Map(); // New: Track last progress per attack animation

  constructor(
    protected scene: Scene,
    config: EnemyTypeConfig,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator,
    position: Vector3,
    targetingSystem: TargetingSystem,
    game: Game
  ) {
    this.id = uuidv4();
    this.config = config;
    this.type = config.type;
    this.assetManager = assetManager;
    this.shadowGenerator = shadowGenerator;
    this.position = position;
    this.game = game;
    this.animationManager = new EnemyAnimationManager(this.scene, this.game, this);
    this.attackSystem = new EnemyAttackSystem(this.scene, this, this.game); // New

    // Log attacks config to verify
    console.log(`Enemy ${this.id}: Attacks config`, JSON.stringify(this.config.attacks, null, 2));
    // Use config
    this.maxHP = config.maxHP;
    this.currentHP = config.maxHP;
    this.aggroRadius = config.aggroRadius;
    this.attackRange = config.attackRange;
    this.xpReward = config.xpReward;


    this.hoverConfig = {
      customCursorUrl: "./images/cursorTargetAlly.png",
    };
    this.hoverHandler = new HoverHandler(this.scene, this.hoverConfig);

    targetingSystem.registerTarget(this);

    this.loadCharacter();
    this.startWandering();
    this.setupBehavior();
  }

  // New: Method to trigger attacks
    public performAttack(attackId: string): void {
        this.attackSystem.performAttack(attackId);
    }

  protected setupBehavior(): void {
        if (this.isNPC) {
            console.log(`Enemy ${this.id}: Skipping behavior setup, is NPC`);
            return;
        }

        // Subscribe to keyframe events for attack animations
        const keyFrameObserver = this.animationManager.onAnimationKeyFrame.add(({ name, frame }) => {
            const attack = this.config.attacks.find(a => a.animation === name && a.triggerFrame === frame);
            if (attack) {
                this.performAttack(attack.id);
                console.log(`Enemy ${this.id}: Triggered attack ${attack.id} at frame ${frame}`);
            }
        });

        this.behaviorObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (!this.enemyMesh || !this.physicsController) {
                console.error(`Enemy ${this.id}: Behavior skipped - enemyMesh: ${!!this.enemyMesh}, physicsController: ${!!this.physicsController}, isNPC: ${this.isNPC}, isDead: ${this.isDead}`);
                return;
            }

            const playerMesh = this.game.getCharacterController()?.characterMeshLoader.getCharacterMesh();
            if (!playerMesh) {
                console.warn(`Enemy ${this.id}: Player mesh not found`);
                return;
            }

            const distanceToPlayer = Vector3.Distance(this.enemyMesh.position, playerMesh.position);
            const cullingDistance = 110;
            if (distanceToPlayer > cullingDistance) {
                if (this.isAggroed || this.isAttacking) {
                    this.isAggroed = false;
                    this.isAttacking = false;
                    this.physicsController.stopAllMovement();
                    this.startWandering();
                    console.log(`Enemy ${this.id}: Beyond culling distance (${distanceToPlayer.toFixed(2)} > ${cullingDistance}), lost aggro, resuming wander`);
                }
                return;
            }

            if (this.isDead() || this.game.getCharacterController()?.getPlayer()?.isPlayerDead()) {
                if (this.isAggroed || this.isAttacking) {
                    this.isAggroed = false;
                    this.isAttacking = false;
                    this.physicsController.stopAllMovement();
                    this.animationManager.playAnimation(this.config.animations.idle, 1.0, undefined, undefined, true);
                    console.log(`Enemy ${this.id}: Player or enemy is dead, stopping attack and switching to Idle`);
                }
                return;
            }

            if (distanceToPlayer <= this.aggroRadius && !this.isAggroed) {
                this.isAggroed = true;
                this.isAttacking = false;
                this.physicsController.stopAllMovement();
                console.log(`Enemy ${this.id}: Aggroed on player at distance ${distanceToPlayer.toFixed(2)}`);
            } else if (distanceToPlayer > this.aggroRadius && this.isAggroed) {
                this.isAggroed = false;
                this.isAttacking = false;
                this.physicsController.stopAllMovement();
                this.startWandering();
                console.log(`Enemy ${this.id}: Lost aggro, resuming wander`);
            }

            if (this.isAggroed) {
                const hasLOS = this.hasLineOfSightToPlayer(playerMesh);

                if (distanceToPlayer <= this.attackRange && hasLOS) {
                    this.physicsController.stopAllMovement();
                    const directionToPlayer = playerMesh.position.subtract(this.enemyMesh.position);
                    this.physicsController.orientToForwardDirection(directionToPlayer);
                    if (!this.isAttacking) {
                        this.isAttacking = true;
                        const attackId = "nightmareBolt"; // Will generalize later
                        const animation = this.attackSystem.getAttackAnimation(attackId);
                        if (animation) {
                            this.animationManager.playAnimation(animation, 1.0, undefined, undefined, true);
                            console.log(`Enemy ${this.id}: In attack range (${distanceToPlayer.toFixed(2)}) with LOS, playing ${animation}`);
                        } else {
                            console.warn(`Enemy ${this.id}: No animation found for attack ${attackId}`);
                        }
                    }
                } else {
                    if (this.isAttacking) {
                        this.isAttacking = false;
                        this.physicsController.stopAllMovement();
                        console.log(`Enemy ${this.id}: Stopped attacking, chasing player due to no LOS or out of range`);
                    }
                    this.moveTo(playerMesh.position);
                    this.animationManager.playAnimation(this.config.animations.run);
                    console.log(`Enemy ${this.id}: Moving to player at distance ${distanceToPlayer.toFixed(2)}, LOS: ${hasLOS}`);
                }
            } else {
                const agentVelocity = this.game.getCrowd()?.getAgentVelocity(this.physicsController.getAgentIndex());
                if (agentVelocity && agentVelocity.lengthSquared() > 0.01) {
                    this.animationManager.playAnimation(this.config.animations.run, 1.0, undefined, undefined, false);
                } else {
                    this.animationManager.playAnimation(this.config.animations.idle, 1.0, undefined, undefined, true);
                }
            }
        });
    }
  protected setupHealthBarObserver(): void {
  const nearUpdateInterval = 100; // Update nearby health bars every 100ms
  const farUpdateInterval = 500; // Update distant health bars every 500ms
  const visibilityDistance = 30; // Show health bars within 30 units
  const hitboxHeight = 2.0;
  const yOffset = 0.2;
  let floatPhase = 0;

  this.healthBarObserver = this.scene.onBeforeRenderObservable.add(() => {
    if (!this.healthBarPlane || !this.hitboxMesh || this.hitboxMesh.isDisposed()) {
      console.warn(`Enemy ${this.id}: Health bar update skipped - plane or hitbox disposed`);
      this.disposeHealthBar();
      return;
    }

    const playerMesh = this.game.getCharacterController()?.characterMeshLoader.getCharacterMesh();
    if (!playerMesh) {
      this.healthBarPlane.isVisible = false;
      return;
    }

    const currentTime = performance.now();
    const distanceToPlayer = Vector3.Distance(this.enemyMesh!.position, playerMesh.position);
    const isRelevant = this.isTargetted || this.isAggroed || distanceToPlayer <= visibilityDistance;
    this.healthBarUpdateInterval = distanceToPlayer > visibilityDistance ? farUpdateInterval : nearUpdateInterval;

    // Hide health bar if not relevant
    if (!isRelevant) {
      this.healthBarPlane.isVisible = false;
      return;
    }

    // Only update if enough time has passed
    if (currentTime - this.lastHealthBarUpdateTime < this.healthBarUpdateInterval) {
      return;
    }
    this.lastHealthBarUpdateTime = currentTime;

    // Update position with floating effect
    this.healthBarPlane.isVisible = true;
    this.hitboxMesh.computeWorldMatrix(true);
    const hitboxTopY = this.hitboxMesh.absolutePosition.y + (hitboxHeight / 2);
    floatPhase += this.scene.getEngine().getDeltaTime() * 0.002;
    const floatY = Math.sin(floatPhase) * 0.05;
    this.healthBarPlane.position = new Vector3(
      this.hitboxMesh.absolutePosition.x,
      hitboxTopY + yOffset + floatY,
      this.hitboxMesh.absolutePosition.z
    );
  });
}

  protected setupHealthBar(isNPC = false): void {
  if (isNPC) {
    // console.log(`Enemy ${this.id}: Skipping health bar setup for NPC`);
    return;
  }

  if (!this.enemyMesh || !this.hitboxMesh) {
    console.error(`Enemy ${this.id}: Cannot setup health bar, enemy mesh or hitbox is null`);
    return;
  }

  try {
    const hitboxHeight = 2.0;
    const yOffset = 0.2;
    this.hitboxMesh.computeWorldMatrix(true);
    const hitboxTopY = this.hitboxMesh.absolutePosition.y + (hitboxHeight / 2);

    this.healthBarPlane = MeshBuilder.CreatePlane(`healthBar_${this.id}`, {
      width: 1.5,
      height: 0.15,
    }, this.scene);

    this.healthBarPlane.position = new Vector3(
      this.hitboxMesh.absolutePosition.x,
      hitboxTopY + yOffset,
      this.hitboxMesh.absolutePosition.z
    );
    this.healthBarPlane.isPickable = false;
    this.healthBarPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.healthBarPlane.isVisible = false; // Start invisible
    this.healthBarPlane.renderingGroupId = 0;
    this.healthBarPlane.alwaysSelectAsActiveMesh = false;

    this.healthBarTexture = AdvancedDynamicTexture.CreateForMesh(this.healthBarPlane, 768, 96, true);

    this.healthBarBackground = new Rectangle(`healthBarBg_${this.id}`);
    this.healthBarBackground.width = "100%";
    this.healthBarBackground.height = "100%";
    this.healthBarBackground.thickness = 1;
    this.healthBarBackground.color = "rgba(255, 255, 255, 0.4)";
    this.healthBarBackground.background = "rgba(200, 160, 255, 0.2)";
    this.healthBarBackground.cornerRadius = 150;
    this.healthBarTexture.addControl(this.healthBarBackground);

    this.healthBarFill = new Rectangle(`healthBarFill_${this.id}`);
    this.healthBarFill.width = `${(this.currentHP / this.maxHP) * 100}%`;
    this.healthBarFill.height = "90%";
    this.healthBarFill.horizontalAlignment = Rectangle.HORIZONTAL_ALIGNMENT_LEFT;
    this.healthBarFill.background = "rgba(33, 184, 221, 0.95)";
    this.healthBarFill.thickness = 0;
    this.healthBarFill.cornerRadius = 90;
    this.healthBarTexture.addControl(this.healthBarFill);

    // Initialize update timing
    this.lastHealthBarUpdateTime = 0;
    this.healthBarUpdateInterval = 100; // Default to 100ms, adjusted in observer

    this.setupHealthBarObserver();
    this.updateHealthBar();
    // console.log(`Enemy ${this.id}: Health bar setup complete`);
  } catch (error) {
    console.error(`Enemy ${this.id}: Failed to setup health bar`, error);
  }
}

  protected updateHealthBar(): void {
  if (this.healthBarFill && this.healthBarPlane?.isVisible) {
    const hpRatio = Math.max(0, this.currentHP / this.maxHP);
    this.healthBarFill.width = `${hpRatio * 100}%`;
    // console.log(`Enemy ${this.id}: Health bar updated, HP: ${this.currentHP}/${this.maxHP}, fill width: ${this.healthBarFill.width}`);
  }
}

  protected disposeHealthBar(): void {
    if (this.healthBarObserver) {
      this.scene.onBeforeRenderObservable.remove(this.healthBarObserver);
      this.healthBarObserver = null;
    }
    if (this.healthBarTexture) {
      this.healthBarTexture.dispose();
      this.healthBarTexture = null;
    }
    if (this.healthBarPlane) {
      this.healthBarPlane.dispose();
      this.healthBarPlane = null;
    }
    this.healthBarFill = null;
    this.healthBarBackground = null;
    // // // console.log(`Enemy ${this.id}: Health bar disposed`);
  }

  public async loadCharacter(): Promise<void> {
    try {
      const enemyAssetContainer = this.assetManager.getAssetContainer(this.config.model);
      if (!enemyAssetContainer) {
        console.error(`Failed to load the ${this.config.model} asset container for Enemy ${this.id}`);
        return;
      }

      const clones = this.duplicate(enemyAssetContainer, this.position);
      this.enemyMesh = clones.rootNodes[0] as Mesh;
      this.enemySkeleton = clones.skeletons[0];
      const animationGroups = clones.animationGroups || [];

      this.enemyMesh.position = this.position;
      this.enemyMesh.checkCollisions = true;
      this.enemyMesh.isPickable = false;

      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        const mat = mesh.material as PBRMaterial;
        mesh.checkCollisions = true;
        mesh.isPickable = false;
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


      const { height, width, yPosition } = this.config.hitbox;

      this.hitboxMesh = MeshBuilder.CreateBox(`hitbox_${this.id}`, {
        height: height, width: width,
      }, this.scene);
      this.hitboxMesh.parent = this.enemyMesh;
      this.hitboxMesh.position = new Vector3(0, yPosition, 0);
      this.hitboxMesh.checkCollisions = false;
      this.hitboxMesh.isPickable = true;
      this.hitboxMesh.isVisible = false;

      const hitboxMaterial = new StandardMaterial(`hitboxMat_${this.id}`, this.scene);
      hitboxMaterial.alpha = 0;
      this.hitboxMesh.material = hitboxMaterial;

      Tags.EnableFor(this.hitboxMesh);
      Tags.AddTagsTo(this.hitboxMesh, `enemyID:${this.id} hitbox`);
      // // // console.log(`Hitbox: ${this.hitboxMesh.name}, isVisible: ${this.hitboxMesh.isVisible}, isPickable: ${this.hitboxMesh.isPickable}, tags: ${Tags.GetTags(this.hitboxMesh)}`);

      this.hitboxMesh.receiveShadows = false;
      this.shadowGenerator.removeShadowCaster(this.hitboxMesh);

      this.setupPhysics();
      this.animationManager.initialize(animationGroups);

      this.setupHealthBar(this.isNPC);

      const hoverable: Hoverable = {
        getMesh: () => this.enemyMesh,
        getScene: () => this.scene,
      };
      this.hoverHandler.setupHover(hoverable);

      // // // console.log(`Enemy ${this.id}: Character loaded successfully`);
    } catch (error) {
      console.error(`Failed to load character for Enemy ${this.id}`, error);
    }
  }

  protected setupPhysics(): void {
    if (!this.enemyMesh) {
      console.error(`Cannot setup physics: Enemy mesh is null for Enemy ${this.id}`);
      return;
    }

    console.log("Setting up Physics");
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


    console.log(`Enemy ${this.id}: Setting up physics with config`, JSON.stringify(this.config.physics, null, 2));

    try {
        // Convert pointA and pointB to Vector3
        const physicsConfig: PhysicsConfig = {
            ...this.config.physics,
            colliderParams: {
                ...this.config.physics.colliderParams,
                pointA: new Vector3(
                    this.config.physics.colliderParams.pointA?.x ?? 0,
                    this.config.physics.colliderParams.pointA?.y ?? 0,
                    this.config.physics.colliderParams.pointA?.z ?? 0
                ),
                pointB: new Vector3(
                    this.config.physics.colliderParams.pointB?.x ?? 0,
                    this.config.physics.colliderParams.pointB?.y ?? 0,
                    this.config.physics.colliderParams.pointB?.z ?? 0
                ),
            },
        };

        this.physicsController = new EnemyPhysicsController(this.scene, this.enemyMesh, physicsConfig, this.game, this);
        if (!this.physicsController) {
            console.error(`Enemy ${this.id}: Failed to create physicsController`);
            return;
        }
        this.physicsController.setInertia(new Vector3(0, 1, 0));
        this.physicsController.orientToForwardDirection(Vector3.Left());
        console.log(`Enemy ${this.id}: PhysicsController initialized`);
    } catch (error) {
        console.error(`Enemy ${this.id}: Error setting up physics`, error);
    }
    // // // console.log(`Enemy ${this.id}: PhysicsController initialized, instance: ${this.physicsController}`);
  }

  protected duplicate(container: AssetContainer, position: Vector3) {
    const entries = container.instantiateModelsToScene(undefined, false, { doNotInstantiate: false });

    const rootMesh = entries.rootNodes[0] as Mesh;
    this.enemyMesh = rootMesh;
    this.enemyMesh.isPickable = false;
    this.enemySkeleton = entries.skeletons[0];
    rootMesh.setEnabled(true);
    rootMesh.position = position;

    entries.rootNodes[0].getChildMeshes().forEach((mesh: AbstractMesh) => {
      mesh.setEnabled(true);
      mesh.isPickable = false;
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

        
      } else {
        if (this.targetCircle) {
          if (this.targetCircle.metadata?.observer) {
            this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
          }
          this.targetCircle.dispose();
          this.targetCircle = null;
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
    return this.hitboxMesh;
  }

   public getHitbox(): Mesh | null {
    return this.hitboxMesh;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getPosition() {
    return this.position;
  }

  public getCurrentHP(): number {
    return this.currentHP;
  }

  public getMaxHP(): number {
    return this.maxHP;
  }

  public takeDamage(damage: number): void {
    if (this.isNPC) {
      // // // console.log(`Enemy ${this.id}: Ignoring damage, already an NPC`);
      return;
    }
    this.currentHP = Math.max(0, this.currentHP - damage);
    // // // console.log(`Enemy ${this.id}: Took ${damage} damage, current HP: ${this.currentHP}/${this.maxHP}`);
    this.updateHealthBar();
    if (this.isDead() && !this.isTransformed) {
      this.swapToNPCModel();
      // // // console.log(`Enemy ${this.id}: HP reached 0, transforming to NPC`);
    }
  }

  public isDead(): boolean {
    return this.currentHP <= 0;
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
    this.disposeHealthBar();
    if (this.enemyMesh) {
      this.enemyMesh.dispose();
      this.enemyMesh = null;
    }
    this.animationManager.dispose();
    this.attackSystem.dispose();
    this.enemySkeleton = null;
    // // // console.log(`Enemy ${this.id}: Disposed`);
  }

  public moveTo(position: Vector3): void {
    if (this.physicsController) {
      this.physicsController.moveTo(position);
    }
  }

  public startWandering(maxDistance = 2): void {
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
            console.log(`Enemy ${this.id}: Already transformed to NPC, skipping swap`);
            return;
        }

        if (!this.assetManager) {
            console.error(`Enemy ${this.id}: Cannot swap model: AssetManager is undefined`);
            return;
        }

        try {
            console.log(`Enemy ${this.id}: Starting transformation to NPC, isTransformed: ${this.isTransformed}`);
            const currentPosition = this.enemyMesh ? this.enemyMesh.position.clone() : this.position;
            this.onDeath.notifyObservers({ id: this.id, position: currentPosition });
            const wasWandering = this.isAggroed ? false : true;

            if (this.behaviorObserver) {
                this.scene.onBeforeRenderObservable.remove(this.behaviorObserver);
                this.behaviorObserver = null;
                console.log(`Enemy ${this.id}: Removed behavior observer`);
            }

            if (this.physicsController) {
                this.physicsController.stopAllMovement();
                this.physicsController.dispose();
                this.physicsController = null;
                console.log(`Enemy ${this.id}: PhysicsController stopped and disposed`);
            }

            if (this.targetCircle) {
                if (this.targetCircle.metadata?.observer) {
                    this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
                }
                this.targetCircle.dispose();
                this.targetCircle = null;
                console.log(`Enemy ${this.id}: Disposed target circle`);
            }

            if (this.hitboxMesh) {
                console.log(`Enemy ${this.id}: Disposing enemy hitbox ${this.hitboxMesh.name}`);
                this.hitboxMesh.dispose();
                this.hitboxMesh = null;
            }

            this.disposeHealthBar();
            console.log(`Enemy ${this.id}: Disposed health bar`);

            if (this.enemyMesh) {
                this.enemyMesh.dispose();
                this.enemyMesh = null;
                console.log(`Enemy ${this.id}: Disposed enemy mesh`);
            }

            this.animationManager.dispose();
            this.onDeath.clear();
            this.enemySkeleton = null;
            console.log(`Enemy ${this.id}: Disposed animation manager and skeleton`);

            const npcAssetContainer = this.assetManager.getAssetContainer(this.config.npcTransformation.model);
            if (!npcAssetContainer) {
                console.error(`Enemy ${this.id}: Failed to load npc asset container`);
                this.position = currentPosition;
                return;
            }

            const clones = this.duplicate(npcAssetContainer, currentPosition);
            this.enemyMesh = clones.rootNodes[0] as Mesh;
            this.enemySkeleton = clones.skeletons[0];
            const animationGroups = clones.animationGroups || [];
            console.log(`Enemy ${this.id}: Loaded plushUnicorn model`);

            this.enemyMesh.position = currentPosition;
            this.enemyMesh.checkCollisions = true;
            this.enemyMesh.isPickable = false;
            this.enemyMesh.scaling = new Vector3(
                this.config.npcTransformation.scaling.x,
                this.config.npcTransformation.scaling.y,
                this.config.npcTransformation.scaling.z
            );

            this.enemyMesh.getChildMeshes().forEach((mesh) => {
                mesh.checkCollisions = true;
                mesh.isPickable = false;
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
            console.log(`Enemy ${this.id}: Set up tags for unicorn mesh`);

            this.hitboxMesh = MeshBuilder.CreateBox(`hitbox_${this.id}`, {
                height: this.config.npcTransformation.hitbox.height,
                width: this.config.npcTransformation.hitbox.width,
            }, this.scene);
            this.hitboxMesh.parent = this.enemyMesh;
            this.hitboxMesh.position = new Vector3(0, this.config.npcTransformation.hitbox.height / 2, 0);
            this.hitboxMesh.checkCollisions = false;
            this.hitboxMesh.isPickable = true;
            this.hitboxMesh.isVisible = false;

            const hitboxMaterial = new StandardMaterial(`hitboxMat_${this.id}`, this.scene);
            hitboxMaterial.alpha = 0;
            this.hitboxMesh.material = hitboxMaterial;

            Tags.EnableFor(this.hitboxMesh);
            Tags.AddTagsTo(this.hitboxMesh, `enemyID:${this.id} hitbox`);
            console.log(`Enemy ${this.id}: NPC hitbox created, height: ${this.config.npcTransformation.hitbox.height}, width: ${this.config.npcTransformation.hitbox.width}`);

            this.shadowGenerator.removeShadowCaster(this.hitboxMesh);

            this.setupPhysics();
            this.animationManager.initialize(animationGroups);
            console.log(`Enemy ${this.id}: Initialized physics and animations`);

            this.setupHealthBar(true);
            console.log(`Enemy ${this.id}: Set up hidden health bar`);

            const hoverable: Hoverable = {
                getMesh: () => this.hitboxMesh,
                getScene: () => this.scene,
            };
            this.hoverHandler.setupHover(hoverable);
            console.log(`Enemy ${this.id}: Set up hover handler`);

            if (this.isTargetted) {
                this.setTargetted(true);
                console.log(`Enemy ${this.id}: Reapplied targeting`);
            }

            this.isNPC = true;
            this.isAggroed = false;
            this.isAttacking = false;
            this.isTransformed = true;
            console.log(`Enemy ${this.id}: Set NPC state`);

            this.physicsController!.stopAllMovement();
            this.animationManager.playAnimation(this.config.animations.idle, 1.0, undefined, undefined, true);
            console.log(`Enemy ${this.id}: Set to Idle as NPC`);

            if (wasWandering) {
                this.physicsController!.startWandering();
                this.animationManager.playAnimation(this.config.animations.run, 1.0, undefined, undefined, true);
                console.log(`Enemy ${this.id}: Resumed wandering as NPC`);
            }

            if (this.game?.gameManager) {
                this.game.gameManager.scheduleEnemyRespawn(this.id, currentPosition);
                console.log(`Enemy ${this.id}: Scheduled respawn in 60 seconds at position`, currentPosition);
            } else {
                console.error(`Enemy ${this.id}: Cannot schedule respawn, game or gameManager is undefined`);
            }

            console.log(`Enemy ${this.id}: Completed transformation to plushUnicorn at position`, currentPosition);
        } catch (error) {
            console.error(`Enemy ${this.id}: Failed to swap model to NPC`, error);
        }
    }


public getType(): string {
    return this.type;
}

protected hasLineOfSightToPlayer(playerMesh: Mesh): boolean {
  if (!this.enemyMesh || !playerMesh) {
    console.warn(`Enemy ${this.id}: LOS check failed - enemyMesh or playerMesh is null`);
    return false;
  }

  const currentTime = performance.now();
  if (currentTime - this.lastLOSCheckTime < this.losCheckInterval) {
    return this.lastHasLOS ?? false; // Use cached result
  }

  this.lastLOSCheckTime = currentTime;

  const enemyPos = this.enemyMesh.position.clone().add(new Vector3(0, 1.5, 0));
  const playerPos = playerMesh.position.clone().add(new Vector3(0, 1.5, 0));
  const direction = playerPos.subtract(enemyPos);
  const distance = direction.length();
  const ray = new Ray(enemyPos, direction.normalize(), distance);


  /*
  const rayHelper = new RayHelper(ray);
  rayHelper.show(this.scene, new Color3(1, 0, 0));  

  
  setTimeout(() => {
    rayHelper.hide();
    rayHelper.dispose();
  }, 500);
  */

  // Perform raycast, only hitting meshes tagged as "obstacle"
  let checkedMeshCount = 0;
  const hit = this.scene.pickWithRay(ray, (mesh) => {
    const isObstacle = Tags.MatchesQuery(mesh, "obstacle");
    checkedMeshCount++;
    // // // // console.log(`Enemy ${this.id}: Raycast checked mesh ${mesh.name}, isObstacle: ${isObstacle}`);
    return isObstacle;
  });

  const hasLOS = !hit || !hit.hit;
  this.lastHasLOS = hasLOS; // Cache result
  // // // // console.log(`Enemy ${this.id}: LOS check - distance: ${distance.toFixed(2)}, hasLOS: ${hasLOS}, hit mesh: ${hit?.pickedMesh?.name || "none"}, checked meshes: ${checkedMeshCount}`);
  return hasLOS;
}


public isCastingAttack(): boolean {
    return this.config.attacks.some(attack => this.animationManager.getAnimationByName(attack.animation)?.isPlaying || false);
  }
}