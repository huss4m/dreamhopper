import {
    Scene,
    DirectionalLight,
    Vector3,
    SceneLoader,
    CascadedShadowGenerator,
    PBRMaterial,
    PhysicsAggregate,
    PhysicsShapeType,
    StandardMaterial,
    Color3,
    HemisphericLight,
    Texture,
    MeshBuilder,
    Mesh,
    Color4,
    ParticleSystem,
    CubeTexture
} from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";
import { Environment } from "../EnvironmentCreator";

export class ForestEnvironment implements Environment {
    private light: DirectionalLight | null = null;
    private shadowGenerator: CascadedShadowGenerator | null = null;

    constructor(private scene: Scene) {}

    public async create(): Promise<void> {
        this.setupLighting();
        this.setupFog();
        await this.loadGroundMesh();
        this.createRock();
        this.createMistParticles();
        await this.setupSkybox();
    }

    private async setupSkybox(): Promise<void> {
        const envTex = CubeTexture.CreateFromPrefilteredData("./environment/bluesky.env", this.scene);
        envTex.gammaSpace = false;
        envTex.rotationY = Math.PI;
        this.scene.environmentTexture = envTex;

        const skybox = this.scene.createDefaultSkybox(envTex, true, 100000, 0);
        if (skybox && skybox.material) {
            skybox.applyFog = false;
        }
    }

    private setupLighting(): void {
        this.light = new DirectionalLight("sunLight", new Vector3(-0.5, -1, -0.5).normalize(), this.scene);
        this.light.intensity = 2.5;
        this.light.position = new Vector3(50, 100, 50);

        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.6;
        ambientLight.diffuse = new Color3(0.8, 0.85, 0.9);
        ambientLight.groundColor = new Color3(0.6, 0.65, 0.7);

        this.shadowGenerator = new CascadedShadowGenerator(2048, this.light);
        this.shadowGenerator.numCascades = 4;
        this.shadowGenerator.lambda = 0.9;
        this.shadowGenerator.autoCalcDepthBounds = true;
        this.shadowGenerator.shadowMaxZ = 1000;
        this.shadowGenerator.bias = 0.01;
        this.shadowGenerator.cascadeBlendPercentage = 0.05;
        this.shadowGenerator.penumbraDarkness = 0.9;
        this.shadowGenerator.stabilizeCascades = true;
    }

    private setupFog(): void {
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.008;
        this.scene.fogColor = new Color3(0.9, 0.92, 0.95);
        this.scene.fogEnabled = true;
    }

    private async loadGroundMesh(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "./models/", "grass2.glb", this.scene);
            const targetPosition = new Vector3(0, 0, 0);

