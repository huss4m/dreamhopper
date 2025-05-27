import {
    Scene,
    DirectionalLight,
    Vector3,
    SceneLoader,
    CascadedShadowGenerator,
    PBRMaterial,
    PhysicsAggregate,
    PhysicsShapeType,
    HemisphericLight,
    MeshBuilder,
    Mesh,
    Color3,
    CubeTexture,
    Texture,
    ParticleSystem,
    Color4
} from "@babylonjs/core";
import { Environment } from "../EnvironmentCreator";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";

export class PortalEnvironment implements Environment {
    private light: DirectionalLight | null = null;
    private ambientLight: HemisphericLight | null = null;
    private shadowGenerator: CascadedShadowGenerator | null = null;
    private groundMeshes: Mesh[] = [];
    private portalMeshes: Mesh[] = [];
    private skybox: Mesh | null = null;
    private envTexture: CubeTexture | null = null;
    private mistSystem: ParticleSystem | null = null;

    constructor(private scene: Scene) {}

    public async create(): Promise<void> {
        this.setupLighting();
        this.setupFog();
        await this.loadPortalArea();
        this.createMistParticles();
        await this.setupSkybox();
    }

    private setupLighting(): void {
        this.light = new DirectionalLight("sunLight", new Vector3(-0.5, -1, -0.5).normalize(), this.scene);
        this.light.intensity = 2.0;
        this.light.position = new Vector3(50, 100, 50);

        this.ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        this.ambientLight.intensity = 0.5;
        this.ambientLight.diffuse = new Color3(0.9, 0.9, 1.0);
        this.ambientLight.groundColor = new Color3(0.7, 0.7, 0.8);

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
        this.scene.fogDensity = 0.005;
        this.scene.fogColor = new Color3(0.8, 0.85, 0.9);
        this.scene.fogEnabled = true;
    }

    private async loadPortalArea(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "./models/", "portals.glb", this.scene);
            const targetPosition = new Vector3(0, 0, 0);

            result.meshes.forEach(mesh => {
                mesh.position = targetPosition;
                mesh.receiveShadows = true;
                mesh.isPickable = true;

                if (mesh instanceof Mesh) {
                    if (mesh.name === "Plane") {
                        this.groundMeshes.push(mesh);
                        try {
                            new PhysicsAggregate(
                                mesh,
                                PhysicsShapeType.MESH,
                                { mass: 0, restitution: 0.1, friction: 0.8 },
                                this.scene
                            );
                        } catch (physicsError) {
                            console.error(`Failed to apply physics to ${mesh.name}:`, physicsError);
                        }
                    } else {
                        this.portalMeshes.push(mesh);
                    }
                }

                const allMeshes = mesh.getChildMeshes();
                allMeshes.push(mesh);

                allMeshes.forEach(child => {
                    child.receiveShadows = true;
                    child.isPickable = true;
                    child.isVisible = true;

                    if (child.material) {
                        const mat = child.material as PBRMaterial;
                        mat.albedoColor = new Color3(1, 1, 1);
                        mat.reflectivityColor = new Color3(0.7, 0.7, 0.7);
                        mat.microSurface = 0.9;
                        mat.roughness = 0.3;
                        mat.metallic = 0.2;
                        mat.usePhysicalLightFalloff = true;

                        if (child.name.toLowerCase().includes("portal")) {
                            mat.emissiveColor = new Color3(0.2, 0.8, 1.0);
                            mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
                            mat.alpha = 0.7;
                        }
                    }

                    if (this.shadowGenerator) {
                        this.shadowGenerator.addShadowCaster(child);
                    }
                });
            });
        } catch (error) {
            console.error("Error loading portals.glb:", error);
        }
    }

    private async setupSkybox(): Promise<void> {
        this.envTexture = CubeTexture.CreateFromPrefilteredData("./environment/bluesky.env", this.scene);
        this.envTexture.gammaSpace = false;
        this.envTexture.rotationY = Math.PI;
        this.scene.environmentTexture = this.envTexture;

        this.skybox = this.scene.createDefaultSkybox(this.envTexture, true, 100000, 0);
        if (this.skybox && this.skybox.material) {
            this.skybox.applyFog = false;
        }
    }

    private createMistParticles(): void {
        this.mistSystem = new ParticleSystem("mist", 100, this.scene);
        this.mistSystem.particleTexture = new Texture("./Mist2.png", this.scene);
        this.mistSystem.emitter = new Vector3(0, 1, 0);
        this.mistSystem.minEmitBox = new Vector3(-30, 0.5, -30);
        this.mistSystem.maxEmitBox = new Vector3(30, 2, 30);
        this.mistSystem.minSize = 15.0;
        this.mistSystem.maxSize = 20.0;
        this.mistSystem.minLifeTime = 4.0;
        this.mistSystem.maxLifeTime = 8.0;
        this.mistSystem.emitRate = 1;
        this.mistSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
        this.mistSystem.gravity = new Vector3(0.5, 0.2, 0);
        this.mistSystem.direction1 = new Vector3(-0.05, 0.02, -0.05);
        this.mistSystem.direction2 = new Vector3(0.05, 0.02, 0.05);
        this.mistSystem.minAngularSpeed = 0;
        this.mistSystem.maxAngularSpeed = 0.05;
        this.mistSystem.minEmitPower = 0.05;
        this.mistSystem.maxEmitPower = 0.2;
        this.mistSystem.color1 = new Color4(0.7, 0.8, 0.9, 0.05);
        this.mistSystem.color2 = new Color4(0.8, 0.85, 0.95, 0.03);
        this.mistSystem.colorDead = new Color4(0.7, 0.8, 0.9, 0.0);
        this.mistSystem.start();
    }

    public getShadowGenerator(): CascadedShadowGenerator | null {
        return this.shadowGenerator;
    }

    public dispose(): void {
        // Dispose ground meshes and their physics aggregates
        this.groundMeshes.forEach(mesh => {
            if (mesh.physicsBody) {
                mesh.physicsBody.dispose();
            }
            if (mesh.material) {
                mesh.material.dispose();
            }
            mesh.dispose();
        });
        this.groundMeshes = [];

        // Dispose portal meshes
        this.portalMeshes.forEach(mesh => {
            if (mesh.physicsBody) {
                mesh.physicsBody.dispose();
            }
            if (mesh.material) {
                mesh.material.dispose();
            }
            mesh.dispose();
        });
        this.portalMeshes = [];

        // Dispose mist particle system
        if (this.mistSystem) {
            if (this.mistSystem.particleTexture) {
                this.mistSystem.particleTexture.dispose();
            }
            this.mistSystem.dispose();
            this.mistSystem = null;
        }

        // Dispose skybox and environment texture
        if (this.skybox) {
            if (this.skybox.material) {
                this.skybox.material.dispose();
            }
            this.skybox.dispose();
            this.skybox = null;
        }
        if (this.envTexture) {
            this.envTexture.dispose();
            this.envTexture = null;
        }
        this.scene.environmentTexture = null;

        // Dispose lights
        if (this.light) {
            this.light.dispose();
            this.light = null;
        }
        if (this.ambientLight) {
            this.ambientLight.dispose();
            this.ambientLight = null;
        }

        // Dispose shadow generator
        if (this.shadowGenerator) {
            this.shadowGenerator.dispose();
            this.shadowGenerator = null;
        }

        // Disable fog
        this.scene.fogEnabled = false;
    }
}