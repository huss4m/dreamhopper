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
  PhysicsShapeBox,
  Quaternion,
  Texture,
  MeshBuilder,
  Vector2,
  Mesh
} from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "./PhysicsController";

export class EnvironmentCreator {
  private light: DirectionalLight | null = null;
  private shadowGenerator: CascadedShadowGenerator | null = null;

  constructor(private scene: Scene) {
   
  }

  public async createEnvironment(): Promise<void> {
    this.setupLighting();
    await this.loadGroundMesh();
    this.createRock();
  }

  private setupLighting(): void {
    // Sunlight
    this.light = new DirectionalLight("sunLight", new Vector3(-0, -1, -0.5).normalize(), this.scene);
    this.light.intensity = 5.0;
    this.light.position = new Vector3(50, 100, 50);

    // Shadows
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



             // Apply physics to bark
             try {
              const barkPhysicsConfig: PhysicsConfig = {
                colliderType: ColliderType.Mesh,
                colliderParams: {}, // auto: true
                physicsProps: {
                  mass: 0, // Static
                  friction: 0.8, // Rough surface
                  restitution: 0.1 // Low bounciness
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

          // Apply physics to "ant01" only
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


  // Rock to test some physics properties
  private createRock(): void {
    // Create rock mesh (icosphere)
    const rock = MeshBuilder.CreateIcoSphere("rock", { radius: 1, subdivisions: 2 }, this.scene);
    rock.position = new Vector3(5, 15, 5); // Position near ground
    rock.receiveShadows = true;
    rock.isPickable = true;

    // Apply PBR material 
    const rockMaterial = new PBRMaterial("rockMaterial", this.scene);
    rockMaterial.albedoColor = new Color3(1, 1, 1);
    rockMaterial.reflectivityColor = new Color3(0.7, 0.7, 0.7);
    rockMaterial.microSurface = 0.9;
    rockMaterial.roughness = 0.5;
    rockMaterial.metallic = 0.2;
    rockMaterial.usePhysicalLightFalloff = true;
    rock.material = rockMaterial;

    // Add shadows
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(rock);
    }

    // Configure physics with automatic mesh collider
    const rockPhysicsConfig: PhysicsConfig = {
      colliderType: ColliderType.Sphere,
      colliderParams: {}, // auto: true
      physicsProps: {
        mass: 1, // Static
        friction: 0.8, // Rough surface
        restitution: 0.1 // Low bounciness
      }
    };

    // Instantiate PhysicsController
    try {
      new PhysicsController(this.scene, rock, rockPhysicsConfig);
    } catch (physicsError) {
      console.error("Failed to apply physics to rock:", physicsError);
    }
  }

  public getShadowGenerator(): CascadedShadowGenerator | null {
    return this.shadowGenerator;
  }
}