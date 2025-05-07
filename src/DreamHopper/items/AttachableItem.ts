import { Scene, AssetContainer, CascadedShadowGenerator, Vector3, Bone, Mesh } from "@babylonjs/core";
import { IAttachableItem } from "./IAttachableItem";
import { Item } from "./Item";

export class AttachableItem extends Item implements IAttachableItem {
    constructor(
      itemName: string,
      scene: Scene,
      assetContainer: AssetContainer | undefined,
      shadowGenerator: CascadedShadowGenerator,
      positionOffset: Vector3 = Vector3.Zero(),
      rotationOffset: Vector3 = Vector3.Zero(),
      scaling: Vector3 = new Vector3(1, 1, 1)
    ) {
      super(itemName, scene, assetContainer, shadowGenerator, positionOffset, rotationOffset, scaling);
    }
  
    public attachToBone(bone: Bone, boundMesh: Mesh): void {
      const itemMesh = this.getParentMesh();
      itemMesh.attachToBone(bone, boundMesh);
    }
  }