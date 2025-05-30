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
  AbstractMesh,
  MeshBuilder,
  StandardMaterial
} from "@babylonjs/core";
import { AssetManager } from "../AssetManager";

export class CharacterMeshLoader {
  private characterMesh: Mesh | null = null;
  private skeleton: Skeleton | null = null;
  private animationGroups: AnimationGroup[] = [];
  private hitboxMesh: Mesh | null = null;
  assetManager: AssetManager;
  shadowGenerator: CascadedShadowGenerator;

  constructor(
    private scene: Scene,
    assetManager: AssetManager,
    shadowGenerator: CascadedShadowGenerator
  ) {
    this.assetManager = assetManager;
    this.shadowGenerator = shadowGenerator;
  }

  public async loadCharacter(position: Vector3): Promise<void> {
    try {
      const guyAssetContainer = this.assetManager.getAssetContainer("caster");
      if (!guyAssetContainer) {
        console.error("Failed to load the 'caster' asset container.");
        return;
      }

      const clones = this.duplicate(guyAssetContainer, position);
      this.characterMesh = clones.rootNodes[0] as Mesh;
      this.skeleton = clones.skeletons[0];
      this.animationGroups = clones.animationGroups || [];

      console.log(`Loaded ${this.animationGroups.length} animation groups:`, this.animationGroups.map(ag => ag.name));

      this.characterMesh.position = position;
      this.characterMesh.checkCollisions = true;
      this.characterMesh.isPickable = true;

      if (this.shadowGenerator) {
        this.shadowGenerator.addShadowCaster(this.characterMesh);
        this.characterMesh.getChildMeshes().forEach(m => this.shadowGenerator.addShadowCaster(m));
      }

      Tags.AddTagsTo(this.characterMesh, "player");

          // Create player hitbox as a capsule
          this.hitboxMesh = MeshBuilder.CreateCapsule("player_hitbox", {
            height: 2,
            radius: 0.25,
            tessellation: 16
          }, this.scene);
          this.hitboxMesh.parent = this.characterMesh;
          this.hitboxMesh.position = new Vector3(0, 1, 0); // Center at torso
          this.hitboxMesh.checkCollisions = false;
          this.hitboxMesh.isPickable = true;
          this.hitboxMesh.isVisible = true; // Visible for debugging
    
          const hitboxMaterial = new StandardMaterial("player_hitbox_mat", this.scene);
          hitboxMaterial.alpha = 0.5; // Semi-transparent
          hitboxMaterial.diffuseColor = new Color3(0, 0, 1); // Blue for visibility
          this.hitboxMesh.material = hitboxMaterial;

      Tags.EnableFor(this.hitboxMesh);
      Tags.AddTagsTo(this.hitboxMesh, "player hitbox");
      console.log(`Player hitbox created: ${this.hitboxMesh.name}, isVisible: ${this.hitboxMesh.isVisible}, isPickable: ${this.hitboxMesh.isPickable}, tags: ${Tags.GetTags(this.hitboxMesh)}`);

      if (this.shadowGenerator) {
        this.shadowGenerator.removeShadowCaster(this.hitboxMesh);
      }

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
    return this.characterMesh;
  }

  public getSkeleton(): Skeleton | null {
    return this.skeleton;
  }

  public getAnimationGroups(): AnimationGroup[] {
    return this.animationGroups;
  }

  public dispose(): void {
    if (this.hitboxMesh) {
      this.hitboxMesh.dispose();
      this.hitboxMesh = null;
    }
    if (this.characterMesh) {
      this.characterMesh.dispose();
      this.characterMesh = null;
    }
    this.skeleton = null;
    this.animationGroups.forEach(ag => ag.dispose());
    this.animationGroups = [];
  }
}