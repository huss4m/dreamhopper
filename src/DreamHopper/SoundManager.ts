import { Sound, CreateAudioEngineAsync, CreateStreamingSoundAsync, AudioEngineV2 } from "@babylonjs/core";

export class SoundManager {
  private audioEngine: AudioEngineV2 | null = null;
  private currentSound: any | null = null;
  private songFiles: string[];
  private volume = 0.2;
  private isPlaying = false;

  constructor(songFiles: string[]) {
    if (!songFiles || songFiles.length === 0) {
      throw new Error("SoundManager: At least one song file must be provided");
    }
    this.songFiles = songFiles;
  }

  public async initialize(): Promise<void> {
    try {
      this.audioEngine = await CreateAudioEngineAsync();
      await this.audioEngine.unlockAsync();
      console.log("SoundManager: Audio engine initialized and unlocked");
      await this.playRandomSong();
    } catch (error) {
      console.error("SoundManager: Failed to initialize audio engine", error);
      throw error;
    }
  }

  private async playRandomSong(): Promise<void> {
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound.dispose();
      this.currentSound = null;
    }

    const randomIndex = Math.floor(Math.random() * this.songFiles.length);
    const songUrl = this.songFiles[randomIndex];

    try {
      this.currentSound = await CreateStreamingSoundAsync(
        `backgroundMusic_${randomIndex}`,
        songUrl
      );
      this.currentSound.loop = false; // Loop per song disabled; handled by onEnded
      this.currentSound.volume = this.volume;
      this.currentSound.play();
      this.isPlaying = true;
      console.log(`SoundManager: Playing song ${songUrl}`);

      this.currentSound.onEndedObservable.addOnce(() => {
        console.log(`SoundManager: Song ${songUrl} ended`);
        this.playRandomSong();
      });
    } catch (error) {
      console.error(`SoundManager: Failed to play song ${songUrl}`, error);
      this.isPlaying = false;
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentSound) {
      this.currentSound.volume = this.volume;
    }
    console.log(`SoundManager: Volume set to ${this.volume}`);
  }

  public stop(): void {
    if (this.currentSound) {
      this.currentSound.stop();
      this.isPlaying = false;
      console.log("SoundManager: Music stopped");
    }
  }

  public dispose(): void {
    this.stop();
    if (this.currentSound) {
      this.currentSound.dispose();
      this.currentSound = null;
    }
    if (this.audioEngine) {
      this.audioEngine.dispose();
      this.audioEngine = null;
    }
    console.log("SoundManager: Disposed");
  }

  public isMusicPlaying(): boolean {
    return this.isPlaying;
  }
}