export interface QuestState {
    id: string;
    status: "available" | "inProgress" | "completed" | "turnedIn"; // Added turnedIn
    collectedCrystals: number;
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
      public turnedInText: string // Added turnedInText
    ) {
      this.state = {
        id: this.id,
        status: "available",
        collectedCrystals: 0,
        isCompleted: false,
      };
    }
  
    public getId(): string {
      return this.id;
    }
  
    public getTitle(): string {
      return this.title;
    }
  
    public getDescription(): string {
      return this.description;
    }
  
    public getInProgressText(): string {
      return this.inProgressText || `Progress: ${this.state.collectedCrystals}/${this.requiredCrystals} crystals collected.`;
    }
  
    public getCompletedText(): string {
      return this.completedText || "Quest completed! Thank you for collecting the crystals.";
    }
  
    public getTurnedInText(): string { // Added getTurnedInText
      return this.turnedInText || "Thank you for completing the quest!";
    }
  
    public getRequiredCrystals(): number {
      return this.requiredCrystals;
    }
  
    public getState(): QuestState {
      return { ...this.state };
    }
  
    public setState(state: QuestState): void {
      console.log(`Quest ${this.id}: Setting state to`, state);
      this.state = { ...state };
      if (this.state.status === "completed" || this.state.status === "turnedIn") { // Updated to include turnedIn
        this.state.isCompleted = true;
      }
    }
  
    public accept(): void {
      if (this.state.status === "available") {
        this.state.status = "inProgress";
        console.log(`Quest ${this.id}: Accepted, status set to inProgress`);
      }
    }
  
    public complete(): void {
      this.state.status = "completed";
      this.state.isCompleted = true;
      console.log(`Quest ${this.id}: Completed`);
    }
  
    public turnIn(): void { // Added turnIn
      if (this.state.status === "completed") {
        this.state.status = "turnedIn";
        this.state.isCompleted = true;
        console.log(`Quest ${this.id}: Turned in`);
      }
    }
  
    public updateProgress(collectedCrystals: number): void {
      if (this.state.status === "inProgress") {
        this.state.collectedCrystals = collectedCrystals;
        console.log(`Quest ${this.id}: Progress updated to ${collectedCrystals}/${this.requiredCrystals}`);
        if (collectedCrystals >= this.requiredCrystals && this.requiredCrystals > 0) {
          this.complete();
        }
      }
    }
  
    public isCompletedStatus(): boolean {
      return this.state.status === "completed" || this.state.status === "turnedIn" || // Updated to include turnedIn
             (this.state.collectedCrystals >= this.requiredCrystals && this.requiredCrystals > 0);
    }
  
    public isTakenStatus(): boolean {
      return this.state.status === "inProgress";
    }
  }