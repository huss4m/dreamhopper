import { Bone, Mesh } from "@babylonjs/core";
import { IItem } from "./IItem";
// Interface for attachable items
export interface IAttachableItem extends IItem {
    attachToBone(bone: Bone, boundMesh: Mesh): void;
  }