import { ArcRotateCamera, Engine, HighlightLayer, Scene, Vector3, Observable } from "@babylonjs/core";
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
import { Targettable } from "./Targettable";
import { CharacterAnimationManager } from "./player/CharacterAnimationManager";
import { Quest, QuestState } from "./npc/Quest";
import { NPC } from "./npc/NPC";

export interface SceneState {
  npcPositions?: Vector3[];
  enemyPositions?: Vector3[];
  questStates?: QuestState[];
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
  private showQuestDialog = false;
  private onQuestDialogToggled = new Observable<boolean>();
  private currentQuest: Quest | null = null;

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
      { npcPositions: [], enemyPositions: [], questStates: [] },
      { npcPositions: [], enemyPositions: [], questStates: [] },
    ];

    this.activeScene = this.scenes[0];
    this.initializationPromise = this.initialize();

    window.addEventListener("beforeunload", () => {
      this.soundManager.dispose();
    });
  }

  private async initialize(): Promise<void> {
    try {
      this.engine.displayLoadingUI();
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
        console.log("Game: All DreamCrystals collected! You win!");
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
        this.targetingSystem,
        this
      );

      const savedState = this.sceneStates[sceneIndex];
      await this.gameManager.initializeNPCs(savedState.npcPositions, savedState.questStates);
      console.log("Game: NPCs initialized");
      onStepComplete();
      await this.gameManager.initializeEnemies(savedState.enemyPositions);
      console.log("Game: Enemies initialized");
      onStepComplete();

      this.characterController = new CharacterController(
        scene,
        this.canvas,
        scene.activeCamera as ArcRotateCamera,
        shadowGenerator,
        this.assetManager,
        this.targetingSystem,
        this.gameManager,
        
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
      console.log("Game: DreamCrystals initialized");
      onStepComplete();

      const player = this.characterController.getPlayer();
      const crystalState = this.gameManager.getDreamCrystalManager().getState();
      const totalCrystals = this.gameManager.getDreamCrystalManager().totalCrystals;
      console.log(`Game: Crystal state:`, crystalState.collected, `positions:`, crystalState.positions.length, `totalCrystals:`, totalCrystals);
      player.setTotalCrystals(totalCrystals);
      player.resetCrystalCount();
      crystalState.collected.forEach((collected, i) => {
        if (collected) {
          player.incrementCrystalCount();
          console.log(`Game: Crystal ${i} collected during initialization`);
        }
      });
      this.gameManager.getDreamCrystalManager().getOnCrystalCollectedObservable().add((index) => {
        player.incrementCrystalCount();
        console.log(`Game: Crystal ${index} collected, player crystals: ${player.getCollectedCrystals()}/${player.getTotalCrystals()}`);
      });

      if (savedState.questStates) {
        player.setQuestState(savedState.questStates);
      }

      this.inputHandler = new InputHandler(scene, this.characterController, this.canvas, this);
      const initSuccess = await this.inputHandler.init();
      if (!initSuccess) {
        console.warn("Game: InputHandler failed to initialize, using fallback keybindings");
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
            questStates: this.gameManager.getQuestStates()
          };
        }
      }

      this.gameManager.dispose();
      this.characterController?.dispose();
      this.targetingSystem?.dispose();
      this.assetManager?.dispose();
      this.showQuestDialog = false;
      this.currentQuest = null;
      this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);

      this.engine.displayLoadingUI();
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
      this.engine.hideLoadingUI();
    } catch (error) {
      console.error("Game: Scene switch failed:", error);
      this.engine.hideLoadingUI();
      throw error;
    }
  }

  public getCharacterController(): CharacterController | null {
    return this.characterController;
  }

  public getAnimationTarget(): Targettable | null {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized");
      return null;
    }
    return this.characterController.getCurrentTarget();
  }

  public getAnimationManager(): CharacterAnimationManager | null {
    if (!this.characterController) {
      console.warn("Game: CharacterController not initialized");
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

  public getGameManager(): GameManager {
    return this.gameManager;
  }

  public toggleQuestDialog(): void {
    const target = this.getAnimationTarget();
    if (target instanceof NPC) {
      const npcQuest = target.getQuest();
      if (npcQuest && this.characterController) {
        const player = this.characterController.getPlayer();
        const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests()].find(q => q.getId() === npcQuest.getId());
        this.currentQuest = playerQuest || npcQuest; // Prefer playerQuest
        console.log(`Game: Set currentQuest to ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}, playerQuest: ${playerQuest ? playerQuest.getState().status : 'none'}, npcQuest: ${npcQuest.getState().status}`);
        this.showQuestDialog = !this.showQuestDialog;
        console.log(`Game: Quest dialog toggled to ${this.showQuestDialog} for quest ${this.currentQuest.getId()}`);
        this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
        if (this.showQuestDialog) {
          target.rotateToFacePlayer();
        }
      } else {
        console.log("Game: Cannot toggle quest dialog; NPC has no quest");
        this.showQuestDialog = false;
        this.currentQuest = null;
        this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
      }
    } else {
      console.log("Game: Cannot toggle quest dialog; target is not an NPC");
      this.showQuestDialog = false;
      this.currentQuest = null;
      this.onQuestDialogToggled.notifyObservers(this.showQuestDialog);
    }
  }

  public getShowQuestDialog(): boolean {
    return this.showQuestDialog;
  }

  public getCurrentQuest(): Quest | null {
    if (this.currentQuest && this.characterController) {
      const player = this.characterController.getPlayer();
      const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests()].find(q => q.getId() === this.currentQuest!.getId());
      if (playerQuest) {
        this.currentQuest = playerQuest;
        console.log(`Game: getCurrentQuest updated to playerQuest ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}`);
      }
    }
    console.log(`Game: getCurrentQuest returning ${this.currentQuest?.getId() ?? "null"}, status: ${this.currentQuest?.getState().status ?? "none"}`);
    return this.currentQuest;
  }

  public getOnQuestDialogToggled(): Observable<boolean> {
    return this.onQuestDialogToggled;
  }

  public getTargetingSystem(): TargetingSystem {
    return this.targetingSystem;
  }

  public handleQuestAccept(): void {
    if (this.currentQuest && this.characterController) {
      const player = this.characterController.getPlayer();
      player.acceptQuest(this.currentQuest);
      this.gameManager.getNPCs().forEach(npc => {
        if (npc.getQuest()?.getId() === this.currentQuest!.getId()) {
          const playerQuest = player.getActiveQuests().find(q => q.getId() === this.currentQuest!.getId());
          if (playerQuest) {
            npc.setQuest(playerQuest);
            console.log(`Game: Updated NPC quest ${this.currentQuest!.getId()} to status: ${playerQuest.getState().status}`);
          }
          npc.updateQuestMarker();
        }
      });
      this.currentQuest = player.getActiveQuests().find(q => q.getId() === this.currentQuest!.getId()) || this.currentQuest;
      console.log(`Game: Updated currentQuest after accept to ${this.currentQuest.getId()}, status: ${this.currentQuest.getState().status}`);
      this.showQuestDialog = false;
      this.onQuestDialogToggled.notifyObservers(false);
    }
  }

  public handleQuestDeny(): void {
    this.showQuestDialog = false;
    this.onQuestDialogToggled.notifyObservers(false);
  }

  public handleQuestClose(): void {
    this.showQuestDialog = false;
    this.onQuestDialogToggled.notifyObservers(false);
  }

  public handleQuestTurnIn(): void {
    if (this.currentQuest && this.characterController) {
      const player = this.characterController.getPlayer();
      player.turnInQuest(this.currentQuest);
      this.gameManager.getNPCs().forEach(npc => {
        if (npc.getQuest()?.getId() === this.currentQuest!.getId()) {
          const playerQuest = [...player.getActiveQuests(), ...player.getCompletedQuests(), ...player.getTurnedInQuests()].find(q => q.getId() === this.currentQuest!.getId());
          if (playerQuest) {
            npc.setQuest(playerQuest);
            console.log(`Game: Updated NPC quest ${this.currentQuest!.getId()} to status: ${playerQuest.getState().status}`);
            npc.updateQuestMarker();
          }
        }
      });
      this.currentQuest = [...player.getActiveQuests(), ...player.getCompletedQuests(), ...player.getTurnedInQuests()].find(q => q.getId() === this.currentQuest!.getId()) || this.currentQuest;
      console.log(`Game: Updated currentQuest after turn-in to ${this.currentQuest!.getId()}, status: ${this.currentQuest!.getState().status}`);
      this.showQuestDialog = false;
      this.onQuestDialogToggled.notifyObservers(false);
    }
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
      this.onQuestDialogToggled.clear();
      this.engine.dispose();
      console.log("Game: Disposed");
    } catch (error) {
      console.error("Game: Dispose failed:", error);
    }
  }
}