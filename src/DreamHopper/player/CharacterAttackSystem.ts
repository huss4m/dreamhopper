import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ParticleSystem,
  Texture,
  Color4,
  Sound,
  Tags,
} from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";
import { GameManager } from "../GameManager";
import { Enemy } from "../enemy/Enemy";

export class CharacterAttackSystem {
  private castBolt2Sound: Sound | null = null;
  private dreamboltSound: Sound | null = null;
  private boltLaunchSound: Sound | null = null;
  private impactChimeSound: Sound | null = null;

  constructor(
    private scene: Scene,
    private characterController: CharacterController,
    private targetingSystem?: TargetingSystem,
    private gameManager?: GameManager
  ) {
    // [CHANGED] Removed preloadDreamboltSounds call from constructor
  }

  // [NEW] Initialize method to preload sounds after mesh is loaded
  public initialize(): void {
    this.preloadDreamboltSounds();
  }

  private preloadDreamboltSounds(): void {
    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.warn("Character mesh not available for Dreambolt sound preloading");
      return;
    }

    this.castBolt2Sound = new Sound(
      "castBoltSound",
      "./sfx/castBolt2.wav",
      this.scene,
      () => this.castBolt2Sound!.attachToMesh(characterMesh),
      { autoplay: false, loop: true, spatialSound: true, maxDistance: 50, volume: 1 }
    );

    this.boltLaunchSound = new Sound(
      "boltLaunchSound",
      "./sfx/boltLaunch.wav",
      this.scene,
      () => this.boltLaunchSound!.attachToMesh(characterMesh),
      { autoplay: false, loop: false, spatialSound: true, maxDistance: 50, volume: 1.0 }
    );

    this.dreamboltSound = new Sound(
      "dreamboltSound",
      "./sfx/bolt2.mp3",
      this.scene,
      null,
      { autoplay: false, loop: true, spatialSound: true, maxDistance: 50, volume: 1 }
    );

