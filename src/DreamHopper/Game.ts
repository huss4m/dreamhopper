import { ArcRotateCamera, AssetContainer, Engine, HighlightLayer, Scene, Vector3, Observable, Mesh } from "@babylonjs/core";
import { SceneCreator } from "./SceneCreator";
import { CharacterController } from "./player/CharacterController";
import { InputHandler } from "./InputHandler";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { TargetingSystem } from "./TargetingSystem";
import { EnvironmentType } from "./EnvironmentCreator";
import { DreamCrystalManager, DreamCrystalState } from "./items/DreamCrystalManager";

export interface SceneState {
  npcPositions?: Vector3[];
  crystalState?: DreamCrystalState;
}

export class Game {
  private engine: Engine;
  private characterController!: CharacterController;
  private inputHandler!: InputHandler;
  private targetingSystem!: TargetingSystem;
  assetManager!: AssetManager;
  highlightLayer!: HighlightLayer;
  npcs: NPC[] = [];
  private dreamCrystalManager!: DreamCrystalManager;
  sceneCreator: any;
  private scenes: Scene[] = [];
  private activeScene: Scene | null = null;
  private sceneStates: SceneState[] = [];

  constructor(private canvas: HTMLCanvasElement, environmentType: EnvironmentType = EnvironmentType.FOREST) {
    this.engine = new Engine(canvas, true);
    this.sceneCreator = new SceneCreator(this.engine, canvas, environmentType);

    this.scenes.push(this.sceneCreator.createScene()); // Index 0: FOREST
    this.scenes.push(new SceneCreator(this.engine, canvas, EnvironmentType.DESERT).createScene());

    this.sceneStates = [
      // FOREST scene
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
      // DESERT scene
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

    this.initialize();
  }

  private async initialize(): Promise<void> {
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
      console.log("Player mesh name:", characterMesh.name); // Debug mesh name
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

    const savedState = this.sceneStates[sceneIndex];
    this.npcs = [
      new NPC(scene, "npc", this.assetManager, shadowGenerator, savedState.npcPositions?.[0] || new Vector3(5, 1, 5), this.highlightLayer, this.targetingSystem),
      new NPC(scene, "npc", this.assetManager, shadowGenerator, savedState.npcPositions?.[1] || new Vector3(10, 1, 5), this.highlightLayer, this.targetingSystem),
      new NPC(scene, "npc", this.assetManager, shadowGenerator, savedState.npcPositions?.[2] || new Vector3(10, 1, 10), this.highlightLayer, this.targetingSystem),
    ];

    this.npcs.forEach((npc, index) => {
      const npcMesh = npc.getMesh();
      if (npcMesh) {
        shadowGenerator.addShadowCaster(npcMesh, true);
        npcMesh.receiveShadows = true;
        npcMesh.getChildMeshes().forEach(child => {
          shadowGenerator.addShadowCaster(child, true);
          child.receiveShadows = true;
        });
        console.log(`NPC ${index} mesh added to shadow generator:`, npcMesh.name);
      } else {
        console.warn(`NPC ${index} mesh not found for shadow generator`);
      }
    });

    this.dreamCrystalManager = new DreamCrystalManager(
      scene,
      this.assetManager.getAssetContainer("dreamCrystal"),
      shadowGenerator,
      characterMesh! // Pass player mesh
    );
    const crystalState = savedState.crystalState || { positions: [], collected: [] };
    this.dreamCrystalManager.initialize(crystalState.positions, crystalState.collected);

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
          npcPositions: this.npcs.map(npc => npc.getPosition()),
          crystalState: this.dreamCrystalManager.getState(),
        };
      }
    }

    this.npcs.forEach(npc => npc.dispose());
    this.npcs = [];
    this.dreamCrystalManager.dispose();
    this.characterController?.dispose();
    this.targetingSystem?.dispose();
    this.assetManager?.dispose();

    this.sceneCreator = new SceneCreator(this.engine, this.canvas, environmentType);
    const newScene = this.sceneCreator.createScene();
    this.scenes[index] = newScene;
    this.activeScene = newScene;

    await this.initializeSceneComponents(newScene, index);
    console.log(`Switched to ${environmentType} scene.`);
  }

  public dispose(): void {
    this.characterController?.dispose();
    this.npcs.forEach(npc => npc.dispose());
    this.dreamCrystalManager?.dispose();
    this.targetingSystem?.dispose();
    this.assetManager?.dispose();
    this.scenes.forEach(scene => scene.dispose());
    this.engine.dispose();
  }
}