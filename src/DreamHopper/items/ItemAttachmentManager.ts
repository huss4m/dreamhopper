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
    positionOffset: Vector3 = item.getPositionOffset(), 
    rotationOffset: Vector3 = item.getRotationOffset(), 
    scaling: Vector3 = item.getScaling()
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
      item.setScaling(scaling); 
      itemMesh.attachToBone(bone, boundMesh);
  
      item.setPositionOffset(positionOffset); 
      item.setRotationOffset(rotationOffset); 
    } catch (err) {
      console.error(`Error attaching item '${item.getName()}' to bone '${boneName}':`, err);
    }
  }

  public detachItem(item: Item): void {
    try {
      const itemMesh = item.getParentMesh();
      
    
      itemMesh.detachFromBone();
  
   
      itemMesh.parent = null;
  
      // console.log(`Item '${item.getName()}' detached from bone.`);
    } catch (err) {
      console.error(`Error detaching item '${item.getName()}':`, err);
    }
  }
  public dispose(): void {
    // No items stored locally; Player handles disposal
  }
}