import { Scene, Vector3, ShadowGenerator, CascadedShadowGenerator } from "@babylonjs/core";
import { AssetManager } from "./AssetManager";
import { NPC } from "./npc/NPC";
import { Enemy } from "./enemy/Enemy";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { TargetingSystem } from "./TargetingSystem";

export class GameManager {
  private npcs: NPC[] = [];
  private enemies: Enemy[] = [];

  constructor(
    private scene: Scene,
    private assetManager: AssetManager,
    private shadowGenerator: CascadedShadowGenerator,
    private highlightLayer: HighlightLayer,
    private targetingSystem: TargetingSystem
  ) {}

  async initializeNPCs(): Promise<NPC[]> {
    const configData = await this.assetManager.loadJson("./game_config.json");
    const npcPositions = configData.npcs?.map((pos: { x: number, y: number, z: number }) => 
      new Vector3(pos.x, pos.y, pos.z)) || [];

    const positionsToUse = npcPositions;

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
        console.log(`NPC ${index} mesh added to shadow generator:`, npcMesh.name);
      } else {
        console.warn(`NPC ${index} mesh not found for shadow generator`);
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
        "enemy", // Using same asset as NPCs
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
        console.log(`Enemy ${index} mesh added to shadow generator:`, enemyMesh.name);
      } else {
        console.warn(`Enemy ${index} mesh not found for shadow generator`);
      }
    });

    return this.enemies;
  }

  getNPCs(): NPC[] {
    return this.npcs;
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  getNPCPositions(): Vector3[] {
    return this.npcs.map(npc => npc.getPosition());
  }

  getEnemyPositions(): Vector3[] {
    return this.enemies.map(enemy => enemy.getPosition());
  }

  dispose(): void {
    this.npcs.forEach(npc => npc.dispose());
    this.enemies.forEach(enemy => enemy.dispose());
    this.npcs = [];
    this.enemies = [];
  }
}