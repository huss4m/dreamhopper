import { Scene, CascadedShadowGenerator, Vector3, Observable } from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { Item } from "../items/Item";
import { Quest, QuestState } from "../npc/Quest";
import { Game } from "../Game";

export class Player {
  private inventory: Item[] = [];
  private collectedCrystals = 0;
  private totalCrystals = 0;
  private activeQuests: Quest[] = [];
  private completedQuests: Quest[] = [];
  private turnedInQuests: Quest[] = [];
  private maxHP = 100;
  private currentHP = 100;
  private isDead = false;
  public onDeathObservable = new Observable<void>();
  public onQuestStateChanged = new Observable<Quest>();
  isSheathed = false;
  posOffset: Vector3;
  rotOffset: Vector3;
  private game: Game | null = null;

  constructor(scene: Scene, assetManager: AssetManager, shadowGenerator: CascadedShadowGenerator, game?: Game) {
    this.game = game!;
    this.posOffset = new Vector3(0, 0, -0.21);
    this.rotOffset = new Vector3(-11 * Math.PI / 12, Math.PI / 11, Math.PI / 3);
  }

  public getMaxHP(): number {
    return this.maxHP;
  }

  public getCurrentHP(): number {
    return this.currentHP;
  }

  public isPlayerDead(): boolean {
    return this.isDead;
  }

  public setHP(hp: number): void {
    this.currentHP = Math.max(0, Math.min(hp, this.maxHP));
    console.log(`Player: HP updated to ${this.currentHP}/${this.maxHP}`);
    if (this.currentHP === 0 && !this.isDead) {
      this.isDead = true;
      console.log("Player is Dead!");
      this.onDeathObservable.notifyObservers();
      const characterController = this.game?.getCharacterController();
      if (characterController) {
        characterController.playDeathAnimation();
      } else {
        console.warn("Player: Cannot play Death animation, CharacterController not found");
      }
    }
  }

  public reset(): void {
    this.currentHP = this.maxHP;
    this.isDead = false;
    console.log("Player: Reset HP to max and cleared isDead state");
  }

  public getInventory(): Item[] {
    return [...this.inventory];
  }

  public addItem(item: Item): void {
    if (!this.inventory.some(i => i.getName() === item.getName())) {
      this.inventory.push(item);
      console.log(`Player: Added ${item.getName()} to inventory`);
    } else {
      console.log(`Player: ${item.getName()} already in inventory`);
      item.dispose();
    }
  }

  public removeItem(itemName: string): void {
    const index = this.inventory.findIndex(i => i.getName() === itemName);
    if (index !== -1) {
      const item = this.inventory[index];
      this.inventory.splice(index, 1);
      item.dispose();
      console.log(`Player: Removed ${itemName} from inventory`);
    } else {
      console.log(`Player: ${itemName} not found in inventory`);
    }
  }

  public hasItem(itemName: string): boolean {
    return this.inventory.some(i => i.getName() === itemName);
  }

  public sheathe() {
    this.isSheathed = true;
  }

  public unSheathe() {
    this.isSheathed = false;
  }

  
  public incrementCrystalCount(): void {
    this.collectedCrystals++;
    console.log(`Player: Incrementing crystal count, now ${this.collectedCrystals}/${this.totalCrystals}, activeQuests=${this.activeQuests.map(q => `${q.getId()}:${q.getState().status}`).join(", ")}`);
    this.activeQuests.forEach(quest => {
      if (quest.type === "COLLECT" && quest.getState().status === "inProgress") {
        quest.updateProgress(1); // Increment by 1 for each crystal
        console.log(`Player: Updated COLLECT quest ${quest.getId()} - progress ${quest.getState().collectedCrystals}/${quest.requiredCrystals}, completed=${quest.isCompletedStatus()}`);
      this.updateNPCQuest(quest);
      this.onQuestStateChanged.notifyObservers(quest);
      }
    });
    this.checkQuestCompletion();
  }

  public incrementEnemyKills(): void { // New: Increment kills for KILL quests
    console.log(`Player: Incrementing enemy kills`);
    this.activeQuests.forEach(quest => {
      if (quest.type === "KILL") { // Fixed: Use quest.type
        quest.updateProgress(1); // Update progress by 1 kill
        console.log(`Player: Updated KILL quest ${quest.getId()} progress`);
        this.updateNPCQuest(quest);
        this.onQuestStateChanged.notifyObservers(quest);
      }
    });
    this.checkQuestCompletion();
  }

  public setTotalCrystals(total: number): void {
    this.totalCrystals = total;
    console.log(`Player: Set total crystals to ${this.totalCrystals}`);
  }

  public getCollectedCrystals(): number {
    return this.collectedCrystals;
  }

  public getTotalCrystals(): number {
    return this.totalCrystals;
  }

  public resetCrystalCount(): void {
    this.collectedCrystals = 0;
    this.totalCrystals = 0;
    console.log("Player: Reset crystal count");
  }

