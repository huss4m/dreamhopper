import {
  Scene,
  Mesh,
  Vector3,
  CascadedShadowGenerator,
  AssetContainer,
} from "@babylonjs/core";

export class Item {
  private parentMesh: Mesh;
  private name: string;
  private shadowGenerator: CascadedShadowGenerator;
  private scene: Scene;
  private positionOffset: Vector3; // Store position offset
  private rotationOffset: Vector3; // Store rotation offset
  private scaling: Vector3; // Store scaling

  constructor(
    itemName: string,
    scene: Scene,
    assetContainer: AssetContainer | undefined,
    shadowGenerator: CascadedShadowGenerator,
    positionOffset: Vector3 = Vector3.Zero(), // Default to zero vector
    rotationOffset: Vector3 = Vector3.Zero(), // Default to zero vector
    scaling: Vector3 = new Vector3(1, 1, 1) 
  ) {
    this.scene = scene;
    this.name = itemName;
    this.parentMesh = new Mesh(`${itemName}Parent`, scene);
    this.shadowGenerator = shadowGenerator;
    this.positionOffset = positionOffset; // Store position offset
    this.rotationOffset = rotationOffset; // Store rotation offset
    this.scaling = scaling; // Store scaling
    this.initializeMeshes(assetContainer);
  }

  private initializeMeshes(assetContainer: AssetContainer | undefined): void {
    try {
      if (!assetContainer || !assetContainer.meshes?.length) {
        throw new Error(`Asset container for '${this.name}' not found or has no meshes.`);
      }

      console.log(`Loaded meshes for ${this.name}:`, assetContainer.meshes.map((m, i) => `Index ${i}: ${m.name}`));

      // Clone meshes instead of reparenting
      assetContainer.meshes.forEach((mesh, index) => {
        if (index === 0) {
          console.log(`Skipping mesh at index 0: ${mesh.name}`);
          return;
        }
        const clonedMesh = mesh.clone(`${mesh.name}_clone`, this.parentMesh); // Clone and parent to parentMesh
        if (clonedMesh) {
          clonedMesh.isVisible = true;
          clonedMesh.setEnabled(true);
        }
      });

      if (this.parentMesh.getChildMeshes().length === 0) {
        throw new Error(`No child meshes attached to ${this.name}Parent. Meshes in container: ${assetContainer.meshes.map(m => m.name).join(", ")}`);
      }

      // Apply stored offsets and scaling
      this.parentMesh.position = this.positionOffset;
      this.parentMesh.rotation = this.rotationOffset;
      this.parentMesh.scaling = this.scaling;
      this.shadowGenerator.addShadowCaster(this.parentMesh);
    } catch (err) {
      console.error(`Error initializing item '${this.name}':`, err);
      this.parentMesh.dispose();
      throw err;
    }
  }

  public getParentMesh(): Mesh {
    return this.parentMesh;
  }

  public getName(): string {
    return this.name;
  }

  public getPositionOffset(): Vector3 {
    return this.positionOffset.clone(); // Return a clone to prevent external modification
  }

  public getRotationOffset(): Vector3 {
    return this.rotationOffset.clone(); // Return a clone to prevent external modification
  }

  public getScaling(): Vector3 {
    return this.scaling.clone(); // Return a clone to prevent external modification
  }

  public setPositionOffset(offset: Vector3): void {
    this.positionOffset = offset.clone(); // Store a clone to prevent external modification
    this.parentMesh.position = this.positionOffset;
  }

  public setRotationOffset(offset: Vector3): void {
    this.rotationOffset = offset.clone(); // Store a clone to prevent external modification
    this.parentMesh.rotation = this.rotationOffset;
  }

  public setScaling(scaling: Vector3): void {
    this.scaling = scaling.clone(); // Store a clone to prevent external modification
    this.parentMesh.scaling = this.scaling;
  }

  public dispose(): void {
    if (this.parentMesh) {
      this.parentMesh.dispose();
    }
  }
}