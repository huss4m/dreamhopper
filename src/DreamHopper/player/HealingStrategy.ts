import { Scene, Mesh, ParticleSystem, Sound, Vector3, Color4, Texture } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";
import { GameManager } from "../GameManager";
import { AbilityConfig, ParticleSystemConfig } from "./AbilityConfig";
import { AbilityStrategy } from "./AbilityStrategy";
import { Player } from "./Player"; // New: Import Player

export class HealingStrategy implements AbilityStrategy {
  execute(
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
    player?: Player // New: Add player parameter
  ): void {
    if (!ability.healing) {
      console.warn(`No healing config for ability ${ability.id}`);
      return;
    }

    try {
      // New: Deduct mana before healing
      if (ability.manaCost && player && !player.deductMana(ability.manaCost)) {
        console.warn(`Cannot apply ${ability.id}; insufficient mana (required: ${ability.manaCost}, available: ${player.getMana()})`);
        return;
      }
      console.log(`Deducted ${ability.manaCost} mana for ${ability.id} when healing applied`);

      // Apply healing effect
      const playerLevel = characterController.getPlayer().getLevel() || 1;
      const healAmount = ability.healing.baseHeal + (playerLevel - 1) * ability.healing.levelScaling;
      const healed = characterController.getPlayer().heal(healAmount);
      if (healed) {
        console.log(`HealingStrategy: Applied ${healAmount} healing to player (level ${playerLevel})`);
      } else {
        console.log(`HealingStrategy: Healing failed (player dead or at max HP)`);
      }

      // Create cast particle system
      let particles: ParticleSystem | null = null;
      if (ability.particles?.cast && createParticleSystem) {
        particles = createParticleSystem(ability.particles.cast, characterMesh, `${ability.id}_cast_particles`);
        particles.start();
      }

      // Play cast sound
      let clonedSound: Sound | null = null;
      const castSound = sounds?.get(`${ability.id}_cast`);
      if (castSound && castSound.isReady() && !characterMesh.isDisposed()) {
        console.log(`HealingStrategy: Playing cast sound ${ability.id}_cast`);
        clonedSound = castSound.clone();
        if (clonedSound) {
          clonedSound.attachToMesh(characterMesh);
          clonedSound.play();
        }
      }

      // Clean up particles and sound
      setTimeout(() => {
        particles?.stop();
        particles?.dispose();
        clonedSound?.stop();
        clonedSound?.dispose();
      }, 1000); // Match animation duration
    } catch (error) {
      console.error(`HealingStrategy: Failed to execute ${ability.id}:`, error);
    }
  }
}