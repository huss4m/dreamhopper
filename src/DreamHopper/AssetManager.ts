import { Scene, SceneLoader, AssetContainer } from "@babylonjs/core";

export class AssetManager {
  private scene: Scene | null;
  public assetList: { [key: string]: AssetContainer } = {};

  constructor(scene: Scene | null) {
    this.scene = scene;
  }

  // Initialize and load assets from Json file (models/assets.json)
  async initializeFromJson(jsonUrl: string): Promise<void> {
    if (!this.scene) {
      console.error("Scene not set in AssetManager during initialization");
      return;
    }
  
    console.log("Initializing assets from JSON...");
  
    try {
      const response = await fetch(jsonUrl);
      const assets = await response.json();
  
      for (const asset of assets) {
        await this.loadAsset(asset.name, asset.rootUrl, asset.filename);
      }
  
      console.log("Assets loaded successfully from JSON.");
    } catch (error) {
      console.error("Error loading assets from JSON:", error);
    }
  }

  // Load a JSON file and return its parsed content
  async loadJson(jsonUrl: string): Promise<any> {
    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JSON from ${jsonUrl}: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error loading JSON from ${jsonUrl}:`, error);
      return {};
    }
  }

  // Load a specific asset into the asset container
  private async loadAsset(name: string, rootUrl: string, filename: string): Promise<void> {
    if (!this.scene) {
      throw new Error(`Cannot load asset '${name}' without a scene`);
    }

    try {
      const assetContainer = await SceneLoader.LoadAssetContainerAsync(rootUrl, filename, this.scene);
      this.assetList[name] = assetContainer; // Store in the asset list

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

  // Update the scene for the AssetManager
  setScene(scene: Scene | null): void {
    this.scene = scene;
    // Update existing assets to use the new scene
    Object.values(this.assetList).forEach(container => {
      container.removeAllFromScene();
      if (scene) {
        container.addAllToScene();
      }
    });
  }

  // Dispose of all assets
  dispose(): void {
    Object.values(this.assetList).forEach(container => {
      container.dispose();
    });
    this.assetList = {};
    this.scene = null;
  }
}