import { AnimationGroup, Scene, Mesh, StandardMaterial, Color3, Vector3, MeshBuilder, ParticleSystem, Texture, Color4, Observable, Tags } from "@babylonjs/core";
import { Game } from "../Game";
import { Enemy } from "./Enemy";

export class EnemyAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isBlending = false;
  private blendFrameId: number | null = null;
  private nightmareBoltSpawned = false;
  private lastProgress = 0;
  private loopCount = 0;
  private lastBoltTime = 0; 
  public onNightmareBoltAnimationState = new Observable<{ isRunning: boolean; progress?: number }>();

  constructor(
    private scene: Scene,
    private game?: Game,
    private enemy?: Enemy
  ) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    // console.log(`Initializing EnemyAnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    const idleAnim = this.getAnimationByName("Idle");
    if (idleAnim) {
      idleAnim.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("Idle animation not found for Enemy");
    }

    this.setupNightmareBoltDetection();
  }

  private setupNightmareBoltDetection(): void {
    const nightmareBoltAnim = this.getAnimationByName("NightmareBolt");
    if (nightmareBoltAnim) {
      // console.log("EnemyAnimationManager: NightmareBolt animation found, monitoring for 50% progress");
      nightmareBoltAnim.onAnimationGroupEndObservable.add(() => {
        this.onNightmareBoltAnimationState.notifyObservers({ isRunning: false });
        // console.log(`EnemyAnimationManager: NightmareBolt animation ended, loopCount=${this.loopCount}`);
      });
    } else {
      console.warn("EnemyAnimationManager: NightmareBolt animation not found");
    }
  }

  private spawnNightmareBoltSphere(): void {
    if (Date.now() - this.lastBoltTime < 2000) {
      // console.log("EnemyAnimationManager: NightmareBolt on cooldown");
      return;
    }
    this.lastBoltTime = Date.now();

    if (!this.enemy || !this.enemy.getEnemyMesh()) {
      console.error("EnemyAnimationManager: Enemy or enemy mesh not initialized");
      return;
    }

    const enemyMesh = this.enemy.getEnemyMesh()!;
    const playerMesh = this.game?.getCharacterController()?.characterMeshLoader.getCharacterMesh();
    if (!playerMesh) {
      console.error("EnemyAnimationManager: Player mesh not found");
      return;
    }

    if (!this.enemy.getPhysics()) {
      console.error("EnemyAnimationManager: Enemy PhysicsController not found");
      return;
    }

    // Find player hitbox
    const hitboxMesh = playerMesh.getChildMeshes().find(mesh => mesh.name === "player_hitbox" || Tags.MatchesQuery(mesh, "player hitbox")) as Mesh;
    if (!hitboxMesh) {
      console.error("EnemyAnimationManager: Player hitbox mesh not found");
      return;
    }
    // console.log(`EnemyAnimationManager: Found player hitbox: ${hitboxMesh.name}, position: ${hitboxMesh.getAbsolutePosition().toString()}`);

    // console.log(`EnemyAnimationManager: Spawning NightmareBolt sphere, loopCount=${this.loopCount}`);

    const sphere = MeshBuilder.CreateSphere("nightmareBolt", { diameter: 0.5 }, this.scene);
    const material = new StandardMaterial("nightmareBoltMat", this.scene);
    material.diffuseColor = new Color3(0.5, 0.0, 0.5);
    material.emissiveColor = new Color3(0.3, 0.0, 0.6);
    sphere.material = material;
    sphere.isVisible = true;

    const particles = new ParticleSystem("boltParticles", 500, this.scene);
    particles.particleTexture = new Texture("./Flare.png", this.scene);
    particles.emitter = sphere;
    particles.minEmitBox = Vector3.Zero();
    particles.maxEmitBox = Vector3.Zero();
    particles.color1 = new Color4(0.5, 0.0, 0.5, 1.0);
    particles.color2 = new Color4(0.6, 0.2, 0.7, 0.6);
    particles.colorDead = new Color4(0.2, 0.0, 0.2, 0.0);
    particles.minSize = 0.7;
    particles.maxSize = 1.5;
    particles.minLifeTime = 0.15;
    particles.maxLifeTime = 0.4;
    particles.emitRate = 600;
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;
    particles.gravity = Vector3.Zero();
    particles.direction1 = Vector3.Zero();
    particles.direction2 = Vector3.Zero();
    particles.start();

    const forward = enemyMesh.getDirection(Vector3.Forward()).normalize();
    const spawnOffset = forward.scale(1).add(new Vector3(0, 1.2, 0));
    const startPos = enemyMesh.getAbsolutePosition().add(spawnOffset);
    sphere.position = startPos;
    sphere.checkCollisions = true;

    // console.log(`EnemyAnimationManager: Sphere spawned at position: ${sphere.position.toString()}`);

    // Use hitbox for targeting
    hitboxMesh.computeWorldMatrix(true);
    hitboxMesh.refreshBoundingInfo();
    const boundingBox = hitboxMesh.getBoundingInfo().boundingBox;
    const hitboxCenterY = (boundingBox.minimumWorld.y + boundingBox.maximumWorld.y) / 2;
    const hitboxPos = hitboxMesh.getAbsolutePosition();
    const adjustedPlayerPos = new Vector3(hitboxPos.x, hitboxCenterY, hitboxPos.z);

    // console.log(`EnemyAnimationManager: Player hitbox bounding box: min=${boundingBox.minimumWorld.toString()}, max=${boundingBox.maximumWorld.toString()}, centerY=${hitboxCenterY}`);

    if (hitboxCenterY - boundingBox.minimumWorld.y < 0.5) {
      adjustedPlayerPos.y = hitboxPos.y + 0.875;
      // console.log(`EnemyAnimationManager: Warning: Player hitbox midpoint too low, using fallback y=${adjustedPlayerPos.y}`);
    }

    let moveDirection = adjustedPlayerPos.subtract(sphere.position);
    if (moveDirection.lengthSquared() > 0.0001) {
      moveDirection = moveDirection.normalize();
      // console.log(`EnemyAnimationManager: Moving sphere toward player hitbox at adjusted position: ${adjustedPlayerPos.toString()}`);
    } else {
      moveDirection = forward;
      // console.log("EnemyAnimationManager: Player hitbox at same position as sphere, using forward direction");
    }

    const speed = 20;

    const renderCallback = () => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));

      // console.log(`EnemyAnimationManager: Sphere position: ${sphere.position.toString()}, Hitbox position: ${hitboxMesh.getAbsolutePosition().toString()}`);

      if (sphere.intersectsMesh(hitboxMesh, true)) {
        // console.log("EnemyAnimationManager: NightmareBolt hit player hitbox");
        // console.log("EnemyAnimationManager: Game instance exists:", !!this.game);
        const characterController = this.game?.getCharacterController();
        // console.log("EnemyAnimationManager: CharacterController exists:", !!characterController);
        const player = characterController?.getPlayer();
        // console.log("EnemyAnimationManager: Player instance exists:", !!player);
        if (player) {
          const currentHP = player.getCurrentHP();
          // console.log(`EnemyAnimationManager: Current HP before damage: ${currentHP}`);
          player.setHP(currentHP - 10);
          // console.log(`EnemyAnimationManager: Applied 10 damage to player, new HP: ${player.getCurrentHP()}`);
        } else {
          console.error("EnemyAnimationManager: Player instance not found");
        }


        /*
          // Apply knockback impulse
          const physicsController = characterController!.physicsController;
          if (physicsController && physicsController.getPhysicsAggregate()) {
            const aggregate = physicsController.getPhysicsAggregate()!;
            const knockbackMagnitude = 2000; // Adjust for desired knockback strength
            const knockbackDirection = moveDirection.scale(1); // Use bolt's movement direction
            const impulse = knockbackDirection.scale(knockbackMagnitude);
            const impulsePoint = hitboxMesh.getAbsolutePosition(); // Apply at hitbox center
            aggregate.body.applyImpulse(impulse, impulsePoint);
            console.log(`EnemyAnimationManager: Applied knockback impulse: ${impulse.toString()} at ${impulsePoint.toString()}`);
          }else {
            console.error("EnemyAnimationManager: PhysicsController or PhysicsAggregate not found");
          }*/
        
        particles.stop();
        particles.dispose();



        

// Create a dark purple arcane-style explosion effect
const explosion = new ParticleSystem("nightmareExplosion", 100, this.scene);
explosion.particleTexture = new Texture("./Flare.png", this.scene);
explosion.emitter = sphere.position.clone();
explosion.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
explosion.maxEmitBox = new Vector3(0.2, 0.2, 0.2);
explosion.color1 = new Color4(0.4, 0.0, 0.6, 1.0); // deep violet
explosion.color2 = new Color4(0.6, 0.1, 0.8, 0.8); // brighter purple
explosion.colorDead = new Color4(0.2, 0.0, 0.3, 0.0); // fades to transparent dark
explosion.minSize = 0.4;
explosion.maxSize = 1.2;
explosion.minLifeTime = 0.2;
explosion.maxLifeTime = 0.5;
explosion.emitRate = 1000;
explosion.blendMode = ParticleSystem.BLENDMODE_ADD;
explosion.gravity = Vector3.Zero();
explosion.direction1 = new Vector3(-1, -1, -1);
explosion.direction2 = new Vector3(1, 1, 1);
explosion.minAngularSpeed = 0;
explosion.maxAngularSpeed = Math.PI;
explosion.targetStopDuration = 0.1;
explosion.disposeOnStop = true;
explosion.manualEmitCount = 50; // Quick burst
explosion.start();

        sphere.dispose();
        this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
        return;
      }

      setTimeout(() => {
        if (!sphere.isDisposed()) {
          particles.stop();
          particles.dispose();
          sphere.dispose();
          this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
          // console.log("EnemyAnimationManager: NightmareBolt timed out");
        }
      }, 5000);
    };

    this.scene.onBeforeRenderObservable.add(renderCallback);
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number,
    loop = true
  ): void {
    const newAnim = this.getAnimationByName(name);
    if (!newAnim) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    if (name === this.currentAnimationName && newAnim.isPlaying) {
      return;
    }

    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }

    const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

    if (prevAnim) {
      prevAnim.setWeightForAllAnimatables(0);
      prevAnim.stop();
    }

    newAnim.stop();
    newAnim.start(loop, speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
    newAnim.setWeightForAllAnimatables(0);

    this.currentAnimationName = name;
    this.isBlending = true;

    const blendDuration = 300;
    const startTime = performance.now();

    const blendStep = (now: number) => {
      const t = Math.min((now - startTime) / blendDuration, 1);
      newAnim.setWeightForAllAnimatables(t);
      if (prevAnim) prevAnim.setWeightForAllAnimatables(1 - t);

      if (t < 1) {
        this.blendFrameId = requestAnimationFrame(blendStep);
      } else {
        if (prevAnim) prevAnim.stop();
        newAnim.setWeightForAllAnimatables(1);
        this.isBlending = false;
        this.blendFrameId = null;
      }
    };

    this.blendFrameId = requestAnimationFrame(blendStep);

    if (name === "NightmareBolt") {
      this.lastProgress = 0;
      this.loopCount = 0;
      this.nightmareBoltSpawned = false;
      this.onNightmareBoltAnimationState.notifyObservers({ isRunning: true, progress: 0 });
      // console.log("EnemyAnimationManager: NightmareBolt animation started, loopCount=0, notified observers");
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;
          const from = newAnim.from;
          const to = newAnim.to;
          const progress = (currentFrame - from) / (to - from);
          
          if (progress < this.lastProgress && this.lastProgress > 0.9) {
            this.loopCount++;
            this.nightmareBoltSpawned = false;
            // console.log(`EnemyAnimationManager: Detected NightmareBolt animation loop reset, loopCount=${this.loopCount}, resetting nightmareBoltSpawned`);
          }
          this.lastProgress = progress;

          // console.log(`EnemyAnimationManager: NightmareBolt progress=${progress.toFixed(2)}, frame=${currentFrame}, nightmareBoltSpawned=${this.nightmareBoltSpawned}, loopCount=${this.loopCount}`);

          this.onNightmareBoltAnimationState.notifyObservers({ isRunning: true, progress });
          if (progress >= 0.5 && !this.nightmareBoltSpawned) {
            // console.log(`EnemyAnimationManager: NightmareBolt animation reached 50%, spawning sphere, loopCount=${this.loopCount}`);
            this.spawnNightmareBoltSphere();
            this.nightmareBoltSpawned = true;
            this.onNightmareBoltAnimationState.notifyObservers({ isRunning: true, progress: 0.5 });
          }
        } else {
          // console.log("EnemyAnimationManager: NightmareBolt animation stopped or no animatables, removing observer");
          this.onNightmareBoltAnimationState.notifyObservers({ isRunning: false });
          this.scene.onBeforeRenderObservable.remove(observer);
        }
      });
      newAnim.metadata = newAnim.metadata || {};
      newAnim.metadata.nightmareBoltObserver = observer;
    } else {
      const nightmareBoltAnim = this.getAnimationByName("NightmareBolt");
      if (nightmareBoltAnim?.metadata?.nightmareBoltObserver) {
        this.scene.onBeforeRenderObservable.remove(nightmareBoltAnim.metadata.nightmareBoltObserver);
        nightmareBoltAnim.metadata.nightmareBoltObserver = null;
      }
    }
  }

  public hasAnimationEnded(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying === false;
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public getAnimationGroups(): AnimationGroup[] {
    return this.animationGroups;
  }

  public dispose(): void {
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }
    const nightmareBoltAnim = this.getAnimationByName("NightmareBolt");
    if (nightmareBoltAnim?.metadata?.nightmareBoltObserver) {
      this.scene.onBeforeRenderObservable.remove(nightmareBoltAnim.metadata.nightmareBoltObserver);
    }
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
    this.onNightmareBoltAnimationState.clear();
    // // console.log("EnemyAnimationManager: Disposed");
  }
}