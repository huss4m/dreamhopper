import { Scene, Vector3, CascadedShadowGenerator, AssetContainer, Observable, Mesh } from "@babylonjs/core";
import { DreamCrystal } from "./DreamCrystal";

export interface DreamCrystalState {
  positions: Vector3[];
  collected: boolean[];
}

export class DreamCrystalManager {
  private scene: Scene;
  private assetContainer: AssetContainer | undefined;
  private shadowGenerator: CascadedShadowGenerator;
  private playerMesh: Mesh; 
  private dreamCrystals: DreamCrystal[] = [];
  private collectedCrystals = 0;
  private totalCrystals = 0;
  private onAllCrystalsCollected: Observable<void> = new Observable();

  constructor(scene: Scene, assetContainer: AssetContainer | undefined, shadowGenerator: CascadedShadowGenerator, playerMesh: Mesh) {
    this.scene = scene;
    this.assetContainer = assetContainer;
    this.shadowGenerator = shadowGenerator;
    this.playerMesh = playerMesh;
  }

  public initialize(positions: Vector3[], collectedStates: boolean[] = []): void {
    this.dreamCrystals.forEach(crystal => crystal.dispose());
    this.dreamCrystals = [];
    this.collectedCrystals = 0;
    this.totalCrystals = positions.length;

    positions.forEach((position, i) => {
      const isCollected = collectedStates[i] || false;
      if (!isCollected) {
        const crystal = new DreamCrystal(
          `dreamCrystal_${i}`,
          this.scene,
          this.assetContainer,
          this.shadowGenerator,
          this.playerMesh, 
          position,
          new Vector3(0, 0, 0),
          new Vector3(0.2, 0.2, 0.2)
        );
        crystal.getOnCollectedObservable().add(() => this.onCrystalCollected());
        this.dreamCrystals.push(crystal);
        if (collectedStates[i]) {
          crystal.getParentMesh().setEnabled(false);
          this.collectedCrystals++;
        }
      } else {
        this.collectedCrystals++;
      }
    });

    console.log(`Initialized ${this.totalCrystals} DreamCrystals, ${this.collectedCrystals} already collected.`);
  }

  private onCrystalCollected(): void {
    this.collectedCrystals++;
    console.log(`Collected ${this.collectedCrystals}/${this.totalCrystals} DreamCrystals`);
    if (this.collectedCrystals >= this.totalCrystals) {
      this.onAllCrystalsCollected.notifyObservers();
    }
  }

  public getState(): DreamCrystalState {
    return {
      positions: this.dreamCrystals.map(crystal => crystal.getPositionOffset()),
      collected: this.dreamCrystals.map(crystal => crystal.isCrystalCollected()),
    };
  }

  public getOnAllCrystalsCollected(): Observable<void> {
    return this.onAllCrystalsCollected;
  }

  public dispose(): void {
    this.dreamCrystals.forEach(crystal => crystal.dispose());
    this.dreamCrystals = [];
    this.collectedCrystals = 0;
    this.totalCrystals = 0;
  }
}