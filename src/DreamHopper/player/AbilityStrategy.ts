import { Scene, Mesh, Vector3, ParticleSystem, Sound } from "@babylonjs/core";
import { CharacterController } from "./CharacterController";
import { TargetingSystem } from "../TargetingSystem";
import { GameManager } from "../GameManager";
import { AbilityConfig, ParticleSystemConfig } from "./AbilityConfig";

export interface AbilityStrategy {
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
    createParticleSystem?: (config: ParticleSystemConfig, emitter: Mesh | Vector3, name: string) => ParticleSystem
  ): void;
}