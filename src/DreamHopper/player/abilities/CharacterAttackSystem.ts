import { Scene, Mesh, ParticleSystem, Texture, Sound, Tags, Vector3, Color4 } from "@babylonjs/core";
import { CharacterController } from "../CharacterController";
import { TargetingSystem } from "../../TargetingSystem";
import { GameManager } from "../../GameManager";
import { AbilityConfig, AbilityType, ParticleSystemConfig } from "./AbilityConfig";
import { AssetsManager } from "@babylonjs/core";
import { AbilityStrategy } from "./AbilityStrategy";
import { RangedProjectileStrategy } from "./RangedProjectileStrategy";
import { HealingStrategy } from "./HealingStrategy";

export class CharacterAttackSystem {
  private abilities: Map<string, AbilityConfig> = new Map();
  public sounds: Map<string, Sound> = new Map();
  private scene: Scene;
  private strategies: Map<AbilityType, AbilityStrategy> = new Map();

  constructor(
    scene: Scene,
    private characterController: CharacterController,
    private targetingSystem?: TargetingSystem,
    private gameManager?: GameManager
  ) {
    this.scene = scene;
    this.strategies.set(AbilityType.RangedProjectile, new RangedProjectileStrategy());
    this.strategies.set(AbilityType.Healing, new HealingStrategy());
  }

  public async initialize(): Promise<void> {
    await this.loadAbilities();
    this.preloadSounds();
  }

  private async loadAbilities(): Promise<void> {
    const assetsManager = new AssetsManager(this.scene);
    const assetTask = assetsManager.addTextFileTask("abilities", "./abilities.json");
    await assetsManager.loadAsync();
    const abilities: AbilityConfig[] = JSON.parse(assetTask.text);
    abilities.forEach((ability) => this.abilities.set(ability.id, ability));
  }

  private preloadSounds(): void {
    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.warn("CharacterAttackSystem: Character mesh not available for sound preloading");
      return;
    }