            result.meshes.forEach(mesh => {
                mesh.position = targetPosition;
                mesh.receiveShadows = true;
                mesh.isPickable = true;

                const allMeshes = mesh.getChildMeshes();
                allMeshes.push(mesh);

                allMeshes.forEach(child => {
                    child.receiveShadows = true;
                    child.isPickable = true;
                    child.isVisible = true;

                    if (child.name.toLowerCase().includes("rock") && child.material) {
                        const mat = child.material as PBRMaterial;
                        child.receiveShadows = true;
                        mat.albedoColor = new Color3(1, 1, 1);
                        mat.reflectivityColor = new Color3(0.7, 0.7, 0.7);
                        mat.microSurface = 0.9;
                        mat.roughness = 0.5;
                        mat.metallic = 0.2;
                        mat.usePhysicalLightFalloff = true;
                    }

                    if (child.name.toLowerCase().includes("bark") && child.material) {
                        const mat = child.material as PBRMaterial;
                        child.receiveShadows = true;
                        mat.albedoColor = new Color3(1, 1, 1);
                        mat.reflectivityColor = new Color3(0.7, 0.7, 0.7);
                        mat.microSurface = 0.9;
                        mat.roughness = 0.1;
                        mat.metallic = 0.5;
                        mat.usePhysicalLightFalloff = true;

                        try {
                            const barkPhysicsConfig: PhysicsConfig = {
                                colliderType: ColliderType.Mesh,
                                colliderParams: {},
                                physicsProps: {
                                    mass: 0,
                                    friction: 0.8,
                                    restitution: 0.1
                                }
                            };
                            new PhysicsController(this.scene, child as Mesh, barkPhysicsConfig);
                        } catch (physicsError) {
                            console.error(`Failed to apply physics to ${child.name}:`, physicsError);
                        }
                    }

                    if (child.name.toLowerCase().includes("cluster") && child.material) {
                        const mat = child.material as PBRMaterial;
                        mat.forceDepthWrite = true;
                        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
                        mat.alphaCutOff = 0.4;
                        child.receiveShadows = true;
                        mat.albedoColor = new Color3(1, 1, 1);
                        mat.environmentIntensity = 3.6;
                        mat.reflectivityColor = new Color3(0.7, 0.7, 0.7);
                        mat.microSurface = 0.9;
                        mat.usePhysicalLightFalloff = true;
                    }

                    if (this.shadowGenerator) {
                        this.shadowGenerator.addShadowCaster(child);
                    }

                    if (child.name.toLowerCase().includes("ant01")) {
                        if (child.material instanceof PBRMaterial) {
                            child.material.metallic = 0;
                            child.material.roughness = 3;
                            child.material.specularIntensity = 0;
                            child.material.environmentIntensity = 0.2;
                        } else if (child.material instanceof StandardMaterial) {
                            child.material.specularColor = new Color3(0, 0, 0);
                            child.material.specularPower = 0;
                        }
                        try {
                            new PhysicsAggregate(
                                child,
                                PhysicsShapeType.MESH,
                                { mass: 0, restitution: 0, friction: 5.0 },
                                this.scene
                            );
                        } catch (physicsError) {
                            console.error(`Failed to apply physics to ${child.name}:`, physicsError);
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Error loading grass2.glb:", error);
        }
    }

    private createRock(): void {
        const rock = MeshBuilder.CreateIcoSphere("rock", { radius: 1, subdivisions: 2 }, this.scene);
        rock.position = new Vector3(5, 15, 5);
        rock.receiveShadows = true;
        rock.isPickable = true;

        const rockMaterial = new PBRMaterial("rockMaterial", this.scene);
        rockMaterial.albedoColor = new Color3(1, 1, 1);
        rockMaterial.reflectivityColor = new Color3(0.7, 0.7, 0.7);
        rockMaterial.microSurface = 0.9;
        rockMaterial.roughness = 0.5;
        rockMaterial.metallic = 0.2;
        rockMaterial.usePhysicalLightFalloff = true;
        rock.material = rockMaterial;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(rock);
        }

        const rockPhysicsConfig: PhysicsConfig = {
            colliderType: ColliderType.Sphere,
            colliderParams: {},
            physicsProps: {
                mass: 1,
                friction: 0.8,
                restitution: 0.1
            }
        };

        try {
            new PhysicsController(this.scene, rock, rockPhysicsConfig);
        } catch (physicsError) {
            console.error("Failed to apply physics to rock:", physicsError);
        }
    }

    private createMistParticles(): void {
        const mistSystem = new ParticleSystem("mist", 200, this.scene);
        mistSystem.particleTexture = new Texture("./Mist2.png", this.scene);
        mistSystem.emitter = new Vector3(0, 1, 0);
        mistSystem.minEmitBox = new Vector3(-50, 0.5, -50);
        mistSystem.maxEmitBox = new Vector3(50, 2, 50);
        mistSystem.minSize = 25.0;
        mistSystem.maxSize = 25.0;
        mistSystem.minLifeTime = 5.0;
        mistSystem.maxLifeTime = 10.0;
        mistSystem.emitRate = 2;
        mistSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
        mistSystem.gravity = new Vector3(1, 0.8, 0);
        mistSystem.direction1 = new Vector3(-0.1, 0.05, -0.1);
        mistSystem.direction2 = new Vector3(0.1, 0.05, 0.1);
        mistSystem.minAngularSpeed = 0;
        mistSystem.maxAngularSpeed = 0.1;
        mistSystem.minEmitPower = 0.1;
        mistSystem.maxEmitPower = 0.3;
        mistSystem.color1 = new Color4(0.8, 0.85, 0.9, 0.1);
        mistSystem.color2 = new Color4(0.9, 0.92, 0.95, 0.05);
        mistSystem.colorDead = new Color4(0.8, 0.85, 0.9, 0.0);
        mistSystem.start();
    }

    public getShadowGenerator(): CascadedShadowGenerator | null {
        return this.shadowGenerator;
    }
}