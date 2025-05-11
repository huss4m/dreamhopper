import {
  Scene,
  Mesh,
  Vector3,
  CascadedShadowGenerator,
  Skeleton,
  Bone,
} from "@babylonjs/core";
import { Item } from "./Item";

export class ItemAttachmentManager {
  constructor(
    private scene: Scene,
    private shadowGenerator: CascadedShadowGenerator
  ) {}

  public async attachItemToHand(
    item: Item,
    boneName: string,
    skeleton: Skeleton,
    characterMesh: Mesh,
    positionOffset: Vector3 = item.getPositionOffset(), // Default to item's stored offset
    rotationOffset: Vector3 = item.getRotationOffset(), // Default to item's stored offset
    scaling: Vector3 = item.getScaling() // Default to item's stored scaling
  ): Promise<void> {
    try {
      const boundMesh = characterMesh.getChildMeshes().find(m => m.skeleton === skeleton) || characterMesh;
      if (!boundMesh) {
        throw new Error("No mesh found with the bound skeleton");
      }
  
      const bone = skeleton.bones.find((b: Bone) => b.name === boneName);
      if (!bone) {
        throw new Error(`Bone '${boneName}' not found. Available bones: ${skeleton.bones.map(b => b.name).join(", ")}`);
      }
  
      const itemMesh = item.getParentMesh();
      item.setScaling(scaling); // Apply scaling (or keep stored scaling)
      itemMesh.attachToBone(bone, boundMesh);
  
      item.setPositionOffset(positionOffset); // Apply position offset (or keep stored offset)
      item.setRotationOffset(rotationOffset); // Apply rotation offset (or keep stored offset)
    } catch (err) {
      console.error(`Error attaching item '${item.getName()}' to bone '${boneName}':`, err);
    }
  }

  public detachItem(item: Item): void {
    try {
      const itemMesh = item.getParentMesh();
      
      // Detach the item mesh from the bone
      itemMesh.detachFromBone();
  
   
      itemMesh.parent = null;
  
      console.log(`Item '${item.getName()}' detached from bone.`);
    } catch (err) {
      console.error(`Error detaching item '${item.getName()}':`, err);
    }
  }
  public dispose(): void {
    // No items stored locally; Player handles disposal
  }
}