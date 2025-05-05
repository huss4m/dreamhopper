import { Scene, SceneLoader, AssetContainer, AbstractMesh } from "@babylonjs/core";

export class AssetManager {
  private scene: Scene;
  public assetList: { [key: string]: AssetContainer } = {};

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // Initialize and load assets 
  async initialize(): Promise<void> {
    console.log("Initializing assets...");
  
    try {
      await this.loadAsset("guy", "./models/", "guy2.glb");
      await this.loadAsset("sword", "./models/", "steel_sword.glb");

      await this.loadAsset("sword_of_artorias", "./models/", "sword_of_artorias.glb");

      console.log("Assets loaded successfully.");
    } catch (error) {
      console.error("Error loading assets:", error);
    }
  }

  // Load a specific asset into the asset container
  private async loadAsset(name: string, rootUrl: string, filename: string): Promise<void> {
    try {
      const assetContainer = await SceneLoader.LoadAssetContainerAsync(rootUrl, filename, this.scene);
      this.assetList[name] = assetContainer;  // Store in the asset list

      assetContainer.meshes.forEach(mesh => mesh.setEnabled(false));
     
      assetContainer.addAllToScene();
    } catch (error) {
      console.error(`Error loading asset '${name}':`, error);
    }
  }

  // Get a loaded asset container by name
  getAssetContainer(name: string): AssetContainer | undefined {
    return this.assetList[name];
  }
}