import { Scene, CascadedShadowGenerator, Vector3, Observable, ParticleSystem, Color4, Texture, Sound } from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { Item } from "../items/Item";
import { Quest, QuestState } from "../npc/Quest";
import { Game } from "../Game";
import { Enemy } from "../enemy/Enemy";
//import { BossEnemy } from "../enemy/BossEnemy";

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
  private level = 1; // New: Track player level, starting at 1
  private currentXP = 0;
  private maxXP = 1000; // New: Base XP for level 1
  public onDeathObservable = new Observable<void>();
  public onQuestStateChanged = new Observable<Quest>();
  public onHPChanged = new Observable<{ currentHP: number; maxHP: number }>();
  public onXPChanged = new Observable<{ currentXP: number; maxXP: number }>();
  public onLevelChanged = new Observable<{ level: number }>(); // New: Notify level changes
  isSheathed = false;
  posOffset: Vector3;
  rotOffset: Vector3;
  private game: Game | null = null;
  scene: Scene;

  private baseRegenRate = 2; 
  private hpRegenRate: number; 
  private hpRegenInterval: number | null = null;
  private baseManaRegenRate = 2; // New: Base mana regen rate
  private manaRegenRate: number; // New: Mana regen rate
  private manaRegenInterval: number | null = null; // New: Mana regen interval
  private mana = 100;
  private maxMana = 100;

  public onManaChanged = new Observable<{ currentMana: number; maxMana: number }>(); // New: Mana change observable

  constructor(scene: Scene, assetManager: AssetManager, shadowGenerator: CascadedShadowGenerator, game?: Game) {
    this.game = game!;
    this.scene = scene;
    this.posOffset = new Vector3(0, 0, -0.21);
    this.rotOffset = new Vector3(-11 * Math.PI / 12, Math.PI / 11, Math.PI / 3);

    this.hpRegenRate = this.baseRegenRate;
    this.manaRegenRate = this.baseManaRegenRate; // New: Initialize mana regen rate

    this.startHPRegeneration();
    this.startManaRegeneration(); // New: Start mana regeneration
    // Subscribe to enemy and boss death events to award XP
    this.setupEnemyDeathSubscriptions();
    this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana }); // New: Initial mana notification

  }


  private startHPRegeneration(): void {
    this.hpRegenInterval = setInterval(() => {
    if (!this.isDead && this.currentHP < this.maxHP) {
      this.currentHP = Math.min(this.currentHP + this.hpRegenRate, this.maxHP);
      // console.log(`Player: Regenerated ${this.hpRegenRate} HP at level ${this.level}, now ${this.currentHP}/${this.maxHP}`);
      this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
    }
  }, 5000);
  }


   private startManaRegeneration(): void { // New: Mana regeneration
    this.manaRegenInterval = setInterval(() => {
      if (!this.isDead && this.mana < this.maxMana) {
        this.mana = Math.min(this.mana + this.manaRegenRate, this.maxMana);
        this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana });
      }
    }, 5000);
  }

  private setupEnemyDeathSubscriptions(): void {
  if (!this.game) {
    console.error("Player: Cannot setup enemy death subscriptions, game instance is null");
    return;
  }
  const enemies = this.game.getGameManager()?.getEnemies() || [];
  //const bosses = this.game.getGameManager()?.getBosses() || [];
  
  enemies.forEach(enemy => this.subscribeToEnemyDeath(enemy));
 // bosses.forEach(boss => this.subscribeToEnemyDeath(boss));

  // console.log(`Player: Subscribed to ${enemies.length} enemies and ${bosses.length} bosses for XP awards`);
}

  public getLevel(): number { // New: Getter for level
    return this.level;
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
    // console.log(`Player: HP updated to ${this.currentHP}/${this.maxHP}`);
    if (this.currentHP === 0 && !this.isDead) {
      this.isDead = true;
      // console.log("Player is Dead!");
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
    this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
    this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana }); // New: Notify mana reset
    // console.log("Player: Reset HP to max and cleared isDead state");
  }

  public getInventory(): Item[] {
    return [...this.inventory];
  }

  public addItem(item: Item): void {
    if (!this.inventory.some(i => i.getName() === item.getName())) {
      this.inventory.push(item);
      // console.log(`Player: Added ${item.getName()} to inventory`);
    } else {
      // console.log(`Player: ${item.getName()} already in inventory`);
      item.dispose();
    }
  }

  public removeItem(itemName: string): void {
    const index = this.inventory.findIndex(i => i.getName() === itemName);
    if (index !== -1) {
      const item = this.inventory[index];
      this.inventory.splice(index, 1);
      item.dispose();
      // console.log(`Player: Removed ${itemName} from inventory`);
    } else {
      // console.log(`Player: ${itemName} not found in inventory`);
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
    // console.log(`Player: Incrementing crystal count, now ${this.collectedCrystals}/${this.totalCrystals}, activeQuests=${this.activeQuests.map(q => `${q.getId()}:${q.getState().status}`).join(", ")}`);
    this.activeQuests.forEach(quest => {
      if (quest.type === "COLLECT" && quest.getState().status === "inProgress") {
        quest.updateProgress(1);
        // console.log(`Player: Updated COLLECT quest ${quest.getId()} - progress ${quest.getState().collectedCrystals}/${quest.requiredCrystals}, completed=${quest.isCompletedStatus()}`);
        this.updateNPCQuest(quest);
        this.onQuestStateChanged.notifyObservers(quest);
      }
    });
    this.checkQuestCompletion();
  }

  public incrementEnemyKills(enemyType: "Enemy" | "BossEnemy"): void {
    // console.log(`Player: Incrementing enemy kills for type ${enemyType}`);
    this.activeQuests.forEach(quest => {
      if (quest.type === "KILL") {
        quest.updateProgress(1, enemyType);
        // console.log(`Player: Updated KILL quest ${quest.getId()} progress for ${enemyType}, enemiesKilled: ${quest.getState().enemiesKilled}`);
        this.updateNPCQuest(quest);
        this.onQuestStateChanged.notifyObservers(quest);
      }
    });
    this.checkQuestCompletion();
  }

  public setTotalCrystals(total: number): void {
    this.totalCrystals = total;
    // console.log(`Player: Set total crystals to ${this.totalCrystals}`);
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
    // console.log("Player: Reset crystal count");
  }

  public acceptQuest(quest: Quest): void {
    if (!this.activeQuests.some(q => q.getId() === quest.getId()) && 
        !this.completedQuests.some(q => q.getId() === quest.getId()) &&
        !this.turnedInQuests.some(q => q.getId() === quest.getId())) {
      quest.accept();
      this.activeQuests.push(quest);
      // console.log(`Player: Accepted quest ${quest.getId()}`);
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
        collectedCrystals: quest.type === "COLLECT" ? quest.requiredCrystals : quest.getState().collectedCrystals,
        enemiesKilled: quest.type === "KILL" ? quest.requiredEnemies : quest.getState().enemiesKilled,
        isCompleted: true
      });
      this.activeQuests = this.activeQuests.filter(q => q.getId() !== questId);
      this.completedQuests.push(quest);
      // console.log(`Player: Forced completion of quest ${questId}`);
      this.updateNPCQuest(quest);
    } else {
      // console.log(`Player: Quest ${questId} not found in active quests`);
    }
  }

  public turnInQuest(quest: Quest): void {
    if (quest.getState().status === "completed") {
      quest.turnIn();
      this.completedQuests = this.completedQuests.filter(q => q.getId() !== quest.getId());
      this.activeQuests = this.activeQuests.filter(q => q.getId() !== quest.getId());
      this.turnedInQuests.push(quest);
      this.addXP(quest.getXPReward());
      // console.log(`Player: Turned in quest ${quest.getId()}`);
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
        // console.log(`Player: Completed quest ${quest.getId()}`);
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
    // console.log(`Player: Found ${npcs.length} NPCs to check for quest ${quest.getId()}`);
    let updated = false;
    npcs.forEach(npc => {
      const npcQuest = npc.getQuest();
      // console.log(`Player: Checking NPC ${npc.getId()}, quest=${npcQuest?.getId() || 'none'}, status=${npcQuest?.getState().status || 'none'}`);
      if (npcQuest?.getId() === quest.getId()) {
        npc.setQuest(quest);
        npc.updateQuestMarker();
        // console.log(`Player: Updated NPC ${npc.getId()} quest ${quest.getId()} to status: ${quest.getState().status}`);
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
          this.completedQuests = this.completedQuests.filter(q => q.getId() === quest.id);
          this.turnedInQuests.push(quest);
          this.updateNPCQuest(quest);
        }
      }
    });
  }

  public takeDamage(damage: number): void {
    this.currentHP = Math.max(0, Math.min(this.currentHP - damage, this.maxHP));
    // console.log(`Player: Took ${damage} damage, HP updated to ${this.currentHP}/${this.maxHP}`);
    this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
    if (this.currentHP === 0 && !this.isDead) {
      this.isDead = true;
      // console.log("Player is Dead!");
      this.onDeathObservable.notifyObservers();
      const characterController = this.game?.getCharacterController();
      if (characterController) {
        characterController.playDeathAnimation();
      } else {
        console.warn("Player: Cannot play Death animation, CharacterController not found");
      }
    }
  }

    public heal(amount: number): boolean { // New: Heal method
    if (this.isDead || this.currentHP >= this.maxHP) {
      return false;
    }
    this.currentHP = Math.min(this.currentHP + amount, this.maxHP);
    this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
    return true;
  }

  public getCurrentXP(): number {
    return this.currentXP;
  }

  public getMaxXP(): number {
    return this.maxXP;
  }

  public addXP(amount: number): void {
    this.currentXP += amount;
    // console.log(`Player: Added ${amount} XP, current XP: ${this.currentXP}/${this.maxXP} at level ${this.level}`);
    this.onXPChanged.notifyObservers({ currentXP: this.currentXP, maxXP: this.maxXP });

    while (this.currentXP >= this.maxXP) {
        this.level++;
        this.hpRegenRate = this.baseRegenRate + (this.level - 1) * 2;
        const oldMaxHP = this.maxHP;
        this.maxHP = 100 + (this.level - 1) * 20; 
        const hpPercentage = this.currentHP / oldMaxHP;
        this.currentHP = Math.round(this.maxHP * hpPercentage); 
        // console.log(`Player: Leveled up to level ${this.level}! New max HP: ${this.maxHP}, current HP: ${this.currentHP}`);
        this.currentXP -= this.maxXP;
        this.maxXP = Math.round(1000 * Math.pow(1.5, this.level - 1));
        this.onLevelChanged.notifyObservers({ level: this.level });
        this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP }); // Notify HP change
        this.onXPChanged.notifyObservers({ currentXP: this.currentXP, maxXP: this.maxXP });
        this.triggerLevelUpEffect();
    }
}


  public subscribeToEnemyDeath(entity: Enemy ): void {
  entity.onDeath.add(() => {
    this.addXP(entity.xpReward);
    // console.log(`Player: Awarded 100 XP for ${entity instanceof Enemy ? 'Enemy' : 'BossEnemy'} ${entity.getId()} transformation`);
  });
  // console.log(`Player: Subscribed to ${entity instanceof Enemy ? 'Enemy' : 'BossEnemy'} ${entity.getId()} for XP awards`);
}



   public deductMana(amount: number): boolean {
    if (this.mana >= amount) {
      this.mana -= amount;
      return true;
    }
    return false;
  }

  public getMana(): number {
    return this.mana;
  }


