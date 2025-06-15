import { Scene, Mesh, StandardMaterial, Color3, Vector3, ParticleSystem, Texture, Color4, Sound, Tags, MeshBuilder } from "@babylonjs/core";
import { Game } from "../Game";
import { Enemy } from "./Enemy";
import { AttackConfig } from "./EnemyTypeConfig";

export class EnemyAttackSystem {
    protected scene: Scene;
    protected enemy: Enemy;
    protected game: Game;
    protected attacks: AttackConfig[];
    protected lastAttackTimes: Map<string, number> = new Map();
    protected castSound: Sound | null = null; // New
    protected launchSound: Sound | null = null; // New
    protected ambientSound: Sound | null = null; // New

    constructor(scene: Scene, enemy: Enemy, game: Game) {
        this.scene = scene;
        this.enemy = enemy;
        this.game = game;
        this.attacks = enemy.config.attacks;
        this.preloadSounds(); // New
        console.log(`EnemyAttackSystem for Enemy ${enemy.getId()}: Initialized with ${this.attacks.length} attacks`);
    }

    // New: Preload sounds for attacks
    protected preloadSounds(): void {
        const enemyMesh = this.enemy.getEnemyMesh();
        if (!enemyMesh) {
            console.warn(`EnemyAttackSystem for Enemy ${this.enemy.getId()}: Enemy mesh not available for sound preloading`);
            return;
        }

        const nightmareBoltAttack = this.attacks.find(a => a.id === "nightmareBolt");
        if (!nightmareBoltAttack?.soundEffects) {
            console.warn(`EnemyAttackSystem for Enemy ${this.enemy.getId()}: No sound effects for nightmareBolt`);
            return;
        }

        if (nightmareBoltAttack.soundEffects.cast) {
            this.castSound = new Sound(
                `castBoltSound_${this.enemy.getId()}`,
                nightmareBoltAttack.soundEffects.cast,
                this.scene,
                () => {
                    console.log(`EnemyAttackSystem for Enemy ${this.enemy.getId()}: Cast sound preloaded`);
                    this.castSound!.attachToMesh(enemyMesh);
                },
                { autoplay: false, loop: true, spatialSound: true, maxDistance: 50, volume: 0.4 }
            );
        }

        if (nightmareBoltAttack.soundEffects.launch) {
            this.launchSound = new Sound(
                `boltLaunchSound_${this.enemy.getId()}`,
                nightmareBoltAttack.soundEffects.launch,
                this.scene,
                () => {
                    console.log(`EnemyAttackSystem for Enemy ${this.enemy.getId()}: Launch sound preloaded`);
                    this.launchSound!.attachToMesh(enemyMesh);
                },
                { autoplay: false, loop: false, spatialSound: true, maxDistance: 50, volume: 1.2 }
            );
        }

        if (nightmareBoltAttack.soundEffects.ambient) {
            this.ambientSound = new Sound(
                `nightmareBoltSound_${this.enemy.getId()}`,
                nightmareBoltAttack.soundEffects.ambient,
                this.scene,
                () => {
                    console.log(`EnemyAttackSystem for Enemy ${this.enemy.getId()}: Ambient sound preloaded`);
                },
                { autoplay: false, loop: true, spatialSound: true, maxDistance: 50, volume: 1 }
            );
        }
    }

    // New: Get animation for an attack
    public getAttackAnimation(attackId: string): string | null {
        const attack = this.attacks.find(a => a.id === attackId);
        return attack?.animation || null;
    }

    public performAttack(attackId: string): void {
        const attack = this.attacks.find(a => a.id === attackId);
        if (!attack) {
            console.error(`Enemy ${this.enemy.getId()}: Attack ${attackId} not found`);
            return;
        }

        const currentTime = Date.now();
        const lastTime = this.lastAttackTimes.get(attackId) || 0;
        if (currentTime - lastTime < attack.cooldown) {
            console.log(`Enemy ${this.enemy.getId()}: Attack ${attackId} on cooldown`);
            return;
        }

        console.log(`Enemy ${this.enemy.getId()}: Performing attack ${attackId}`);

        if (attack.type === "ranged" && attack.projectile) {
            this.performRangedAttack(attack);
            this.lastAttackTimes.set(attackId, currentTime);
        } else {
            console.warn(`Enemy ${this.enemy.getId()}: Unsupported attack type ${attack.type}`);
        }
    }

