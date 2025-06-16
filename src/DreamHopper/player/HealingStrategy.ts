import { Scene, Mesh, ParticleSystem, Sound, Vector3, Color4, Texture } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";
import { GameManager } from "../GameManager";
import { AbilityConfig, ParticleSystemConfig } from "./AbilityConfig";
import { AbilityStrategy } from "./AbilityStrategy";
import { Player } from "./Player";

export class HealingStrategy implements AbilityStrategy {
  public execute(
    ability: AbilityConfig,
    characterMesh: Mesh,
    forward: Vector3,
    target: { mesh: Mesh; id: string },
    scene: Scene,
    characterController: CharacterController,
    targetingSystem?: TargetingSystem,
    gameManager?: GameManager,
    sounds?: Map<string, Sound>,
    createParticleSystem?: (config: ParticleSystemConfig, emitter: Mesh | Vector3, name: string) => ParticleSystem,
    player?: Player
  ): void {
    const startTime = performance.now();
    console.log(`[Healing] Start: ${startTime - startTime}ms, Ability: ${ability.id}`);

    if (!ability.healing) {
      console.warn(`No healing config for ability ${ability.id}`);
      return;
    }

    try {
      // Mana deduction (assuming handled elsewhere in original context)
      if (ability.manaCost && player && !player.deductMana(ability.manaCost)) {
        console.warn(`Cannot apply ${ability.id}; insufficient mana (required: ${ability.manaCost}, available: ${player.getMana()})`);
        return;
      }
      console.log(`Deducted ${ability.manaCost} mana for ${ability.id} when healing applied`);

      const playerLevel = characterController.getPlayer().getLevel() || 1;
      const healAmount = ability.healing.baseHeal + (playerLevel - 1) * ability.healing.levelScaling;
      const healed = characterController.getPlayer().heal(healAmount);
      if (healed) {
        console.log(`HealingStrategy: Applied ${healAmount} healing to player (level ${playerLevel})`);
      } else {
        console.log(`HealingStrategy: Healing failed (player dead or at max HP)`);
      }

      let particles: ParticleSystem | null = null;
      if (ability.particles?.cast && createParticleSystem) {
        const particleStart = performance.now();
        console.log(`[Healing] Particle Start: ${particleStart - startTime}ms, Ability: ${ability.id}`);
        particles = createParticleSystem(ability.particles.cast, characterMesh, `${ability.id}_cast_particles`);
        particles.start();
        console.log(`[Healing] Particle End: ${performance.now() - particleStart}ms, Ability: ${ability.id}`);
      }

      let clonedSound: Sound | null = null;
      const castSound = sounds?.get(`${ability.id}_cast`);
      if (castSound && castSound.isReady() && !characterMesh.isDisposed()) {
        const soundStart = performance.now();
        console.log(`[Healing] Sound Start: ${soundStart - startTime}ms, Ability: ${ability.id}`);
        console.log(`HealingStrategy: Playing cast sound ${ability.id}_cast`);
        clonedSound = castSound.clone();
        if (clonedSound) {
          clonedSound.attachToMesh(characterMesh);
          clonedSound.play();
        }
        console.log(`[Healing] Sound End: ${performance.now() - soundStart}ms, Ability: ${ability.id}`);
      }

      setTimeout(() => {
        particles?.stop();
        particles?.dispose();
        clonedSound?.stop();
        clonedSound?.dispose();
      }, 1000);

      console.log(`[Healing] Completed: ${performance.now() - startTime}ms, Ability: ${ability.id}`);
    } catch (error) {
      console.error(`HealingStrategy: Failed to execute ${ability.id}:`, error);
    }
  }
}