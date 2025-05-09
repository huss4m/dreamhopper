import { ArcRotateCamera, AssetContainer, Engine, HighlightLayer, Scene, Vector3 } from "@babylonjs/core";
import { SceneCreator } from "./SceneCreator";
import { CharacterController } from "./player/CharacterController";
import { InputHandler } from "./InputHandler";
import "@babylonjs/loaders";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { TargetingSystem } from "./TargetingSystem";
import { EnvironmentType } from "./EnvironmentCreator";

export interface SceneState {
  npcPositions?: Vector3[];
}

export class Game {
  private engine: Engine;
  private characterController!: CharacterController;
  private inputHandler!: InputHandler;
  private targetingSystem: TargetingSystem;
  assetManager!: AssetManager;
  highlightLayer: HighlightLayer;
  npcs: NPC[] = [];
  sceneCreator: any;
  private scenes: Scene[] = [];
  private activeScene: Scene | null = null;
  private sceneStates: SceneState[] = [];

  constructor(private canvas: HTMLCanvasElement, environmentType: EnvironmentType = EnvironmentType.FOREST) {
    this.engine = new Engine(canvas, true);
    this.sceneCreator = new SceneCreator(this.engine, canvas, environmentType);
    
    // Create and store scenes 
    this.scenes.push(this.sceneCreator.createScene()); // Index 0: FOREST
    this.scenes.push(new SceneCreator(this.engine, canvas, EnvironmentType.DESERT).createScene()); 
  
    // Initialize scene states (one for each scene)
    this.sceneStates = this.scenes.map(() => ({}));

    // Set initial scene (FOREST)
    this.activeScene = this.scenes[0];

    this.assetManager = new AssetManager(this.activeScene);
    this.highlightLayer = this.sceneCreator.highlightLayer;
    this.targetingSystem = new TargetingSystem(this.activeScene);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.initializeSceneComponents(this.activeScene!, 0);
    
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
    // Load all assets
    this.assetManager = new AssetManager(scene);
    await this.assetManager.initializeFromJson('./models/assets.json');
    console.log("All assets loaded.");

    // Get shadow generator
    const shadowGenerator = this.sceneCreator.getShadowGenerator();
    if (!shadowGenerator) {
      console.error("Shadow generator not initialized!");
      return;
    }

    // Verify shadow generator configuration
    if (!shadowGenerator.getLight()) {
      console.error("Shadow generator has no associated light!");
      return;
    }
    console.log("Shadow generator initialized with light:", shadowGenerator.getLight().name);

    // Get the guy asset container
    const guyAssetContainer = this.assetManager.getAssetContainer("guy");
    if (!guyAssetContainer) {
      console.error("guyAssetContainer is undefined");
      return;
    }

    // Initialize components
    this.highlightLayer = this.sceneCreator.highlightLayer;
    this.targetingSystem = new TargetingSystem(scene);
    this.characterController = new CharacterController(
      scene,
      this.canvas,
      scene.activeCamera as ArcRotateCamera,
      shadowGenerator,
      this.assetManager
    );

    // Add character to shadow generator
    const characterMesh = this.characterController.characterMeshLoader.getCharacterMesh();
    if (characterMesh) {
      shadowGenerator.addShadowCaster(characterMesh, true);
      characterMesh.receiveShadows = true;
      // Include child meshes for shadows
      characterMesh.getChildMeshes().forEach(child => {
        shadowGenerator.addShadowCaster(child, true);
        child.receiveShadows = true;
      });
      console.log("Character mesh added to shadow generator:", characterMesh.name);
    } else {
      console.warn("Character mesh not found for shadow generator");
    }

    // Create NPCs and restore positions if available
    const savedState = this.sceneStates[sceneIndex];
    this.npcs = [
      new NPC(scene, "npc", this.assetManager, shadowGenerator, savedState.npcPositions?.[0] || new Vector3(5, 1, 5), this.highlightLayer, this.targetingSystem),
      new NPC(scene, "npc", this.assetManager, shadowGenerator, savedState.npcPositions?.[1] || new Vector3(10, 1, 5), this.highlightLayer, this.targetingSystem),
      new NPC(scene, "npc", this.assetManager, shadowGenerator, savedState.npcPositions?.[2] || new Vector3(10, 1, 10), this.highlightLayer, this.targetingSystem)
    ];

    // Add NPCs to shadow generator
    this.npcs.forEach((npc, index) => {
      const npcMesh = npc.getMesh();
      if (npcMesh) {
        shadowGenerator.addShadowCaster(npcMesh, true);
        npcMesh.receiveShadows = true;
        // Include child meshes for shadows
        npcMesh.getChildMeshes().forEach(child => {
          shadowGenerator.addShadowCaster(child, true);
          child.receiveShadows = true;
        });
        console.log(`NPC ${index} mesh added to shadow generator:`, npcMesh.name);
      } else {
        console.warn(`NPC ${index} mesh not found for shadow generator`);
      }
    });

    // Ensure ground receives shadows (assuming SceneCreator creates a ground mesh)
    const groundMesh = scene.getMeshByName("ground");
    if (groundMesh) {
      groundMesh.receiveShadows = true;
      console.log("Ground mesh set to receive shadows:", groundMesh.name);
    } else {
      console.warn("Ground mesh not found in scene");
    }

    // Initialize InputHandler and await its setup
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

    // Save current scene's NPC state
    if (this.activeScene && this.npcs.length) {
      const currentIndex = this.scenes.indexOf(this.activeScene);
      if (currentIndex !== -1) {
        this.sceneStates[currentIndex] = {
          npcPositions: this.npcs.map(npc => npc.getPosition())
        };
      }
    }

    // Clean up existing components
    this.npcs.forEach(npc => npc.dispose());
    this.npcs = [];
    this.characterController?.dispose();
    this.targetingSystem?.dispose();
    this.assetManager?.dispose();

    // Create new SceneCreator for the new environment and ensure scene is properly set up
    this.sceneCreator = new SceneCreator(this.engine, this.canvas, environmentType);
    const newScene = this.sceneCreator.createScene();
    
    // Replace the old scene with the new one
    this.scenes[index] = newScene;
    this.activeScene = newScene;

    // Reinitialize components for the new scene
    await this.initializeSceneComponents(newScene, index);
    
    console.log(`Switched to ${environmentType} scene.`);
  }

  public dispose(): void {
    this.characterController?.dispose();
    this.npcs.forEach(npc => npc.dispose());
    this.targetingSystem?.dispose();
    this.assetManager?.dispose();
    this.scenes.forEach(scene => scene.dispose());
    this.engine.dispose();
  }
}