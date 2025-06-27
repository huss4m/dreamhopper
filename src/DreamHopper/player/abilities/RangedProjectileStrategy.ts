import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Color4, ParticleSystem, Vector3, Sound, Tags } from "@babylonjs/core";
import { CharacterController } from "../CharacterController";
import { TargetingSystem } from "../../TargetingSystem";
import { GameManager } from "../../GameManager";
import { AbilityConfig, ParticleSystemConfig } from "./AbilityConfig";
import { AbilityStrategy } from "./AbilityStrategy";
import { Player } from "../Player"; 

export class RangedProjectileStrategy implements AbilityStrategy {
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
    player?: Player 
  ): void {
    if (!ability.projectile) {
      console.warn(`No projectile config for ability ${ability.id}`);
      return;
    }

    const spawnOffset = forward.add(new Vector3(0, 1.2, 0));
    const startPos = characterMesh.getAbsolutePosition().add(spawnOffset);

    const sphere = MeshBuilder.CreateSphere(`${ability.id}_projectile`, { diameter: ability.projectile.diameter }, scene);


    if (ability.manaCost && player && !player.deductMana(ability.manaCost)) {
      console.warn(`Cannot spawn ${ability.id} projectile; insufficient mana (required: ${ability.manaCost}, available: ${player.getMana()})`);
      sphere.dispose();
      return;
    }
    console.log(`Deducted ${ability.manaCost} mana for ${ability.id} when projectile appeared`);

    const material = new StandardMaterial(`${ability.id}_mat`, scene);
    material.diffuseColor = new Color3(
      ability.projectile.material.diffuseColor.r,
      ability.projectile.material.diffuseColor.g,
      ability.projectile.material.diffuseColor.b
    );
    material.emissiveColor = new Color3(
      ability.projectile.material.emissiveColor.r,
      ability.projectile.material.emissiveColor.g,
      ability.projectile.material.emissiveColor.b
    );
    material.alpha = ability.projectile.material.alpha;
    material.specularPower = ability.projectile.material.specularPower;
    material.backFaceCulling = ability.projectile.material.backFaceCulling;
    sphere.material = material;
    sphere.position = startPos;
    sphere.checkCollisions = true;

    let particles: ParticleSystem | null = null;
    if (ability.particles?.projectile && createParticleSystem) {
      particles = createParticleSystem(ability.particles.projectile, sphere, `${ability.id}_projectile_particles`);
      particles.start();
    }

    let travelSound: Sound | null = null;
    const originalTravelSound = sounds?.get(`${ability.id}_travel`);
    if (originalTravelSound && !sphere.isDisposed()) {
      travelSound = originalTravelSound.clone();
      if (travelSound) {
        travelSound.attachToMesh(sphere);
        travelSound.play();
      }
    }

    const launchSound = sounds?.get(`${ability.id}_launch`);
    if (launchSound && launchSound.isReady()) {
      console.log(`RangedProjectileStrategy: Playing launch sound ${ability.id}_launch`);
      launchSound.play();
    }

    const moveDirection = target.mesh.getAbsolutePosition().subtract(sphere.position).normalize();

    const playerLevel = characterController.getPlayer().getLevel() || 1;
    const minDamage = ability.damage!.min + (playerLevel - 1) * ability.damage!.levelScaling;
    const maxDamage = ability.damage!.max + (playerLevel - 1) * ability.damage!.levelScaling;

    const renderCallback = () => {
      const deltaTime = scene.getEngine().getDeltaTime() / 1000;
      const moveDistance = ability.projectile!.speed * deltaTime;
      sphere.position.addInPlace(moveDirection.scale(moveDistance));

      const hitboxes = scene.meshes.filter((mesh) => Tags.MatchesQuery(mesh, "hitbox"));
      for (const hitbox of hitboxes) {
        if (sphere.intersectsMesh(hitbox, true)) {
          const tags = Tags.GetTags(hitbox);
          const enemyId = tags?.split(" ").find((tag: string) => tag.startsWith("enemyID:"))?.split(":")[1];
          if (enemyId) {
            const enemy = gameManager?.getEnemies().find((e) => e.getId() === enemyId);
            if (enemy) {
              if (ability.particles?.impact && createParticleSystem) {
                const impactParticles = createParticleSystem(
                  ability.particles.impact,
                  sphere.position.clone(),
                  `${ability.id}_impact_particles`
                );
                impactParticles.start();
                setTimeout(() => {
                  impactParticles.stop();
                  impactParticles.dispose();
                }, 1000);
              }

              let impactSound: Sound | null = null;
              const originalImpactSound = sounds?.get(`${ability.id}_impact`);
              if (originalImpactSound && !hitbox.isDisposed()) {
                impactSound = originalImpactSound.clone();
                if (impactSound) {
                  impactSound.attachToMesh(hitbox);
                  impactSound.play();
                }
              }

              const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
              enemy.takeDamage(damage);

              particles?.stop();
              particles?.dispose();
              sphere.dispose();
              travelSound?.stop();
              travelSound?.dispose();
              launchSound?.stop();
              const activeCastSound = sounds?.get(`${ability.id}_cast_active`);
              if (activeCastSound) {
                activeCastSound.stop();
                activeCastSound.dispose();
                sounds?.delete(`${ability.id}_cast_active`);
              }
              if (impactSound) {
                const soundDuration = impactSound.getAudioBuffer()?.duration || 1;
                setTimeout(() => {
                  impactSound?.stop();
                  impactSound?.dispose();
                }, soundDuration * 1000);
              }
              scene.onBeforeRenderObservable.removeCallback(renderCallback);
              return;
            }
          }
        }
      }
    };

    scene.onBeforeRenderObservable.add(renderCallback);
    setTimeout(() => {
      if (sphere && !sphere.isDisposed()) {
        particles?.stop();
        particles?.dispose();
        sphere.dispose();
        travelSound?.stop();
        travelSound?.dispose();
        launchSound?.stop();
        const activeCastSound = sounds?.get(`${ability.id}_cast_active`);
        if (activeCastSound) {
          activeCastSound.stop();
          activeCastSound.dispose();
          sounds?.delete(`${ability.id}_cast_active`);
        }
        scene.onBeforeRenderObservable.removeCallback(renderCallback);
      }
    }, ability.projectile!.lifetime);
  }
}