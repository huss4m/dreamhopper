import { ArcRotateCamera, AssetContainer, Engine, Scene } from "@babylonjs/core";
import { SceneCreator } from "./SceneCreator";
import { CharacterController } from "./CharacterController";
import { InputHandler } from "./InputHandler";
import { EnvironmentCreator } from "./EnvironmentCreator";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";

export class Game {
  private engine: Engine;
  private scene: Scene;
  private characterController!: CharacterController;
  private inputHandler!: InputHandler;
  private environmentCreator: EnvironmentCreator;
  assetManager!: AssetManager;
  guyAssetContainer!: AssetContainer;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    const sceneCreator = new SceneCreator(this.engine, canvas);
    this.scene = sceneCreator.createScene();

    this.environmentCreator = new EnvironmentCreator(this.scene);

    this.assetManager = new AssetManager(this.scene);
    //this.guyAssetContainer = this.assetManager.guyAssetContainer;

    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.environmentCreator.createEnvironment();


    // Load all assets
await this.assetManager.initialize();  // Wait until all assets are loaded
console.log("All assets loaded.");
const shadowGenerator = this.environmentCreator.getShadowGenerator();
if (!shadowGenerator) {
  console.error("Shadow generator not initialized!");
  return;
}
// Get the guy asset container (once it's loaded)
const guyAssetContainer = this.assetManager!.getAssetContainer("guy");

// Ensure the asset was successfully loaded before proceeding
if (!guyAssetContainer) {
  console.error("guyAssetContainer is undefined");
  return;
} 

  //console.log("LOADED asset:", this.assetManager.getAssetContainer("guy"));
  this.characterController = new CharacterController(
    this.scene,
    this.canvas,
    this.scene.activeCamera as ArcRotateCamera,
    shadowGenerator,
    this.assetManager 
  );

     //this.guyAssetContainer = this.assetManager.guyAssetContainer;

   


    this.inputHandler = new InputHandler(this.scene, this.characterController, this.canvas);

    this.engine.runRenderLoop(() => {
      this.inputHandler.update();
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  public dispose(): void {
    this.characterController.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}