import { Scene, AnimationGroup, Vector3, ParticleSystem, Color3, Color4, Texture, StandardMaterial, MeshBuilder, Sound, Tags, Mesh } from "@babylonjs/core";
import { Game } from "../Game";
import { EnemyAnimationManager } from "./EnemyAnimationManager";
import { BossEnemy } from "./BossEnemy";

export class BossEnemyAnimationManager extends EnemyAnimationManager {
  constructor(scene: Scene, game: Game, enemy: BossEnemy) {
    super(scene, game, enemy);
    console.log(`BossEnemyAnimationManager: Constructor called for BossEnemy ${enemy.getId()}`);
  }

  public initialize(animationGroups: AnimationGroup[]): void {
   
    super.initialize(animationGroups);
    this.animationGroups = animationGroups;
   console.log(`BossEnemyAnimationManager: Initializing with ${animationGroups.length} animation groups: ${animationGroups.map(ag => ag.name).join(", ")}`);
  }

  protected setupNightmareBoltDetection(): void {
    console.log(`BossEnemyAnimationManager: Setting up NightmareBolt detection`);
    super.setupNightmareBoltDetection();
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number,
    loop = true
  ): void {
    console.log(`BossEnemyAnimationManager: Playing animation ${name} with speed ${speed}`);
    if(name === "Run") { speed = 0.5 }
    super.playAnimation(name, speed, fromFrame, toFrame, loop);
  }

