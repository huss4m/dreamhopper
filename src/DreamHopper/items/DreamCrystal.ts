import { Scene, Mesh, Vector3, CascadedShadowGenerator, AssetContainer, Observable, BoundingBox, GlowLayer, PointLight, Color3, StandardMaterial } from "@babylonjs/core";
import { Item } from "./Item";

export class DreamCrystal extends Item {
  private isCollected = false;
  private onCollected: Observable<DreamCrystal> = new Observable();
  private showBoundingBoxes = false;
  private rotationSpeed = 0.02; // Radians per frame
  private glowLayer: GlowLayer | null;
  private pointLight: PointLight;
  private pulseTime = 0;

  constructor(
    itemName: string,
    scene: Scene,
    assetContainer: AssetContainer | undefined,
    shadowGenerator: CascadedShadowGenerator,
    playerMesh: Mesh,
    glowLayer: GlowLayer | null,
    positionOffset: Vector3 = Vector3.Zero(),
    rotationOffset: Vector3 = Vector3.Zero(),
    scaling: Vector3 = new Vector3(1.5, 1.5, 1.5)
  ) {
    super(itemName, scene, assetContainer, shadowGenerator, positionOffset, rotationOffset, scaling);
    
    this.glowLayer = glowLayer;
    const crystalMesh = this.getCrystalMesh();

    // Setup material with emissive color for glow
    let material = crystalMesh.material as StandardMaterial;
    if (!material || !(material instanceof StandardMaterial)) {
      material = new StandardMaterial(`${itemName}_material`, scene);
      crystalMesh.material = material;
    }
    material.emissiveColor = new Color3(0.5, 0.25, 0.4); // Stronger pinkish emissive for glow
    material.diffuseColor = new Color3(1, 0.5, 0.8); // Pinkish diffuse
    material.specularColor = new Color3(0.1, 0.1, 0.1); // Minimize shininess
    console.log(`Material for ${itemName}: emissiveColor=${material.emissiveColor.toString()}, diffuseColor=${material.diffuseColor.toString()}`);

  
    // Setup pinkish point light at mesh center
    crystalMesh.computeWorldMatrix(true); // Ensure matrix is updated
    const boundingBox = crystalMesh.getBoundingInfo().boundingBox;
    const centerWorld = boundingBox.centerWorld; // World-space center of mesh
    this.pointLight = new PointLight(`${itemName}_light`, centerWorld, scene);
    this.pointLight.diffuse = new Color3(1, 0.5, 0.8); // Pinkish color
    this.pointLight.intensity = 50.0; // Balanced intensity
    this.pointLight.range = 5; // Adjust range

    console.log(`Initialized ${itemName}: Mesh Position=${crystalMesh.position.toString()}, Light Position=${centerWorld.toString()}, BoundingBox Center=${centerWorld.toString()}, Visible=${crystalMesh.isVisible}, Enabled=${crystalMesh.isEnabled()}`);
    
    this.setupCollision(playerMesh);
    this.setupAnimation();
    this.setupBoundingBoxToggle();
  }

  public getCrystalMesh(): Mesh {
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
        crystalMesh.rotation.y += this.rotationSpeed;
        parentMesh.rotation.y += this.rotationSpeed;
        // Update light position to stay at mesh center
        crystalMesh.computeWorldMatrix(true);
        const centerWorld = crystalMesh.getBoundingInfo().boundingBox.centerWorld;
        this.pointLight.position = centerWorld;
        // Pulse the point light
        this.pulseTime += this.scene.getAnimationRatio() * 0.05;
        this.pointLight.intensity = 50.0 + Math.sin(this.pulseTime) * 10.0; // Pulse between 40 and 60
        console.log(`Animating ${this.getName()}: Light Position=${centerWorld.toString()}, Intensity=${this.pointLight.intensity.toFixed(2)}`);
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
    this.getCrystalMesh().isVisible = false; // Hide mesh to remove from glow layer
    this.pointLight.setEnabled(false); // Disable light
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
    this.getCrystalMesh().isVisible = false; // Ensure mesh is hidden
    this.pointLight.dispose();
    super.dispose();
  }
}