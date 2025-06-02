import { AnimationGroup, Scene, Mesh, StandardMaterial, Color3, Vector3, MeshBuilder, ParticleSystem, Texture, Color4, Observable, Tags, Sound } from "@babylonjs/core";
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
  private footstepSounds: Sound[] = [];
  private footstepFrames: number[] = [];
  private footstepObserver: any = null;
  private castBoltSound: Sound | null = null;
  private boltLaunchSound: Sound | null = null;
  private nightmareBoltSound: Sound | null = null;
  public onNightmareBoltAnimationState = new Observable<{ isRunning: boolean; progress?: number }>();

  constructor(
    private scene: Scene,
    private game?: Game,
    private enemy?: Enemy
  ) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing EnemyAnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    console.log("EnemyAnimationManager: Loading footstep sounds");
    this.loadFootstepSounds();
    console.log(`EnemyAnimationManager: Footstep sounds loaded, count: ${this.footstepSounds.length}`);

    console.log("EnemyAnimationManager: Preloading NightmareBolt sounds");
    this.preloadNightmareBoltSounds();
    console.log("EnemyAnimationManager: NightmareBolt sounds preloaded");

    const idleAnim = this.getAnimationByName("Idle");
    if (idleAnim) {
      idleAnim.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("Idle animation not found for Enemy");
    }

    this.setupNightmareBoltDetection();
  }

  private loadFootstepSounds(): void {
    console.log("EnemyAnimationManager: Starting loadFootstepSounds");
    const soundFiles = [
      "./sfx/footstep1.wav",
      "./sfx/footstep2.wav",
      "./sfx/footstep3.wav",
      "./sfx/footstep4.wav"
    ];

    const enemyMesh = this.enemy?.getEnemyMesh();
    if (!enemyMesh) {
      console.warn("EnemyAnimationManager: Enemy mesh not available for spatial sound attachment");
    } else {
      console.log(`EnemyAnimationManager: Attaching footstep sounds to enemy mesh at position ${enemyMesh.getAbsolutePosition().toString()}`);
    }

    for (const file of soundFiles) {
      console.log(`EnemyAnimationManager: Attempting to load sound ${file}`);
      const sound = new Sound(
        `footstep_${file.split('/').pop()}`,
        file,
        this.scene,
        () => {
          console.log(`EnemyAnimationManager: Loaded footstep sound ${file} (spatial: true, attached: ${!!enemyMesh})`);
          this.footstepSounds.push(sound);
          if (enemyMesh) {
            sound.attachToMesh(enemyMesh);
            console.log(`EnemyAnimationManager: Attached footstep sound ${file} to enemy mesh`);
          }
          if (this.footstepSounds.length === soundFiles.length) {
            console.log(`EnemyAnimationManager: Successfully loaded ${this.footstepSounds.length} footstep sounds`);
          }
        },
        {
          autoplay: false,
          loop: false,
          spatialSound: true,
          maxDistance: 70,
          volume: 0.5
        }
      );
    }
  }

  private preloadNightmareBoltSounds(): void {
    const enemyMesh = this.enemy?.getEnemyMesh();
    if (!enemyMesh) {
      console.warn("EnemyAnimationManager: Enemy mesh not available for NightmareBolt sound preloading");
      return;
    }

    console.log("EnemyAnimationManager: Preloading castBolt2.wav (cast sound)");
    this.castBoltSound = new Sound(
      "castBoltSound",
      "./sfx/castBolt2.wav",
      this.scene,
      () => {
        console.log("EnemyAnimationManager: Cast bolt sound preloaded");
        this.castBoltSound!.attachToMesh(enemyMesh);
      },
      {
        autoplay: false,
        loop: true,
        spatialSound: true,
        maxDistance: 50,
        volume: 0.4
      }
    );

    console.log("EnemyAnimationManager: Preloading boltLaunch.wav (whoosh sound)");
    this.boltLaunchSound = new Sound(
      "boltLaunchSound",
      "./sfx/boltLaunch.wav",
      this.scene,
      () => {
        console.log("EnemyAnimationManager: Bolt launch (whoosh) sound preloaded");
        this.boltLaunchSound!.attachToMesh(enemyMesh);
        if (!this.boltLaunchSound!.isReady()) {
          console.warn("EnemyAnimationManager: Bolt launch (whoosh) sound not ready after preload");
        }
      },
      {
        autoplay: false,
        loop: false,
        spatialSound: true,
        maxDistance: 50,
        volume: 1.2 // Increased volume for audibility
      }
    );

    console.log("EnemyAnimationManager: Preloading bolt.mp3 (ambient bolt sound)");
    this.nightmareBoltSound = new Sound(
      "nightmareBoltSound",
      "./sfx/bolt.wav",
      this.scene,
      () => {
        console.log("EnemyAnimationManager: NightmareBolt ambient sound preloaded");
      },
      {
        autoplay: false,
        loop: true,
        spatialSound: true,
        maxDistance: 50,
        volume: 1
      }
    );
  }

  private setupNightmareBoltDetection(): void {
    const nightmareBoltAnim = this.getAnimationByName("NightmareBolt");
    if (nightmareBoltAnim) {
      console.log("EnemyAnimationManager: NightmareBolt animation found, monitoring for 50% progress");
      nightmareBoltAnim.onAnimationGroupEndObservable.add(() => {
        this.onNightmareBoltAnimationState.notifyObservers({ isRunning: false });
        console.log(`EnemyAnimationManager: NightmareBolt animation ended, loopCount=${this.loopCount}`);
        if (this.castBoltSound) {
          this.castBoltSound.stop();
          console.log("EnemyAnimationManager: Cast bolt sound stopped on animation end");
        }
      });
    } else {
      console.warn("EnemyAnimationManager: NightmareBolt animation not found");
    }
  }

  private spawnNightmareBoltSphere(): void {
    if (Date.now() - this.lastBoltTime < 2000) {
      console.log("EnemyAnimationManager: NightmareBolt on cooldown");
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

    const hitboxMesh = playerMesh.getChildMeshes().find(mesh => mesh.name === "player_hitbox" || Tags.MatchesQuery(mesh, "player hitbox")) as Mesh;
    if (!hitboxMesh) {
      console.error("EnemyAnimationManager: Player hitbox mesh not found");
      return;
    }
    console.log(`EnemyAnimationManager: Found player hitbox: ${hitboxMesh.name}, position: ${hitboxMesh.getAbsolutePosition().toString()}`);

    console.log(`EnemyAnimationManager: Spawning NightmareBolt sphere, loopCount=${this.loopCount}`);

    const sphere = MeshBuilder.CreateSphere("nightmareBolt", { diameter: 0.5 }, this.scene);
    const material = new StandardMaterial("nightmareBoltMat", this.scene);
    material.diffuseColor = new Color3(0.15, 0.0, 0.3);
    material.emissiveColor = new Color3(0.1, 0.0, 0.4);
    material.specularColor = new Color3(0, 0, 0);
    material.specularPower = 0;
    material.alpha = 0.6;
    sphere.material = material;
    sphere.isVisible = true;

    const particles = new ParticleSystem("boltParticles", 400, this.scene);
    particles.particleTexture = new Texture("./Flare.png", this.scene);
    particles.emitter = sphere;
    particles.minEmitBox = Vector3.Zero();
    particles.maxEmitBox = Vector3.Zero();
    particles.color1 = new Color4(0.15, 0.0, 0.4, 1.0);
    particles.color2 = new Color4(0.05, 0.0, 0.4, 0.7);
    particles.colorDead = new Color4(0.0, 0.0, 0.1, 0.0);
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

    console.log(`EnemyAnimationManager: Sphere spawned at position: ${sphere.position.toString()}`);

    // Play whoosh sound when sphere spawns
    if (this.boltLaunchSound && this.boltLaunchSound.isReady()) {
      console.log("EnemyAnimationManager: Playing boltLaunch.wav (whoosh sound)");
      this.boltLaunchSound.play();
      if (!this.boltLaunchSound.isPlaying) {
        console.warn("EnemyAnimationManager: Bolt launch (whoosh) sound failed to play");
      }
    } else {
      console.warn("EnemyAnimationManager: boltLaunchSound (whoosh) not preloaded or not ready");
    }

    // Play ambient bolt sound attached to sphere
    let sphereNightmareBoltSound: Sound | null = null;
    if (this.nightmareBoltSound) {
      console.log(`EnemyAnimationManager: Cloning preloaded nightmareBolt sound for sphere ${sphere.uniqueId}`);
      sphereNightmareBoltSound = this.nightmareBoltSound.clone();
      if (sphere && !sphere.isDisposed()) {
        sphereNightmareBoltSound!.attachToMesh(sphere);
        sphereNightmareBoltSound!.play();
        console.log(`EnemyAnimationManager: Cloned nightmareBolt sound playing, attached to sphere ${sphere.uniqueId}`);
      } else {
        console.warn(`EnemyAnimationManager: Sphere ${sphere.uniqueId} disposed before nightmareBolt sound could be attached`);
        sphereNightmareBoltSound!.dispose();
        sphereNightmareBoltSound = null;
      }
    } else {
      console.warn("EnemyAnimationManager: nightmareBoltSound not preloaded");
    }

    hitboxMesh.computeWorldMatrix(true);
    hitboxMesh.refreshBoundingInfo();
    const boundingBox = hitboxMesh.getBoundingInfo().boundingBox;
    const hitboxCenterY = (boundingBox.minimumWorld.y + boundingBox.maximumWorld.y) / 2;
    const hitboxPos = hitboxMesh.getAbsolutePosition();
    const adjustedPlayerPos = new Vector3(hitboxPos.x, hitboxCenterY, hitboxPos.z);

    console.log(`EnemyAnimationManager: Player hitbox bounding box: min=${boundingBox.minimumWorld.toString()}, max=${boundingBox.maximumWorld.toString()}, centerY=${hitboxCenterY}`);

    if (hitboxCenterY - boundingBox.minimumWorld.y < 0.5) {
      adjustedPlayerPos.y = hitboxPos.y + 0.875;
      console.log(`EnemyAnimationManager: Warning: Player hitbox midpoint too low, using fallback y=${adjustedPlayerPos.y}`);
    }

    let moveDirection = adjustedPlayerPos.subtract(sphere.position);
    if (moveDirection.lengthSquared() > 0.0001) {
      moveDirection = moveDirection.normalize();
      console.log(`EnemyAnimationManager: Moving sphere toward player hitbox at adjusted position: ${adjustedPlayerPos.toString()}`);
    } else {
      moveDirection = forward;
      console.log("EnemyAnimationManager: Player hitbox at same position as sphere, using forward direction");
    }

    const speed = 20;

    const renderCallback = () => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));

      console.log(`EnemyAnimationManager: Sphere position: ${sphere.position.toString()}, Hitbox position: ${hitboxMesh.getAbsolutePosition().toString()}`);

      if (sphere.intersectsMesh(hitboxMesh, true)) {
        console.log("EnemyAnimationManager: NightmareBolt hit player hitbox");
        const characterController = this.game?.getCharacterController();
        if (characterController) {
          const player = characterController.getPlayer();
          if (player) {
            const currentHP = player.getCurrentHP();
            console.log(`EnemyAnimationManager: Current HP before damage: ${currentHP}`);
            const damage = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
            player.setHP(currentHP - damage);
            console.log(`EnemyAnimationManager: Applied ${damage} damage to player, new HP: ${player.getCurrentHP()}`);
          } else {
            console.error("EnemyAnimationManager: Player instance not found");
          }
        }

        const explosion = confrontationParticleSystem(sphere, this.scene);
        particles.stop();
        particles.dispose();
        sphere.dispose();
        if (sphereNightmareBoltSound) {
          sphereNightmareBoltSound.stop();
          sphereNightmareBoltSound.dispose();
          console.log(`EnemyAnimationManager: Cloned nightmareBolt sound for sphere ${sphere.uniqueId} stopped and disposed`);
        }
        if (this.boltLaunchSound) {
          this.boltLaunchSound.stop();
          console.log("EnemyAnimationManager: Bolt launch (whoosh) sound stopped");
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
            console.log(`EnemyAnimationManager: Cloned nightmareBolt sound for sphere ${sphere.uniqueId} stopped and disposed due to timeout`);
          }
          if (this.boltLaunchSound) {
            this.boltLaunchSound.stop();
            console.log("EnemyAnimationManager: Bolt launch (whoosh) sound stopped due to timeout");
          }
          this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
          console.log("EnemyAnimationManager: NightmareBolt timed out");
        }
      }, 5000);
    };

    this.scene.onBeforeRenderObservable.add(renderCallback);
  }

  public cancelNightmareBolt(): void {
    const nightmareBoltAnim = this.getAnimationByName("NightmareBolt");
    if (nightmareBoltAnim && nightmareBoltAnim.isPlaying) {
      console.log("EnemyAnimationManager: Cancelling NightmareBolt animation");
      nightmareBoltAnim.stop();
      this.onNightmareBoltAnimationState.notifyObservers({ isRunning: false });
      this.nightmareBoltSpawned = false;
      this.currentAnimationName = null;
      if (this.blendFrameId !== null) {
        cancelAnimationFrame(this.blendFrameId);
        this.blendFrameId = null;
        this.isBlending = false;
      }
      if (this.castBoltSound) {
        this.castBoltSound.stop();
        console.log("EnemyAnimationManager: Cast bolt sound stopped on cancel");
      }
      if (this.getAnimationByName("Idle")) {
        this.getAnimationByName("Idle")!.play(true);
        this.currentAnimationName = "Idle";
      }
    }
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

    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      this.footstepFrames = [];
      console.log("EnemyAnimationManager: Cleared previous footstep observer");
    }

    const walkingAnimations = ["Run", "RunBackwards", "RightStrafe", "StrafeLeft"];
    if (walkingAnimations.includes(name) && this.footstepSounds.length > 0) {
      const frameRange = (toFrame ?? newAnim.to) - (fromFrame ?? newAnim.from);
      this.footstepFrames = [
        (fromFrame ?? newAnim.from) + 0.25 * frameRange,
        (fromFrame ?? newAnim.from) + 0.75 * frameRange
      ];
      console.log(`EnemyAnimationManager: Set footstep sounds to play at frames ${this.footstepFrames} for animation '${name}'`);

      this.footstepObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;

          for (let i = 0; i < this.footstepFrames.length; i++) {
            const frame = this.footstepFrames[i];
            if (currentFrame >= frame && currentFrame < frame + 1) {
              const soundIndex = Math.floor(Math.random() * this.footstepSounds.length);
              this.footstepSounds[soundIndex].play();
              console.log(`EnemyAnimationManager: Played footstep sound ${soundIndex + 1} at frame ${currentFrame} for animation '${name}'`);
              if (newAnim.isStarted && loop) {
                this.footstepFrames[i] += frameRange;
                console.log(`EnemyAnimationManager: Shifted keyframe ${i} to ${this.footstepFrames[i]} for next loop`);
              }
            }
          }
        } else {
          this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
          this.footstepObserver = null;
          this.footstepFrames = [];
          console.log(`EnemyAnimationManager: Animation '${name}' stopped, removed footstep observer`);
        }
      });
    } else {
      console.log(`EnemyAnimationManager: No footstep sounds for animation '${name}' (walkingAnimations: ${walkingAnimations.includes(name)}, sounds loaded: ${this.footstepSounds.length})`);
    }

    if (name === "NightmareBolt") {
      if (!this.enemy || !this.enemy.getPhysics() || !this.enemy.getEnemyMesh()) {
        console.warn("EnemyAnimationManager: Cannot cast NightmareBolt; missing enemy, physics, or enemy mesh");
        return;
      }

      const enemyMesh = this.enemy.getEnemyMesh()!;
      const playerMesh = this.game?.getCharacterController()?.characterMeshLoader.getCharacterMesh();
      if (!playerMesh) {
        console.warn("EnemyAnimationManager: Cannot cast NightmareBolt; player mesh not found");
        return;
      }

      const hitboxMesh = playerMesh.getChildMeshes().find(mesh => mesh.name === "player_hitbox" || Tags.MatchesQuery(mesh, "player hitbox")) as Mesh;
      if (!hitboxMesh) {
        console.warn("EnemyAnimationManager: Cannot cast NightmareBolt; player hitbox not found");
        return;
      }

      const forward = enemyMesh.getDirection(Vector3.Forward()).normalize();
      const enemyPos = enemyMesh.getAbsolutePosition();
      const playerPos = hitboxMesh.getAbsolutePosition();
      const toPlayer = playerPos.subtract(enemyPos).normalize();
      const dot = Vector3.Dot(forward, toPlayer);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      console.log(`EnemyAnimationManager: NightmareBolt player angle: ${angle * (180 / Math.PI)} deg`);

      if (angle > Math.PI / 2) {
        console.warn(`EnemyAnimationManager: Cannot cast NightmareBolt; player is outside front 180° arc`);
        return;
      }

      // Play cast sound when NightmareBolt animation starts
      if (this.castBoltSound && this.castBoltSound.isReady()) {
        console.log("EnemyAnimationManager: Playing castBolt2.wav (cast sound)");
        this.castBoltSound.play();
        if (!this.castBoltSound.isPlaying) {
          console.warn("EnemyAnimationManager: Cast bolt sound failed to play");
        }
      } else {
        console.warn("EnemyAnimationManager: castBoltSound not preloaded or not ready");
      }
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
      console.log("EnemyAnimationManager: NightmareBolt animation started, loopCount=0, notified observers");
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;
          const from = newAnim.from;
          const to = newAnim.to;
          const progress = (currentFrame - from) / (to - from);

          // Detect animation loop reset to play cast sound again
          if (progress < this.lastProgress && this.lastProgress > 0.9) {
            this.loopCount++;
            this.nightmareBoltSpawned = false;
            console.log(`EnemyAnimationManager: Detected NightmareBolt animation loop reset, loopCount=${this.loopCount}, resetting nightmareBoltSpawned`);
            // Replay cast sound at start of new loop
            if (this.castBoltSound && this.castBoltSound.isReady()) {
              this.castBoltSound.stop(); // Ensure previous instance is stopped
              this.castBoltSound.play();
              console.log(`EnemyAnimationManager: Replaying castBolt2.wav (cast sound) for loop ${this.loopCount}`);
              if (!this.castBoltSound.isPlaying) {
                console.warn("EnemyAnimationManager: Cast bolt sound failed to play on loop reset");
              }
            } else {
              console.warn("EnemyAnimationManager: castBoltSound not preloaded or not ready for loop reset");
            }
          }
          this.lastProgress = progress;

          console.log(`EnemyAnimationManager: NightmareBolt progress=${progress.toFixed(2)}, frame=${currentFrame}, nightmareBoltSpawned=${this.nightmareBoltSpawned}, loopCount=${this.loopCount}`);

          this.onNightmareBoltAnimationState.notifyObservers({ isRunning: true, progress });
          if (progress >= 0.5 && !this.nightmareBoltSpawned) {
            console.log(`EnemyAnimationManager: NightmareBolt animation reached 50%, spawning sphere, loopCount=${this.loopCount}`);
            if (this.castBoltSound) {
              this.castBoltSound.stop();
              console.log("EnemyAnimationManager: Cast bolt sound stopped at 50% progress");
            }
            this.spawnNightmareBoltSphere();
            this.nightmareBoltSpawned = true;
            this.onNightmareBoltAnimationState.notifyObservers({ isRunning: true, progress: 0.5 });
          }
        } else {
          console.log("EnemyAnimationManager: NightmareBolt animation stopped or no animatables, removing observer");
          this.onNightmareBoltAnimationState.notifyObservers({ isRunning: false });
          if (this.castBoltSound) {
            this.castBoltSound.stop();
            console.log("EnemyAnimationManager: Cast bolt sound stopped on animation stop");
          }
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
        if (this.castBoltSound) {
          this.castBoltSound.stop();
          console.log("EnemyAnimationManager: Cast bolt sound stopped when switching to non-NightmareBolt animation");
        }
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
    this.footstepSounds.forEach(sound => sound.dispose());
    this.footstepSounds = [];
    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      console.log("EnemyAnimationManager: Cleared footstep observer in dispose");
    }
    if (this.castBoltSound) {
      this.castBoltSound.stop();
      this.castBoltSound.dispose();
      this.castBoltSound = null;
      console.log("EnemyAnimationManager: Cast bolt sound stopped and disposed in dispose");
    }
    if (this.boltLaunchSound) {
      this.boltLaunchSound.stop();
      this.boltLaunchSound.dispose();
      this.boltLaunchSound = null;
      console.log("EnemyAnimationManager: Bolt launch (whoosh) sound stopped and disposed in dispose");
    }
    if (this.nightmareBoltSound) {
      this.nightmareBoltSound.stop();
      this.nightmareBoltSound.dispose();
      this.nightmareBoltSound = null;
      console.log("EnemyAnimationManager: NightmareBolt ambient sound stopped and disposed in dispose");
    }
    this.onNightmareBoltAnimationState.clear();
    console.log("EnemyAnimationManager: Disposed");
  }
}

// Helper function to create the confrontation particle system
function confrontationParticleSystem(sphere: Mesh, scene: Scene): ParticleSystem {
  const explosion = new ParticleSystem("nightmareExplosion", 100, scene);
  explosion.particleTexture = new Texture("./Flare.png", scene);
  explosion.emitter = sphere.position.clone();
  explosion.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
  explosion.maxEmitBox = new Vector3(0.2, 0.2, 0.2);
  explosion.color1 = new Color4(0.4, 0.0, 0.6, 1.0);
  explosion.color2 = new Color4(0.6, 0.1, 0.8, 0.8);
  explosion.colorDead = new Color4(0.2, 0.0, 0.3, 0.0);
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
  explosion.manualEmitCount = 50;
  explosion.start();
  return explosion;
}