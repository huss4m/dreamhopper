import { Sound, CreateAudioEngineAsync, CreateStreamingSoundAsync, AudioEngineV2 } from "@babylonjs/core";

export class SoundManager {
  private static instance: SoundManager | null = null;
  private audioEngine: AudioEngineV2 | null = null;
  private currentSound: any | null = null;
  private songFiles: string[];
  private volume = 0.15;
  private isPlaying = false;
  private ambianceSound: any | null = null;

  private constructor(songFiles: string[]) {
    if (!songFiles || songFiles.length === 0) {
      throw new Error("SoundManager: At least one song file must be provided");
    }
    this.songFiles = songFiles;
  }

  public static getInstance(songFiles?: string[]): SoundManager {
    if (!SoundManager.instance) {
      if (!songFiles) {
        throw new Error("SoundManager: Song files must be provided for first instance");
      }
      SoundManager.instance = new SoundManager(songFiles);
    }
    return SoundManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      if (this.audioEngine) {
        this.audioEngine.dispose();
        this.audioEngine = null;
      }
      this.audioEngine = await CreateAudioEngineAsync({
           listenerAutoUpdate: true,
        listenerEnabled: true,
        resumeOnInteraction: true
      });
      await this.audioEngine.unlockAsync();
      console.log("SoundManager: Audio engine initialized and unlocked");
      await this.playRandomSong();
      await this.playAmbiance();
    } catch (error) {
      console.error("SoundManager: Failed to initialize audio engine", error);
      throw error;
    }
  }
private async playAmbiance(): Promise<void> {
  try {
    this.ambianceSound = await CreateStreamingSoundAsync("ambiance", "./music/ambiance.mp3",
{
       stereoEnabled: true,
       
        
        loop: true,
        autoplay: true

}

    );
    this.ambianceSound.loop = true;
    this.ambianceSound.volume = 0.35; // ajustable indépendamment
  
    this.ambianceSound.play();
    console.log("SoundManager: Ambiance sound started");
  } catch (error) {
    console.error("SoundManager: Failed to play ambiance sound", error);
  }
}
  private async playRandomSong(): Promise<void> {
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound.onEndedObservable.clear();
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
      this.currentSound.loop = false;
      this.currentSound.volume = this.volume;
      this.currentSound.play();
      this.isPlaying = true;
     // console.log(`SoundManager: Playing song ${songUrl}, instance count: ${this.audioEngine?.audioContext?.sounds.length || 0}`);

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
      this.currentSound.onEndedObservable.clear();
      this.currentSound.dispose();
      this.currentSound = null;
    }
    if (this.audioEngine) {
      this.audioEngine.dispose();
      this.audioEngine = null;
    }
    SoundManager.instance = null;
    console.log("SoundManager: Disposed");
  }

  public isMusicPlaying(): boolean {
    return this.isPlaying;
  }
}