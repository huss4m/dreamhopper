import { ArcRotateCamera, AssetContainer, Engine, HighlightLayer, Scene, Vector3 } from "@babylonjs/core";
import { SceneCreator } from "./SceneCreator";
import { CharacterController } from "./player/CharacterController";
import { InputHandler } from "./InputHandler";
import { EnvironmentCreator } from "./EnvironmentCreator";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";
import { NPC } from "./NPC";
import { TargetingSystem } from "./TargetingSystem";

export class Game {
  private engine: Engine;
  private scene: Scene;
  private characterController!: CharacterController;
  private inputHandler!: InputHandler;
  private environmentCreator: EnvironmentCreator;
  private targetingSystem: TargetingSystem;
  assetManager!: AssetManager;
  highlightLayer: HighlightLayer;
  npcs: NPC[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    const sceneCreator = new SceneCreator(this.engine, canvas);
    this.scene = sceneCreator.createScene();

    this.environmentCreator = new EnvironmentCreator(this.scene);
    this.assetManager = new AssetManager(this.scene);
    this.highlightLayer = sceneCreator.highlightLayer;
    this.targetingSystem = new TargetingSystem(this.scene);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.environmentCreator.createEnvironment();

    // Load all assets
    await this.assetManager.initializeFromJson('./models/assets.json');
    console.log("All assets loaded.");
    const shadowGenerator = this.environmentCreator.getShadowGenerator();
    if (!shadowGenerator) {
      console.error("Shadow generator not initialized!");
      return;
    }

    // Get the guy asset container (once it's loaded)
    const guyAssetContainer = this.assetManager.getAssetContainer("guy");
    if (!guyAssetContainer) {
      console.error("guyAssetContainer is undefined");
      return;
    }

    this.characterController = new CharacterController(
      this.scene,
      this.canvas,
      this.scene.activeCamera as ArcRotateCamera,
      shadowGenerator,
      this.assetManager
    );

    if (this.scene) {
      const npc1 = new NPC(this.scene, "npc", this.assetManager, shadowGenerator, new Vector3(5, 10, 5), this.highlightLayer, this.targetingSystem);
      const npc2 = new NPC(this.scene, "npc", this.assetManager, shadowGenerator, new Vector3(10, 10, 5), this.highlightLayer, this.targetingSystem);
      const npc3 = new NPC(this.scene, "npc", this.assetManager, shadowGenerator, new Vector3(10, 10, 10), this.highlightLayer, this.targetingSystem);

      this.npcs.push(npc1, npc2, npc3);
    }

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
    this.npcs.forEach(npc => npc.dispose());
    this.targetingSystem.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}