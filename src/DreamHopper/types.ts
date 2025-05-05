import { AbstractMesh, AnimationGroup, InstantiatedEntries, Mesh, Skeleton } from "@babylonjs/core";

export interface Character {
  colliderBox: Mesh | null;
  isJumping: boolean;
}