    protected performRangedAttack(attack: AttackConfig): void {
        if (!attack.projectile) {
            console.error(`Enemy ${this.enemy.getId()}: Ranged attack ${attack.id} missing projectile config`);
            return;
        }

        const enemyMesh = this.enemy.getEnemyMesh();
        if (!enemyMesh) {
            console.error(`Enemy ${this.enemy.getId()}: Enemy mesh not found`);
            return;
        }

        const playerMesh = this.game.getCharacterController()?.characterMeshLoader.getCharacterMesh();
        if (!playerMesh) {
            console.error(`Enemy ${this.enemy.getId()}: Player mesh not found`);
            return;
        }

        const hitboxMesh = playerMesh.getChildMeshes().find((mesh: { name: string; }) => mesh.name === "player_hitbox" || Tags.MatchesQuery(mesh, "player hitbox")) as Mesh;
        if (!hitboxMesh) {
            console.error(`Enemy ${this.enemy.getId()}: Player hitbox mesh not found`);
            return;
        }

        // Play cast sound
        if (this.castSound && this.castSound.isReady()) {
            this.castSound.play();
            console.log(`Enemy ${this.enemy.getId()}: Playing cast sound for ${attack.id}`);
        }

        // Create projectile
        const sphere = MeshBuilder.CreateSphere(`nightmareBolt_${this.enemy.getId()}`, { diameter: attack.projectile.diameter }, this.scene);
        const material = new StandardMaterial(`nightmareBoltMat_${this.enemy.getId()}`, this.scene);
        material.diffuseColor = new Color3(0.15, 0.0, 0.3);
        material.emissiveColor = new Color3(0.1, 0.0, 0.4);
        material.specularColor = new Color3(0, 0, 0);
        material.specularPower = 0;
        material.alpha = 0.6;
        sphere.material = material;
        sphere.isVisible = true;

        // Particle effects
        const particles = new ParticleSystem(`boltParticles_${this.enemy.getId()}`, 400, this.scene);
        particles.particleTexture = new Texture("./Flare.png", this.scene);
        particles.emitter = sphere;
        particles.minEmitBox = Vector3.Zero();
        particles.maxEmitBox = Vector3.Zero();
        particles.color1 = new Color4(0.15, 0.0, 0.4, 1.0);
        particles.color2 = new Color4(0.05, 0.0, 0.4, 0.7);
        particles.colorDead = new Color4(0.0, 0.0, 0.1, 0.0);
        particles.minSize = attack.projectile.particleMinSize;
        particles.maxSize = attack.projectile.particleMaxSize;
        particles.minLifeTime = 0.15;
        particles.maxLifeTime = 0.4;
        particles.emitRate = 600;
        particles.blendMode = ParticleSystem.BLENDMODE_ADD;
        particles.gravity = Vector3.Zero();
        particles.direction1 = Vector3.Zero();
        particles.direction2 = Vector3.Zero();
        particles.start();

        // Position projectile
        const forward = enemyMesh.getDirection(Vector3.Forward()).normalize();
        const spawnOffset = forward.scale(attack.projectile.spawnOffsetScale).add(new Vector3(0, attack.projectile.spawnOffsetScale, 0));
        const startPos = enemyMesh.getAbsolutePosition().add(spawnOffset);
        sphere.position = startPos;
        sphere.checkCollisions = true;

        // Play launch sound
        if (this.launchSound && this.launchSound.isReady()) {
            this.launchSound.play();
            console.log(`Enemy ${this.enemy.getId()}: Playing launch sound for ${attack.id}`);
        }

        // Play ambient sound
        let sphereAmbientSound: Sound | null = null;
        if (this.ambientSound) {
            sphereAmbientSound = this.ambientSound.clone();
            if (sphere && !sphere.isDisposed()) {
                sphereAmbientSound!.attachToMesh(sphere);
                sphereAmbientSound!.play();
                console.log(`Enemy ${this.enemy.getId()}: Playing ambient sound for ${attack.id}`);
            } else {
                sphereAmbientSound!.dispose();
                sphereAmbientSound = null;
            }
        }

        // Move projectile
        hitboxMesh.computeWorldMatrix(true);
        hitboxMesh.refreshBoundingInfo();
        const boundingBox = hitboxMesh.getBoundingInfo().boundingBox;
        const hitboxCenterY = (boundingBox.minimumWorld.y + boundingBox.maximumWorld.y) / 2;
        const hitboxPos = hitboxMesh.getAbsolutePosition();
        const adjustedPlayerPos = new Vector3(hitboxPos.x, hitboxCenterY, hitboxPos.z);

        if (hitboxCenterY - boundingBox.minimumWorld.y < 0.5) {
            adjustedPlayerPos.y = hitboxPos.y + 0.875;
        }

        let moveDirection = adjustedPlayerPos.subtract(sphere.position);
        if (moveDirection.lengthSquared() > 0.0001) {
            moveDirection = moveDirection.normalize();
        } else {
            moveDirection = forward;
        }

        const speed = attack.projectile.speed;

        const renderCallback = () => {
            const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
            const moveDistance = speed * deltaTime;
            sphere.position.addInPlace(moveDirection.scale(moveDistance));

            if (sphere.intersectsMesh(hitboxMesh, true)) {
                const characterController = this.game.getCharacterController();
                if (characterController) {
                    const player = characterController.getPlayer();
                    if (player) {
                        const damage = Math.floor(Math.random() * (attack.damageMax - attack.damageMin + 1)) + attack.damageMin;
                        player.takeDamage(damage);
                        console.log(`Enemy ${this.enemy.getId()}: ${attack.id} hit player for ${damage} damage`);
                    }
                }

                const explosion = this.createExplosion(sphere, attack);
                particles.stop();
                particles.dispose();
                sphere.dispose();
                if (sphereAmbientSound) {
                    sphereAmbientSound.stop();
                    sphereAmbientSound.dispose();
                }
                if (this.castSound) {
                    this.castSound.stop();
                }
                this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
                return;
            }

            setTimeout(() => {
                if (!sphere.isDisposed()) {
                    particles.stop();
                    particles.dispose();
                    sphere.dispose();
                    if (sphereAmbientSound) {
                        sphereAmbientSound.stop();
                        sphereAmbientSound.dispose();
                    }
                    if (this.castSound) {
                        this.castSound.stop();
                    }
                    this.scene.onBeforeRenderObservable.removeCallback(renderCallback);
                }
            }, 5000);
        };

        this.scene.onBeforeRenderObservable.add(renderCallback);
    }

