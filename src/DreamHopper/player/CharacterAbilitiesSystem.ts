import { Color3, Color4, Mesh, MeshBuilder, ParticleSystem, Scene, Sound, StandardMaterial, Tags, Texture, Vector3 } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { CharacterAnimationManager } from "./CharacterAnimationManager";
import { TargetingSystem } from "../TargetingSystem";
import { Player } from "./Player";
import { Ability } from "./AbilityTypes";
import { Enemy } from "../enemy/Enemy";
import { GameManager } from "../GameManager";

export class CharacterAbilitySystem {
  private scene: Scene;
  private characterController: CharacterController;
  private targetingSystem: TargetingSystem;
  private animationManager: CharacterAnimationManager;
  private player: Player;
  private gameManager: GameManager;
  private abilities: Map<string, Ability> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private abilitySounds: Map<string, Sound[]> = new Map();
  private abilityParticles: Map<string, ParticleSystem[]> = new Map();
  private abilityMeshes: Map<string, Mesh[]> = new Map(); 

  constructor(
    scene: Scene,
    characterController: CharacterController,
    targetingSystem: TargetingSystem,
    animationManager: CharacterAnimationManager,
    player: Player,
    gameManager: GameManager
  ) {
    this.scene = scene;
    this.characterController = characterController;
    this.targetingSystem = targetingSystem;
    this.animationManager = animationManager;
    this.player = player;
    this.gameManager = gameManager;
    this.loadAbilities();
  }

  private async loadAbilities(): Promise<void> {
    try {
      const response = await fetch("./abilities.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch abilities.json: ${response.status}`);
      }
      const data: { abilities: Ability[] } = await response.json();
      data.abilities.forEach((ability: Ability) => {
        this.abilities.set(ability.id, ability);
      });
      console.log(`Loaded ${this.abilities.size} abilities:`, Array.from(this.abilities.keys()));
    } catch (error) {
      console.error("Failed to load abilities:", error);
    }
  
  }

