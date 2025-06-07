export type QuestType = "COLLECT" | "KILL";

export interface QuestState {
  id: string;
  status: "available" | "inProgress" | "completed" | "turnedIn";
  collectedCrystals?: number; // For COLLECT quests
  enemiesKilled?: number; // For KILL quests
  isCompleted?: boolean;
}

export class Quest {
  public state: QuestState;

  constructor(
    public id: string,
    public title: string,
    public description: string,
    public inProgressText: string,
    public completedText: string,
    public requiredCrystals: number,
    public requiredEnemies: number, // New: For KILL quests
    public turnedInText: string,
    public type: QuestType, // New: Quest type
    public nextQuestId: string | null, 
    public requiredEnemyType?: "Enemy" | "BossEnemy",
    public xpReward = 0
  ) {
    this.state = {
      id: this.id,
      status: "available",
      collectedCrystals: type === "COLLECT" ? 0 : undefined,
      enemiesKilled: type === "KILL" ? 0 : undefined,
      isCompleted: false,
    };
    // console.log(`Quest ${id}: Constructed with requiredEnemyType=${this.requiredEnemyType}`); // Debug
  }

  public accept(): void {
    if (this.state.status === "available") {
      this.state.status = "inProgress";
      // console.log(`Quest ${this.id}: Accepted, status set to inProgress`);
    }
  }

  public getXPReward() { 
    return this.xpReward; 
  } 

  public updateProgress(amount: number, enemyType?: "Enemy" | "BossEnemy"): void {
  if (this.state.status !== "inProgress") {
    // console.log(`Quest ${this.id}: Cannot update progress, status is ${this.state.status}`);
    return;
  }
  if (amount <= 0) {
    console.warn(`Quest ${this.id}: Invalid progress amount ${amount}, ignoring`);
    return;
  }
  if (this.type === "COLLECT") {
    const newCrystals = (this.state.collectedCrystals || 0) + Math.min(amount, 1);
    this.state.collectedCrystals = Math.min(newCrystals, this.requiredCrystals);
    // console.log(`Quest ${this.id}: Collected ${Math.min(amount, 1)} crystals, total: ${this.state.collectedCrystals}/${this.requiredCrystals}`);
    if (this.state.collectedCrystals >= this.requiredCrystals && this.requiredCrystals > 0) {
      this.complete();
    }
  } else if (this.type === "KILL") {
    // Log incoming parameters for debugging
    // console.log(`Quest ${this.id}: Processing kill, enemyType=${enemyType}, requiredEnemyType=${this.requiredEnemyType}`);
    // Only count kills if enemyType matches requiredEnemyType
    if (this.requiredEnemyType && enemyType !== this.requiredEnemyType) {
      // console.log(`Quest ${this.id}: Killed enemy type ${enemyType}, but requires ${this.requiredEnemyType}, ignoring`);
      return;
    }
    // If no requiredEnemyType, default to counting only "Enemy" kills
    if (!this.requiredEnemyType && enemyType !== "Enemy") {
      // console.log(`Quest ${this.id}: Killed enemy type ${enemyType}, but no requiredEnemyType set, requires Enemy, ignoring`);
      return;
    }
    this.state.enemiesKilled = (this.state.enemiesKilled || 0) + amount;
    // console.log(`Quest ${this.id}: Defeated ${amount} ${enemyType || "enemies"}, total: ${this.state.enemiesKilled}/${this.requiredEnemies}`);
    if (this.state.enemiesKilled >= this.requiredEnemies && this.requiredEnemies > 0) {
      this.complete();
    }
  }
}

  public complete(): void {
    if (this.state.status === "inProgress") {
      this.state.status = "completed";
      this.state.isCompleted = true;
      // console.log(`Quest ${this.id}: Completed`);
    }
  }

  public turnIn(): void {
    if (this.state.status === "completed") {
      this.state.status = "turnedIn";
      // console.log(`Quest ${this.id}: Turned in`);
    }
  }
public isCompletedStatus(): boolean {
    const isComplete =
      this.state.status === "completed" ||
      this.state.status === "turnedIn" ||
      (this.type === "COLLECT" &&
       this.state.collectedCrystals !== undefined &&
       this.state.collectedCrystals >= this.requiredCrystals &&
       this.requiredCrystals > 0) ||
      (this.type === "KILL" &&
       this.state.enemiesKilled !== undefined &&
       this.state.enemiesKilled >= this.requiredEnemies &&
       this.requiredEnemies > 0);

    // console.log(`Quest ${this.id}: isCompletedStatus check - status: ${this.state.status}, collectedCrystals: ${this.state.collectedCrystals}/${this.requiredCrystals}, enemiesKilled: ${this.state.enemiesKilled}/${this.state.enemiesKilled}, isComplete: ${isComplete}`);
    return isComplete;
  }


  public getNextQuestId(): string | null {
    return this.nextQuestId;
  }

  public getId(): string {
    return this.id;
  }

  public getState(): QuestState {
    return this.state;
  }

  public setState(state: QuestState): void {
    this.state = { ...state };
    // console.log(`Quest ${this.id}: State updated to`, this.state);
  }

  public getTitle(): string {
    return this.title;
  }

  public getDescription(): string {
    return this.description;
  }

  public getInProgressText(): string {
    return this.inProgressText;
  }

  public getCompletedText(): string {
    return this.completedText;
  }

  public getTurnedInText(): string {
    return this.turnedInText;
  }
}