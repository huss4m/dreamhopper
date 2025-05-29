import { Scene, Vector3, ShadowGenerator, CascadedShadowGenerator, Mesh, Ray } from "@babylonjs/core";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { Enemy } from "./enemy/Enemy";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { TargetingSystem } from "./TargetingSystem";
import { DreamCrystalManager, DreamCrystalState } from "./items/DreamCrystalManager";

export class GameManager {
  private npcs: NPC[] = [];
  private enemies: Enemy[] = [];
  private dreamCrystalManager: DreamCrystalManager | null = null;
  private characterMesh: Mesh | null = null;

  constructor(
    private scene: Scene,
    private assetManager: AssetManager,
    private shadowGenerator: CascadedShadowGenerator,
    private highlightLayer: HighlightLayer,
    private targetingSystem: TargetingSystem
  ) {}

  public setCharacterMesh(mesh: Mesh): void {
    console.log("GameManager: Setting character mesh:", mesh.name);
    this.characterMesh = mesh;
  }

  async initializeNPCs(savedPositions?: Vector3[]): Promise<NPC[]> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const npcPositions = configData.npcs?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];

    const positionsToUse = savedPositions?.length ? savedPositions : npcPositions;

    this.npcs = positionsToUse.map((position: Vector3, index: number) => 
      new NPC(
        this.scene,
        "npc",
        this.assetManager,
        this.shadowGenerator,
        position,
        this.highlightLayer,
        this.targetingSystem
      )
    );

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
        this.targetingSystem
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

    // Get the ground mesh (named "Plane")
    const groundMesh = this.scene.getMeshByName("Plane");
    if (!groundMesh) {
      console.warn("GameManager: Ground mesh 'Plane' not found, using original y-positions");
    }

    // Adjust y-positions to be ground height + 1
    const adjustedPositions = stateToUse.positions.map((pos: Vector3) => {
      let yPos: number = pos.y; // Fallback to original y-position
      if (groundMesh) {
        // Use raycasting to find ground height
        const ray = new Ray(new Vector3(pos.x, 1000, pos.z), new Vector3(0, -1, 0));
        const pickInfo = this.scene.pickWithRay(ray, (mesh) => mesh === groundMesh);
        if (pickInfo?.hit && pickInfo.pickedPoint) {
          yPos = pickInfo.pickedPoint.y;
        } else {
          console.warn(`GameManager: No ground hit for crystal at (${pos.x}, ${pos.z}), using original y: ${pos.y}`);
        }
      }
      return new Vector3(pos.x, yPos + 1, pos.z); // Add 1 unit above ground
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

  dispose(): void {
    this.npcs.forEach(npc => npc.dispose());
    this.enemies.forEach(enemy => enemy.dispose());
    this.dreamCrystalManager?.dispose();
    this.npcs = [];
    this.enemies = [];
    this.dreamCrystalManager = null;
    this.characterMesh = null;
  }
}