   public async useAbility(abilityId: string): Promise<boolean> {
    const ability = this.abilities.get(abilityId);
    if (!ability) {
      console.warn(`Ability not found: ${abilityId}`);
      return false;
    }

    const cooldown = this.cooldowns.get(abilityId) || 0;
    if (cooldown > 0) {
      console.log(`Ability ${abilityId} on cooldown: ${cooldown.toFixed(2)}s remaining`);
      return false;
    }

    if (this.player.getMana() < ability.manaCost) {
      console.log(`Insufficient mana for ${abilityId}: ${this.player.getMana()}/${ability.manaCost}`);
      return false;
    }

    // Deduct mana
    if (!this.player.deductMana(ability.manaCost)) {
      console.warn(`Failed to deduct mana for ${abilityId}`);
      return false;
    }

    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (!characterMesh) {
      console.warn(`No character mesh for ${abilityId} effects`);
      return false;
    }

    // Play animation if defined
    if (ability.animation) {
      try {
        this.animationManager.playAnimation(
          ability.animation.name,
          ability.animation.speed,
          undefined,
          undefined,
          ability.animation.loop
        );
        console.log(`Playing animation for ${abilityId}: ${ability.animation.name}`);
      } catch (error) {
        console.warn(`Failed to play animation ${ability.animation.name} for ${abilityId}:`, error);
      }
    }

    // Play sounds if defined
    const sounds: Sound[] = [];
    if (ability.sounds && ability.sounds.length > 0) {
      ability.sounds.forEach((soundConfig) => {
        try {
          const sound = new Sound(
            `${abilityId}_${soundConfig.id}`,
            soundConfig.file,
            this.scene,
            () => {
              if (characterMesh && soundConfig.spatial) {
                sound.attachToMesh(characterMesh);
              }
              sound.setVolume(soundConfig.volume);
              if (soundConfig.maxDistance && soundConfig.spatial) {
                sound.maxDistance = soundConfig.maxDistance;
              }
              sound.play();
              console.log(`Playing sound ${soundConfig.id} for ${abilityId}`);
            },
            {
              loop: soundConfig.loop,
              autoplay: false,
              spatialSound: soundConfig.spatial,
            }
          );
          sounds.push(sound);
        } catch (error) {
          console.warn(`Failed to load/play sound ${soundConfig.id} for ${abilityId}:`, error);
        }
      });
      this.abilitySounds.set(abilityId, sounds);
    }

    // Execute gameplay effects
    if (ability.effects && ability.effects.length > 0) {
      const healEffects = ability.effects.filter((effect) => effect.type === "heal");
      const damageEffects = ability.effects.filter((effect) => effect.type === "damage");
      const particleEffects = ability.effects.filter((effect) => effect.type === "particle");

      // Apply heal effects
      healEffects.forEach((effect, index) => {
        if (effect.target === "self") {
          try {
            const playerLevel = this.player.getLevel() || 1;
            const healAmount = effect.baseAmount! + (playerLevel - 1) * effect.levelScaling!;
            if (this.player.heal(healAmount)) {
              console.log(`Applied heal effect ${index} for ${abilityId}: ${healAmount} to player`);
            } else {
              console.warn(`Failed to apply heal effect ${index} for ${abilityId}: Player at max health or dead`);
            }
          } catch (error) {
            console.warn(`Failed to apply heal effect ${index} for ${abilityId}:`, error);
          }
        }
      });

      // Handle damage effects (Dreambolt projectile)
      if (abilityId === "dreambolt" && damageEffects.length > 0) {
        const damageEffect = damageEffects[0]; // Assume first damage effect
        if (damageEffect.target === "enemy") {
          try {
            const forward = this.characterController.physicsController?.forwardDirection.scale(-1).normalize() || Vector3.Forward();
            const charPos = characterMesh.getAbsolutePosition();
            let moveDirection = forward;
            let targetMesh: Mesh | null = null;

            // Check target validity
            const target = this.targetingSystem.getCurrentTarget();
            if (target && target instanceof Enemy && target.getMesh()) {
              targetMesh = target.getMesh()!;
              const toTarget = targetMesh.getAbsolutePosition().subtract(charPos).normalize();
              const dot = Vector3.Dot(forward, toTarget);
              const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
              if (angle > Math.PI / 2) {
                console.warn(`Target ${target.getId()} is outside front 180° arc for ${abilityId}`);
                return false;
              }
              targetMesh.computeWorldMatrix(true);
              targetMesh.refreshBoundingInfo();
              const boundingBox = targetMesh.getBoundingInfo().boundingBox;
              const targetMidpoint = boundingBox.minimumWorld.add(boundingBox.maximumWorld).scale(0.5);
              moveDirection = targetMidpoint.subtract(charPos).normalize();
            }

            // Spawn projectile
            const spawnOffset = forward.add(new Vector3(0, 1.2, 0));
            const startPos = charPos.add(spawnOffset);
            const sphere = MeshBuilder.CreateSphere(`${abilityId}_projectile`, { diameter: 0.5 }, this.scene);
            const material = new StandardMaterial(`${abilityId}_mat`, this.scene);
            material.diffuseColor = new Color3(1.0, 0.85, 0.9);
            material.emissiveColor = new Color3(1.0, 0.95, 0.97);
            material.alpha = 0.8;
            material.specularPower = 0;
            material.backFaceCulling = false;
            sphere.material = material;
            sphere.position = startPos;
            sphere.checkCollisions = true;

            // Projectile particles
            const projectileParticle = particleEffects.find(e => e.trigger === "onCast" && e.particleSystem?.texture === "./Flare.png");
            let particles: ParticleSystem | null = null;
            if (projectileParticle?.particleSystem) {
              particles = new ParticleSystem(`${abilityId}_projectile_particles`, 1000, this.scene);
              particles.particleTexture = new Texture(projectileParticle.particleSystem.texture, this.scene);
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
            }

            // Projectile sound (bolt2.mp3)
            let sphereDreamboltSound: Sound | null = null;
            const bolt2SoundConfig = ability.sounds?.find(s => s.file === "./sfx/bolt2.mp3");
            if (bolt2SoundConfig) {
              sphereDreamboltSound = new Sound(
                `${abilityId}_bolt2`,
                bolt2SoundConfig.file,
                this.scene,
                () => {
                  if (sphere && !sphere.isDisposed()) {
                    sphereDreamboltSound!.attachToMesh(sphere);
                    sphereDreamboltSound!.play();
                  }
                },
                { loop: true, autoplay: false, spatialSound: true, maxDistance: 50, volume: bolt2SoundConfig.volume }
              );
            }

            // Play launch sound (boltLaunch.wav)
            const boltLaunchSoundConfig = ability.sounds?.find(s => s.file === "./sfx/boltLaunch.wav");
            if (boltLaunchSoundConfig) {
              sounds.push(new Sound(
                `${abilityId}_boltLaunch`,
                boltLaunchSoundConfig.file,
                this.scene,
                () => {
                  if (characterMesh) {
                    sounds[sounds.length - 1].attachToMesh(characterMesh);
                    sounds[sounds.length - 1].play();
                  }
                },
                { loop: false, autoplay: false, spatialSound: true, maxDistance: 50, volume: boltLaunchSoundConfig.volume }
              ));
            }

            // Track resources
            const meshes = [sphere];
            this.abilityMeshes.set(abilityId, meshes);
            if (particles) {
              this.abilityParticles.set(abilityId, [particles]);
            }
            this.abilitySounds.set(abilityId, sounds.concat(sphereDreamboltSound ? [sphereDreamboltSound] : []));

            // Projectile movement
            const speed = 10;
            const playerLevel = this.player.getLevel() || 1;
            const minDamage = damageEffect.minBase! + (playerLevel - 1) * damageEffect.levelScaling!;
            const maxDamage = damageEffect.maxBase! + (playerLevel - 1) * damageEffect.levelScaling!;

            const renderCallback = () => {
              if (sphere.isDisposed()) return;
              const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
              const moveDistance = speed * deltaTime;
              sphere.position.addInPlace(moveDirection.scale(moveDistance));

              const hitboxes = this.scene.meshes.filter(mesh => Tags.MatchesQuery(mesh, "hitbox"));
              for (const hitbox of hitboxes) {
                if (sphere.intersectsMesh(hitbox, true)) {
                  const tags = Tags.GetTags(hitbox);
                  const enemyId = tags?.split(" ").find((tag: string) => tag.startsWith("enemyID:"))?.split(":")[1];
                  if (enemyId) {
                    const target = this.gameManager.getEnemies().find(e => e.getId() === enemyId);
                    if (target) {
                      // Apply damage
                      const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
                      target.takeDamage(damage);
                      console.log(`Applied damage for ${abilityId}: ${damage} to enemy ${target.getId()}`);

                      // Fireworks on hit
                      const hitParticle = particleEffects.find(e => e.trigger === "onHit" && e.particleSystem?.texture === "./star_1.png");
                      if (hitParticle?.particleSystem) {
                        const fireworks = new ParticleSystem(`${abilityId}_fireworks`, 2000, this.scene);
                        fireworks.particleTexture = new Texture(hitParticle.particleSystem.texture, this.scene);
                        fireworks.emitter = sphere.position.clone();
                        fireworks.minEmitBox = Vector3.Zero();
                        fireworks.maxEmitBox = Vector3.Zero();
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
                        this.abilityParticles.get(abilityId)?.push(fireworks);
                      }

                      // Impact sound
                      const impactSoundConfig = ability.sounds?.find(s => s.file === "./sfx/impactchime.wav");
                      if (impactSoundConfig) {
                        const impactSound = new Sound(
                          `${abilityId}_impact`,
                          impactSoundConfig.file,
                          this.scene,
                          () => {
                            if (target.getMesh() && !target.getMesh()!.isDisposed()) {
                              impactSound.attachToMesh(target.getMesh()!);
                              impactSound.play();
                            }
                          },
                          { loop: false, autoplay: false, spatialSound: true, maxDistance: 50, volume: impactSoundConfig.volume }
                        );
                        this.abilitySounds.get(abilityId)?.push(impactSound);
                        setTimeout(() => {
                          if (impactSound) {
                            impactSound.stop();
                            impactSound.dispose();
                          }
                        }, (impactSound.getAudioBuffer()?.duration || 1) * 1000);
                      }

                      // Cleanup
                      if (particles) {
                        particles.stop();
                        particles.dispose();
                      }
                      if (sphereDreamboltSound) {
                        sphereDreamboltSound.stop();
                        sphereDreamboltSound.dispose();
                      }
                      sphere.dispose();
                      this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
                      return;
                    }
                  }
                }
              }
            };

            this.scene.onBeforeRenderObservable.add(renderCallback);

            // Timeout after 5s
            setTimeout(() => {
              if (!sphere.isDisposed()) {
                if (particles) {
                  particles.stop();
                  particles.dispose();
                }
                if (sphereDreamboltSound) {
                  sphereDreamboltSound.stop();
                  sphereDreamboltSound.dispose();
                }
                sphere.dispose();
                this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
              }
            }, 5000);
          } catch (error) {
            console.warn(`Failed to execute projectile for ${abilityId}:`, error);
            return false;
          }
        }
      } else {
        // Non-projectile damage effects (if any)
        damageEffects.forEach((effect, index) => {
          if (effect.target === "enemy") {
            try {
              const target = this.targetingSystem.getCurrentTarget();
              if (!target) {
                console.warn(`No target selected for damage effect ${index} of ${abilityId}`);
                return;
              }
              if (target instanceof Enemy) {
                const playerLevel = this.player.getLevel() || 1;
                const minDamage = effect.minBase! + (playerLevel - 1) * effect.levelScaling!;
                const maxDamage = effect.maxBase! + (playerLevel - 1) * effect.levelScaling!;
                const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
                target.takeDamage(damage);
                console.log(`Applied damage effect ${index} for ${abilityId}: ${damage} to enemy ${target.getId()}`);
              } else {
                console.warn(`Target ${target.getId()} is not an Enemy for damage effect ${index} of ${abilityId}`);
              }
            } catch (error) {
              console.warn(`Failed to apply damage effect ${index} for ${abilityId}:`, error);
            }
          }
        });
      }

      // On-cast particle effects (non-projectile, e.g., Heal)
      const onCastEffects = particleEffects.filter((effect) => effect.trigger === "onCast" && effect.particleSystem?.texture !== "./Flare.png");
      const particleSystems: ParticleSystem[] = [];
      onCastEffects.forEach((effect, index) => {
        if (effect.particleSystem) {
          try {
            const ps = new ParticleSystem(`${abilityId}_particle_${index}`, 2000, this.scene);
            ps.particleTexture = new Texture(effect.particleSystem.texture, this.scene);
            ps.emitter = characterMesh;
            ps.emitRate = effect.particleSystem.emitRate;
            ps.minSize = effect.particleSystem.minSize;
            ps.maxSize = effect.particleSystem.maxSize;
            ps.minLifeTime = effect.particleSystem.minLifeTime;
            ps.maxLifeTime = effect.particleSystem.maxLifeTime;
            ps.color1 = new Color4(...effect.particleSystem.color1);
            ps.color2 = new Color4(...effect.particleSystem.color2);
            ps.colorDead = new Color4(...effect.particleSystem.colorDead);
            ps.blendMode =
              effect.particleSystem.blendMode === "BLENDMODE_ADD"
                ? ParticleSystem.BLENDMODE_ADD
                : ParticleSystem.BLENDMODE_STANDARD;

            if (effect.particleSystem.gravity) {
              ps.gravity = new Vector3(...effect.particleSystem.gravity);
            }
            if (effect.particleSystem.direction1 && effect.particleSystem.direction2) {
              ps.direction1 = new Vector3(...effect.particleSystem.direction1);
              ps.direction2 = new Vector3(...effect.particleSystem.direction2);
            }
            if (effect.particleSystem.minAngularSpeed && effect.particleSystem.maxAngularSpeed) {
              ps.minAngularSpeed = effect.particleSystem.minAngularSpeed;
              ps.maxAngularSpeed = effect.particleSystem.maxAngularSpeed;
            }
            if (effect.particleSystem.minEmitPower && effect.particleSystem.maxEmitPower) {
              ps.minEmitPower = effect.particleSystem.minEmitPower;
              ps.maxEmitPower = effect.particleSystem.maxEmitPower;
            }

            ps.start();
            const duration = effect.particleSystem.duration ?? 1000;
            setTimeout(() => {
              if (ps) {
                ps.stop();
                setTimeout(() => {
                  if (ps) {
                    ps.dispose();
                  }
                }, 5000);
              }
            }, duration);

            particleSystems.push(ps);
            console.log(`Started particle system ${index} for ${abilityId} with duration ${duration}ms`);
          } catch (error) {
            console.warn(`Failed to create particle system ${index} for ${abilityId}:`, error);
          }
        }
      });

      if (particleSystems.length > 0) {
        this.abilityParticles.set(abilityId, (this.abilityParticles.get(abilityId) || []).concat(particleSystems));
      }
    }

    // Set cooldown
    this.cooldowns.set(abilityId, ability.cooldown);

    console.log(`Used ability: ${abilityId}`);
    return true;
  }



  public update(deltaTime: number): void {
    this.cooldowns.forEach((cooldown, abilityId) => {
      if (cooldown > 0) {
        const newCooldown = Math.max(0, cooldown - deltaTime);
        this.cooldowns.set(abilityId, newCooldown);
        if (newCooldown === 0) {
          console.log(`Ability ${abilityId} off cooldown`);
        }
      }
    });
  }


  public dispose(): void {
    // Clean up sounds
    this.abilitySounds.forEach((sounds) => {
      sounds.forEach((sound) => sound.dispose());
    });
    this.abilitySounds.clear();

    // Clean up particle systems
    this.abilityParticles.forEach((systems) => {
      systems.forEach((ps) => {
        ps.stop();
        ps.dispose();
      });
    });

    this.abilityMeshes.forEach((meshes) => {
      meshes.forEach((mesh) => {
        if (!mesh.isDisposed()) {
          mesh.dispose();
        }
      });
    });
    this.abilityParticles.clear();
  
  }
}