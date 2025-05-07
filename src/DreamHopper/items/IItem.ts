import { Scene, Mesh, Vector3, CascadedShadowGenerator, AssetContainer, Skeleton, Bone } from "@babylonjs/core";

// Base interface for all items
export interface IItem {
    getParentMesh(): Mesh;
    getName(): string;
    getPositionOffset(): Vector3;
    getRotationOffset(): Vector3;
    getScaling(): Vector3;
    setPositionOffset(offset: Vector3): void;
    setRotationOffset(offset: Vector3): void;
    setScaling(scaling: Vector3): void;
    dispose(): void;
  }