    this.impactChimeSound = new Sound(
      "impactChimeSound",
      "./sfx/impactchime.wav",
      this.scene,
      null,
      { autoplay: false, loop: false, spatialSound: true, maxDistance: 50, volume: 0.04 }
    );
  }

  private triggerFireworks(position: Vector3): void {
    const fireworks = new ParticleSystem("fairyFireworks", 2000, this.scene);
    fireworks.particleTexture = new Texture("./star_1.png", this.scene);
    fireworks.emitter = position;
    fireworks.minEmitBox = new Vector3(0, 0, 0);
    fireworks.maxEmitBox = new Vector3(0, 0, 0);
    fireworks.color1 = new Color4(1.0, 0.0, 1.0, 1.0);
    fireworks.color2 = new Color4(0.2, 0.8, 1.0, 1.0);
    fireworks.colorDead = new Color4(1.0, 1.0, 0.5, 0.3);
    fireworks.minSize = 0.15;
    fireworks.maxSize = 0.5;
    fireworks.minLifeTime = 2.5;
    fireworks.maxLifeTime = 4.0;
    fireworks.emitRate = 1000;
    fireworks.blendMode = ParticleSystem.BLENDMODE_ADD;
    fireworks.gravity = new Vector3(0, -0.5, 0);
    fireworks.direction1 = new Vector3(-1, -1, -1);
    fireworks.direction2 = new Vector3(1, 1, 1);
    fireworks.minAngularSpeed = -Math.PI / 6;
    fireworks.maxAngularSpeed = Math.PI / 6;
    fireworks.minEmitPower = 0.5;
    fireworks.maxEmitPower = 1.2;
    fireworks.updateSpeed = 0.05;
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
      setTimeout(() => fireworks.dispose(), 5000);
    }, 1000);
  }

  public triggerDreambolt(): void {
    if (!this.characterController || !this.characterController.physicsController || !this.characterController.characterMeshLoader.getCharacterMesh()) {
      console.warn("Cannot trigger Dreambolt; missing characterController, physicsController, or character mesh");
      return;
    }

    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh()!;
    const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
    const charPos = characterMesh.getAbsolutePosition();

    const target = this.targetingSystem?.getCurrentTarget();
    if (!target || !target.getMesh()) {
      console.warn("Cannot trigger Dreambolt; no target selected or target has no mesh");
      return;
    }

    const targetMesh = target.getMesh()!;
    const targetPos = targetMesh.getAbsolutePosition();
    const toTarget = targetPos.subtract(charPos).normalize();
    const dot = Vector3.Dot(forward, toTarget);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angle > Math.PI / 2) {
      console.warn(`Cannot trigger Dreambolt; target ${target.getId()} is outside front 180° arc`);
      return;
    }

    if (this.castBolt2Sound && this.castBolt2Sound.isReady()) {
      this.castBolt2Sound.play();
    } else {
      console.warn("castBolt2Sound not preloaded or not ready");
    }

    this.spawnDreamboltSphere();
  }

  private spawnDreamboltSphere(): void {
    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh()!;
    const forward = this.characterController.physicsController!.forwardDirection.scale(-1).normalize();
    const spawnOffset = forward.add(new Vector3(0, 1.2, 0));
    const startPos = characterMesh.getAbsolutePosition().add(spawnOffset);

    const sphere = MeshBuilder.CreateSphere("dreambolt", { diameter: 0.5 }, this.scene);
    const material = new StandardMaterial("dreamboltMat", this.scene);
    material.diffuseColor = new Color3(1.0, 0.85, 0.9);
    material.emissiveColor = new Color3(1.0, 0.95, 0.97);
    material.alpha = 0.8;
    material.specularPower = 0;
    material.backFaceCulling = false;
    sphere.material = material;
    sphere.isVisible = true;
    sphere.position = startPos;
    sphere.checkCollisions = true;

    const particles = new ParticleSystem("boltParticles", 1000, this.scene);
    particles.particleTexture = new Texture("./Flare.png", this.scene);
    particles.emitter = sphere;
    particles.minEmitBox = Vector3.Zero();
    particles.maxEmitBox = Vector3.Zero();
    particles.color1 = new Color4(0.9, 0.2, 1.0, 1.0);
    particles.color2 = new Color4(0.8, 0.5, 0.9, 0.6);
    particles.colorDead = new Color4(0, 0, 0.2, 0.0);
    particles.minSize = 0.7;
    particles.maxSize = 1.5;
    particles.minLifeTime = 0.15;
    particles.maxLifeTime = 0.4;
    particles.emitRate = 400;
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;
    particles.gravity = Vector3.Zero();
    particles.direction1 = Vector3.Zero();
    particles.direction2 = Vector3.Zero();
    particles.start();

    if (this.boltLaunchSound && this.boltLaunchSound.isReady()) {
      this.boltLaunchSound.play();
    } else {
      console.warn("boltLaunchSound not preloaded or not ready");
    }

    let sphereDreamboltSound: Sound | null = null;
    if (this.dreamboltSound) {
      sphereDreamboltSound = this.dreamboltSound.clone();
      if (sphere && !sphere.isDisposed()) {
        sphereDreamboltSound!.attachToMesh(sphere);
        sphereDreamboltSound!.play();
      } else {
        sphereDreamboltSound!.dispose();
        sphereDreamboltSound = null;
      }
    } else {
      console.warn("dreamboltSound not preloaded");
    }

    let moveDirection: Vector3;
    if (this.targetingSystem && this.targetingSystem.getCurrentTarget() && this.targetingSystem.getCurrentTarget()!.getMesh()) {
      const target = this.targetingSystem.getCurrentTarget();
      const targetMesh = target!.getMesh()!;
      targetMesh.computeWorldMatrix(true);
      targetMesh.refreshBoundingInfo();
      const boundingBox = targetMesh.getBoundingInfo().boundingBox;
      const targetMidpoint = boundingBox.minimumWorld.add(boundingBox.maximumWorld).scale(0.5);
      moveDirection = targetMidpoint.subtract(sphere.position);
      if (moveDirection.lengthSquared() > 0.0001) {
        moveDirection = moveDirection.normalize();
      } else {
        moveDirection = forward;
      }
    } else {
      moveDirection = forward;
    }

    const speed = 10;
    const BASE_DREAMBOLT_MIN_DAMAGE = 20;
    const BASE_DREAMBOLT_MAX_DAMAGE = 40;
    const playerLevel = this.characterController.getPlayer().getLevel() || 1;
    const DREAMBOLT_MIN_DAMAGE = BASE_DREAMBOLT_MIN_DAMAGE + (playerLevel - 1) * 5;
    const DREAMBOLT_MAX_DAMAGE = BASE_DREAMBOLT_MAX_DAMAGE + (playerLevel - 1) * 5;

    const renderCallback = () => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));

      const hitboxes = this.scene.meshes.filter(mesh => Tags.MatchesQuery(mesh, "hitbox"));
      for (const hitbox of hitboxes) {
        if (sphere.intersectsMesh(hitbox, true)) {
          const tags = Tags.GetTags(hitbox);
          const enemyId = tags ? tags.split(" ").find((tag: string) => tag.startsWith("enemyID:"))?.split(":")[1] : undefined;
          if (enemyId) {
            const target: Enemy | undefined = this.gameManager?.getEnemies().find(e => e.getId() === enemyId);
            if (target) {
              this.triggerFireworks(sphere.position.clone());
              let impactSound: Sound | null = null;
              if (this.impactChimeSound && this.impactChimeSound.isReady()) {
                impactSound = this.impactChimeSound.clone();
                const targetMesh = target.getMesh();
                if (targetMesh && !targetMesh.isDisposed()) {
                  impactSound!.attachToMesh(targetMesh);
                  impactSound!.play();
                } else {
                  impactSound!.dispose();
                  impactSound = null;
                }
              } else {
                console.warn("impactChimeSound not preloaded or not ready");
              }

              const damage = Math.floor(Math.random() * (DREAMBOLT_MAX_DAMAGE - DREAMBOLT_MIN_DAMAGE + 1)) + DREAMBOLT_MIN_DAMAGE;
              target.takeDamage(damage);

              particles.stop();
              particles.dispose();
              sphere.dispose();
              if (sphereDreamboltSound) {
                sphereDreamboltSound.stop();
                sphereDreamboltSound.dispose();
              }
              if (this.boltLaunchSound) {
                this.boltLaunchSound.stop();
              }
              if (impactSound) {
                const soundDuration = impactSound.getAudioBuffer()?.duration || 1;
                setTimeout(() => {
                  if (impactSound) {
                    impactSound.stop();
                    impactSound.dispose();
                  }
                }, soundDuration * 1000);
              }
              this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
              return;
            } else {
              console.warn(`No enemy found with id ${enemyId} in GameManager`);
            }
          }
        }
      }
    };

    this.scene.onBeforeRenderObservable.add(renderCallback);
    setTimeout(() => {
      if (sphere && !sphere.isDisposed()) {
        particles.stop();
        particles.dispose();
        sphere.dispose();
        if (sphereDreamboltSound) {
          sphereDreamboltSound.stop();
          sphereDreamboltSound.dispose();
        }
        if (this.boltLaunchSound) {
          this.boltLaunchSound.stop();
        }
        this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
      }
    }, 5000);
  }

  public stopSounds(): void {
    if (this.castBolt2Sound) this.castBolt2Sound.stop();
    if (this.boltLaunchSound) this.boltLaunchSound.stop();
    if (this.dreamboltSound) this.dreamboltSound.stop();
    if (this.impactChimeSound) this.impactChimeSound.stop();
  }

  public dispose(): void {
    this.stopSounds();
    if (this.castBolt2Sound) this.castBolt2Sound.dispose();
    if (this.boltLaunchSound) this.boltLaunchSound.dispose();
    if (this.dreamboltSound) this.dreamboltSound.dispose();
    if (this.impactChimeSound) this.impactChimeSound.dispose();
  }
}