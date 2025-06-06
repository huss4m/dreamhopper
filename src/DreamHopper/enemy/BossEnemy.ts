import { Scene, Vector3, HighlightLayer, CascadedShadowGenerator, Mesh, AbstractMesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle } from "@babylonjs/gui";
import { AssetManager } from "../AssetManager";
import { TargetingSystem } from "../TargetingSystem";
import { Game } from "../Game";
import { Enemy } from "./Enemy";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial, Tags } from "@babylonjs/core";
import { EnemyPhysicsController, PhysicsConfig } from "./EnemyPhysicsController";
import { ColliderType } from "../PhysicsController";
import { BossEnemyAnimationManager } from "./BossEnemyAnimationManager";

export class BossEnemy extends Enemy {
  constructor(
    scene: Scene,
    name: string,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator,
    position: Vector3,
    highlightLayer: HighlightLayer,
    targetingSystem: TargetingSystem,
    game: Game
  ) {
    super(scene, name, assetManager, shadowGenerator, position, highlightLayer, targetingSystem, game);
   
    this.attackRange = 15;
    this.aggroRadius = 25;
    this.maxHP = 250;
    this.currentHP = 250;
  

  }


  
  public async loadCharacter(name: string): Promise<void> {
    try {
      const enemyAssetContainer = this.assetManager.getAssetContainer(name);
      if (!enemyAssetContainer) {
        console.error(`BossEnemy ${this.getId()}: Failed to load asset container ${name}`);
        return;
      }
      const clones = this.duplicate(enemyAssetContainer, this.position);
      this.enemyMesh = clones.rootNodes[0] as Mesh;
      this.enemySkeleton = clones.skeletons[0];
      const animationGroups = clones.animationGroups || [];
      console.log(`BossEnemy: Loaded ${animationGroups.length} animation groups: ${animationGroups.map(ag => ag.name).join(", ")}`);

      this.enemyMesh.position = this.position;
      this.enemyMesh.checkCollisions = true;
      this.enemyMesh.isPickable = true;
      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        mesh.checkCollisions = true;
        mesh.isPickable = true;
      });

      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(this.enemyMesh!);
        this.enemyMesh!.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
      }

      Tags.EnableFor(this.enemyMesh);
      Tags.AddTagsTo(this.enemyMesh, `enemyID:${this.getId()}`);
      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        Tags.EnableFor(mesh);
        Tags.AddTagsTo(mesh, `enemyID:${this.getId()}`);
      });

      this.hitboxMesh = MeshBuilder.CreateBox(`hitbox_${this.getId()}`, {
        height: 4,
        width: 2,
      }, this.scene);
      this.hitboxMesh.parent = this.enemyMesh;
      this.hitboxMesh.position = new Vector3(0, 3, 0);
      this.hitboxMesh.checkCollisions = false;
      this.hitboxMesh.isPickable = true;
      this.hitboxMesh.isVisible = false;
      const hitboxMaterial = new StandardMaterial(`hitboxMat_${this.getId()}`, this.scene);
      hitboxMaterial.alpha = 0;
      this.hitboxMesh.material = hitboxMaterial;
      Tags.EnableFor(this.hitboxMesh);
      Tags.AddTagsTo(this.hitboxMesh, `enemyID:${this.getId()} hitbox`);
      this.shadowGenerator.removeShadowCaster(this.hitboxMesh);

      this.setupPhysics();
      console.log(`BossEnemy ${this.getId()}: Initializing animation manager`);
      //console.log('AnimationManager instance of Boss ?', this.animationManager instanceof BossEnemyAnimationManager);
       this.animationManager = new BossEnemyAnimationManager(this.scene, this.game, this);
      this.animationManager.initialize(animationGroups);
      this.setupHealthBar(this.isNPC);

      const hoverable = {
        getMesh: () => this.enemyMesh,
        getScene: () => this.scene,
        getHighlightMesh: () => this.enemyMesh,
      };
      this.hoverHandler.setupHover(hoverable);
      console.log(`BossEnemy ${this.getId()}: Loaded with 2x hitbox at position`, this.position);
    } catch (error) {
      console.error(`BossEnemy ${this.getId()}: Failed to load character`, error);
    }


  }

  protected setupPhysics(): void {
    if (!this.enemyMesh) {
      console.error(`Cannot setup physics: Enemy mesh is null for BossEnemy ${this.getId()}`);
      return;
    }
    const physicsConfig: PhysicsConfig = {
      colliderType: ColliderType.Capsule,
      colliderParams: {
        auto: false,
        pointA: new Vector3(0, 0.4, 0), // 2x original
        pointB: new Vector3(0, 3.5, 0), // 2x original
        radius: 0.4, // 2x original
      },
      physicsProps: {
        mass: 150, // 2x original (75)
        friction: 1,
        restitution: 0,
      },
    };
    this.physicsController = new EnemyPhysicsController(this.scene, this.enemyMesh, physicsConfig, this.game, this);
    this.physicsController.setInertia(new Vector3(0, 1, 0));
    this.physicsController.orientToForwardDirection(Vector3.Left());
    console.log(`BossEnemy ${this.getId()}: Physics setup with 2x capsule collider`);
  }


  protected setupHealthBar(isNPC = false): void {
    if (isNPC) {
      // console.log(`BossEnemy ${this.getId()}: Skipping health bar setup for NPC`);
      return;
    }
    if (!this.getEnemyMesh() || !this.hitboxMesh) {
      console.error(`BossEnemy ${this.getId()}: Cannot setup health bar, enemy mesh or hitbox is null`);
      return;
    }
    try {
      const hitboxHeight = 2.0;
      const yOffset = 0.2;
      this.hitboxMesh.computeWorldMatrix(true);
      const hitboxTopY = this.hitboxMesh.absolutePosition.y + (hitboxHeight / 2);
      this.healthBarPlane = MeshBuilder.CreatePlane(`healthBar_${this.getId()}`, {
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
      this.healthBarPlane.isVisible = true;
      this.healthBarPlane.renderingGroupId = 0;
      this.healthBarPlane.alwaysSelectAsActiveMesh = false;
      this.healthBarTexture = AdvancedDynamicTexture.CreateForMesh(this.healthBarPlane, 768, 96, true);
      // console.log(`BossEnemy ${this.getId()}: Health bar texture created, resolution: 768x96`);
      this.healthBarBackground = new Rectangle(`healthBarBg_${this.getId()}`);
      this.healthBarBackground.width = "100%";
      this.healthBarBackground.height = "100%";
      this.healthBarBackground.thickness = 1;
      this.healthBarBackground.color = "rgba(255, 255, 255, 0.4)";
      this.healthBarBackground.background = "rgba(200, 160, 255, 0.2)";
      this.healthBarBackground.cornerRadius = 150;
      this.healthBarTexture.addControl(this.healthBarBackground);
      this.healthBarFill = new Rectangle(`healthBarFill_${this.getId()}`);
      this.healthBarFill.width = `${(this.getCurrentHP() / this.getMaxHP()) * 100}%`;
      this.healthBarFill.height = "90%";
      this.healthBarFill.horizontalAlignment = Rectangle.HORIZONTAL_ALIGNMENT_LEFT;
      this.healthBarFill.background = "rgba(128, 0, 128, 0.95)"; // Purple fill
      this.healthBarFill.thickness = 0;
      this.healthBarFill.cornerRadius = 90;
      this.healthBarTexture.addControl(this.healthBarFill);
      let floatPhase = 0;
      this.healthBarObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (this.healthBarPlane && this.hitboxMesh && !this.hitboxMesh.isDisposed()) {
          this.hitboxMesh.computeWorldMatrix(true);
          const hitboxTopY = this.hitboxMesh.absolutePosition.y + (hitboxHeight / 2);
          floatPhase += this.scene.getEngine().getDeltaTime() * 0.002;
          const floatY = Math.sin(floatPhase) * 0.05;
          this.healthBarPlane.position = new Vector3(
            this.hitboxMesh.absolutePosition.x,
            hitboxTopY + yOffset + floatY,
            this.hitboxMesh.absolutePosition.z
          );
        }
      });
      this.updateHealthBar();
      // console.log(`BossEnemy ${this.getId()}: Purple health bar setup complete`);
    } catch (error) {
      console.error(`BossEnemy ${this.getId()}: Failed to setup purple health bar`, error);
    }
  }

  public async swapToNPCModel(): Promise<void> {
    if (this.isTransformed) {
      // console.log(`BossEnemy ${this.getId()}: Already transformed to NPC, skipping swap`);
      return;
    }
    try {
      // console.log(`BossEnemy ${this.getId()}: Starting transformation to NPC, isTransformed: ${this.isTransformed}`);
      const currentPosition = this.getEnemyMesh() ? this.getEnemyMesh()!.position.clone() : this.getPosition();
      // console.log(`BossEnemy ${this.getId()}: Current position for respawn`, currentPosition);
      this.onDeath.notifyObservers({ id: this.getId(), position: currentPosition });
      const wasWandering = this.isAggroed ? false : true;
      if (this.behaviorObserver) {
        this.scene.onBeforeRenderObservable.remove(this.behaviorObserver);
        this.behaviorObserver = null;
        // console.log(`BossEnemy ${this.getId()}: Removed behavior observer`);
      }
      if (this.getPhysics()) {
        this.getPhysics()!.stopAllMovement();
        this.getPhysics()!.dispose();
        this.physicsController = null;
        // console.log(`BossEnemy ${this.getId()}: PhysicsController stopped and disposed`);
      }
      if (this.targetCircle) {
        if (this.targetCircle.metadata?.observer) {
          this.scene.onBeforeRenderObservable.remove(this.targetCircle.metadata.observer);
        }
        this.targetCircle.dispose();
        this.targetCircle = null;
        // console.log(`BossEnemy ${this.getId()}: Disposed target circle`);
      }
      if (this.hitboxMesh) {
        // console.log(`BossEnemy ${this.getId()}: Disposing enemy hitbox ${this.hitboxMesh.name}`);
        this.hitboxMesh.dispose();
        this.hitboxMesh = null;
      }
      this.disposeHealthBar();
      // console.log(`BossEnemy ${this.getId()}: Disposed health bar`);
      const enemyMesh = this.getEnemyMesh();
      if (enemyMesh && this.highlightLayer && !enemyMesh.isDisposed()) {
        this.highlightLayer.removeMesh(enemyMesh);
        enemyMesh.getChildMeshes().forEach((mesh) => {
          if (!mesh.isDisposed() && mesh instanceof Mesh) {
            this.highlightLayer.removeMesh(mesh);
          }
        });
        // console.log(`BossEnemy ${this.getId()}: Removed highlight layer from mesh`);
      }
      if (enemyMesh) {
        enemyMesh.dispose();
        this.enemyMesh = null;
        // console.log(`BossEnemy ${this.getId()}: Disposed enemy mesh`);
      }
      this.getAnimationManager().dispose();
      this.onDeath.clear();
      this.enemySkeleton = null;
      // console.log(`BossEnemy ${this.getId()}: Disposed animation manager and skeleton`);
      const npcAssetContainer = this.assetManager.getAssetContainer("plushUnicorn");
      if (!npcAssetContainer) {
        console.error(`BossEnemy ${this.getId()}: Failed to load npc asset container`);
        this.position = currentPosition;
        return;
      }
      const clones = this.duplicate(npcAssetContainer, currentPosition);
      this.enemyMesh = clones.rootNodes[0] as Mesh;
      this.enemySkeleton = clones.skeletons[0];
      const animationGroups = clones.animationGroups || [];
      // console.log(`BossEnemy ${this.getId()}: Loaded plushUnicorn model`);
      this.enemyMesh.position = currentPosition;
      this.enemyMesh.checkCollisions = true;
      this.enemyMesh.isPickable = false;
      this.enemyMesh.scaling = new Vector3(3, 3, 3);
      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        mesh.checkCollisions = true;
        mesh.isPickable = false;
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(mesh);
        }
      });
      Tags.EnableFor(this.enemyMesh);
      Tags.AddTagsTo(this.enemyMesh, `enemyID:${this.getId()}`);
      this.enemyMesh.getChildMeshes().forEach((mesh) => {
        Tags.EnableFor(mesh);
        Tags.AddTagsTo(mesh, `enemyID:${this.getId()}`);
      });
      // console.log(`BossEnemy ${this.getId()}: Set up tags for unicorn mesh`);
      this.hitboxMesh = MeshBuilder.CreateBox(`hitbox_${this.getId()}`, {
        height: 0.4,
        width: 0.3,
      }, this.scene);
      this.hitboxMesh.parent = this.enemyMesh;
      this.hitboxMesh.position = new Vector3(0, 0.2, 0);
      this.hitboxMesh.checkCollisions = false;
      this.hitboxMesh.isPickable = true;
      this.hitboxMesh.isVisible = false;
      const hitboxMaterial = new StandardMaterial(`hitboxMat_${this.getId()}`, this.scene);
      hitboxMaterial.alpha = 0;
      this.hitboxMesh.material = hitboxMaterial;
      Tags.EnableFor(this.hitboxMesh);
      Tags.AddTagsTo(this.hitboxMesh, `enemyID:${this.getId()} hitbox`);
      // console.log(`BossEnemy ${this.getId()}: Unicorn hitbox created, height: 0.4, width: 0.3`);
      this.shadowGenerator.removeShadowCaster(this.hitboxMesh);
      this.setupPhysics();
      this.getAnimationManager().initialize(animationGroups);
      // console.log(`BossEnemy ${this.getId()}: Initialized physics and animations`);
      this.setupHealthBar(true);
      // console.log(`BossEnemy ${this.getId()}: Set up hidden health bar`);
      const hoverable = {
        getMesh: () => this.hitboxMesh,
        getScene: () => this.scene,
        getHighlightMesh: () => this.enemyMesh,
      };
      this.hoverHandler.setupHover(hoverable);
      // console.log(`BossEnemy ${this.getId()}: Set up hover handler`);
      if (this.isTargetted) {
        if (!this.highlightLayer) {
          console.error(`BossEnemy ${this.getId()}: HighlightLayer is undefined for targeting`);
          this.isTargetted = false;
        } else {
          this.setTargetted(true);
          // console.log(`BossEnemy ${this.getId()}: Reapplied targeting`);
        }
      }
      this.isNPC = true;
      this.isAggroed = false;
      this.isAttacking = false;
      this.isTransformed = true;
      // console.log(`BossEnemy ${this.getId()}: Set NPC state`);
      this.getPhysics()!.stopAllMovement();
      this.getAnimationManager().playAnimation("Idle", 1.0, undefined, undefined, true);
      // console.log(`BossEnemy ${this.getId()}: Set to Idle as NPC`);
      if (wasWandering) {
        this.getPhysics()!.startWandering();
        this.getAnimationManager().playAnimation("Run", 0.5, undefined, undefined, true);
        // console.log(`BossEnemy ${this.getId()}: Resumed wandering as NPC`);
      }
      if (this.game?.gameManager) {
        this.game.gameManager.scheduleBossRespawn(this.getId(), currentPosition);
        // console.log(`BossEnemy ${this.getId()}: Scheduled boss respawn in 60 seconds at position`, currentPosition);
      } else {
        console.error(`BossEnemy ${this.getId()}: Cannot schedule respawn, game or gameManager is undefined`);
      }
      // console.log(`BossEnemy ${this.getId()}: Completed transformation to plushUnicorn at position`, currentPosition);
    } catch (error) {
      console.error(`BossEnemy ${this.getId()}: Failed to swap model to NPC`, error);
    }
  }


  protected setupBehavior(): void {
    if (this.isNPC) {
      console.log(`BossEnemy ${this.getId()}: Skipping behavior setup, is NPC`);
      return;
    }


    console.log(`BossEnemy ${this.getId()}: Setting up behavior observer`);
    this.behaviorObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.enemyMesh || !this.physicsController) {
        console.warn(`BossEnemy ${this.getId()}: Behavior skipped - enemyMesh or physicsController null`);
        return;
      }

      const playerMesh = this.game.getCharacterController()?.characterMeshLoader.getCharacterMesh();
      if (!playerMesh) {
        console.warn(`BossEnemy ${this.getId()}: Player mesh not found`);
        return;
      }

      const distanceToPlayer = Vector3.Distance(this.enemyMesh.position, playerMesh.position);
      console.log(`BossEnemy ${this.getId()}: Distance to player: ${distanceToPlayer.toFixed(2)}, aggroRadius: ${this.aggroRadius}, attackRange: ${this.attackRange}`);

      if (distanceToPlayer > this.aggroRadius * 2) {
        if (this.isAggroed || this.isAttacking) {
          this.isAggroed = false;
          this.isAttacking = false;
          this.physicsController.stopAllMovement();
          this.startWandering();
          console.log(`BossEnemy ${this.getId()}: Beyond culling distance (${distanceToPlayer.toFixed(2)} > ${this.aggroRadius * 2}), lost aggro`);
        }
        return;
      }

      if (this.isDead() || this.game.getCharacterController()?.getPlayer()?.isPlayerDead()) {
        if (this.isAggroed || this.isAttacking) {
          this.isAggroed = false;
          this.isAttacking = false;
          this.physicsController.stopAllMovement();
          this.animationManager.playAnimation("Idle", 1.0, undefined, undefined, true);
          console.log(`BossEnemy ${this.getId()}: Player or boss dead, stopping attack`);
        }
        return;
      }

      if (distanceToPlayer <= this.aggroRadius && !this.isAggroed) {
        this.isAggroed = true;
        this.isAttacking = false;
        this.physicsController.stopAllMovement();
        console.log(`BossEnemy ${this.getId()}: Aggroed on player at distance ${distanceToPlayer.toFixed(2)}`);
      } else if (distanceToPlayer > this.aggroRadius && this.isAggroed) {
        this.isAggroed = false;
        this.isAttacking = false;
        this.physicsController.stopAllMovement();
        this.startWandering();
        console.log(`BossEnemy ${this.getId()}: Lost aggro at distance ${distanceToPlayer.toFixed(2)}`);
      }

      if (this.isAggroed) {
        const hasLOS = this.hasLineOfSightToPlayer(playerMesh);
        console.log(`BossEnemy ${this.getId()}: Has LOS: ${hasLOS}, Distance: ${distanceToPlayer.toFixed(2)}, Attack range check: ${distanceToPlayer <= this.attackRange}, isAttacking: ${this.isAttacking}`);

        if (distanceToPlayer <= this.attackRange && hasLOS) {
          this.physicsController.stopAllMovement();
          const directionToPlayer = playerMesh.position.subtract(this.enemyMesh.position);
          this.physicsController.orientToForwardDirection(directionToPlayer);
          const hasNightmareBolt = !!this.animationManager.getAnimationByName("NightmareBolt");
          const animationName = hasNightmareBolt ? "NightmareBolt" : "Idle";
          console.log(`BossEnemy ${this.getId()}: In attack range with LOS, hasNightmareBolt: ${hasNightmareBolt}, playing: ${animationName}, isAttacking: ${this.isAttacking}`);
          if (!this.isAttacking || animationName === "NightmareBolt") {
            this.isAttacking = true;
            this.animationManager.playAnimation(animationName, 1.0, undefined, undefined, true);
          }
        } else {
          if (this.isAttacking) {
            this.isAttacking = false;
            this.physicsController.stopAllMovement();
            console.log(`BossEnemy ${this.getId()}: Stopped attacking, out of range or no LOS`);
          }
          this.moveTo(playerMesh.position);
          this.animationManager.playAnimation("Run", 0.5);
          console.log(`BossEnemy ${this.getId()}: Moving to player at distance ${distanceToPlayer.toFixed(2)}`);
        }
      } else {
        console.log(`BossEnemy ${this.getId()}: Not aggroed, checking velocity for animation`);
        const agentVelocity = this.game.getCrowd()?.getAgentVelocity(this.physicsController.getAgentIndex());
        if (agentVelocity && agentVelocity.lengthSquared() > 0.01) {
          this.animationManager.playAnimation("Run", 0.5);
        } else {
          this.animationManager.playAnimation("Idle", 1.0, undefined, undefined, true);
        }
      }
    });
  }


}