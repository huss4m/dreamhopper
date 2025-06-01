import { AnimationGroup, Scene, Mesh, StandardMaterial, Color3, Vector3, MeshBuilder, EventState, ParticleSystem, Texture, Color4, Observable, Tags, Sound } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";
import { AssetManager } from "../AssetManager";
import { GameManager } from "../GameManager";
import { Enemy } from "../enemy/Enemy";

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
      console.warn("CharacterAnimationManager: Character mesh not available for spatial sound attachment");
    } else {
      console.log(`CharacterAnimationManager: Attaching footstep sounds to mesh at position ${characterMesh.getAbsolutePosition().toString()}`);
    }

    for (const file of soundFiles) {
      console.log(`CharacterAnimationManager: Attempting to load sound ${file}`);
      const sound = new Sound(
        `footstep_${file.split('/').pop()}`,
        file,
        this.scene,
        () => {
          console.log(`CharacterAnimationManager: Loaded footstep sound ${file} (spatial: true, attached: ${!!characterMesh})`);
          this.footstepSounds.push(sound);
          if (characterMesh) {
            sound.attachToMesh(characterMesh);
            console.log(`CharacterAnimationManager: Attached footstep sound ${file} to character mesh`);
          }
          if (this.footstepSounds.length === soundFiles.length) {
            console.log(`CharacterAnimationManager: Successfully loaded ${this.footstepSounds.length} footstep sounds`);
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
      console.warn("CharacterAnimationManager: Character mesh not available for Dreambolt sound preloading");
      return;
    }

    console.log("CharacterAnimationManager: Preloading castBolt2.wav");
    this.castBolt2Sound = new Sound(
      "castBoltSound",
      "./sfx/castBolt2.wav",
      this.scene,
      () => {
        console.log("CharacterAnimationManager: Cast bolt sound preloaded");
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

    console.log("CharacterAnimationManager: Preloading boltLaunch.wav");
    this.boltLaunchSound = new Sound(
      "boltLaunchSound",
      "./sfx/boltLaunch.wav",
      this.scene,
      () => {
        console.log("CharacterAnimationManager: Bolt launch sound preloaded");
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

    console.log("CharacterAnimationManager: Preloading bolt.wav");
    this.dreamboltSound = new Sound(
      "dreamboltSound",
      "./sfx/bolt2.mp3",
      this.scene,
      () => {
        console.log("CharacterAnimationManager: Dreambolt sound preloaded");
        // Will attach to sphere when played
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

  private setupJumpDetection(): void {
    if (this.getAnimationByName("Jump")) {
      this.getAnimationByName("Jump")!.onAnimationGroupEndObservable.add(() => {
        this.isJumping = false;
        this.currentAnimationName = null;
      });
    } else {
      console.warn("CharacterAnimationManager: Jump animation not found");
    }
  }

  private setupDreamboltDetection(): void {
    const dreamboltAnim = this.getAnimationByName("Dreambolt");
    if (dreamboltAnim) {
      console.log("CharacterAnimationManager: Dreambolt animation found, monitoring for 50% progress");
      dreamboltAnim.onAnimationGroupEndObservable.add(() => {
        this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
        console.log("CharacterAnimationManager: Dreambolt animation ended");
        if (this.castBolt2Sound) {
          this.castBolt2Sound.stop();
          console.log("CharacterAnimationManager: Cast bolt sound stopped on animation end");
        }
      });
    } else {
      console.warn("CharacterAnimationManager: Dreambolt animation not found");
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
        console.log("CharacterAnimationManager: Fireworks effect disposed");
      }, 5000);
    }, 1000);
  }

  private spawnDreamboltSphere(): void {
    if (!this.characterController) {
      console.error("CharacterAnimationManager: CharacterController not initialized");
      return;
    }

    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.error("CharacterAnimationManager: Character mesh not found");
      return;
    }

    if (!this.characterController.physicsController) {
      console.error("CharacterAnimationManager: PhysicsController not found");
      return;
    }

    console.log("CharacterAnimationManager: Spawning Dreambolt sphere");

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

    console.log(`CharacterAnimationManager: Sphere spawned at position: ${sphere.position.toString()}`);

    if (this.boltLaunchSound) {
      console.log("CharacterAnimationManager: Playing boltLaunch.wav");
      this.boltLaunchSound.play();
    } else {
      console.warn("CharacterAnimationManager: boltLaunchSound not preloaded");
    }

    if (this.dreamboltSound) {
      console.log("CharacterAnimationManager: Playing bolt.wav");
      if (sphere && !sphere.isDisposed()) {
        this.dreamboltSound.attachToMesh(sphere);
        this.dreamboltSound.play();
        console.log("CharacterAnimationManager: Dreambolt sound playing, attached to sphere");
      } else {
        console.warn("CharacterAnimationManager: Sphere disposed before dreambolt sound could be attached");
      }
    } else {
      console.warn("CharacterAnimationManager: dreamboltSound not preloaded");
    }

    let moveDirection: Vector3;
    if (this.targetingSystem && this.targetingSystem.getCurrentTarget() && this.targetingSystem.getCurrentTarget()!.getMesh()) {
      const target = this.targetingSystem.getCurrentTarget();
      const targetMesh = target!.getMesh()!;

      targetMesh.computeWorldMatrix(true);
      targetMesh.refreshBoundingInfo();
      const boundingBox = targetMesh.getBoundingInfo().boundingBox;

      const targetCenterY = (boundingBox.minimumWorld.y + boundingBox.maximumWorld.y) / 2;
      const targetPos = targetMesh.getAbsolutePosition();

      console.log(`CharacterAnimationManager: Target ${target!.getId()} bounding box: min=${boundingBox.minimumWorld.toString()}, max=${boundingBox.maximumWorld.toString()}, centerY=${targetCenterY}`);

      const adjustedTargetPos = new Vector3(targetPos.x, targetCenterY, targetPos.z);

      if (targetCenterY - boundingBox.minimumWorld.y < 0.5) {
        adjustedTargetPos.y = targetPos.y + 0.875;
        console.log(`CharacterAnimationManager: Warning: Target ${target!.getId()} bounding box midpoint too low, using fallback y=${adjustedTargetPos.y}`);
      }
      moveDirection = adjustedTargetPos.subtract(sphere.position);
      if (moveDirection.lengthSquared() > 0.0001) {
        moveDirection = moveDirection.normalize();
        console.log(`CharacterAnimationManager: Moving sphere toward target ${target!.getId()} at adjusted position: ${adjustedTargetPos.toString()}`);
      } else {
        moveDirection = forward;
        console.log(`CharacterAnimationManager: Target ${target!.getId()} is at same position as sphere, using forward direction`);
      }
    } else {
      moveDirection = forward;
      console.log("CharacterAnimationManager: No target or target mesh not found, moving sphere in character's forward direction");
    }

    const speed = 10;
    //const DREAMBOLT_DAMAGE = 40;
    const DREAMBOLT_MIN_DAMAGE = 20;
    const DREAMBOLT_MAX_DAMAGE = 40;

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
            console.log(`CharacterAnimationManager: Dreambolt hit enemy hitbox, id: ${enemyId}`);
            const enemy = this.gameManager?.getEnemies().find(e => e.getId() === enemyId);
            if (enemy) {
              this.triggerFireworks(sphere.position.clone());
              console.log(`CharacterAnimationManager: Triggered fireworks for Dreambolt hit on enemy ${enemyId}`);

              const damage = Math.floor(Math.random() * (DREAMBOLT_MAX_DAMAGE - DREAMBOLT_MIN_DAMAGE + 1)) + DREAMBOLT_MIN_DAMAGE;
              enemy.takeDamage(damage);
              console.log(`CharacterAnimationManager: Dealt ${damage} damage to enemy ${enemyId}, HP: ${enemy.getCurrentHP()}/${enemy.getMaxHP()}`);
              if (enemy.isDead()) {
                console.log(`CharacterAnimationManager: Enemy ${enemyId} defeated`);
              }

              particles.stop();
              particles.dispose();
              sphere.dispose();
              if (this.dreamboltSound) {
                this.dreamboltSound.stop();
                console.log("CharacterAnimationManager: Dreambolt sound stopped");
              }
              if (this.boltLaunchSound) {
                this.boltLaunchSound.stop();
                console.log("CharacterAnimationManager: Bolt launch sound stopped");
              }
              this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
              return;
            } else {
              console.warn(`CharacterAnimationManager: Enemy with id ${enemyId} not found in GameManager`);
            }
          }
        }
      }
    };

    this.scene.onBeforeRenderObservable.add(renderCallback);

    setTimeout(() => {
      if (sphere && !sphere.isDisposed()) {
        console.log("CharacterAnimationManager: Dreambolt sphere timed out, disposing");
        particles.stop();
        particles.dispose();
        sphere.dispose();
        if (this.dreamboltSound) {
          this.dreamboltSound.stop();
          console.log("CharacterAnimationManager: Dreambolt sound stopped due to timeout");
        }
        if (this.boltLaunchSound) {
          this.boltLaunchSound.stop();
          console.log("CharacterAnimationManager: Bolt launch sound stopped due to timeout");
        }
        this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
      }
    }, 5000);
  }

  public cancelDreambolt(): void {
    const dreamboltAnim = this.getAnimationByName("Dreambolt");
    if (dreamboltAnim && dreamboltAnim.isPlaying) {
      console.log("CharacterAnimationManager: Cancelling Dreambolt animation");
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
        console.log("CharacterAnimationManager: Cast bolt sound stopped on cancel");
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
    console.log(`CharacterAnimationManager: Attempting to play animation '${name}'`);
    const newAnim = this.getAnimationByName(name);
    if (!newAnim) {
      console.warn(`CharacterAnimationManager: Animation group '${name}' not found`);
      return;
    }

    if (this.characterController?.getPlayer().isPlayerDead() && name !== "Death" && name !== "Idle") {
      console.log(`CharacterAnimationManager: Skipping animation '${name}' because player is dead`);
      return;
    }

    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      this.footstepFrames = [];
      console.log("CharacterAnimationManager: Cleared previous footstep observer");
    }

    const walkingAnimations = ["Run", "RunBackwards", "RightStrafe", "StrafeLeft"];
    if (walkingAnimations.includes(name) && this.footstepSounds.length > 0) {
      const frameRange = (toFrame ?? newAnim.to) - (fromFrame ?? newAnim.from);
      this.footstepFrames = [
        (fromFrame ?? newAnim.from) + 0.25 * frameRange,
        (fromFrame ?? newAnim.from) + 0.75 * frameRange
      ];
      console.log(`CharacterAnimationManager: Set footstep sounds to play at frames ${this.footstepFrames} for animation '${name}'`);

      this.footstepObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;

          for (let i = 0; i < this.footstepFrames.length; i++) {
            const frame = this.footstepFrames[i];
            if (currentFrame >= frame && currentFrame < frame + 1) {
              const soundIndex = Math.floor(Math.random() * this.footstepSounds.length);
              this.footstepSounds[soundIndex].play();
              console.log(`CharacterAnimationManager: Played footstep sound ${soundIndex + 1} at frame ${currentFrame} for animation '${name}'`);
              if (newAnim.isStarted && (loop ?? true)) {
                this.footstepFrames[i] += frameRange;
                console.log(`CharacterAnimationManager: Shifted keyframe ${i} to ${this.footstepFrames[i]} for next loop`);
              }
            }
          }
        } else {
          this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
          this.footstepObserver = null;
          this.footstepFrames = [];
          console.log(`CharacterAnimationManager: Animation '${name}' stopped, removed footstep observer`);
        }
      });
    } else {
      console.log(`CharacterAnimationManager: No footstep sounds for animation '${name}' (walkingAnimations: ${walkingAnimations.includes(name)}, sounds loaded: ${this.footstepSounds.length})`);
    }

    if (name === "Dreambolt") {
      if (!this.characterController || !this.characterController.physicsController || !this.characterController.characterMeshLoader.getCharacterMesh()) {
        console.warn("CharacterAnimationManager: Cannot cast Dreambolt; missing characterController, physicsController, or character mesh");
        return;
      }

      const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh()!;
      const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
      const charPos = characterMesh.getAbsolutePosition();

      const target = this.targetingSystem?.getCurrentTarget();
      if (!target || !target.getMesh()) {
        console.warn("CharacterAnimationManager: Cannot cast Dreambolt; no target selected or target has no mesh");
        return;
      }

      const targetMesh = target.getMesh()!;
      const targetPos = targetMesh.getAbsolutePosition();
      const toTarget = targetPos.subtract(charPos).normalize();
      const dot = Vector3.Dot(forward, toTarget);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      console.log(`CharacterAnimationManager: Dreambolt target ${target.getId()} angle: ${angle * (180 / Math.PI)} deg`);

      if (angle > Math.PI / 2) {
        console.warn(`CharacterAnimationManager: Cannot cast Dreambolt; target ${target.getId()} is outside front 180° arc`);
        return;
      }

      if (this.castBolt2Sound) {
        console.log("CharacterAnimationManager: Playing castBolt2.wav");
        this.castBolt2Sound.play();
      } else {
        console.warn("CharacterAnimationManager: castBolt2Sound not preloaded");
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
      console.log(`CharacterAnimationManager: Animation '${name}' already playing, skipping`);
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
    console.log(`CharacterAnimationManager: Started animation '${name}'`);

    if (skipBlending) {
      if (prevAnim) prevAnim.stop();
      newAnim.setWeightForAllAnimatables(1);
      this.isBlending = false;
      console.log(`CharacterAnimationManager: Played '${name}' without blending (previous was Death)`);
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
          console.log(`CharacterAnimationManager: Blending complete for '${name}'`);
        }
      };

      this.blendFrameId = requestAnimationFrame(blendStep);
    }

    if (newAnim === this.getAnimationByName("Jump")) {
      this.isJumping = true;
      console.log("CharacterAnimationManager: Jump animation detected, isJumping set to true");
    }

    if (name === "Dreambolt") {
      this.dreamboltSpawned = false;
      this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress: 0 });
      console.log("CharacterAnimationManager: Dreambolt animation started");
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;
          const from = newAnim.from;
          const to = newAnim.to;
          const progress = (currentFrame - from) / (to - from);
          this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress });
          if (progress >= 0.5 && !this.dreamboltSpawned) {
            console.log("CharacterAnimationManager: Dreambolt animation reached 50%, spawning sphere");
            if (this.castBolt2Sound) {
              this.castBolt2Sound.stop();
              console.log("CharacterAnimationManager: Cast bolt sound stopped at 50% progress");
            }
            this.spawnDreamboltSphere();
            this.dreamboltSpawned = true;
            this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress: 0.5 });
            this.scene.onBeforeRenderObservable.remove(observer);
          }
        } else {
          console.log("CharacterAnimationManager: Dreambolt animation stopped or no animatables, removing observer");
          this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
          if (this.castBolt2Sound) {
            this.castBolt2Sound.stop();
            console.log("CharacterAnimationManager: Cast bolt sound stopped on animation stop");
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
      console.warn("CharacterAnimationManager: One or both animations not found for blending");
      return;
    }

    if (this.isBlending) {
      console.warn("CharacterAnimationManager: Already blending animations");
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
      console.log("CharacterAnimationManager: Cleared footstep observer in stopAllAnimations");
    }
    if (this.castBolt2Sound) {
      this.castBolt2Sound.stop();
      console.log("CharacterAnimationManager: Cast bolt sound stopped in stopAllAnimations");
    }
    if (this.dreamboltSound) {
      this.dreamboltSound.stop();
      console.log("CharacterAnimationManager: Dreambolt sound stopped in stopAllAnimations");
    }
    if (this.boltLaunchSound) {
      this.boltLaunchSound.stop();
      console.log("CharacterAnimationManager: Bolt launch sound stopped in stopAllAnimations");
    }
    this.currentAnimationName = null;
    this.dreamboltSpawned = false;
    console.log("CharacterAnimationManager: Stopped all animations, cleared blending state, and reset animatables");
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
    this.footstepSounds.forEach(sound => sound.dispose());
    this.footstepSounds = [];
    if (this.footstepObserver) {
      this.scene.onBeforeRenderObservable.remove(this.footstepObserver);
      this.footstepObserver = null;
      console.log("CharacterAnimationManager: Cleared footstep observer in dispose");
    }
    if (this.castBolt2Sound) {
      this.castBolt2Sound.stop();
      this.castBolt2Sound.dispose();
      this.castBolt2Sound = null;
      console.log("CharacterAnimationManager: Cast bolt sound stopped and disposed in dispose");
    }
    if (this.dreamboltSound) {
      this.dreamboltSound.stop();
      this.dreamboltSound.dispose();
      this.dreamboltSound = null;
      console.log("CharacterAnimationManager: Dreambolt sound stopped and disposed in dispose");
    }
    if (this.boltLaunchSound) {
      this.boltLaunchSound.stop();
      this.boltLaunchSound.dispose();
      this.boltLaunchSound = null;
      console.log("CharacterAnimationManager: Bolt launch sound stopped and disposed in dispose");
    }
    this.onDreamboltAnimationState.clear();
    console.log("CharacterAnimationManager: Disposed");
  }
}