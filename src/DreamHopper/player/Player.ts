import { Scene, CascadedShadowGenerator, Vector3 } from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { Item } from "../items/Item";

export class Player {
  private inventory: Item[] = [];
  private collectedCrystals = 0;
  private totalCrystals = 0;
  isSheathed = false;
  posOffset: Vector3;
  rotOffset: Vector3;

  constructor(scene: Scene, assetManager: AssetManager, shadowGenerator: CascadedShadowGenerator) {
    if (this.isSheathed) {
      this.posOffset = new Vector3(0, 0, -0.21);
      this.rotOffset = new Vector3(-11 * Math.PI / 12, Math.PI / 11, +Math.PI / 3);
    } else {
      this.posOffset = new Vector3(0.8, 0.05, 0.05);
      this.rotOffset = new Vector3(Math.PI, 0, 0);
    }

    this.addItem(new Item(
      "sword1",
      scene,
      assetManager.getAssetContainer("dragon_slayer"),
      shadowGenerator,
      this.posOffset,
      this.rotOffset,
      new Vector3(1.2, 1.2, 1.2)
    ));
  }

  public getInventory(): Item[] {
    return [...this.inventory];
  }

  public addItem(item: Item): void {
    if (!this.inventory.some(i => i.getName() === item.getName())) {
      this.inventory.push(item);
      console.log(`Added ${item.getName()} to inventory`);
    } else {
      console.log(`${item.getName()} already in inventory`);
      item.dispose();
    }
  }

  public removeItem(itemName: string): void {
    const index = this.inventory.findIndex(i => i.getName() === itemName);
    if (index !== -1) {
      const item = this.inventory[index];
      this.inventory.splice(index, 1);
      item.dispose();
      console.log(`Removed ${itemName} from inventory`);
    } else {
      console.log(`${itemName} not found in inventory`);
    }
  }

  public hasItem(itemName: string): boolean {
    return this.inventory.some(i => i.getName() === itemName);
  }

  public sheathe() {
    this.isSheathed = true;
  }

  public unSheathe() {
    this.isSheathed = false;
  }

  public incrementCrystalCount(): void {
    this.collectedCrystals++;
    console.log(`Player: Collected crystal, now ${this.collectedCrystals}/${this.totalCrystals}`);
  }

  public setTotalCrystals(total: number): void {
    this.totalCrystals = total;
    console.log(`Player: Set total crystals to ${this.totalCrystals}`);
  }

  public getCollectedCrystals(): number {
    return this.collectedCrystals;
  }

  public getTotalCrystals(): number {
    return this.totalCrystals;
  }

  public resetCrystalCount(): void {
    this.collectedCrystals = 0;
    this.totalCrystals = 0;
    console.log("Player: Reset crystal count");
  }
}