  public acceptQuest(quest: Quest): void {
    if (!this.activeQuests.some(q => q.getId() === quest.getId()) && 
        !this.completedQuests.some(q => q.getId() === quest.getId()) &&
        !this.turnedInQuests.some(q => q.getId() === quest.getId())) {
      quest.accept();
      this.activeQuests.push(quest);
      console.log(`Player: Accepted quest ${quest.getId()}`);
      this.updateNPCQuest(quest);
      this.onQuestStateChanged.notifyObservers(quest);
    }
  }

  public forceCompleteQuest(questId: string): void {
    const quest = this.activeQuests.find(q => q.getId() === questId);
    if (quest) {
      quest.setState({
        ...quest.getState(),
        status: "completed",
        collectedCrystals: quest.type === "COLLECT" ? quest.requiredCrystals : quest.getState().collectedCrystals, // Fixed: Use quest.type
        enemiesKilled: quest.type === "KILL" ? quest.requiredEnemies : quest.getState().enemiesKilled, // Fixed: Use quest.requiredEnemies
        isCompleted: true
      });
      this.activeQuests = this.activeQuests.filter(q => q.getId() !== questId);
      this.completedQuests.push(quest);
      console.log(`Player: Forced completion of quest ${questId}`);
      this.updateNPCQuest(quest);
    } else {
      console.log(`Player: Quest ${questId} not found in active quests`);
    }
  }

  public turnInQuest(quest: Quest): void {
    if (quest.getState().status === "completed") {
      quest.turnIn();
      this.completedQuests = this.completedQuests.filter(q => q.getId() !== quest.getId());
      this.activeQuests = this.activeQuests.filter(q => q.getId() !== quest.getId()); // Ensure removal from activeQuest
      this.turnedInQuests.push(quest);
      console.log(`Player: Turned in quest ${quest.getId()}`);
      this.updateNPCQuest(quest);
      this.onQuestStateChanged.notifyObservers(quest);
    }
  }

  public getActiveQuests(): Quest[] {
    return [...this.activeQuests];
  }

  public getCompletedQuests(): Quest[] {
    return [...this.completedQuests];
  }

  public getTurnedInQuests(): Quest[] {
    return [...this.turnedInQuests];
  }

  private checkQuestCompletion(): void {
    this.activeQuests.forEach(quest => {
      if (quest.isCompletedStatus() && quest.getState().status !== "completed") {
        quest.setState({
          ...quest.getState(),
          status: "completed",
          isCompleted: true
        });
        this.activeQuests = this.activeQuests.filter(q => q.getId() !== quest.getId());
        this.completedQuests.push(quest);
        console.log(`Player: Completed quest ${quest.getId()}`);
        this.updateNPCQuest(quest);
        this.onQuestStateChanged.notifyObservers(quest);
      }
    });
  }

  private updateNPCQuest(quest: Quest): void {
    if (!this.game) {
      console.error(`Player: Cannot update NPC quest ${quest.getId()}, game instance is null`);
      return;
    }
    const npcs = this.game.getGameManager().getNPCs();
    console.log(`Player: Found ${npcs.length} NPCs to check for quest ${quest.getId()}`);
    let updated = false;
    npcs.forEach(npc => {
      const npcQuest = npc.getQuest();
      console.log(`Player: Checking NPC ${npc.getId()}, quest=${npcQuest?.getId() || 'none'}, status=${npcQuest?.getState().status || 'none'}`);
      if (npcQuest?.getId() === quest.getId()) {
        npc.setQuest(quest);
        npc.updateQuestMarker();
        console.log(`Player: Updated NPC ${npc.getId()} quest ${quest.getId()} to status: ${quest.getState().status}`);
        updated = true;
      }
    });
    if (!updated) {
      console.warn(`Player: No NPCs found with quest ${quest.getId()}`);
    }
  }

  public getQuestState(): QuestState[] {
    return [
      ...this.activeQuests.map(q => q.getState()),
      ...this.completedQuests.map(q => q.getState()),
      ...this.turnedInQuests.map(q => q.getState())
    ];
  }

  public setQuestState(states: QuestState[]): void {
    states.forEach(state => {
      const quest = [...this.activeQuests, ...this.completedQuests, ...this.turnedInQuests].find(q => q.getId() === state.id);
      if (quest) {
        quest.setState(state);
        if (state.status === "completed" && this.activeQuests.includes(quest)) {
          this.activeQuests = this.activeQuests.filter(q => q.getId() !== quest.id);
          this.completedQuests.push(quest);
          this.updateNPCQuest(quest);
        } else if (state.status === "turnedIn" && this.completedQuests.includes(quest)) {
          this.completedQuests = this.completedQuests.filter(q => q.getId() !== quest.id);
          this.turnedInQuests.push(quest);
          this.updateNPCQuest(quest);
        }
      }
    });
  }

  public dispose(): void {
    this.onDeathObservable.clear();
    this.onQuestStateChanged.clear();
    this.inventory.forEach(item => item.dispose());
    this.inventory = [];
    this.activeQuests = [];
    this.completedQuests = [];
    this.turnedInQuests = [];
    console.log("Player: Disposed");
  }
}