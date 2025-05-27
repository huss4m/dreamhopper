import { AnimationGroup, Scene, Mesh, StandardMaterial, Color3, Vector3, MeshBuilder, EventState, ParticleSystem, Texture, Color4, Observable } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";

export class CharacterAnimationManager {
  private animationGroups: AnimationGroup[] = [];
  private currentAnimationName: string | null = null;
  private isJumping = false;
  private isBlending = false;
  private blendFrameId: number | null = null;
  private dreamboltSpawned = false;
  public onDreamboltAnimationState = new Observable<{ isPlaying: boolean, progress?: number }>();

  constructor(
    private scene: Scene,
    private characterController?: CharacterController,
    private targetingSystem?: TargetingSystem
  ) {}

  public initialize(animationGroups: AnimationGroup[]): void {
    this.animationGroups = animationGroups;
    console.log(`Initializing AnimationManager with ${animationGroups.length} animation groups:`, animationGroups.map(ag => ag.name));

    if (this.animationGroups.length < 6) {
      console.warn(`Expected at least 6 animation groups, found ${this.animationGroups.length}. Animations may not work as expected.`);
      return;
    }

    if (this.getAnimationByName("Idle")) {
      this.getAnimationByName("Idle")!.play(true);
      this.currentAnimationName = "Idle";
    } else {
      console.warn("Idle animation not found");
    }

    this.setupJumpDetection();
    this.setupDreamboltDetection();
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
      console.log("Dreambolt animation found, monitoring for 85% progress");
      dreamboltAnim.onAnimationGroupEndObservable.add(() => {
        this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
        console.log("Dreambolt animation ended, notified observers");
      });
    } else {
      console.warn("Dreambolt animation not found");
    }
  }

  private spawnDreamboltSphere(): void {
    if (!this.characterController) {
      console.error("CharacterController not provided to CharacterAnimationManager");
      return;
    }

    const characterMesh = this.characterController.getCharacter().colliderBox;
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
    material.diffuseColor = new Color3(0.9, 0.8, 1.0);
    material.emissiveColor = new Color3(0.2, 0.8, 1.0);
    sphere.material = material;
    sphere.isVisible = false;

    const boltParticles = new ParticleSystem("boltParticles", 1000, this.scene);
    boltParticles.particleTexture = new Texture("./Flare.png", this.scene);
    boltParticles.emitter = sphere;
    boltParticles.minEmitBox = Vector3.Zero();
    boltParticles.maxEmitBox = Vector3.Zero();
    boltParticles.color1 = new Color4(0.9, 0.2, 1.0, 1.0);
    boltParticles.color2 = new Color4(0.8, 0.5, 0.9, 0.6);
    boltParticles.colorDead = new Color4(0, 0, 0.2, 0.0);
    boltParticles.minSize = 0.3;
    boltParticles.maxSize = 0.7;
    boltParticles.minLifeTime = 0.15;
    boltParticles.maxLifeTime = 0.4;
    boltParticles.emitRate = 1200;
    boltParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
    boltParticles.gravity = Vector3.Zero();
    boltParticles.direction1 = Vector3.Zero();
    boltParticles.direction2 = Vector3.Zero();
    boltParticles.start();

    const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
    const spawnOffset = forward.add(new Vector3(0, 1.2, 0));
    const startPos = characterMesh.getAbsolutePosition().add(spawnOffset);
    sphere.position = startPos;
    sphere.checkCollisions = true;

    console.log(`Sphere spawned at position: ${sphere.position.toString()}`);

    let moveDirection: Vector3;
    let targetMesh: Mesh | null = null;
    if (this.targetingSystem && this.targetingSystem.getCurrentTarget() && this.targetingSystem.getCurrentTarget()!.getMesh()) {
      const target = this.targetingSystem.getCurrentTarget();
      targetMesh = target!.getMesh()!;

      targetMesh.computeWorldMatrix(true);
      targetMesh.refreshBoundingInfo();
      const boundingBox = targetMesh.getBoundingInfo().boundingBox;

      const targetCenterY = (boundingBox.minimumWorld.y + boundingBox.maximumWorld.y) / 2;
      const targetPos = targetMesh.getAbsolutePosition();

      console.log(`Target ${target!.getId()} bounding box: min=${boundingBox.minimumWorld.toString()}, max=${boundingBox.maximumWorld.toString()}, centerY=${targetCenterY}`);

      const adjustedTargetPos = new Vector3(targetPos.x, targetCenterY, targetPos.z);

      if (targetCenterY - boundingBox.minimumWorld.y < 0.5) {
        adjustedTargetPos.y = targetPos.y + 0.875;
        console.log(`Warning: Target ${target!.getId()} bounding box midpoint too low, using fallback y=${adjustedTargetPos.y}`);
      }
      moveDirection = adjustedTargetPos.subtract(sphere.position);
      if (moveDirection.lengthSquared() > 0.0001) {
        moveDirection = moveDirection.normalize();
        console.log(`Moving sphere toward target ${target!.getId()} at adjusted position: ${adjustedTargetPos.toString()}`);
        console.log(`Move direction: ${moveDirection.toString()}`);
      } else {
        moveDirection = forward;
        console.log(`Target ${target!.getId()} is at same position as sphere, using forward direction`);
      }
    } else {
      moveDirection = forward;
      console.log("No target or target mesh not found, moving sphere in character's forward direction");
    }

    const speed = 10;
    const maxDistance = 100;
    let traveledDistance = 0;

    const renderCallback = (eventData: Scene, eventState: EventState) => {
      const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));
      traveledDistance += moveDistance;

      console.log(`Sphere position: ${sphere.position.toString()}, traveled: ${traveledDistance}`);

      if (targetMesh) {
        targetMesh.computeWorldMatrix(true);
        targetMesh.refreshBoundingInfo();
        if (sphere.intersectsMesh(targetMesh, true)) {
          console.log(`Sphere hit target ${this.targetingSystem?.getCurrentTarget()?.getId() || 'unknown'}, disposing`);
          sphere.dispose();
          boltParticles.stop();
          boltParticles.dispose();
          this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
          return;
        }
        const childMeshes = targetMesh.getChildMeshes(false);
        for (const child of childMeshes) {
          if (child instanceof Mesh && sphere.intersectsMesh(child, true)) {
            console.log(`Sphere hit target child mesh ${child.name}, disposing`);
            sphere.dispose();
            boltParticles.stop();
            boltParticles.dispose();
            this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
            return;
          }
        }
      }

      if (traveledDistance >= maxDistance || sphere.intersectsMesh(characterMesh, false)) {
        console.log("Sphere disposed: reached max distance or collided with character");
        sphere.dispose();
        boltParticles.stop();
        boltParticles.dispose();
        this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
      } else {
        const meshes = this.scene.meshes.filter(m => m !== sphere && m !== characterMesh && m.checkCollisions);
        for (const mesh of meshes) {
          if (sphere.intersectsMesh(mesh, false)) {
            console.log(`Sphere collided with ${mesh.name}, disposing`);
            sphere.dispose();
            boltParticles.stop();
            boltParticles.dispose();
            this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
            break;
          }
        }
      }
    };

    this.scene.onBeforeRenderObservable.add(renderCallback);
  }

  public playAnimation(
    name: string,
    speed = 1.0,
    fromFrame?: number,
    toFrame?: number
  ): void {
    const newAnim = this.getAnimationByName(name);
    if (!newAnim) {
      console.warn(`Animation group '${name}' not found`);
      return;
    }

    if ((name === "Dreambolt" || name === "Jump") && this.currentAnimationName !== name) {
      const prevAnim = this.getAnimationByName(this.currentAnimationName || "");
      if (prevAnim) {
        prevAnim.stop();
        prevAnim.setWeightForAllAnimatables(0);
      }
    } else if (name === this.currentAnimationName && newAnim.isPlaying) {
      return;
    }

    if (this.blendFrameId !== null) {
      cancelAnimationFrame(this.blendFrameId);
      this.blendFrameId = null;
    }

    const prevAnim = this.getAnimationByName(this.currentAnimationName || "");

    if (prevAnim && name !== "Dreambolt" && name !== "Jump") {
      prevAnim.setWeightForAllAnimatables(0);
      prevAnim.stop();
    }

    newAnim.stop();
    newAnim.start(!(newAnim.name === "Jump" || newAnim.name === "Dreambolt"), speed, fromFrame ?? 0, toFrame ?? newAnim.to, false);
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

    if (newAnim === this.getAnimationByName("Jump")) {
      this.isJumping = true;
    }

    if (name === "Dreambolt") {
      this.dreamboltSpawned = false;
      this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress: 0 });
      console.log("Dreambolt animation started, notified observers");
      const observer = this.scene.onBeforeRenderObservable.add(() => {
        if (newAnim.isPlaying && newAnim.animatables.length > 0) {
          const animatable = newAnim.animatables[0];
          const currentFrame = animatable.masterFrame;
          const from = newAnim.from;
          const to = newAnim.to;
          const progress = (currentFrame - from) / (to - from);
          this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress });
          if (progress >= 0.5 && !this.dreamboltSpawned) {
            console.log("Dreambolt animation reached 85%, spawning sphere");
            this.spawnDreamboltSphere();
            this.dreamboltSpawned = true;
            this.onDreamboltAnimationState.notifyObservers({ isPlaying: true, progress: 0.85 });
            this.scene.onBeforeRenderObservable.remove(observer);
          }
        } else {
          console.log("Dreambolt animation stopped or no animatables, removing observer");
          this.onDreamboltAnimationState.notifyObservers({ isPlaying: false });
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

  hasAnimationEnded(name: string): boolean {
    const anim = this.getAnimationByName(name);
    return anim?.isPlaying === false;
  }

  getAnimationByName(name: string): AnimationGroup | undefined {
    return this.animationGroups.find(group => group.name === name);
  }

  public dispose(): void {
    this.animationGroups.forEach(group => group.dispose());
    this.animationGroups = [];
    this.onDreamboltAnimationState.clear();
    console.log("CharacterAnimationManager disposed");
  }
}