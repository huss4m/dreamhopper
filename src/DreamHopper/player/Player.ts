import { Scene, CascadedShadowGenerator, Vector3, Observable, ParticleSystem, Color4, Texture, Sound } from "@babylonjs/core";
import { AssetManager } from "../AssetManager";
import { Item } from "../items/Item";
import { Quest, QuestState } from "../npc/Quest";
import { Game } from "../Game";
import { Enemy } from "../enemy/Enemy";

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
  private level = 1;
  private currentXP = 0;
  private maxXP = 1000;
  public onDeathObservable = new Observable<void>();
  public onQuestStateChanged = new Observable<Quest>();
  public onHPChanged = new Observable<{ currentHP: number; maxHP: number }>();
  public onXPChanged = new Observable<{ currentXP: number; maxXP: number }>();
  public onLevelChanged = new Observable<{ level: number }>();
  public onManaChanged = new Observable<{ currentMana: number; maxMana: number }>();
  isSheathed = false;
  posOffset: Vector3;
  rotOffset: Vector3;
  private game: Game | null = null;
  scene: Scene;

  private baseRegenRate = 2;
  private hpRegenRate: number;
  private hpRegenInterval: number | null = null;
  private baseManaRegenRate = 2;
  private manaRegenRate: number;
  private manaRegenInterval: number | null = null;
  public mana = 100;
  private maxMana = 100;

  constructor(scene: Scene, assetManager: AssetManager, shadowGenerator: CascadedShadowGenerator, game?: Game) {
    this.game = game!;
    this.scene = scene;
    this.posOffset = new Vector3(0, 0, -0.21);
    this.rotOffset = new Vector3(-11 * Math.PI / 12, Math.PI / 11, Math.PI / 3);

    this.hpRegenRate = this.baseRegenRate;
    this.manaRegenRate = this.baseManaRegenRate;

    this.startHPRegeneration();
    this.startManaRegeneration();
    this.setupEnemyDeathSubscriptions();
    this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana });
  }

  private startHPRegeneration(): void {
    this.hpRegenInterval = setInterval(() => {
      if (!this.isDead && this.currentHP < this.maxHP) {
        this.currentHP = Math.min(this.currentHP + this.hpRegenRate, this.maxHP);
        this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
      }
    }, 5000);
  }

  private startManaRegeneration(): void {
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
    enemies.forEach(enemy => this.subscribeToEnemyDeath(enemy));
  }

  public getLevel(): number {
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
    if (this.currentHP === 0 && !this.isDead) {
      this.isDead = true;
      this.onDeathObservable.notifyObservers();
      const characterController = this.game?.getCharacterController();
      if (characterController) {
        characterController.playDeathAnimation();
      } else {
        console.warn("Player: Cannot play Death animation, CharacterController not found");
      }
    }
    this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
  }

  public reset(): void {
    this.currentHP = this.maxHP;
    this.mana = this.maxMana; // New: Reset mana
    this.isDead = false;
    this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
    this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana });
  }

  public getInventory(): Item[] {
    return [...this.inventory];
  }

  public addItem(item: Item): void {
    if (!this.inventory.some(i => i.getName() === item.getName())) {
      this.inventory.push(item);
    } else {
      item.dispose();
    }
  }

  public removeItem(itemName: string): void {
    const index = this.inventory.findIndex(i => i.getName() === itemName);
    if (index !== -1) {
      const item = this.inventory[index];
      this.inventory.splice(index, 1);
      item.dispose();
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
    this.activeQuests.forEach(quest => {
      if (quest.type === "COLLECT" && quest.getState().status === "inProgress") {
        quest.updateProgress(1);
        this.updateNPCQuest(quest);
        this.onQuestStateChanged.notifyObservers(quest);
      }
    });
    this.checkQuestCompletion();
  }

  public incrementEnemyKills(enemyType: "Enemy" | "BossEnemy"): void {
    this.activeQuests.forEach(quest => {
      if (quest.type === "KILL") {
        quest.updateProgress(1, enemyType);
        this.updateNPCQuest(quest);
        this.onQuestStateChanged.notifyObservers(quest);
      }
    });
    this.checkQuestCompletion();
  }

  public setTotalCrystals(total: number): void {
    this.totalCrystals = total;
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
  }

  public acceptQuest(quest: Quest): void {
    if (!this.activeQuests.some(q => q.getId() === quest.getId()) && 
        !this.completedQuests.some(q => q.getId() === quest.getId()) &&
        !this.turnedInQuests.some(q => q.getId() === quest.getId())) {
      quest.accept();
      this.activeQuests.push(quest);
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
      this.updateNPCQuest(quest);
    }
  }

  public turnInQuest(quest: Quest): void {
    if (quest.getState().status === "completed") {
      quest.turnIn();
      this.completedQuests = this.completedQuests.filter(q => q.getId() !== quest.getId());
      this.activeQuests = this.activeQuests.filter(q => q.getId() !== quest.getId());
      this.turnedInQuests.push(quest);
      this.addXP(quest.getXPReward());
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
    let updated = false;
    npcs.forEach(npc => {
      const npcQuest = npc.getQuest();
      if (npcQuest?.getId() === quest.getId()) {
        npc.setQuest(quest);
        npc.updateQuestMarker();
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

  public takeDamage(damage: number): void {
    this.currentHP = Math.max(0, Math.min(this.currentHP - damage, this.maxHP));
    this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
    if (this.currentHP === 0 && !this.isDead) {
      this.isDead = true;
      this.onDeathObservable.notifyObservers();
      const characterController = this.game?.getCharacterController();
      if (characterController) {
        characterController.playDeathAnimation();
      } else {
        console.warn("Player: Cannot play Death animation, CharacterController not found");
      }
    }
  }

  public heal(amount: number): boolean {
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
    this.onXPChanged.notifyObservers({ currentXP: this.currentXP, maxXP: this.maxXP });

    while (this.currentXP >= this.maxXP) {
      this.level++;
      this.hpRegenRate = this.baseRegenRate + (this.level - 1) * 2;
      this.manaRegenRate = this.baseManaRegenRate + (this.level - 1) * 0.5; // New: Scale mana regen
      const oldMaxHP = this.maxHP;
      const oldMaxMana = this.maxMana; // New: Store old max mana
      this.maxHP = 100 + (this.level - 1) * 20;
      this.maxMana = 100 + (this.level - 1) * 20; // New: Scale max mana
      const hpPercentage = this.currentHP / oldMaxHP;
      const manaPercentage = this.mana / oldMaxMana; // New: Maintain mana percentage
      this.currentHP = Math.round(this.maxHP * hpPercentage);
      this.mana = Math.round(this.maxMana * manaPercentage); // New: Adjust mana
      this.currentXP -= this.maxXP;
      this.maxXP = Math.round(1000 * Math.pow(1.5, this.level - 1));
      this.onLevelChanged.notifyObservers({ level: this.level });
      this.onHPChanged.notifyObservers({ currentHP: this.currentHP, maxHP: this.maxHP });
      this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana }); // New: Notify mana change
      this.onXPChanged.notifyObservers({ currentXP: this.currentXP, maxXP: this.maxXP });
      this.triggerLevelUpEffect();
    }
  }

  public subscribeToEnemyDeath(entity: Enemy): void {
    entity.onDeath.add(() => {
      this.addXP(entity.xpReward);
    });
  }

  public deductMana(amount: number): boolean {
    if (this.mana >= amount) {
      this.mana -= amount;
      this.onManaChanged.notifyObservers({ currentMana: this.mana, maxMana: this.maxMana }); // New: Notify mana change
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
    particleSystem.gravity = new Vector3(0, 0.2, 0);
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
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
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
    this.onLevelChanged.clear();
    this.onManaChanged.clear(); // New: Clear mana observable
    this.inventory.forEach(item => item.dispose());
    this.inventory = [];
    this.activeQuests = [];
    this.completedQuests = [];
    this.turnedInQuests = [];
    if (this.hpRegenInterval !== null) {
      clearInterval(this.hpRegenInterval);
      this.hpRegenInterval = null;
    }
    if (this.manaRegenInterval !== null) {
      clearInterval(this.manaRegenInterval);
      this.manaRegenInterval = null;
    }
  }
}