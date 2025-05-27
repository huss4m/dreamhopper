import { ArcRotateCamera, AssetContainer, Engine, HighlightLayer, Scene, Vector3, Observable } from "@babylonjs/core";
import { SceneCreator } from "./SceneCreator";
import { CharacterController } from "./player/CharacterController";
import { InputHandler } from "./InputHandler";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { TargetingSystem } from "./TargetingSystem";
import { EnvironmentType } from "./EnvironmentCreator";
import { DreamCrystalManager, DreamCrystalState } from "./items/DreamCrystalManager";
import { GameManager } from "./GameManager";

export interface SceneState {
  npcPositions?: Vector3[];
  crystalState?: DreamCrystalState;
}

export class Game {
  private engine: Engine;
  private characterController: CharacterController | null = null;
  private inputHandler!: InputHandler;
  private targetingSystem!: TargetingSystem;
  private assetManager!: AssetManager;
  private highlightLayer!: HighlightLayer;
  private gameManager!: GameManager;
  private dreamCrystalManager!: DreamCrystalManager;
  private sceneCreator: SceneCreator;
  private scenes: Scene[] = [];
  private activeScene: Scene | null = null;
  private sceneStates: SceneState[] = [];
  private initializationPromise: Promise<void>;
  private isInitialized = false;

