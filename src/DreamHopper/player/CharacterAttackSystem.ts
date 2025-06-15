import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Color4, ParticleSystem, Texture, Sound, Tags, Vector3 } from "@babylonjs/core";
   import { CharacterController } from "./CharacterController";
   import { TargetingSystem } from "../TargetingSystem";
   import { GameManager } from "../GameManager";
   import { Enemy } from "../enemy/Enemy";
   import { AbilityConfig, AbilityType, AbilitySoundConfig, ParticleSystemConfig, ProjectileConfig } from "./AbilityConfig";
   import { AssetsManager } from "@babylonjs/core";

   export class CharacterAttackSystem {
     private abilities: Map<string, AbilityConfig> = new Map();
     public sounds: Map<string, Sound> = new Map();
     private scene: Scene;

     constructor(
       scene: Scene,
       private characterController: CharacterController,
       private targetingSystem?: TargetingSystem,
       private gameManager?: GameManager
     ) {
       this.scene = scene;
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
       abilities.forEach(ability => this.abilities.set(ability.id, ability));
     }

     private preloadSounds(): void {
       const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
       if (!characterMesh) {
         console.warn("CharacterAttackSystem: Character mesh not available for sound preloading");
         return;
       }

       this.abilities.forEach(ability => {
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
       const ability = this.abilities.get(abilityId);
       if (!ability) {
         console.warn(`Ability ${abilityId} not found`);
         return;
       }

       if (ability.type !== AbilityType.RangedProjectile) {
         console.warn(`Unsupported ability type: ${ability.type}`);
         return;
       }

       const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
       if (!characterMesh || !this.characterController.physicsController) {
         console.warn(`Cannot trigger ${abilityId}; missing character mesh or physics controller`);
         return;
       }

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

       this.executeRangedProjectile(ability, characterMesh, forward, { mesh: targetMesh, id: currentTarget.getId() });
     }

     private executeRangedProjectile(ability: AbilityConfig, characterMesh: Mesh, forward: Vector3, target: { mesh: Mesh; id: string }): void {
       if (!ability.projectile) return;

       const spawnOffset = forward.add(new Vector3(0, 1.2, 0));
       const startPos = characterMesh.getAbsolutePosition().add(spawnOffset);

       const sphere = MeshBuilder.CreateSphere(`${ability.id}_projectile`, { diameter: ability.projectile.diameter }, this.scene);
       const material = new StandardMaterial(`${ability.id}_mat`, this.scene);
       material.diffuseColor = new Color3(ability.projectile.material.diffuseColor.r, ability.projectile.material.diffuseColor.g, ability.projectile.material.diffuseColor.b);
       material.emissiveColor = new Color3(ability.projectile.material.emissiveColor.r, ability.projectile.material.emissiveColor.g, ability.projectile.material.emissiveColor.b);
       material.alpha = ability.projectile.material.alpha;
       material.specularPower = ability.projectile.material.specularPower;
       material.backFaceCulling = ability.projectile.material.backFaceCulling;
       sphere.material = material;
       sphere.position = startPos;
       sphere.checkCollisions = true;

       let particles: ParticleSystem | null = null;
       if (ability.particles?.projectile) {
         particles = this.createParticleSystem(ability.particles.projectile, sphere, `${ability.id}_projectile_particles`);
         particles.start();
       }

       let travelSound: Sound | null = null;
       const originalTravelSound = this.sounds.get(`${ability.id}_travel`);
       if (originalTravelSound && !sphere.isDisposed()) {
         travelSound = originalTravelSound.clone();
         if (travelSound) {
           travelSound.attachToMesh(sphere);
           travelSound.play();
         }
       }

       const launchSound = this.sounds.get(`${ability.id}_launch`);
       if (launchSound && launchSound.isReady()) {
         console.log(`CharacterAttackSystem: Playing launch sound ${ability.id}_launch`);
         launchSound.play();
       }

       const moveDirection = target.mesh.getAbsolutePosition().subtract(sphere.position).normalize();

       const playerLevel = this.characterController.getPlayer().getLevel() || 1;
       const minDamage = ability.damage.min + (playerLevel - 1) * ability.damage.levelScaling;
       const maxDamage = ability.damage.max + (playerLevel - 1) * ability.damage.levelScaling;

       const renderCallback = () => {
         const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
         const moveDistance = ability.projectile!.speed * deltaTime;
         sphere.position.addInPlace(moveDirection.scale(moveDistance));

         const hitboxes = this.scene.meshes.filter(mesh => Tags.MatchesQuery(mesh, "hitbox"));
         for (const hitbox of hitboxes) {
           if (sphere.intersectsMesh(hitbox, true)) {
             const tags = Tags.GetTags(hitbox);
             const enemyId = tags ? tags.split(" ").find((tag: string) => tag.startsWith("enemyID:"))?.split(":")[1] : undefined;
             if (enemyId) {
               const enemy = this.gameManager?.getEnemies().find(e => e.getId() === enemyId);
               if (enemy) {
                 if (ability.particles?.impact) {
                   const impactParticles = this.createParticleSystem(ability.particles.impact, sphere.position.clone(), `${ability.id}_impact_particles`);
                   impactParticles.start();
                   setTimeout(() => {
                     impactParticles.stop();
                     impactParticles.dispose();
                   }, 1000);
                 }

                 let impactSound: Sound | null = null;
                 const originalImpactSound = this.sounds.get(`${ability.id}_impact`);
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
                 const activeCastSound = this.sounds.get(`${ability.id}_cast_active`);
                 if (activeCastSound) {
                   activeCastSound.stop();
                   activeCastSound.dispose();
                   this.sounds.delete(`${ability.id}_cast_active`);
                 }
                 if (impactSound) {
                   const soundDuration = impactSound.getAudioBuffer()?.duration || 1;
                   setTimeout(() => {
                     impactSound?.stop();
                     impactSound?.dispose();
                   }, soundDuration * 1000);
                 }
                 this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
                 return;
               }
             }
           }
         }
       };

       this.scene.onBeforeRenderObservable.add(renderCallback);
       setTimeout(() => {
         if (sphere && !sphere.isDisposed()) {
           particles?.stop();
           particles?.dispose();
           sphere.dispose();
           travelSound?.stop();
           travelSound?.dispose();
           launchSound?.stop();
           const activeCastSound = this.sounds.get(`${ability.id}_cast_active`);
           if (activeCastSound) {
             activeCastSound.stop();
             activeCastSound.dispose();
             this.sounds.delete(`${ability.id}_cast_active`);
           }
           this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
         }
       }, ability.projectile!.lifetime);
     }

     public stopSounds(): void {
       this.sounds.forEach(sound => sound.stop());
       // NEW: Dispose and remove active cast sound
       this.sounds.forEach((sound, key) => {
         if (key.endsWith("_cast_active")) {
           sound.dispose();
           this.sounds.delete(key);
         }
       });
     }

     public dispose(): void {
       this.stopSounds();
       this.sounds.forEach(sound => sound.dispose());
       this.sounds.clear();
     }
   }