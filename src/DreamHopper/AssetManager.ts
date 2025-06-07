import { Scene, SceneLoader, AssetContainer, AssetsManager } from "@babylonjs/core";

export class AssetManager {
  private scene: Scene | null;
  public assetList: { [key: string]: AssetContainer } = {};
  public assetsManager!: AssetsManager;

  constructor(scene: Scene | null) {
    this.scene = scene;
    this.assetsManager = new AssetsManager(scene!);
    this.assetsManager.useDefaultLoadingScreen = false;
    this.assetsManager.autoHideLoadingUI = false;
  }

  async initializeFromJson(jsonUrl: string, onProgress?: (percent: number) => void): Promise<void> {
  if (!this.scene) {
    console.error("Scene not set in AssetManager during initialization");
    return;
  }

  try {
    const response = await fetch(jsonUrl);
    const assets = await response.json();

    let loadedAssets = 0;
    const totalAssets = assets.length;

    assets.forEach((asset: { name: string; rootUrl: string; filename: string | File }) => {
      const task = this.assetsManager.addContainerTask(asset.name, "", asset.rootUrl, asset.filename);
      task.onSuccess = (task) => {
        this.assetList[asset.name] = task.loadedContainer;
        task.loadedContainer.meshes.forEach(mesh => mesh.setEnabled(false));
        task.loadedContainer.addAllToScene();
        loadedAssets++;
        if (onProgress) {
          onProgress((loadedAssets / totalAssets) * 100); // Report progress per asset
        }
      };
      task.onError = (task, message, exception) => {
        console.error(`Error loading asset '${asset.name}':`, message, exception);
      };
    });

    await this.assetsManager.loadAsync();
    if (onProgress) {
      onProgress(100); // Ensure 100% is reported when done
    }
  } catch (error) {
    console.error("Error loading assets from JSON:", error);
  }
}

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

  private async loadAsset(name: string, rootUrl: string, filename: string): Promise<void> {
    if (!this.scene) {
      throw new Error(`Cannot load asset '${name}' without a scene`);
    }

    try {
      const assetContainer = await SceneLoader.LoadAssetContainerAsync(rootUrl, filename, this.scene);
      this.assetList[name] = assetContainer;
      assetContainer.meshes.forEach(mesh => mesh.setEnabled(false));
      assetContainer.addAllToScene();
    } catch (error) {
      console.error(`Error loading asset '${name}':`, error);
    }
  }

  getAssetContainer(name: string): AssetContainer | undefined {
    return this.assetList[name];
  }

  setScene(scene: Scene | null): void {
    this.scene = scene;
    Object.values(this.assetList).forEach(container => {
      container.removeAllFromScene();
      if (scene) {
        container.addAllToScene();
      }
    });
  }

  dispose(): void {
    Object.values(this.assetList).forEach(container => {
      container.dispose();
    });
    this.assetList = {};
    this.scene = null;
  }
}