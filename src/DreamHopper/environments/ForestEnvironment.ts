import {
    Scene,
    DirectionalLight,
    Vector3,
    SceneLoader,
    CascadedShadowGenerator,
    ShadowGenerator,
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
    CubeTexture,
    AbstractMesh,
    Light,
    Ray,
    RayHelper,
    Quaternion,
    TransformNode,
    InstancedMesh,
    Space,
    Matrix,
    RenderTargetTexture
} from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";
import { Environment } from "../EnvironmentCreator";
import { Inspector } from "@babylonjs/inspector";

export class ForestEnvironment implements Environment {
    private light: DirectionalLight | null = null;
    private ambientLight: HemisphericLight | null = null;
    private shadowGenerator: CascadedShadowGenerator | null = null;
    private treeLight: DirectionalLight | null = null;
    private treeShadowGenerator: ShadowGenerator | null = null;
    private groundMeshes: Mesh[] = [];
    private rock: Mesh | null = null;
    private mistSystem: ParticleSystem | null = null;
    private skybox: Mesh | null = null;
    private envTexture: CubeTexture | null = null;
    private debugMeshes: Mesh[] = [];
    private treeColliders: Mesh[] = [];

    constructor(private scene: Scene) {}

    public async create(): Promise<void> {
        this.setupLighting();
        this.setupFog();
        await this.loadGroundMesh();
        this.createRock();
        this.createMistParticles();
        await this.setupSkybox();
        await this.createForest(800);

        //Inspector.Show(this.scene, {});
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

    private setupLighting(): void {
        this.light = new DirectionalLight("sunLight", new Vector3(-0.5, -1, -0.5).normalize(), this.scene);
        this.light.intensityMode = Light.INTENSITYMODE_ILLUMINANCE;
        this.light.intensity = 3;
        this.light.position = new Vector3(12, 25, 12);

        this.shadowGenerator = new CascadedShadowGenerator(1024, this.light);
        this.shadowGenerator.numCascades = 1;
        this.shadowGenerator.lambda = 0.9;
        this.shadowGenerator.autoCalcDepthBounds = true;
        this.shadowGenerator.shadowMaxZ = 1000;
        this.shadowGenerator.bias = 0.0005;
        this.shadowGenerator.cascadeBlendPercentage = 0.05;
        this.shadowGenerator.penumbraDarkness = 1.0;
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
            const result = await SceneLoader.ImportMeshAsync("", "./models/", "map.glb", this.scene);
            const targetPosition = new Vector3(0, 0, 0);

            result.meshes.forEach(mesh => {
                mesh.position = targetPosition;
                mesh.receiveShadows = true;
                mesh.isPickable = true;

                if (mesh instanceof Mesh && mesh.name === "Plane") {
                    this.groundMeshes.push(mesh);
                    if (this.scene.isPhysicsEnabled()) {
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
                    }
                }

                const allMeshes = mesh.getChildMeshes();
                allMeshes.push(mesh);

                allMeshes.forEach(child => {
                    child.receiveShadows = true;
                    child.isPickable = true;
                    child.isVisible = true;

                    if (child.material && child.name.includes("Object_6")) {
                        const mat = child.material as PBRMaterial;
                        mat.needAlphaTesting();
                        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
                        mat.alphaCutOff = 0.4;
                    }

                    if (child.material && child.name === "Plane") {
                        const mat = child.material as PBRMaterial;
                        mat.roughness = 0.85;
                        mat.metallic = 0;
                        if (mat.albedoTexture instanceof Texture) {
                            mat.albedoTexture.uScale = 0.25;
                            mat.albedoTexture.vScale = 0.25;
                        }
                    }

                    if (this.shadowGenerator) {
                        this.shadowGenerator.addShadowCaster(child);
                    }
                });
            });
        } catch (error) {
            console.error("Error loading map.glb:", error);
        }
    }

    private createRock(): void {
        this.rock = MeshBuilder.CreateIcoSphere("rock", { radius: 1, subdivisions: 2 }, this.scene);
        this.rock.position = new Vector3(5, 15, 5);
        this.rock.receiveShadows = true;
        this.rock.isPickable = true;

        const rockMaterial = new PBRMaterial("rockMaterial", this.scene);
        rockMaterial.albedoColor = new Color3(1, 1, 1);
        rockMaterial.reflectivityColor = new Color3(0.7, 0.7, 0.7);
        rockMaterial.microSurface = 0.9;
        rockMaterial.roughness = 0.5;
        rockMaterial.metallic = 0.2;
        rockMaterial.usePhysicalLightFalloff = true;
        this.rock.material = rockMaterial;

        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(this.rock);
        }

