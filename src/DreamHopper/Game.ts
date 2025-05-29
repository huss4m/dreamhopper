import { ArcRotateCamera, Engine, HighlightLayer, Scene, Vector3, Mesh } from "@babylonjs/core";
import { SceneCreator } from "./SceneCreator";
import { CharacterController } from "./player/CharacterController";
import { InputHandler } from "./InputHandler";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";
import { TargetingSystem } from "./TargetingSystem";
import { EnvironmentType } from "./EnvironmentCreator";
import { GameManager } from "./GameManager";
import { SoundManager } from "./SoundManager";
import { DreamHopperLoadingScreen } from "./DreamHopperLoadingScreen";

export interface SceneState {
  npcPositions?: Vector3[];
  enemyPositions?: Vector3[];
}

export class Game {
  private engine: Engine;
  private characterController: CharacterController | null = null;
  private inputHandler!: InputHandler;
  private targetingSystem!: TargetingSystem;
  private assetManager!: AssetManager;
  private highlightLayer!: HighlightLayer;
  private gameManager!: GameManager;
  private soundManager: SoundManager;
  private sceneCreator: SceneCreator;
  private scenes: Scene[] = [];
  private activeScene: Scene | null = null;
  private sceneStates: SceneState[] = [];
  private initializationPromise: Promise<void>;
  private isInitialized = false;
  private loadingScreen: DreamHopperLoadingScreen;