  constructor(private canvas: HTMLCanvasElement, environmentType: EnvironmentType = EnvironmentType.FOREST) {
    this.engine = new Engine(canvas, true);
    this.sceneCreator = new SceneCreator(this.engine, canvas, environmentType);

    this.scenes.push(this.sceneCreator.createScene());
    this.scenes.push(new SceneCreator(this.engine, canvas, EnvironmentType.DESERT).createScene());

    this.sceneStates = [
      {
        crystalState: {
          positions: [
            new Vector3(2, 2, 2),
            new Vector3(8, 2, 0),
            new Vector3(-3, 2, 6),
          ],
          collected: [],
        },
      },
      {
        crystalState: {
          positions: [
            new Vector3(0, 1, 5),
            new Vector3(10, 1, -5),
            new Vector3(-7, 1, 3),
          ],
          collected: [],
        },
      },
    ];

    this.activeScene = this.scenes[0];

    this.initializationPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeSceneComponents(this.activeScene!, 0);

      this.dreamCrystalManager.getOnAllCrystalsCollected().add(() => {
        console.log("All DreamCrystals collected! You win!");
      });

      this.engine.runRenderLoop(() => {
        if (this.activeScene && this.inputHandler.getIsInitialized()) {
          this.inputHandler.update();
          this.activeScene.render();
        }
      });

      window.addEventListener("resize", () => {
        this.engine.resize();
      });

      this.isInitialized = true;
      console.log("Game initialized");
    } catch (error) {
      console.error("Game initialization failed:", error);
      throw error;
    }
  }

  private async initializeSceneComponents(scene: Scene, sceneIndex: number): Promise<void> {
    this.assetManager = new AssetManager(scene);
    await this.assetManager.initializeFromJson("./models/assets.json");
    console.log("All assets loaded.");

    const shadowGenerator = this.sceneCreator.getShadowGenerator();
    if (!shadowGenerator) {
      console.error("Shadow generator not initialized!");
      return;
    }

    if (!shadowGenerator.getLight()) {
      console.error("Shadow generator has no associated light!");
      return;
    }
    console.log("Shadow generator initialized with light:", shadowGenerator.getLight().name);

    this.highlightLayer = this.sceneCreator.highlightLayer;
    this.targetingSystem = new TargetingSystem(scene);
    this.characterController = new CharacterController(
      scene,
      this.canvas,
      scene.activeCamera as ArcRotateCamera,
      shadowGenerator,
      this.assetManager,
      this.targetingSystem
    );

    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (characterMesh) {
      console.log("Player mesh name:", characterMesh.name);
      shadowGenerator.addShadowCaster(characterMesh, true);
      characterMesh.receiveShadows = true;
      characterMesh.checkCollisions = true;
      characterMesh.getChildMeshes().forEach(child => {
        shadowGenerator.addShadowCaster(child, true);
        child.receiveShadows = true;
        child.checkCollisions = true;
      });
      console.log("Character mesh added to shadow generator:", characterMesh.name);
    } else {
      console.warn("Character mesh not found for shadow generator");
    }

    this.gameManager = new GameManager(
      scene,
      this.assetManager,
      shadowGenerator,
      this.highlightLayer,
      this.targetingSystem
    );

    const savedState = this.sceneStates[sceneIndex];
    const npcPositions = savedState.npcPositions || [];

    this.gameManager.initializeNPCs();
    this.gameManager.initializeEnemies();

    this.dreamCrystalManager = new DreamCrystalManager(
      scene,
      this.assetManager.getAssetContainer("dreamCrystal"),
      shadowGenerator,
      characterMesh!
    );
    const crystalState = savedState.crystalState || { positions: [], collected: [] };
    this.dreamCrystalManager.initialize(crystalState.positions, crystalState.collected);

    // Update Player crystal counts
    const player = this.characterController.getPlayer();
    player.setTotalCrystals(crystalState.positions.length);
    player.resetCrystalCount();
    crystalState.collected.forEach((collected, i) => {
      if (collected) player.incrementCrystalCount();
    });
    this.dreamCrystalManager.getOnAllCrystalsCollected().add(() => {
      player.incrementCrystalCount();
    });

    this.inputHandler = new InputHandler(scene, this.characterController, this.canvas, this);
    const initSuccess = await this.inputHandler.init();
    if (!initSuccess) {
      console.warn("InputHandler using fallback keybindings");
    }
  }

  public async switchScene(environmentType: EnvironmentType): Promise<void> {
    let index: number;
    switch (environmentType) {
      case EnvironmentType.FOREST:
        index = 0;
        break;
      case EnvironmentType.DESERT:
        index = 1;
        break;
      case EnvironmentType.URBAN:
        index = 2;
        break;
      default:
        console.error(`Unknown environment type: ${environmentType}`);
        return;
    }

    const scene = this.scenes[index];
    if (!scene) {
      console.error(`Scene for ${environmentType} at index ${index} not found!`);
      return;
    }

    if (this.activeScene) {
      const currentIndex = this.scenes.indexOf(this.activeScene);
      if (currentIndex !== -1) {
        this.sceneStates[currentIndex] = {
          npcPositions: this.gameManager.getNPCPositions(),
          crystalState: this.dreamCrystalManager.getState(),
        };
      }
    }

    this.gameManager.dispose();
    this.dreamCrystalManager.dispose();
    this.characterController?.dispose();
    this.targetingSystem?.dispose();
    this.assetManager?.dispose();

    this.sceneCreator = new SceneCreator(this.engine, this.canvas, environmentType);
    const newScene = this.sceneCreator.createScene();
    this.scenes[index] = newScene;
    this.activeScene = newScene;

    this.characterController = null;
    await this.initializeSceneComponents(newScene, index);
    console.log(`Switched to ${environmentType} scene.`);
  }

  public getAnimationManager() {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized yet");
      return null;
    }
    return this.characterController.animationManager;
  }

  public getDreamCrystalManager() {
    if (!this.dreamCrystalManager) {
      console.warn("Game: DreamCrystalManager not initialized yet");
      return null;
    }
    return this.dreamCrystalManager;
  }

  public waitForInitialization(): Promise<void> {
    return this.initializationPromise;
  }

  public dispose(): void {
    this.characterController?.dispose();
    this.gameManager?.dispose();
    this.dreamCrystalManager?.dispose();
    this.targetingSystem?.dispose();
    this.assetManager?.dispose();
    this.scenes.forEach(scene => scene.dispose());
    this.engine.dispose();
    console.log("Game disposed");
  }
}