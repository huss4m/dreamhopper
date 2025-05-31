import { Scene, Vector3, ShadowGenerator, CascadedShadowGenerator, Mesh, Ray, GroundMesh } from "@babylonjs/core";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { Enemy } from "./enemy/Enemy";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { TargetingSystem } from "./TargetingSystem";
import { DreamCrystalManager, DreamCrystalState } from "./items/DreamCrystalManager";
import { Game } from "./Game";
import { Quest, QuestState } from "./npc/Quest";

export class GameManager {
  private npcs: NPC[] = [];
  private enemies: Enemy[] = [];
  private dreamCrystalManager: DreamCrystalManager | null = null;
  private characterMesh: Mesh | null = null;
  private quests: Quest[] = [];

  constructor(
    private scene: Scene,
    private assetManager: AssetManager,
    private shadowGenerator: CascadedShadowGenerator,
    private highlightLayer: HighlightLayer,
    private targetingSystem: TargetingSystem,
    public game: Game
  ) {}

  public setCharacterMesh(mesh: Mesh): void {
    console.log("GameManager: Setting character mesh:", mesh.name);
    this.characterMesh = mesh;
  }

  public async initializeNPCs(savedPositions?: Vector3[], savedQuestStates?: QuestState[]): Promise<NPC[]> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const npcPositions = configData.npcs?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];

    const questData = await this.assetManager.loadJson("./quests/quests.json");
    console.log("GameManager: Loaded quests:", questData);
    this.quests = questData.map((q: any) => new Quest(
      q.id,
      q.title,
      q.description,
      q.inProgressText,
      q.completedText,
      q.requiredCrystals,
      q.turnedInText || "Thank you for completing the quest!" // Added turnedInText
    ));

    const positionsToUse = savedPositions?.length ? savedPositions : npcPositions;

    this.npcs = positionsToUse.map((position: Vector3, index: number) => {
      const quest = this.quests[index] || null;
      const npc = new NPC(
        this.scene,
        "npc",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem,
        this.game,
        quest
      );
      console.log(`GameManager: NPC ${index} assigned quest ${quest?.getId() || 'none'}`);
      if (quest && savedQuestStates) {
        const state = savedQuestStates.find(s => s.id === quest.getId());
        if (state) {
          quest.setState(state);
        }
      }
      return npc;
    });

    this.npcs.forEach((npc, index) => {
      const npcMesh = npc.getMesh();
      if (npcMesh) {
        this.shadowGenerator.addShadowCaster(npcMesh, true);
        npcMesh.receiveShadows = true;
        npcMesh.getChildMeshes().forEach(child => {
          this.shadowGenerator.addShadowCaster(child, true);
          child.receiveShadows = true;
        });
        console.log(`GameManager: NPC ${index} mesh added to shadow generator:`, npcMesh.name);
      } else {
        console.warn(`GameManager: NPC ${index} mesh not found for shadow generator`);
      }
    });

    return this.npcs;
  }

  async initializeEnemies(savedPositions?: Vector3[]): Promise<Enemy[]> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const enemyPositions = configData.enemies?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];

    const positionsToUse = savedPositions?.length ? savedPositions : enemyPositions;

    this.enemies = positionsToUse.map((position: Vector3, index: number) => 
      new Enemy(
        this.scene,
        "enemy",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem,
        this.game
      )
    );

    this.enemies.forEach((enemy, index) => {
      const enemyMesh = enemy.getMesh();
      if (enemyMesh) {
        this.shadowGenerator.addShadowCaster(enemyMesh, true);
        enemyMesh.receiveShadows = true;
        enemyMesh.getChildMeshes().forEach(child => {
          this.shadowGenerator.addShadowCaster(child, true);
          child.receiveShadows = true;
        });
        console.log(`GameManager: Enemy ${index} mesh added to shadow generator:`, enemyMesh.name);
        console.log(`GameManager: Enemy ${index} ID:`, enemy.getId());
      } else {
        console.warn(`GameManager: Enemy ${index} mesh not found for shadow generator`);
      }
    });

    return this.enemies;
  }

  async initializeDreamCrystals(savedState?: DreamCrystalState): Promise<DreamCrystalManager> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const crystalPositions = configData.crystals?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];

    const stateToUse: DreamCrystalState = savedState || { 
      positions: crystalPositions, 
      collected: new Array(crystalPositions.length).fill(false) 
    };

    if (!this.characterMesh) {
      throw new Error("GameManager: Character mesh not provided or not loaded");
    }

    console.log("GameManager: Initializing DreamCrystalManager with character mesh:", this.characterMesh.name);

    const groundMesh = this.game.ground;
    if (!groundMesh) {
      throw new Error("GameManager: Ground mesh 'Plane' not found");
    }

  

    const adjustedPositions = stateToUse.positions.map((pos: Vector3, index: number) => {
      const height = groundMesh.getHeightAtCoordinates(pos.x, pos.z);
      if (height === undefined || isNaN(height)) {
        throw new Error(`GameManager: Invalid height for crystal ${index} at (${pos.x}, ${pos.z})`);
      }
      console.log(`GameManager: Crystal ${index} at (${pos.x}, ${pos.z}) placed at y=${height} using getHeightAtCoordinates`);
      return new Vector3(pos.x, height + 1, pos.z); // Add 1 unit offset above ground
    });

    this.dreamCrystalManager = new DreamCrystalManager(
      this.scene,
      this.assetManager.getAssetContainer("dreamCrystal"),
      this.shadowGenerator,
      this.characterMesh
    );
    this.dreamCrystalManager.initialize(adjustedPositions, stateToUse.collected);

    return this.dreamCrystalManager;
  }


  getNPCs(): NPC[] {
    return this.npcs;
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  getDreamCrystalManager(): DreamCrystalManager {
    if (!this.dreamCrystalManager) {
      throw new Error("GameManager: DreamCrystalManager not initialized");
    }
    return this.dreamCrystalManager;
  }

  getNPCPositions(): Vector3[] {
    return this.npcs.map(npc => npc.getPosition());
  }

  getEnemyPositions(): Vector3[] {
    return this.enemies.map(enemy => enemy.getPosition());
  }

  getDreamCrystalState(): DreamCrystalState {
    if (!this.dreamCrystalManager) {
      throw new Error("GameManager: DreamCrystalManager not initialized");
    }
    return this.dreamCrystalManager.getState();
  }

  getQuestStates(): QuestState[] {
    return this.npcs
      .map(npc => npc.getQuest()?.getState())
      .filter((state): state is QuestState => state !== null);
  }

  dispose(): void {
    this.npcs.forEach(npc => npc.dispose());
    this.enemies.forEach(enemy => enemy.dispose());
    this.dreamCrystalManager?.dispose();
    this.npcs = [];
    this.enemies = [];
    this.dreamCrystalManager = null;
    this.characterMesh = null;
    this.quests = [];
  }
}