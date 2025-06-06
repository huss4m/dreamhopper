import { AnimationGroup, Scene, Mesh, StandardMaterial, Color3, Vector3, MeshBuilder, EventState, ParticleSystem, Texture, Color4, Observable, Tags, Sound } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";
import { AssetManager } from "../AssetManager";
import { GameManager } from "../GameManager";
import { Enemy } from "../enemy/Enemy";
import { BossEnemy } from "../enemy/BossEnemy";

export class CharacterAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isJumping = false;
  private isBlending = false;
  private blendFrameId: number | null = null;
  private dreamboltSpawned = false;
  private footstepSounds: any[] = [];
  private footstepFrames: number[] = [];
  private footstepObserver: any = null;
  private castBolt2Sound: Sound | null = null;
  private dreamboltSound: Sound | null = null;
  private boltLaunchSound: Sound | null = null;
  private impactChimeSound: Sound | null = null;
  public onDreamboltAnimationState = new Observable<{ isPlaying: boolean; progress?: number }>();

  constructor(
    private scene: Scene,
    public characterController?: CharacterController,
    private targetingSystem?: TargetingSystem,
    private gameManager?: GameManager
  ) {}

  public async initialize(animationGroups: AnimationGroup[]): Promise<void> {
    this.animationGroups = animationGroups;
    console.log(`CharacterAnimationManager: Initializing with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    console.log("CharacterAnimationManager: About to load footstep sounds");
    this.loadFootstepSounds();
    console.log(`CharacterAnimationManager: Footstep sounds loaded, count: ${this.footstepSounds.length}`);

    console.log("CharacterAnimationManager: About to preload Dreambolt sounds");
    this.preloadDreamboltSounds();
    console.log("CharacterAnimationManager: Dreambolt sounds preloaded");

    if (this.getAnimationByName("Idle")) {
      this.getAnimationByName("Idle")!.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("CharacterAnimationManager: Idle animation not found");
    }

    this.setupJumpDetection();
    this.setupDreamboltDetection();
  }

  private loadFootstepSounds(): void {
    console.log("CharacterAnimationManager: Starting loadFootstepSounds");
    const soundFiles = [
      "./sfx/footstep1.wav",
      "./sfx/footstep2.wav",
      "./sfx/footstep3.wav",
      "./sfx/footstep4.wav"
    ];

    const characterMesh = this.characterController?.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.warn("Character mesh not available for spatial sound attachment");
    } else {
      console.log(`Attaching footstep sounds to mesh at position ${characterMesh.getAbsolutePosition().toString()}`);
    }

    for (const file of soundFiles) {
      console.log(`Attempting to load sound ${file}`);
      const sound = new Sound(
        `footstep_${file.split('/').pop()}`,
        file,
        this.scene,
        () => {
          console.log(`Loaded footstep sound ${file} (spatial: true, attached: ${!!characterMesh})`);
          this.footstepSounds.push(sound);
          if (characterMesh) {
            sound.attachToMesh(characterMesh);
            console.log(`Attached footstep sound ${file} to character mesh`);
          }
          if (this.footstepSounds.length === soundFiles.length) {
            console.log(`Successfully loaded ${this.footstepSounds.length} footstep sounds`);
          }
        },
        {
          autoplay: false,
          loop: false,
          spatialSound: true,
          maxDistance: 20,
          volume: 0.5
        }
      );
    }
  }

  private preloadDreamboltSounds(): void {
    const characterMesh = this.characterController?.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.warn("Character mesh not available for Dreambolt sound preloading");
      return;
    }

    console.log("Preloading castBolt2.wav");
    this.castBolt2Sound = new Sound(
      "castBoltSound",
      "./sfx/castBolt2.wav",
      this.scene,
      () => {
        console.log("Cast bolt sound preloaded");
        this.castBolt2Sound!.attachToMesh(characterMesh);
      },
      {
        autoplay: false,
        loop: true,
        spatialSound: true,
        maxDistance: 50,
        volume: 1
      }
    );

    console.log("Preloading boltLaunch.wav");
    this.boltLaunchSound = new Sound(
      "boltLaunchSound",
      "./sfx/boltLaunch.wav",
      this.scene,
      () => {
        console.log("Bolt launch sound preloaded");
        this.boltLaunchSound!.attachToMesh(characterMesh);
      },
      {
        autoplay: false,
        loop: false,
        spatialSound: true,
        maxDistance: 50,
        volume: 1.0
      }
    );

    console.log("Preloading bolt2.mp3");
    this.dreamboltSound = new Sound(
      "dreamboltSound",
      "./sfx/bolt2.mp3",
      this.scene,
      () => {
        console.log("Dreambolt sound preloaded");
      },
      {
        autoplay: false,
        loop: true,
        spatialSound: true,
        maxDistance: 50,
        volume: 1
      }
    );

    console.log("Preloading impactchime.wav");
    this.impactChimeSound = new Sound(
      "impactChimeSound",
      "./sfx/impactchime.wav",
      this.scene,
      () => {
        console.log("Impact chime sound preloaded");
      },
      {
        autoplay: false,
        loop: false,
        spatialSound: true,
        maxDistance: 50,
        volume: 0.04
      }
    );
  }

  private setupJumpDetection(): void {
    if (this.getAnimationByName("Jump")) {
      this.getAnimationByName("Jump")!.onAnimationGroupEndObservable.add(() => {
        this.isJumping = false;
        this.currentAnimationName = null;
      });
    } else {
      console.warn("Jump animation not found");
    }
  }

  private setupDreamboltDetection(): void {
    const dreamboltAnim = this.getAnimationByName("Dreambolt");
    if (dreamboltAnim) {
      console.log("Dreambolt animation found, monitoring for 50% progress");
      dreamboltAnim.onAnimationGroupEndObservable.add(() => {
        this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
        console.log("Dreambolt animation ended");
        if (this.castBolt2Sound) {
          this.castBolt2Sound.stop();
          console.log("Cast bolt sound stopped on animation end");
        }
      });
    } else {
      console.warn("Dreambolt animation not found");
    }
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
      setTimeout(() => {
        fireworks.dispose();
        console.log("Fireworks effect disposed");
      }, 5000);
    }, 1000);
  }

  private spawnDreamboltSphere(): void {
    if (!this.characterController) {
      console.error("CharacterController not initialized");
      return;
    }
    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.error("Character mesh not found");
      return;
    }
    if (!this.characterController.physicsController) {
      console.error("PhysicsController not found");
      return;
    }
    console.log("Spawning Dreambolt sphere");
    const sphere = MeshBuilder.CreateSphere("dreambolt", { diameter: 0.5 }, this.scene);
    const material = new StandardMaterial("dreamboltMat", this.scene);
    material.diffuseColor = new Color3(1.0, 0.85, 0.9);
    material.emissiveColor = new Color3(1.0, 0.95, 0.97);
    material.alpha = 0.8;
    material.specularPower = 0;
    material.backFaceCulling = false;
    sphere.material = material;
    sphere.isVisible = true;
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
    const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
    const spawnOffset = forward.add(new Vector3(0, 1.2, 0));
    const startPos = characterMesh.getAbsolutePosition().add(spawnOffset);
    sphere.position = startPos;
    sphere.checkCollisions = true;
    console.log(`Sphere spawned at position: ${sphere.position.toString()}`);
    if (this.boltLaunchSound && this.boltLaunchSound.isReady()) {
      console.log("Playing boltLaunch.wav");
      this.boltLaunchSound.play();
    } else {
      console.warn("boltLaunchSound not preloaded or not ready");
    }
    let sphereDreamboltSound: Sound | null = null;
    if (this.dreamboltSound) {
      console.log(`Cloning preloaded dreambolt sound for sphere ${sphere.uniqueId}`);
      sphereDreamboltSound = this.dreamboltSound.clone();
      if (sphere && !sphere.isDisposed()) {
        sphereDreamboltSound!.attachToMesh(sphere);
        sphereDreamboltSound!.play();
        console.log(`Cloned dreambolt sound playing, attached to sphere ${sphere.uniqueId}`);
      } else {
        console.warn(`Sphere ${sphere.uniqueId} disposed before dreambolt sound could be attached`);
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
      console.log(`Target ${target!.getId()} bounding box: min=${boundingBox.minimumWorld.toString()}, max=${boundingBox.maximumWorld.toString()}, midpoint=${targetMidpoint.toString()}`);
      moveDirection = targetMidpoint.subtract(sphere.position);
      if (moveDirection.lengthSquared() > 0.0001) {
        moveDirection = moveDirection.normalize();
        console.log(`Moving sphere toward target ${target!.getId()} at midpoint: ${targetMidpoint.toString()}`);
      } else {
        moveDirection = forward;
        console.log(`Target ${target!.getId()} midpoint is at same position as sphere, using forward direction`);
      }
    } else {
      moveDirection = forward;
      console.log("No target or target mesh not found, moving sphere in character's forward direction");
    }
    const speed = 10;
    const BASE_DREAMBOLT_MIN_DAMAGE = 20;
    const BASE_DREAMBOLT_MAX_DAMAGE = 40;
    const playerLevel = this.characterController?.getPlayer().getLevel() || 1;
    const DREAMBOLT_MIN_DAMAGE = BASE_DREAMBOLT_MIN_DAMAGE + (playerLevel - 1) * 5; // New: Scale with level
    const DREAMBOLT_MAX_DAMAGE = BASE_DREAMBOLT_MAX_DAMAGE + (playerLevel - 1) * 5; // New: Scale with level
    console.log(`Dreambolt damage range at level ${playerLevel}: ${DREAMBOLT_MIN_DAMAGE}–${DREAMBOLT_MAX_DAMAGE}`);
    const renderCallback = (eventData: Scene, eventState: EventState) => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));
      const hitboxes = this.scene.meshes.filter(mesh => Tags.MatchesQuery(mesh, "hitbox"));
      for (const hitbox of hitboxes) {
        if (sphere.intersectsMesh(hitbox, true)) {
          const tags = Tags.GetTags(hitbox);
          const enemyId = tags ? tags.split(" ").find((tag: string) => tag.startsWith("enemyID:"))?.split(":")[1] : undefined;
          if (enemyId) {
            console.log(`Dreambolt hit hitbox with enemyID: ${enemyId}`);
            let target: Enemy | BossEnemy | undefined;
            target = this.gameManager?.getEnemies().find(e => e.getId() === enemyId);
            if (!target) {
              target = this.gameManager?.getBosses().find(b => b.getId() === enemyId);
            }
            if (target) {
              this.triggerFireworks(sphere.position.clone());
              console.log(`Triggered fireworks for Dreambolt hit on ${target instanceof BossEnemy ? 'boss' : 'enemy'} ${enemyId}`);
              let impactSound: Sound | null = null;
              if (this.impactChimeSound && this.impactChimeSound.isReady()) {
                console.log(`Cloning preloaded impact chime sound for ${target instanceof BossEnemy ? 'boss' : 'enemy'} ${enemyId}`);
                impactSound = this.impactChimeSound.clone();
                const targetMesh = target.getMesh();
                if (targetMesh && !targetMesh.isDisposed()) {
                  impactSound!.attachToMesh(targetMesh);
                  impactSound!.play();
                  console.log(`Impact chime sound playing, attached to ${target instanceof BossEnemy ? 'boss' : 'enemy'} ${enemyId}`);
                } else {
                  console.warn(`Target mesh for ${enemyId} disposed before impact chime sound could be attached`);
                  impactSound!.dispose();
                  impactSound = null;
                }
              } else {
                console.warn("impactChimeSound not preloaded or not ready");
              }
              const damage = Math.floor(Math.random() * (DREAMBOLT_MAX_DAMAGE - DREAMBOLT_MIN_DAMAGE + 1)) + DREAMBOLT_MIN_DAMAGE;
              target.takeDamage(damage);
              console.log(`Dealt ${damage} damage to ${target instanceof BossEnemy ? 'boss' : 'enemy'} ${enemyId}, HP: ${target.getCurrentHP()}/${target.getMaxHP()}`);
              if (target.isDead()) {
                console.log(`${target instanceof BossEnemy ? 'Boss' : 'Enemy'} ${enemyId} defeated`);
              }
              particles.stop();
              particles.dispose();
              sphere.dispose();
              if (sphereDreamboltSound) {
                sphereDreamboltSound.stop();
                sphereDreamboltSound.dispose();
                console.log(`Cloned dreambolt sound for sphere ${sphere.uniqueId} stopped and disposed`);
              }
              if (this.boltLaunchSound) {
                this.boltLaunchSound.stop();
                console.log("Bolt launch sound stopped");
              }
              if (impactSound) {
                const soundDuration = impactSound.getAudioBuffer()?.duration || 1;
                const cleanupDelay = soundDuration * 1000;
                console.log(`Scheduling impact chime cleanup for ${target instanceof BossEnemy ? 'boss' : 'enemy'} ${enemyId} after ${cleanupDelay}ms`);
                setTimeout(() => {
                  if (impactSound) {
                    impactSound.stop();
                    impactSound.dispose();
                    console.log(`Impact chime sound for ${target instanceof BossEnemy ? 'boss' : 'enemy'} ${enemyId} stopped and disposed after ${cleanupDelay}ms`);
                  }
                }, cleanupDelay);
              }
              this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
              return;
            } else {
              console.warn(`No enemy or boss found with id ${enemyId} in GameManager`);
            }
          }
        }
      }
    };
    this.scene.onBeforeRenderObservable.add(renderCallback);
    setTimeout(() => {
      if (sphere && !sphere.isDisposed()) {
        console.log(`Dreambolt sphere ${sphere.uniqueId} timed out, disposing`);
        particles.stop();
        particles.dispose();
        sphere.dispose();
        if (sphereDreamboltSound) {
          sphereDreamboltSound.stop();
          sphereDreamboltSound.dispose();
          console.log(`Cloned dreambolt sound for sphere ${sphere.uniqueId} stopped and disposed due to timeout`);
        }
        if (this.boltLaunchSound) {
          this.boltLaunchSound.stop();
          console.log("Bolt launch sound stopped due to timeout");
        }
        this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
      }
    }, 5000);
  }

  public cancelDreambolt(): void {
    const dreamboltAnim = this.getAnimationByName("Dreambolt");
    if (dreamboltAnim && dreamboltAnim.isPlaying) {
      console.log("Cancelling Dreambolt animation");
      dreamboltAnim.stop();
      this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
      this.dreamboltSpawned = false;
      this.currentAnimationName = null;
      if (this.blendFrameId !== null) {
        cancelAnimationFrame(this.blendFrameId);
        this.blendFrameId = null;
        this.isBlending = false;
      }
      if (this.castBolt2Sound) {
        this.castBolt2Sound.stop();
        console.log("Cast bolt sound stopped on cancel");
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
    loop?: boolean
  ): void {
    //console.log(`Attempting to play animation '${name}'`);
    const newAnim = this.getAnimationByName(name);
    if (!newAnim) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    if (this.characterController?.getPlayer().isPlayerDead() && name !== "Death" && name !== "Idle") {
      //console.log(`Skipping animation '${name}' because player is dead`);
      return;
    }

    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      this.footstepFrames = [];
      //console.log("Cleared previous footstep observer");
    }

    const walkingAnimations = ["Run", "RunBackwards", "RightStrafe", "StrafeLeft"];
    if (walkingAnimations.includes(name) && this.footstepSounds.length > 0) {
      const frameRange = (toFrame ?? newAnim.to) - (fromFrame ?? newAnim.from);
      this.footstepFrames = [
        (fromFrame ?? newAnim.from) + 0.25 * frameRange,
        (fromFrame ?? newAnim.from) + 0.75 * frameRange
      ];
      //console.log(`Set footstep sounds to play at frames ${this.footstepFrames} for animation '${name}'`);

      this.footstepObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;

          for (let i = 0; i < this.footstepFrames.length; i++) {
            const frame = this.footstepFrames[i];
            if (currentFrame >= frame && currentFrame < frame + 1) {
              const soundIndex = Math.floor(Math.random() * this.footstepSounds.length);
              this.footstepSounds[soundIndex].play();
              //console.log(`Played footstep sound ${soundIndex + 1} at frame ${currentFrame} for animation '${name}'`);
              if (newAnim.isStarted && (loop ?? true)) {
                this.footstepFrames[i] += frameRange;
                //console.log(`Shifted keyframe ${i} to ${this.footstepFrames[i]} for next loop`);
              }
            }
          }
        } else {
          this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
          this.footstepObserver = null;
          this.footstepFrames = [];
          //console.log(`Animation '${name}' stopped, removed footstep observer`);
        }
      });
    } 

    if (name === "Dreambolt") {
      if (!this.characterController || !this.characterController.physicsController || !this.characterController.characterMeshLoader.getCharacterMesh()) {
        console.warn("Cannot cast Dreambolt; missing characterController, physicsController, or character mesh");
        return;
      }

      const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh()!;
      const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
      const charPos = characterMesh.getAbsolutePosition();

      const target = this.targetingSystem?.getCurrentTarget();
      if (!target || !target.getMesh()) {
        console.warn("Cannot cast Dreambolt; no target selected or target has no mesh");
        return;
      }

      const targetMesh = target.getMesh()!;
      const targetPos = targetMesh.getAbsolutePosition();
      const toTarget = targetPos.subtract(charPos).normalize();
      const dot = Vector3.Dot(forward, toTarget);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      //console.log(`Dreambolt taget ${target.getId()} angle: ${angle * (180 / Math.PI)} deg`);

      if (angle > Math.PI / 2) {
        console.warn(`Cannot cast Dreambolt; target ${target.getId()} is outside front 180° arc`);
        return;
      }

      if (this.castBolt2Sound && this.castBolt2Sound.isReady()) {
       // console.log("Playing castBolt2.wav");
        this.castBolt2Sound.play();
      } else {
        console.warn("castBolt2Sound not preloaded or not ready");
      }
    }

    const skipBlending = this.currentAnimationName === "Death";

    if ((name === "Dreambolt" || name === "Jump" || name === "Death") && this.currentAnimationName !== name) {
      const prevAnim = this.getAnimationByName(this.currentAnimationName || "");
      if (prevAnim) {
        prevAnim.stop();
        prevAnim.setWeightForAllAnimatables(0);
      }
    } else if (name === this.currentAnimationName && newAnim.isPlaying) {
      //console.log(`Animation '${name}' already playing, skipping`);
      return;
    }

    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }

    const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

    if (prevAnim && !skipBlending && name !== "Dreambolt" && name !== "Jump" && name !== "Death") {
      prevAnim.setWeightForAllAnimatables(0);
      prevAnim.stop();
    }

    newAnim.stop();
    const isLooping = name === "Death" ? false : (loop ?? !(name === "Jump" || name === "Dreambolt"));
    newAnim.start(isLooping, speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
    newAnim.setWeightForAllAnimatables(skipBlending ? 1 : 0);

    this.currentAnimationName = name;
    //console.log(`Started animation '${name}'`);

    if (skipBlending) {
      if (prevAnim) prevAnim.stop();
      newAnim.setWeightForAllAnimatables(1);
      this.isBlending = false;
      //console.log(`Played '${name}' without blending (previous was Death)`);
    } else {
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
         // console.log(`Blending complete for '${name}'`);
        }
      };

      this.blendFrameId = requestAnimationFrame(blendStep);
    }

    if (newAnim === this.getAnimationByName("Jump")) {
      this.isJumping = true;
     // console.log("Jump animation detected, isJumping set to true");
    }

    if (name === "Dreambolt") {
      this.dreamboltSpawned = false;
      this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress: 0 });
      //console.log("Dreambolt animation started");
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;
          const from = newAnim.from;
          const to = newAnim.to;
          const progress = (currentFrame - from) / (to - from);
          this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress });
          if (progress >= 0.5 && !this.dreamboltSpawned) {
           // console.log("Dreambolt animation reached 50%, spawning sphere");
            if (this.castBolt2Sound) {
              this.castBolt2Sound.stop();
              //console.log("Cast bolt sound stopped at 50% progress");
            }
            this.spawnDreamboltSphere();
            this.dreamboltSpawned = true;
            this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress: 0.5 });
            this.scene.onBeforeRenderObservable.remove(observer);
          }
        } else {
          //console.log("Dreambolt animation stopped or no animatables, removing observer");
          this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
          if (this.castBolt2Sound) {
            this.castBolt2Sound.stop();
           // console.log("Cast bolt sound stopped on animation stop");
          }
          this.scene.onBeforeRenderObservable.remove(observer);
        }
      });
    }
  }

  public* animationBlending(toAnim: AnimationGroup, fromAnim: AnimationGroup): Generator<any, void, unknown> {
    let currentWeight = 1;
    let newWeight = 0;

    toAnim.play(true);

    while (newWeight < 1) {
      newWeight += 0.01;
      currentWeight -= 0.01;
      toAnim.setWeightForAllAnimatables(newWeight);
      fromAnim.setWeightForAllAnimatables(currentWeight);
      yield;
    }

    toAnim.setWeightForAllAnimatables(1);
    fromAnim.setWeightForAllAnimatables(0);
  }

  public blendAnimations(fromAnimName: string, toAnimName: string): void {
    const fromAnim = this.getAnimationByName(fromAnimName);
    const toAnim = this.getAnimationByName(toAnimName);

    if (!fromAnim || !toAnim) {
      console.warn("One or both animations not found for blending");
      return;
    }

    if (this.isBlending) {
      console.warn("Already blending animations");
      return;
    }

    this.isBlending = true;
    this.currentAnimationName = toAnimName;

    const blendGen = this.animationBlending(toAnim, fromAnim);

    const blendStep = () => {
      if (!blendGen.next().done) {
        this.blendFrameId = requestAnimationFrame(blendStep);
      } else {
        this.isBlending = false;
        this.blendFrameId = null;
      }
    };

    this.blendFrameId = requestAnimationFrame(blendStep);
  }

  public isCharacterJumping(): boolean {
    return this.isJumping;
  }

  public isAnimationPlaying(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying || false;
  }

  public hasAnimationEnded(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying === false;
  }

  public getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public getAnimationGroups() {
    return this.animationGroups;
  }

  public stopAllAnimations(): void {
    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }
    this.isBlending = false;
    this.animationGroups.forEach(group => {
      if (group.isPlaying || group.animatables.length > 0) {
        group.stop();
        group.setWeightForAllAnimatables(0);
        group.animatables.forEach(anim => anim.stop());
      }
    });
    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      this.footstepFrames = [];
      console.log("Cleared footstep observer in stopAllAnimations");
    }
    if (this.castBolt2Sound) {
      this.castBolt2Sound.stop();
      console.log("Cast bolt sound stopped in stopAllAnimations");
    }
    if (this.dreamboltSound) {
      this.dreamboltSound.stop();
      console.log("Dreambolt sound stopped in stopAllAnimations");
    }
    if (this.boltLaunchSound) {
      this.boltLaunchSound.stop();
      console.log("Bolt launch sound stopped in stopAllAnimations");
    }
    if (this.impactChimeSound) {
      this.impactChimeSound.stop();
      console.log("Impact chime sound stopped in stopAllAnimations");
    }
    this.currentAnimationName = null;
    this.dreamboltSpawned = false;
    console.log("Stopped all animations, cleared blending state, and reset animatables");
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
    this.footstepSounds.forEach(sound => sound.dispose());
    this.footstepSounds = [];
    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      console.log("Cleared footstep observer in dispose");
    }
    if (this.castBolt2Sound) {
      this.castBolt2Sound.stop();
      this.castBolt2Sound.dispose();
      this.castBolt2Sound = null;
      console.log("Cast bolt sound stopped and disposed in dispose");
    }
    if (this.dreamboltSound) {
      this.dreamboltSound.stop();
      this.dreamboltSound.dispose();
      this.dreamboltSound = null;
      console.log("Dreambolt sound stopped and disposed in dispose");
    }
    if (this.boltLaunchSound) {
      this.boltLaunchSound.stop();
      this.boltLaunchSound.dispose();
      this.boltLaunchSound = null;
      console.log("Bolt launch sound stopped and disposed in dispose");
    }
    if (this.impactChimeSound) {
      this.impactChimeSound.stop();
      this.impactChimeSound.dispose();
      this.impactChimeSound = null;
      console.log("Impact chime sound stopped and disposed in dispose");
    }
    this.onDreamboltAnimationState.clear();
    console.log("Disposed");
  }
}