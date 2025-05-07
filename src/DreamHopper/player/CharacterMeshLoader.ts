import {
    Scene,
    Mesh,
    Vector3,
    PBRMaterial,
    Color3,
    CascadedShadowGenerator,
    Tags,
    AssetContainer,
    AnimationGroup,
    Skeleton,
    AbstractMesh
  } from "@babylonjs/core";
  import { AssetManager } from "../AssetManager";
  
  export class CharacterMeshLoader {
    private characterMesh: Mesh | null = null;
    private skeleton: Skeleton | null = null;
    private animationGroups: AnimationGroup[] = [];
    assetManager: AssetManager;
    shadowGenerator: CascadedShadowGenerator

    constructor(
      private scene: Scene,
       assetManager: AssetManager,
       shadowGenerator: CascadedShadowGenerator
    ) {
      this.assetManager = assetManager;
      this.shadowGenerator=shadowGenerator;
    }
  
    public async loadCharacter(position: Vector3): Promise<void> {
      try {
        const guyAssetContainer = this.assetManager.getAssetContainer("guy");
        if (!guyAssetContainer) {
          console.error("Failed to load the 'guy' asset container.");
          return;
        }
  
        const clones = this.duplicate(guyAssetContainer, position);
        this.characterMesh = clones.rootNodes[0] as Mesh;
        this.skeleton = clones.skeletons[0];
        this.animationGroups = clones.animationGroups || [];
  
        //console.log(`Loaded ${this.animationGroups.length} animation groups:`, this.animationGroups.map(ag => ag.name));
  
        this.characterMesh.position = position;
        this.characterMesh.checkCollisions = true;
  
        this.characterMesh.getChildMeshes().forEach(mesh => {
          const mat = mesh.material as PBRMaterial;
          if (mat) {
            mat.metallic = 0.2;
            mat.roughness = 0.4;
            mat.albedoColor = mat.albedoColor || new Color3(1, 1, 1);
            mat.reflectivityColor = new Color3(0.3, 0.3, 0.3);
            mat.microSurface = 0.8;
          }
        });
  
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(this.characterMesh);
          this.characterMesh.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
        }
  
        Tags.AddTagsTo(this.characterMesh, "player");
      } catch (error) {
        console.error("Failed to load character:", error);
      }
    }
  
    private duplicate(container: AssetContainer, position: Vector3) {
      const entries = container.instantiateModelsToScene(undefined, false, { doNotInstantiate: false });
  
      const rootMesh = entries.rootNodes[0] as Mesh;
      this.characterMesh = rootMesh;
      this.skeleton = entries.skeletons[0];
      rootMesh.setEnabled(true);
      rootMesh.position = position;
  
      entries.rootNodes[0].getChildMeshes().forEach((mesh: AbstractMesh) => {
        mesh.setEnabled(true);
      });
  
      // Rename cloned animation groups to remove "Clone of" prefix
      entries.animationGroups.forEach((animGroup) => {
        if (animGroup.name.startsWith("Clone of ")) {
          animGroup.name = animGroup.name.replace("Clone of ", "");
        }
      });
  
      return entries;
    }
  
    public printBones(): void {
      if (this.skeleton && this.skeleton.bones.length > 0) {
        console.log("Bones in the skeleton:");
        this.skeleton.bones.forEach((bone, index) => {
          console.log(`Bone ${index}: ${bone.name}`);
        });
      } else {
        console.log("No skeleton found.");
      }
    }
  
    public getCharacterMesh(): Mesh | null {
      //console.log("GETCHARACTERMESH CALLED : ", this.characterMesh?.getChildMeshes());
      return this.characterMesh;
    }
  
    public getSkeleton(): Skeleton | null {
      return this.skeleton;
    }
  
    public getAnimationGroups(): AnimationGroup[] {
      return this.animationGroups;
    }
  
    public dispose(): void {
      if (this.characterMesh) {
        this.characterMesh.dispose();
        this.characterMesh = null;
      }
      this.skeleton = null;
      this.animationGroups.forEach(ag => ag.dispose());
      this.animationGroups = [];
    }
  }