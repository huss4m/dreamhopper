import {
    Scene,
    Mesh,
    Vector3,
    PBRMaterial,
    Color3,
    CascadedShadowGenerator,
    AssetContainer,
    Skeleton
  } from "@babylonjs/core";
  import { AssetManager } from "./AssetManager";
  
  export class ItemAttachmentManager {
    private sword: Mesh | null = null;
  
    constructor(
      private scene: Scene,
      private assetManager: AssetManager,
      private shadowGenerator: CascadedShadowGenerator
    ) {}
  
    public async attachItemToHand(
      itemName: string,
      boneName: string,
      skeleton: Skeleton,
      characterMesh: Mesh,
      positionOffset: Vector3 = Vector3.Zero(),
      rotationOffset: Vector3 = Vector3.Zero(),
      scaling: Vector3 = new Vector3(1, 1, 1)
    ): Promise<void> {
      try {
        const itemAssetContainer = this.assetManager.getAssetContainer(itemName);
        if (!itemAssetContainer || !itemAssetContainer.meshes || itemAssetContainer.meshes.length === 0) {
          console.error(`No meshes found for the item '${itemName}' in the asset container.`);
          return;
        }
  
        console.log(`Loaded meshes for ${itemName}:`, itemAssetContainer.meshes.map((m, i) => `Index ${i}: ${m.name}`));
  
        const itemParent = new Mesh(`${itemName}Parent`, this.scene);
        itemAssetContainer.meshes.forEach((mesh, index) => {
          if (index === 0) return;
          mesh.parent = itemParent;
          mesh.isVisible = true;
          mesh.setEnabled(true);
        });
  
        if (itemParent.getChildMeshes().length === 0) {
          console.error(`No child meshes attached to ${itemName}Parent`);
          return;
        }
  
        this.shadowGenerator.addShadowCaster(itemParent);
  
        const boundMesh = characterMesh.getChildMeshes().find(m => m.skeleton === skeleton) || characterMesh;
        if (!boundMesh) {
          console.error("No mesh found with the bound skeleton");
          return;
        }
  
        const bone = skeleton.bones.find((b: { name: string }) => b.name === boneName);
        if (!bone) {
          console.error(`Bone '${boneName}' not found.`);
          return;
        }
  
        itemParent.position = Vector3.Zero();
        itemParent.rotation = Vector3.Zero();
        itemParent.scaling = scaling;
  
        itemParent.attachToBone(bone, boundMesh);
  
        itemParent.position.addInPlace(positionOffset);
        itemParent.rotation.addInPlace(rotationOffset);
  
        if (itemName === "sword") {
          this.sword = itemParent;
        }
      } catch (err) {
        console.error(`Error in attachItemToHand for item '${itemName}':`, err);
      }
    }
  
    public getSword(): Mesh | null {
      return this.sword;
    }
  
    public dispose(): void {
      if (this.sword) {
        this.sword.dispose();
        this.sword = null;
      }
    }
  }