    this.abilities.forEach((ability) => {
      const soundConfigs = ability.sounds || {};
      for (const [key, soundConfig] of Object.entries(soundConfigs)) {
        console.log(`CharacterAttackSystem: Preloading sound ${ability.id}_${key} with file ${soundConfig.file}`);
        const sound = new Sound(
          `${ability.id}_${key}`,
          soundConfig.file,
          this.scene,
          () => {
            console.log(`CharacterAttackSystem: Sound ${ability.id}_${key} preloaded successfully`);
            if (soundConfig.attachToMesh && !characterMesh.isDisposed()) {
              sound.attachToMesh(characterMesh);
            }
          },
          {
            autoplay: false,
            loop: soundConfig.loop,
            spatialSound: soundConfig.spatialSound,
            maxDistance: soundConfig.maxDistance / 2,
            volume: soundConfig.volume * 2,
          }
        );
        this.sounds.set(`${ability.id}_${key}`, sound);
      }
    });
  }

  private createParticleSystem(config: ParticleSystemConfig, emitter: Mesh | Vector3, name: string): ParticleSystem {
    const particles = new ParticleSystem(name, 1000, this.scene);
    particles.particleTexture = new Texture(config.texture, this.scene);
    particles.emitter = emitter;
    particles.minSize = config.minSize;
    particles.maxSize = config.maxSize;
    particles.minLifeTime = config.minLifeTime;
    particles.maxLifeTime = config.maxLifeTime;
    particles.emitRate = config.emitRate;
    particles.blendMode = config.blendMode;
    if (config.gravity) particles.gravity = new Vector3(config.gravity.x, config.gravity.y, config.gravity.z);
    if (config.direction1) particles.direction1 = new Vector3(config.direction1.x, config.direction1.y, config.direction1.z);
    if (config.direction2) particles.direction2 = new Vector3(config.direction2.x, config.direction2.y, config.direction2.z);
    if (config.minEmitBox) particles.minEmitBox = new Vector3(config.minEmitBox.x, config.minEmitBox.y, config.minEmitBox.z);
    if (config.maxEmitBox) particles.maxEmitBox = new Vector3(config.maxEmitBox.x, config.maxEmitBox.y, config.minEmitBox!.z);
    if (config.minAngularSpeed) particles.minAngularSpeed = config.minAngularSpeed;
    if (config.maxAngularSpeed) particles.maxAngularSpeed = config.maxAngularSpeed;
    if (config.minEmitPower) particles.minEmitPower = config.minEmitPower;
    if (config.maxEmitPower) particles.maxEmitPower = config.maxEmitPower;
    if (config.updateSpeed) particles.updateSpeed = config.updateSpeed;
    particles.color1 = new Color4(config.color1.r, config.color1.g, config.color1.b, config.color1.a);
    particles.color2 = new Color4(config.color2.r, config.color2.g, config.color2.b, config.color2.a);
    particles.colorDead = new Color4(config.colorDead.r, config.colorDead.g, config.colorDead.b, config.colorDead.a);
    return particles;
  }

  public triggerAbility(abilityId: string): void {
  const startTime = performance.now();
  console.log(`[Attack] Start: ${startTime - startTime}ms, Ability: ${abilityId}`);
  const ability = this.abilities.get(abilityId);
  if (!ability) {
    console.warn(`Ability ${abilityId} not found`);
    return;
  }

  const strategy = this.strategies.get(ability.type);
  if (!strategy) {
    console.warn(`No strategy found for ability type: ${ability.type}`);
    return;
  }

  const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
  if (!characterMesh || !this.characterController.physicsController) {
    console.warn(`Cannot trigger ${abilityId}; missing character mesh or physics controller`);
    return;
  }

  const player = this.characterController.getPlayer();

  const strategyStartTime = performance.now();
  console.log(`[Attack] Strategy Start: ${strategyStartTime - startTime}ms, Ability: ${abilityId}`);
  if (ability.type === AbilityType.Healing) {
    strategy.execute(
      ability,
      characterMesh,
      Vector3.Zero(),
      { mesh: characterMesh, id: "player" },
      this.scene,
      this.characterController,
      this.targetingSystem,
      this.gameManager,
      this.sounds,
      this.createParticleSystem.bind(this),
      player
    );
  } else {
    const forward = this.characterController.physicsController.forwardDirection.scale(-1).normalize();
    const currentTarget = this.targetingSystem?.getCurrentTarget();
    if (!currentTarget || !currentTarget.getMesh()) {
      console.warn(`Cannot trigger ${abilityId}; no target selected or target has no mesh`);
      return;
    }

    const targetMesh = currentTarget.getMesh()!;
    const targetPos = targetMesh.getAbsolutePosition();
    const charPos = characterMesh.getAbsolutePosition();
    const toTarget = targetPos.subtract(charPos).normalize();
    const dot = Vector3.Dot(forward, toTarget);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle > Math.PI / 2) {
      console.warn(`Cannot trigger ${abilityId}; target is outside front 180° arc`);
      return;
    }

    strategy.execute(
      ability,
      characterMesh,
      forward,
      { mesh: targetMesh, id: currentTarget.getId() },
      this.scene,
      this.characterController,
      this.targetingSystem,
      this.gameManager,
      this.sounds,
      this.createParticleSystem.bind(this),
      player
    );
  }
  console.log(`[Attack] Strategy End: ${performance.now() - strategyStartTime}ms, Ability: ${abilityId}`);
  console.log(`[Attack] Completed: ${performance.now() - startTime}ms, Ability: ${abilityId}`);
}

  public stopSounds(abilityId?: string): void {
    const startTime = performance.now();
    if (abilityId) {
      // Stop only sounds for the specific ability
      this.sounds.forEach((sound, key) => {
        if (key.startsWith(`${abilityId}_`) && sound.isPlaying) {
          sound.stop();
          if (key.endsWith("_cast_active")) {
            sound.dispose();
            this.sounds.delete(key);
          }
        }
      });
    } else {
      // Fallback: stop all playing sounds
      this.sounds.forEach((sound, key) => {
        if (sound.isPlaying) {
          sound.stop();
          if (key.endsWith("_cast_active")) {
            sound.dispose();
            this.sounds.delete(key);
          }
        }
      });
    }
    console.log(`CharacterAttackSystem: stopSounds for ${abilityId || 'all'} took ${performance.now() - startTime}ms`);
  }

  public dispose(): void {
    this.stopSounds();
    this.sounds.forEach((sound) => sound.dispose());
    this.sounds.clear();
  }
}