private triggerLevelUpEffect(): void {
    if (!this.game) {
      console.error("Player: Cannot trigger level-up effect, game instance is null");
      return;
    }
    const characterController = this.game.getCharacterController();
    if (!characterController || !characterController.characterMesh) {
      console.error("Player: Cannot trigger level-up effect, character mesh not found");
      return;
    }
    const characterMesh = characterController.characterMesh;
    const particleSystem = new ParticleSystem(`levelUpEffect_${this.level}`, 1000, this.scene);
    particleSystem.particleTexture = new Texture("./star_1.png", this.scene);
    particleSystem.emitter = characterMesh;
    particleSystem.minEmitBox = new Vector3(-0.5, 0, -0.5);
    particleSystem.maxEmitBox = new Vector3(0.5, 2, 0.5);
    particleSystem.color1 = new Color4(0.9, 0.2, 1.0, 0.8);
    particleSystem.color2 = new Color4(0.8, 0.5, 0.9, 0.6);
    particleSystem.colorDead = new Color4(0.5, 0.5, 1.0, 0.0);
    particleSystem.minSize = 0.3;
    particleSystem.maxSize = 0.8;
    particleSystem.minLifeTime = 1.0;
    particleSystem.maxLifeTime = 2.5;
    particleSystem.emitRate = 200;
    particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    particleSystem.gravity = new Vector3(0, 0.2, 0); // Slight upward drift
    particleSystem.direction1 = new Vector3(-0.5, 0.5, -0.5);
    particleSystem.direction2 = new Vector3(0.5, 1.0, 0.5);
    particleSystem.minAngularSpeed = -Math.PI / 4;
    particleSystem.maxAngularSpeed = Math.PI / 4;
    particleSystem.minEmitPower = 0.5;
    particleSystem.maxEmitPower = 1.5;
    particleSystem.start();
     const levelUpSound = new Sound(
    "levelUpSound",
    "./sfx/impactchime.wav",
    this.scene,
    () => {
      levelUpSound.play();
    },
    { volume: 0.7 }
  );
    // console.log(`Player: Triggered level-up particle effect at level ${this.level}`);
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
        // console.log(`Player: Disposed level-up particle effect for level ${this.level}`);
      }, 3000);
    }, 2000);
  }

  public getMaxMana() {
    return this.maxMana;
  }

  public dispose(): void {
    this.onDeathObservable.clear();
    this.onQuestStateChanged.clear();
    this.onHPChanged.clear();
    this.onXPChanged.clear();
    this.onLevelChanged.clear(); // New: Clear level change observable
    this.inventory.forEach(item => item.dispose());
    this.inventory = [];
    this.activeQuests = [];
    this.completedQuests = [];
    this.turnedInQuests = [];

     if (this.hpRegenInterval !== null) 
      {
        clearInterval(this.hpRegenInterval);
        this.hpRegenInterval = null;
        // console.log("Player: Cleared HP regeneration interval");
      }

       if (this.manaRegenInterval !== null) { // New: Clear mana regen interval
      clearInterval(this.manaRegenInterval);
      this.manaRegenInterval = null;
    }
    // console.log("Player: Disposed");
  }
}