    protected createExplosion(sphere: Mesh, attack: AttackConfig): ParticleSystem {
        const explosion = new ParticleSystem(`nightmareExplosion_${this.enemy.getId()}`, 100, this.scene);
        explosion.particleTexture = new Texture("./Flare.png", this.scene);
        explosion.emitter = sphere.position.clone();
        explosion.minEmitBox = new Vector3(-attack.projectile!.explosionEmitBoxScale, -attack.projectile!.explosionEmitBoxScale, -attack.projectile!.explosionEmitBoxScale);
        explosion.maxEmitBox = new Vector3(attack.projectile!.explosionEmitBoxScale, attack.projectile!.explosionEmitBoxScale, attack.projectile!.explosionEmitBoxScale);
        explosion.color1 = new Color4(0.4, 0.0, 0.6, 1.0);
        explosion.color2 = new Color4(0.6, 0.1, 0.8, 0.8);
        explosion.colorDead = new Color4(0.2, 0.0, 0.3, 0.0);
        explosion.minSize = attack.projectile!.explosionMinSize;
        explosion.maxSize = attack.projectile!.explosionMaxSize;
        explosion.minLifeTime = 0.2;
        explosion.maxLifeTime = 0.5;
        explosion.emitRate = 1000;
        explosion.blendMode = ParticleSystem.BLENDMODE_ADD;
        explosion.gravity = Vector3.Zero();
        explosion.direction1 = new Vector3(-1, -1, -1);
        explosion.direction2 = new Vector3(1, 1, 1);
        explosion.minAngularSpeed = 0;
        explosion.maxAngularSpeed = Math.PI;
        explosion.targetStopDuration = 0.1;
        explosion.disposeOnStop = true;
        explosion.manualEmitCount = 50;
        explosion.start();
        return explosion;
    }

    public dispose(): void {
        if (this.castSound) {
            this.castSound.stop();
            this.castSound.dispose();
        }
        if (this.launchSound) {
            this.launchSound.stop();
            this.launchSound.dispose();
        }
        if (this.ambientSound) {
            this.ambientSound.stop();
            this.ambientSound.dispose();
        }
        this.lastAttackTimes.clear();
        console.log(`EnemyAttackSystem for Enemy ${this.enemy.getId()}: Disposed`);
    }
}