        if (this.scene.isPhysicsEnabled()) {
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
                new PhysicsController(this.scene, this.rock, rockPhysicsConfig);
            } catch (physicsError) {
                console.error("Failed to apply physics to rock:", physicsError);
            }
        }
    }

    private createMistParticles(): void {
        this.mistSystem = new ParticleSystem("mist", 200, this.scene);
        this.mistSystem.particleTexture = new Texture("./Mist2.png", this.scene);
        this.mistSystem.emitter = new Vector3(0, 1, 0);
        this.mistSystem.minEmitBox = new Vector3(-50, 0.5, -50);
        this.mistSystem.maxEmitBox = new Vector3(50, 2, 50);
        this.mistSystem.minSize = 25.0;
        this.mistSystem.maxSize = 25.0;
        this.mistSystem.minLifeTime = 5.0;
        this.mistSystem.maxLifeTime = 10.0;
        this.mistSystem.emitRate = 2;
        this.mistSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
        this.mistSystem.gravity = new Vector3(1, 0.8, 0);
        this.mistSystem.direction1 = new Vector3(-0.1, 0.05, -0.1);
        this.mistSystem.direction2 = new Vector3(0.1, 0.05, 0.1);
        this.mistSystem.minAngularSpeed = 0;
        this.mistSystem.maxAngularSpeed = 0.1;
        this.mistSystem.minEmitPower = 0.1;
        this.mistSystem.maxEmitPower = 0.3;
        this.mistSystem.color1 = new Color4(0.8, 0.85, 0.9, 0.2);
        this.mistSystem.color2 = new Color4(0.9, 0.92, 0.95, 0.1);
        this.mistSystem.colorDead = new Color4(0.8, 0.85, 0.9, 0.0);
        this.mistSystem.start();
    }

    public getShadowGenerator(): CascadedShadowGenerator | null {
        return this.shadowGenerator;
    }

    public dispose(): void {
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

        if (this.rock) {
            if (this.rock.physicsBody) {
                this.rock.physicsBody.dispose();
            }
            if (this.rock.material) {
                this.rock.material.dispose();
            }
            this.rock.dispose();
            this.rock = null;
        }

        if (this.mistSystem) {
            if (this.mistSystem.particleTexture) {
                this.mistSystem.particleTexture.dispose();
            }
            this.mistSystem.dispose();
            this.mistSystem = null;
        }

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

        if (this.light) {
            this.light.dispose();
            this.light = null;
        }
        if (this.ambientLight) {
            this.ambientLight.dispose();
            this.ambientLight = null;
        }

        if (this.shadowGenerator) {
            this.shadowGenerator.dispose();
            this.shadowGenerator = null;
        }

        this.debugMeshes.forEach(mesh => {
            if (mesh.physicsBody) {
                mesh.physicsBody.dispose();
            }
            if (mesh.material) {
                mesh.material.dispose();
            }
            mesh.dispose();
        });
        this.debugMeshes = [];

        this.treeColliders.forEach(collider => {
            if (collider.physicsBody) {
                collider.physicsBody.dispose();
            }
            collider.dispose();
        });
        this.treeColliders = [];

        this.scene.fogEnabled = false;
    }

    async getGroundInfo(groundMesh: Mesh): Promise<{ minX: number, maxX: number, minZ: number, maxZ: number }> {
        await groundMesh.refreshBoundingInfo();
        const boundingBox = groundMesh.getBoundingInfo().boundingBox;
        return {
            minX: -200,
            maxX: 200,
            minZ: -200,
            maxZ: 200
        };
    }

    getRandomPointOnGround(bounds: { minX: number, maxX: number, minZ: number, maxZ: number }): Vector3 {
        const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
        return new Vector3(x, 100, z);
    }

    async createForest(treeCount: number) {
        if (this.groundMeshes.length === 0) {
            console.warn("No ground mesh loaded to create forest");
            return;
        }
        const groundMesh = this.groundMeshes[0];

        // Load the tree meshes
        const result = await SceneLoader.ImportMeshAsync("", "./models/", "maple_tree3.glb", this.scene);

        // Find trunk and leaves meshes
        const trunkMeshes = result.meshes.filter(mesh => mesh.name.includes("Sakura_Sakura_Mat_0")) as Mesh[];
        const leavesMeshes = result.meshes.filter(mesh => mesh.name.includes("Sakura_Bark001_2K_JPG_Mat_0")) as Mesh[];

        if (trunkMeshes.length === 0 || leavesMeshes.length === 0) {
            console.warn("Could not find both trunk and leaves meshes");
            return;
        }

        // Configure leaves material for shadow casting
        leavesMeshes.forEach(mesh => {
            if (mesh.material instanceof PBRMaterial) {
                const mat = mesh.material as PBRMaterial;
                mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
                mat.alphaCutOff = 0.3;
                mat.useAlphaFromAlbedoTexture = true;
                mat.needAlphaTesting();
                mat.forceDepthWrite = true;
                mat.separateCullingPass = true;
                mat.backFaceCulling = false;
                mat.usePhysicalLightFalloff = true;
            }
        });

        // Merge trunks and leaves separately for instancing
        const mergedTrunkMesh = Mesh.MergeMeshes(trunkMeshes, true, true, undefined, false, true);
        const mergedLeavesMesh = Mesh.MergeMeshes(leavesMeshes, true, true, undefined, false, true);

        if (!mergedTrunkMesh || !mergedLeavesMesh) {
            console.warn("Failed to merge meshes");
            return;
        }

        // Get trunk bounding info to determine collider size
        mergedTrunkMesh.refreshBoundingInfo();
        const trunkBoundingBox = mergedTrunkMesh.getBoundingInfo().boundingBox;
        const trunkHeight = trunkBoundingBox.maximumWorld.y - trunkBoundingBox.minimumWorld.y;
        const trunkDiameter = 4;

        // Hide original individual meshes
        trunkMeshes.forEach(m => m.setEnabled(false));
        leavesMeshes.forEach(m => m.setEnabled(false));

        // Make sure merged meshes receive and cast shadows
        mergedTrunkMesh.receiveShadows = true;
        mergedLeavesMesh.receiveShadows = true;
        if (this.shadowGenerator) {
            this.shadowGenerator.addShadowCaster(mergedTrunkMesh, true);
            this.shadowGenerator.addShadowCaster(mergedLeavesMesh, true);
            this.shadowGenerator.transparencyShadow = true;
            this.shadowGenerator.blurScale = 2;
            this.shadowGenerator.blurBoxOffset = 2;
            this.shadowGenerator.useContactHardeningShadow = true;
        }

        // Get ground bounds for random positioning
        const bounds = await this.getGroundInfo(groundMesh);

        // Prepare arrays for thin instance matrices
        const trunkMatrices: Float32Array = new Float32Array(treeCount * 16);
        const leavesMatrices: Float32Array = new Float32Array(treeCount * 16);

        for (let i = 0; i < treeCount; i++) {
            const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

            const ray = new Ray(new Vector3(x, 100, z), Vector3.Down(), 200);
            const hit = this.scene.pickWithRay(ray, (mesh) => mesh === groundMesh);

            let position = new Vector3(x, 1, z);
            let rotation = Quaternion.Identity();

            if (hit && hit.pickedPoint && hit.getNormal) {
                position = hit.pickedPoint;
                const normal = hit.getNormal(true) || Vector3.Up();
                const up = Vector3.Up();
                const axis = Vector3.Cross(up, normal);
                const angle = Math.acos(Vector3.Dot(up, normal));
                if (axis.lengthSquared() > 0) {
                    rotation = Quaternion.RotationAxis(axis.normalize(), angle);
                }
            } else {
                console.warn(`No terrain hit for tree ${i} at (${x}, ${z})`);
            }

            // Add random Y rotation (yaw)
            const randomYaw = Math.random() * Math.PI * 2;
            const yawRotation = Quaternion.RotationAxis(Vector3.Up(), randomYaw);
            rotation = yawRotation.multiply(rotation);

            // Add slight random rotation to leaves for organic shadows
            const leafRandomTilt = Quaternion.RotationAxis(Vector3.Forward(), (Math.random() - 0.5) * 0.1);
            const leafRotation = leafRandomTilt.multiply(rotation);

            // Random scale between 0.4 and 0.8
            const scaleValue = 0.4 + Math.random() * (0.8 - 0.4);
            const scale = new Vector3(scaleValue, scaleValue, scaleValue);

            // Compose transformation matrices
            const trunkMatrix = Matrix.Compose(scale, rotation, position);
            const leavesMatrix = Matrix.Compose(scale, leafRotation, position);

            trunkMatrix.copyToArray(trunkMatrices, i * 16);
            leavesMatrix.copyToArray(leavesMatrices, i * 16);

            // Create physics collider (cylinder) for the tree trunk
            if (this.scene.isPhysicsEnabled()) {
                const collider = MeshBuilder.CreateCylinder(
                    `treeCollider${i}`,
                    { height: trunkHeight * scaleValue, diameter: trunkDiameter * scaleValue },
                    this.scene
                );
                collider.position = position;
                collider.rotationQuaternion = rotation;
                collider.isVisible = false;
                collider.isPickable = false;

                try {
                    new PhysicsAggregate(
                        collider,
                        PhysicsShapeType.CYLINDER,
                        { mass: 0, restitution: 0.1, friction: 0.8 },
                        this.scene
                    );
                    this.treeColliders.push(collider);
                } catch (physicsError) {
                    console.error(`Failed to apply physics to tree collider ${i}:`, physicsError);
                    collider.dispose();
                }
            }
        }

        // Set thin instances on merged meshes
        mergedTrunkMesh.thinInstanceSetBuffer("matrix", trunkMatrices, 16, true);
        mergedLeavesMesh.thinInstanceSetBuffer("matrix", leavesMatrices, 16, true);

        // Set thin instances count
        mergedTrunkMesh.thinInstanceCount = treeCount;
        mergedLeavesMesh.thinInstanceCount = treeCount;

        console.log(`Created forest with ${treeCount} trees using thin instances and physics colliders.`);
    }
}