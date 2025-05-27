import { Scene, Mesh, Vector3, CascadedShadowGenerator, AssetContainer, Observable, BoundingBox } from "@babylonjs/core";
import { Item } from "./Item";

export class DreamCrystal extends Item {
  private isCollected = false;
  private onCollected: Observable<DreamCrystal> = new Observable();
  private showBoundingBoxes = false;
  private rotationSpeed = 0.02; // Radians per frame

  constructor(
    itemName: string,
    scene: Scene,
    assetContainer: AssetContainer | undefined,
    shadowGenerator: CascadedShadowGenerator,
    playerMesh: Mesh,
    positionOffset: Vector3 = Vector3.Zero(),
    rotationOffset: Vector3 = Vector3.Zero(),
    scaling: Vector3 = new Vector3(1.5, 1.5, 1.5)
  ) {
    super(itemName, scene, assetContainer, shadowGenerator, positionOffset, rotationOffset, scaling);
    this.setupCollision(playerMesh);
    this.setupAnimation();
    this.setupBoundingBoxToggle();
  }

  private getCrystalMesh(): Mesh {
    const parentMesh = this.getParentMesh();
    const childMeshes = parentMesh.getChildMeshes();
    console.log(`Crystal ${this.getName()} child meshes:`, childMeshes.map(m => m.name));
    const childMesh = childMeshes[0] as Mesh;
    if (!childMesh) {
      console.warn(`No child mesh found for ${this.getName()}, using parentMesh`);
      return parentMesh;
    }
    return childMesh;
  }

  private setupCollision(playerMesh: Mesh): void {
    const crystalMesh = this.getCrystalMesh();
    if (!crystalMesh || !playerMesh) {
      console.error(`Invalid mesh for ${this.getName()} collision setup: crystalMesh=${crystalMesh}, playerMesh=${playerMesh}`);
      return;
    }

    console.log(`Setting up collision for ${this.getName()}:`);
    console.log("Player mesh:", playerMesh.name, "Position:", playerMesh.position.toString());
    console.log("Crystal mesh:", crystalMesh.name, "Position:", crystalMesh.position.toString());

    this.scene.registerBeforeRender(() => {
      if (!this.isCollected && crystalMesh.isEnabled()) {
        crystalMesh.computeWorldMatrix(true);
        playerMesh.computeWorldMatrix(true);
        crystalMesh.refreshBoundingInfo();
        playerMesh.refreshBoundingInfo();

        const crystalBB = crystalMesh.getBoundingInfo()?.boundingBox;
        const playerBB = playerMesh.getBoundingInfo()?.boundingBox;
       // console.log("Crystal BB:", crystalBB ? { min: crystalBB.minimum.toString(), max: crystalBB.maximum.toString() } : "null");
       // console.log("Player BB:", playerBB ? { min: playerBB.minimum.toString(), max: playerBB.maximum.toString() } : "null");

        crystalMesh.showBoundingBox = this.showBoundingBoxes;
        playerMesh.showBoundingBox = this.showBoundingBoxes;
        playerMesh.getChildMeshes().forEach(m => m.showBoundingBox = this.showBoundingBoxes);

        const meshesToCheck = [playerMesh, ...playerMesh.getChildMeshes()].filter(m => m.isEnabled());
        const intersects = meshesToCheck.some(childMesh =>
          crystalMesh.intersectsMesh(childMesh, false)
        );

        if (intersects) {
          console.log(`Intersection detected for ${this.getName()} at position ${crystalMesh.position.toString()}`);
          console.log("Distance to player:", Vector3.Distance(crystalMesh.position, playerMesh.position));
          this.collect();
        }
      }
    });
  }

  private setupAnimation(): void {
    const crystalMesh = this.getCrystalMesh();
    const parentMesh = this.getParentMesh();
    this.scene.registerBeforeRender(() => {
      if (!this.isCollected && parentMesh.isEnabled()) {
        // Try rotating child mesh
        crystalMesh.rotation.y += this.rotationSpeed;
        // Fallback: Rotate parent mesh if child rotation isn't visible
        parentMesh.rotation.y += this.rotationSpeed;
        //console.log(`Animating ${this.getName()}: Child Y=${crystalMesh.rotation.y.toFixed(2)}, Parent Y=${parentMesh.rotation.y.toFixed(2)}, Child Enabled=${crystalMesh.isEnabled()}, Parent Enabled=${parentMesh.isEnabled()}`);

       
      }
    });
  }

  private setupBoundingBoxToggle(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === 1 && kbInfo.event.key === "b") {
        this.showBoundingBoxes = !this.showBoundingBoxes;
        console.log(`Bounding boxes ${this.showBoundingBoxes ? "enabled" : "disabled"} for ${this.getName()}`);
      }
    });
  }

  private collect(): void {
    if (this.isCollected) return;

    this.isCollected = true;
    this.getParentMesh().setEnabled(false);
    this.onCollected.notifyObservers(this);
    console.log(`${this.getName()} collected!`);
  }

  public getOnCollectedObservable(): Observable<DreamCrystal> {
    return this.onCollected;
  }

  public isCrystalCollected(): boolean {
    return this.isCollected;
  }

  public dispose(): void {
    super.dispose();
  }
}