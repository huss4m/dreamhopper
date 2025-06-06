import { Scene, Vector3, ShadowGenerator, CascadedShadowGenerator, Mesh, Ray, GroundMesh } from "@babylonjs/core";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { Enemy } from "./enemy/Enemy";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { TargetingSystem } from "./TargetingSystem";
import { DreamCrystalManager, DreamCrystalState } from "./items/DreamCrystalManager";
import { Game } from "./Game";
import { Quest, QuestState } from "./npc/Quest";
import { BossEnemy } from "./enemy/BossEnemy";

export class GameManager {
  private npcs: NPC[] = [];
  private enemies: Enemy[] = [];
  private bosses: BossEnemy[] = [];
  private dreamCrystalManager: DreamCrystalManager | null = null;
  private characterMesh: Mesh | null = null;
  private quests: Quest[] = [];
  private respawnTimers: Map<string, number> = new Map();

  constructor(
    private scene: Scene,
    private assetManager: AssetManager,
    private shadowGenerator: CascadedShadowGenerator,
    private highlightLayer: HighlightLayer,
    private targetingSystem: TargetingSystem,
    public game: Game
  ) {}

   // New: Add getQuestById method
  public getQuestById(questId: string): Quest | null {
    const quest = this.quests.find(q => q.getId() === questId);
    if (!quest) {
      console.warn(`GameManager: Quest ${questId} not found`);
      return null;
    }
    return quest;
  }

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
    q.requiredEnemies,
    q.turnedInText,
    q.type,
    q.nextQuestId,
    q.requiredEnemyType
  ));

  const positionsToUse = savedPositions?.length ? savedPositions : npcPositions;

  this.npcs = positionsToUse.map((position: Vector3, index: number) => {
    let initialQuest: Quest | null = null;
    if (index === 0) { // Assign questline to first NPC
      initialQuest = this.quests.find(q => q.getId() === "quest1") || null;
      if (!initialQuest) {
        console.warn(`GameManager: Quest 'quest1' not found for NPC ${index}`); // New: Warn if quest1 missing
      }
    }

    const npc = new NPC(
      this.scene,
      "npc",
      this.assetManager,
      this.shadowGenerator,
      position,
      this.highlightLayer,
      this.targetingSystem,
      this.game,
      initialQuest
    );

    if (initialQuest) {
      // Assign full questline
      let currentQuest = initialQuest;
      while (currentQuest.getNextQuestId()) {
        const nextQuestId = currentQuest.getNextQuestId();
        const nextQuest = this.quests.find(q => q.getId() === nextQuestId);
        if (nextQuest) {
          npc.setQuest(nextQuest);
          currentQuest = nextQuest;
          console.log(`GameManager: NPC ${index} added quest ${nextQuest.getId()} to questline`);
        } else {
          console.warn(`GameManager: Next quest ${nextQuestId} not found for NPC ${index}`); // Changed: Warn for missing next quest
          break;
        }
      }
      console.log(`GameManager: NPC ${index} assigned questline starting with ${initialQuest.getId()}`);

      // Apply saved quest states
      if (savedQuestStates) {
        let quest: Quest | null = initialQuest;
        while (quest) {
          const state = savedQuestStates.find(s => s.id === quest!.getId());
          if (state) {
            quest.setState(state);
            console.log(`GameManager: Applied saved state to quest ${quest.getId()} for NPC ${index}:`, state);
          }
          const nextQuestId = quest.getNextQuestId();
          quest = nextQuestId ? this.quests.find(q => q.getId() === nextQuestId) || null : null; // Changed: Handle undefined
        }
      }
    } else {
      console.log(`GameManager: NPC ${index} assigned no quest`);
    }

    return npc;
  });

  this.npcs.forEach((npc, index) => {
    const npcMesh = npc.getMesh();
    if (npcMesh) {
      npcMesh.receiveShadows = true;
      console.log(`GameManager: NPC ${index} mesh added to shadow generator:`, npcMesh.name);
    } else {
      console.warn(`GameManager: NPC ${index} mesh not found for shadow generator`);
    }
  });

  return this.npcs;
}

  public scheduleEnemyRespawn(enemyId: string, position: Vector3): void {
    if (this.respawnTimers.has(enemyId)) {
      clearTimeout(this.respawnTimers.get(enemyId)!);
      this.respawnTimers.delete(enemyId);
      console.log(`GameManager: Cleared existing respawn timer for enemy ${enemyId}`);
    }

    const timer = setTimeout(async () => {
      console.log(`GameManager: Respawning enemy ${enemyId} at position`, position);

      const oldEnemyIndex = this.enemies.findIndex(enemy => enemy.getId() === enemyId);
      if (oldEnemyIndex !== -1) {
        const oldEnemy = this.enemies[oldEnemyIndex];
        oldEnemy.dispose();
        this.enemies.splice(oldEnemyIndex, 1);
        console.log(`GameManager: Disposed old enemy (NPC) ${enemyId}`);
      } else {
        console.warn(`GameManager: Enemy ${enemyId} not found in enemies array for respawn`);
      }

      const newEnemy = new Enemy(
        this.scene,
        "enemy",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem,
        this.game
      );
      this.enemies.push(newEnemy);

      this.game.observeEnemyDeath(newEnemy);

      const enemyMesh = newEnemy.getMesh();
      if (enemyMesh) {
        enemyMesh.receiveShadows = true;
        console.log(`GameManager: Respawned enemy ${enemyId} mesh added to shadow generator:`, enemyMesh.name);
      } else {
        console.warn(`GameManager: Respawned enemy ${enemyId} mesh not found for shadow generator`);
      }

      this.respawnTimers.delete(enemyId);
      console.log(`GameManager: Enemy ${enemyId} respawned successfully at position`, position);
    }, 60000);

    this.respawnTimers.set(enemyId, timer);
    console.log(`GameManager: Scheduled respawn for enemy ${enemyId} in 60 seconds`);
  }


  public scheduleBossRespawn(bossId: string, position: Vector3): void {
    if (this.respawnTimers.has(bossId)) {
      clearTimeout(this.respawnTimers.get(bossId)!);
      this.respawnTimers.delete(bossId);
      console.log(`GameManager: Cleared existing respawn timer for boss ${bossId}`);
    }
    const timer = setTimeout(async () => {
      console.log(`GameManager: Respawning boss ${bossId} at position`, position);
      const oldBossIndex = this.bosses.findIndex(boss => boss.getId() === bossId);
      if (oldBossIndex !== -1) {
        const oldBoss = this.bosses[oldBossIndex];
        oldBoss.dispose();
        this.bosses.splice(oldBossIndex, 1);
        console.log(`GameManager: Disposed old boss (NPC) ${bossId}`);
      } else {
        console.warn(`GameManager: Boss ${bossId} not found in bosses array for respawn`);
      }
      const newBoss = new BossEnemy(
        this.scene,
        "boss",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem,
        this.game
      );
      this.bosses.push(newBoss);
      this.game.observeEnemyDeath(newBoss);
      const bossMesh = newBoss.getMesh();
      if (bossMesh) {
        bossMesh.receiveShadows = true;
        console.log(`GameManager: Respawned boss ${bossId} mesh added to shadow generator:`, bossMesh.name);
      } else {
        console.warn(`GameManager: Respawned boss ${bossId} mesh not found for shadow generator`);
      }
      this.respawnTimers.delete(bossId);
      console.log(`GameManager: Boss ${bossId} respawned successfully at position`, position);
    }, 60000);
    this.respawnTimers.set(bossId, timer);
    console.log(`GameManager: Scheduled respawn for boss ${bossId} in 60 seconds`);
  }

  async initializeEnemies(savedPositions?: Vector3[]): Promise<Enemy[]> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const enemyPositions = configData.enemies?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];
    const positionsToUse = savedPositions?.length ? savedPositions : enemyPositions;
    this.enemies = positionsToUse.map((position: Vector3, index: number) => {
      console.log(`GameManager: Spawning Enemy at position`, position);
      return new Enemy(
        this.scene,
        "enemy",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem,
        this.game
      );
    });
    this.enemies.forEach((enemy, index) => {
      const enemyMesh = enemy.getMesh();
      if (enemyMesh) {
        enemyMesh.receiveShadows = true;
        console.log(`GameManager: Enemy ${index} mesh added to shadow generator:`, enemyMesh.name);
        console.log(`GameManager: Enemy ${index} ID:`, enemy.getId());
      } else {
        console.warn(`GameManager: Enemy ${index} mesh not found for shadow generator`);
      }
      this.game.observeEnemyDeath(enemy);
    });
    return this.enemies;
  }


  async initializeBosses(savedPositions?: Vector3[]): Promise<BossEnemy[]> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const bossPositions = configData.bosses?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];
    const positionsToUse = savedPositions?.length ? savedPositions : bossPositions;
    this.bosses = positionsToUse.map((position: Vector3, index: number) => {
      console.log(`GameManager: Spawning BossEnemy at position`, position);
      return new BossEnemy(
        this.scene,
        "boss",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem,
        this.game
      );
    });
    this.bosses.forEach((boss, index) => {
      const bossMesh = boss.getMesh();
      if (bossMesh) {
        bossMesh.receiveShadows = true;
        console.log(`GameManager: Boss ${index} mesh added to shadow generator:`, bossMesh.name);
        console.log(`GameManager: Boss ${index} ID:`, boss.getId());
      } else {
        console.warn(`GameManager: Boss ${index} mesh not found for shadow generator`);
      }
      this.game.observeEnemyDeath(boss);
    });
    return this.bosses;
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
      return new Vector3(pos.x, height + 1, pos.z);
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

  
  getBosses(): BossEnemy[] {
    return this.bosses;
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
     this.bosses.forEach(boss => boss.dispose());
    this.dreamCrystalManager?.dispose();
    this.npcs = [];
    this.enemies = [];
    this.dreamCrystalManager = null;
    this.characterMesh = null;
    this.quests = [];
    this.respawnTimers.forEach((timer, enemyId) => {
      clearTimeout(timer);
      console.log(`GameManager: Cancelled respawn timer for enemy ${enemyId}`);
    });
    this.respawnTimers.clear();
  }
}