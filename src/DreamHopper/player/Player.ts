import { Scene, CascadedShadowGenerator, Vector3 } from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { Item } from "../items/Item";

export class Player {
  private inventory: Item[] = [];
  
  isSheathed = false;

  posOffset: Vector3;
  rotOffset: Vector3;

  constructor(scene: Scene, assetManager: AssetManager, shadowGenerator: CascadedShadowGenerator) {

    if(this.isSheathed) {
      this.posOffset = new Vector3(0, 0, -0.21);
      this.rotOffset = new Vector3(-11*Math.PI/12, Math.PI/11, +Math.PI/3);
    }
    else {
      this.posOffset = new Vector3(0.8, 0.05, 0.05);
      this.rotOffset = new Vector3(Math.PI, 0, 0);
    }

    // Initialize with default swords, including specific offsets
    this.addItem(new Item(
      "sword1",
      scene,
      assetManager.getAssetContainer("dragon_slayer"),
      shadowGenerator,
      this.posOffset, // Position offset for sword
      this.rotOffset, // Rotation offset for sword
      new Vector3(1.2, 1.2, 1.2) // Scaling for sword
    ));


    
    /*

    this.addItem(new Item(
      "sword1",
      scene,
      assetManager.getAssetContainer("dragon_slayer"),
      shadowGenerator,
      new Vector3(0.8, 0.1, 0), // Position offset for sword
      new Vector3(0, 0, 0), // Rotation offset for sword
      new Vector3(1.2, 1.2, 1.2) // Scaling for sword
    ));

    this.addItem(new Item(
      "sword2",
      scene,
      assetManager.getAssetContainer("sword_of_artorias"),
      shadowGenerator,
      new Vector3(-15, 7, 0), // Position offset for sword_of_artorias
      new Vector3(Math.PI/2, Math.PI, 0), // Rotation offset for sword_of_artorias
      new Vector3(5, 5, 5) // Scaling for sword_of_artorias
    ));
    */
  }

  public getInventory(): Item[] {
    return [...this.inventory]; // Return a copy to prevent external modification
  }

  public addItem(item: Item): void {
    if (!this.inventory.some(i => i.getName() === item.getName())) {
      this.inventory.push(item);
      //console.log(`Added ${item.getName()} to inventory`);
    } else {
      //console.log(`${item.getName()} already in inventory`);
      item.dispose(); // Dispose unused item to prevent memory leaks
    }
  }

  public removeItem(itemName: string): void {
    const index = this.inventory.findIndex(i => i.getName() === itemName);
    if (index !== -1) {
      const item = this.inventory[index];
      this.inventory.splice(index, 1);
      item.dispose(); // Dispose item to free resources
      //console.log(`Removed ${itemName} from inventory`);
    } else {
      //console.log(`${itemName} not found in inventory`);
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
}