  constructor(private canvas: HTMLCanvasElement, environmentType: EnvironmentType = EnvironmentType.FOREST) {
    this.engine = new Engine(canvas, true);
    this.sceneCreator = new SceneCreator(this.engine, canvas, environmentType);
    this.soundManager = SoundManager.getInstance([
      "/music/music1.mp3",
      "/music/music2.mp3",
    ]);
  
    this.loadingScreen = new DreamHopperLoadingScreen(this.engine);
    this.engine.loadingScreen = this.loadingScreen;
  
    this.scenes.push(this.sceneCreator.createScene());
    this.scenes.push(new SceneCreator(this.engine, canvas, EnvironmentType.DESERT).createScene());
  
    this.sceneStates = [
      { npcPositions: [], enemyPositions: [] },
      { npcPositions: [], enemyPositions: [] },
    ];
  
    this.activeScene = this.scenes[0];
    this.initializationPromise = this.initialize();
  
    // Clean up on page refresh
    window.addEventListener("beforeunload", () => {
      this.soundManager.dispose();
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Show the loading screen
      this.engine.displayLoadingUI();

      // Track progress (5 async steps: assets, NPCs, enemies, crystals, sound)
      const totalSteps = 5;
      let currentStep = 0;

      await this.initializeSceneComponents(this.activeScene!, 0, () => {
        currentStep++;
        this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);
      });

      await this.soundManager.initialize();
      currentStep++;
      this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

      this.gameManager.getDreamCrystalManager().getOnAllCrystalsCollected().add(() => {
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

      // Hide the loading screen
      this.engine.hideLoadingUI();
    } catch (error) {
      console.error("Game: Initialization failed:", error);
      this.engine.hideLoadingUI();
      throw error;
    }
  }

  private async initializeSceneComponents(scene: Scene, sceneIndex: number, onStepComplete: () => void): Promise<void> {
    try {
      this.assetManager = new AssetManager(scene);
      await this.assetManager.initializeFromJson("./models/assets.json");
      console.log("Game: All assets loaded.");
      onStepComplete();

      const shadowGenerator = this.sceneCreator.getShadowGenerator();
      if (!shadowGenerator) {
        throw new Error("Game: Shadow generator not initialized");
      }

      if (!shadowGenerator.getLight()) {
        throw new Error("Game: Shadow generator has no associated light");
      }
      console.log("Game: Shadow generator initialized with light:", shadowGenerator.getLight().name);

      this.highlightLayer = this.sceneCreator.highlightLayer;
      this.targetingSystem = new TargetingSystem(scene);

      this.gameManager = new GameManager(
        scene,
        this.assetManager,
        shadowGenerator,
        this.highlightLayer,
        this.targetingSystem
      );

      const savedState = this.sceneStates[sceneIndex];
      await this.gameManager.initializeNPCs(savedState.npcPositions);
      onStepComplete();
      await this.gameManager.initializeEnemies(savedState.enemyPositions);
      onStepComplete();

      this.characterController = new CharacterController(
        scene,
        this.canvas,
        scene.activeCamera as ArcRotateCamera,
        shadowGenerator,
        this.assetManager,
        this.targetingSystem,
        this.gameManager
      );

      const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
      if (characterMesh) {
        console.log("Game: Player mesh name:", characterMesh.name);
        shadowGenerator.addShadowCaster(characterMesh, true);
        characterMesh.receiveShadows = true;
        characterMesh.checkCollisions = true;
        characterMesh.getChildMeshes().forEach(child => {
          shadowGenerator.addShadowCaster(child, true);
          child.receiveShadows = true;
          child.checkCollisions = true;
        });
        console.log("Game: Character mesh added to shadow generator:", characterMesh.name);
        this.gameManager.setCharacterMesh(characterMesh);
      } else {
        console.warn("Game: Character mesh not found for shadow generator");
      }

      await this.gameManager.initializeDreamCrystals();
      onStepComplete();

      const player = this.characterController.getPlayer();
      const crystalState = this.gameManager.getDreamCrystalManager().getState();
      player.setTotalCrystals(crystalState.positions.length);
      player.resetCrystalCount();
      crystalState.collected.forEach((collected, i) => {
        if (collected) player.incrementCrystalCount();
      });
      this.gameManager.getDreamCrystalManager().getOnAllCrystalsCollected().add(() => {
        player.incrementCrystalCount();
      });

      this.inputHandler = new InputHandler(scene, this.characterController, this.canvas, this);
      const initSuccess = await this.inputHandler.init();
      if (!initSuccess) {
        console.warn("Game: InputHandler using fallback keybindings");
      }
    } catch (error) {
      console.error("Game: Scene components initialization failed:", error);
      throw error;
    }
  }

  public async switchScene(environmentType: EnvironmentType): Promise<void> {
    try {
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
          throw new Error(`Game: Unknown environment type: ${environmentType}`);
      }

      const scene = this.scenes[index];
      if (!scene) {
        throw new Error(`Game: Scene for ${environmentType} at index ${index} not found`);
      }

      if (this.activeScene) {
        const currentIndex = this.scenes.indexOf(this.activeScene);
        if (currentIndex !== -1) {
          this.sceneStates[currentIndex] = {
            npcPositions: this.gameManager.getNPCPositions(),
            enemyPositions: this.gameManager.getEnemyPositions(),
          };
        }
      }

      this.gameManager.dispose();
      this.characterController?.dispose();
      this.targetingSystem?.dispose();
      this.assetManager?.dispose();

      // Show loading screen
      this.engine.displayLoadingUI();

      // Track progress (4 steps: scene creation, components, sound, final setup)
      const totalSteps = 4;
      let currentStep = 0;

      this.sceneCreator = new SceneCreator(this.engine, this.canvas, environmentType);
      const newScene = this.sceneCreator.createScene();
      this.scenes[index] = newScene;
      this.activeScene = newScene;
      currentStep++;
      this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

      this.characterController = null;
      await this.initializeSceneComponents(newScene, index, () => {
        currentStep++;
        this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);
      });

      if (!this.soundManager.isMusicPlaying()) {
        await this.soundManager.initialize();
      }
      currentStep++;
      this.loadingScreen.updateProgress((currentStep / totalSteps) * 100);

      console.log(`Game: Switched to ${environmentType} scene`);

      // Hide loading screen
      this.engine.hideLoadingUI();
    } catch (error) {
      console.error("Game: Scene switch failed:", error);
      this.engine.hideLoadingUI();
      throw error;
    }
  }

  public getAnimationManager() {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized yet");
      return null;
    }
    return this.characterController.animationManager;
  }

  public getDreamCrystalManager() {
    if (!this.gameManager) {
      console.warn("Game: GameManager not initialized yet");
      return null;
    }
    return this.gameManager.getDreamCrystalManager();
  }

  public waitForInitialization(): Promise<void> {
    return this.initializationPromise;
  }

  public dispose(): void {
    try {
      this.characterController?.dispose();
      this.gameManager?.dispose();
      this.targetingSystem?.dispose();
      this.assetManager?.dispose();
      this.soundManager.dispose();
      this.scenes.forEach(scene => scene.dispose());
      this.engine.dispose();
      console.log("Game: Disposed");
    } catch (error) {
      console.error("Game: Dispose failed:", error);
    }
  }
}