  protected spawnNightmareBoltSphere(): void {
    console.log(`BossEnemyAnimationManager: Spawning NightmareBolt`);
    if (Date.now() - this.lastBoltTime < 2000) {
      console.log("BossEnemyAnimationManager: NightmareBolt on cooldown");
      return;
    }
    this.lastBoltTime = Date.now();

    if (!this.enemy || !this.enemy.getEnemyMesh()) {
      console.error("BossEnemyAnimationManager: Enemy or enemy mesh not initialized");
      return;
    }

    const enemyMesh = this.enemy.getEnemyMesh()!;
    const playerMesh = this.game?.getCharacterController()?.characterMeshLoader.getCharacterMesh();
    if (!playerMesh) {
      console.error("BossEnemyAnimationManager: Player mesh not found");
      return;
    }

    const hitboxMesh = playerMesh.getChildMeshes().find(mesh => mesh.name === "player_hitbox" || Tags.MatchesQuery(mesh, "player hitbox")) as Mesh;
    if (!hitboxMesh) {
      console.error("BossEnemyAnimationManager: Player hitbox mesh not found");
      return;
    }

    // Create larger NightmareBolt (2x size: diameter 1.0)
    const sphere = MeshBuilder.CreateSphere("bossNightmareBolt", { diameter: 1.0 }, this.scene); // 2x base diameter (0.5)
    const material = new StandardMaterial("bossNightmareBoltMat", this.scene);
    material.diffuseColor = new Color3(0.15, 0.0, 0.3);
    material.emissiveColor = new Color3(0.1, 0.0, 0.4);
    material.specularColor = new Color3(0, 0, 0);
    material.specularPower = 0;
    material.alpha = 0.6;
    sphere.material = material;
    sphere.isVisible = true;

    // Scale up particle system to match larger bolt
    const particles = new ParticleSystem("bossBoltParticles", 400, this.scene);
    particles.particleTexture = new Texture("./Flare.png", this.scene);
    particles.emitter = sphere;
    particles.minEmitBox = Vector3.Zero();
    particles.maxEmitBox = Vector3.Zero();
    particles.color1 = new Color4(0.15, 0.0, 0.4, 1.0);
    particles.color2 = new Color4(0.05, 0.0, 0.4, 0.7);
    particles.colorDead = new Color4(0.0, 0.0, 0.1, 0.0);
    particles.minSize = 1.4; // 2x base (0.7)
    particles.maxSize = 3.0; // 2x base (1.5)
    particles.minLifeTime = 0.15;
    particles.maxLifeTime = 0.4;
    particles.emitRate = 600;
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;
    particles.gravity = Vector3.Zero();
    particles.direction1 = Vector3.Zero();
    particles.direction2 = Vector3.Zero();
    particles.start();

    // Adjust spawn position for larger boss and bolt
    const forward = enemyMesh.getDirection(Vector3.Forward()).normalize();
    const spawnOffset = forward.scale(1.5).add(new Vector3(0, 1.5, 0)); // Adjusted for larger size
    const startPos = enemyMesh.getAbsolutePosition().add(spawnOffset);
    sphere.position = startPos;
    sphere.checkCollisions = true;

    // Play whoosh sound
    if (this.boltLaunchSound && this.boltLaunchSound.isReady()) {
      console.log("BossEnemyAnimationManager: Playing boltLaunch.wav (whoosh sound)");
      this.boltLaunchSound.play();
    } else {
      console.warn("BossEnemyAnimationManager: boltLaunchSound not preloaded or not ready");
    }

    // Play ambient bolt sound
    let sphereNightmareBoltSound: Sound | null = null;
    if (this.nightmareBoltSound) {
      sphereNightmareBoltSound = this.nightmareBoltSound.clone();
      if (sphere && !sphere.isDisposed()) {
        sphereNightmareBoltSound!.attachToMesh(sphere);
        sphereNightmareBoltSound!.play();
      } else {
        sphereNightmareBoltSound!.dispose();
        sphereNightmareBoltSound = null;
      }
    }

    // Target player hitbox
    hitboxMesh.computeWorldMatrix(true);
    hitboxMesh.refreshBoundingInfo();
    const boundingBox = hitboxMesh.getBoundingInfo().boundingBox;
    const hitboxCenterY = (boundingBox.minimumWorld.y + boundingBox.maximumWorld.y) / 2;
    const hitboxPos = hitboxMesh.getAbsolutePosition();
    const adjustedPlayerPos = new Vector3(hitboxPos.x, hitboxCenterY, hitboxPos.z);

    if (hitboxCenterY - boundingBox.minimumWorld.y < 0.5) {
      adjustedPlayerPos.y = hitboxPos.y + 0.875;
    }

    let moveDirection = adjustedPlayerPos.subtract(sphere.position);
    if (moveDirection.lengthSquared() > 0.0001) {
      moveDirection = moveDirection.normalize();
    } else {
      moveDirection = forward;
    }

    const speed = 20; // Same as base

    const renderCallback = () => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));

      if (sphere.intersectsMesh(hitboxMesh, true)) {
        const characterController = this.game?.getCharacterController();
        if (characterController) {
          const player = characterController.getPlayer();
          if (player) {
            //const currentHP = player.getCurrentHP();
            const damage = Math.floor(Math.random() * (10 - 5 + 1)) + 5; // Same as base
            player.takeDamage(damage);
            console.log(`BossEnemyAnimationManager: Applied ${damage} damage to player, new HP: ${player.getCurrentHP()}`);
          }
        }

        const explosion = confrontationParticleSystem(sphere, this.scene);
        particles.stop();
        particles.dispose();
        sphere.dispose();
        if (sphereNightmareBoltSound) {
          sphereNightmareBoltSound.stop();
          sphereNightmareBoltSound.dispose();
        }
        if (this.boltLaunchSound) {
          this.boltLaunchSound.stop();
        }
        this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
        return;
      }

      setTimeout(() => {
        if (!sphere.isDisposed()) {
          particles.stop();
          particles.dispose();
          sphere.dispose();
          if (sphereNightmareBoltSound) {
            sphereNightmareBoltSound.stop();
            sphereNightmareBoltSound.dispose();
          }
          if (this.boltLaunchSound) {
            this.boltLaunchSound.stop();
          }
          this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
          console.log("BossEnemyAnimationManager: NightmareBolt timed out");
        }
      }, 5000);
    };

    this.scene.onBeforeRenderObservable.add(renderCallback);
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    const anim = super.getAnimationByName(name);
    console.log(`BossEnemyAnimationManager: getAnimationByName("${name}"), available animations: ${this.animationGroups.map(ag => ag.name).join(", ")}, found: ${!!anim}`);
    return anim;
  }
}

function confrontationParticleSystem(sphere: Mesh, scene: Scene): ParticleSystem {
  const explosion = new ParticleSystem("bossNightmareExplosion", 100, scene);
  explosion.particleTexture = new Texture("./Flare.png", scene);
  explosion.emitter = sphere.position.clone();
  explosion.minEmitBox = new Vector3(-0.4, -0.4, -0.4); // 2x base
  explosion.maxEmitBox = new Vector3(0.4, 0.4, 0.4); // 2x base
  explosion.color1 = new Color4(0.4, 0.0, 0.6, 1.0);
  explosion.color2 = new Color4(0.6, 0.1, 0.8, 0.8);
  explosion.colorDead = new Color4(0.2, 0.0, 0.3, 0.0);
  explosion.minSize = 0.8; // 2x base (0.4)
  explosion.maxSize = 2.4; // 2x base (1.2)
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
  explosion.manualEmitCount = 50;
  explosion.start();
  return explosion;
}