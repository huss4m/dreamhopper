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
  public scene: Scene;
  private positionOffset: Vector3; 
  private rotationOffset: Vector3; 
  private scaling: Vector3;

  constructor(
    itemName: string,
    scene: Scene,
    assetContainer: AssetContainer | undefined,
    shadowGenerator: CascadedShadowGenerator,
    positionOffset: Vector3 = Vector3.Zero(), 
    rotationOffset: Vector3 = Vector3.Zero(), 
    scaling: Vector3 = new Vector3(1, 1, 1) 
  ) {
    this.scene = scene;
    this.name = itemName;
    this.parentMesh = new Mesh(`${itemName}Parent`, scene);
    this.shadowGenerator = shadowGenerator;
    this.positionOffset = positionOffset;
    this.rotationOffset = rotationOffset; 
    this.scaling = scaling;
    this.initializeMeshes(assetContainer);
  }

  private initializeMeshes(assetContainer: AssetContainer | undefined): void {
    try {
      if (!assetContainer || !assetContainer.meshes?.length) {
        throw new Error(`Asset container for '${this.name}' not found or has no meshes.`);
      }

      // console.log(`Loaded meshes for ${this.name}:`, assetContainer.meshes.map((m, i) => `Index ${i}: ${m.name}`));

      // Clone meshes instead of reparenting
      assetContainer.meshes.forEach((mesh, index) => {
        if (index === 0) {
          // console.log(`Skipping mesh at index 0: ${mesh.name}`);
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
      //this.shadowGenerator.addShadowCaster(this.parentMesh);
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
    return this.positionOffset.clone(); 
  }

  public getRotationOffset(): Vector3 {
    return this.rotationOffset.clone(); 
  }

  public getScaling(): Vector3 {
    return this.scaling.clone(); 
  }

  public setPositionOffset(offset: Vector3): void {
    this.positionOffset = offset.clone(); 
    this.parentMesh.position = this.positionOffset;
  }

  public setRotationOffset(offset: Vector3): void {
    this.rotationOffset = offset.clone(); 
    this.parentMesh.rotation = this.rotationOffset;
  }

  public setScaling(scaling: Vector3): void {
    this.scaling = scaling.clone(); 
    this.parentMesh.scaling = this.scaling;
  }

  public dispose(): void {
    if (this.parentMesh) {
      this.parentMesh.dispose();
    }
  }
}