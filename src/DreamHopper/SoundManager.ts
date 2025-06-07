import { Sound, CreateAudioEngineAsync, CreateStreamingSoundAsync, AudioEngineV2 } from "@babylonjs/core";

export class SoundManager {
  private static instance: SoundManager | null = null;
  private audioEngine: AudioEngineV2 | null = null;
  private currentSound: any | null = null;
  private songFiles: string[];
  private volume = 0.15;
  private isPlaying = false;
  private ambianceSound: any | null = null;

  private fadeIntervalId: number | null = null;
  private nextSongTimeoutId: number | null = null;
  private isFading = false;

  
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
      //// console.log("SoundManager: Audio engine initialized and unlocked");
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
    this.ambianceSound.volume = 0.32; // ajustable indépendamment
  
    this.ambianceSound.play();
    //// console.log("SoundManager: Ambiance sound started");
  } catch (error) {
    console.error("SoundManager: Failed to play ambiance sound", error);
  }
}


private async playRandomSong(): Promise<void> {
  // Fade out and dispose current song
  if (this.currentSound) {
    await this.fadeOut(this.currentSound);
    this.currentSound.onEndedObservable.clear();
    this.currentSound.dispose();
    this.currentSound = null;
    this.isPlaying = false;
  }

  // Delay before next song
  const delayMs = 10000 + Math.random() * 5000; // 10-15 seconds
  //// console.log(`SoundManager: Waiting ${delayMs / 1000}s before next song`);

  this.nextSongTimeoutId = setTimeout(async () => {
    this.nextSongTimeoutId = null;

    const randomIndex = Math.floor(Math.random() * this.songFiles.length);
    const songUrl = this.songFiles[randomIndex];

    try {
      this.currentSound = await CreateStreamingSoundAsync(
        `backgroundMusic_${randomIndex}`,
        songUrl
      );
      this.currentSound.loop = false;
      this.currentSound.volume = 0; // Start at 0 for fade-in
      this.currentSound.play();
      this.isPlaying = true;
      //// console.log(`SoundManager: Playing song ${songUrl}`);

      // Fade in
      await this.fadeIn(this.currentSound);

      this.currentSound.onEndedObservable.addOnce(() => {
        //// console.log(`SoundManager: Song ${songUrl} ended`);
        this.playRandomSong();
      });
    } catch (error) {
      console.error(`SoundManager: Failed to play song ${songUrl}`, error);
      this.isPlaying = false;
      this.playRandomSong(); // Retry after delay
    }
  }, delayMs);
}

private async fadeIn(sound: any): Promise<void> {
  if (this.isFading) {
    console.warn("SoundManager: Already fading, skipping fade-in");
    return;
  }
  this.isFading = true;
  const fadeDurationMs = 2000; // 2 seconds
  const steps = 50; // 50 steps
  const stepMs = fadeDurationMs / steps;
  const volumeStep = this.volume / steps;
  let currentVolume = 0;

  return new Promise((resolve) => {
    this.fadeIntervalId = setInterval(() => {
      if (!sound || currentVolume >= this.volume) {
        if (this.fadeIntervalId) {
          clearInterval(this.fadeIntervalId);
          this.fadeIntervalId = null;
        }
        if (sound) {
          sound.volume = this.volume;
         // // console.log(`SoundManager: Fade-in set volume to ${this.volume}`);
        }
        this.isFading = false;
       // // console.log("SoundManager: Fade-in completed");
        resolve();
        return;
      }
      currentVolume += volumeStep;
      sound.volume = Math.min(currentVolume, this.volume);
     // // console.log(`SoundManager: Fade-in volume: ${currentVolume}`);
    }, stepMs);
  });
}

private async fadeOut(sound: any): Promise<void> {
  if (this.isFading) {
    console.warn("SoundManager: Already fading, skipping fade-out");
    return;
  }
  this.isFading = true;
  const fadeDurationMs = 5000; // 2 seconds
  const steps = 50; // 50 steps
  const stepMs = fadeDurationMs / steps;
  const startVolume = sound.volume || this.volume;
  const volumeStep = startVolume / steps;
  let currentVolume = startVolume;

  return new Promise((resolve) => {
    this.fadeIntervalId = setInterval(() => {
      if (!sound || currentVolume <= 0) {
        if (this.fadeIntervalId) {
          clearInterval(this.fadeIntervalId);
          this.fadeIntervalId = null;
        }
        if (sound) {
          sound.volume = 0;
          sound.stop();
         // // console.log("SoundManager: Fade-out set volume to 0 and stopped");
        }
        this.isFading = false;
      //  // console.log("SoundManager: Fade-out completed");
        resolve();
        return;
      }
      currentVolume -= volumeStep;
      sound.volume = Math.max(currentVolume, 0);
     // // console.log(`SoundManager: Fade-out volume: ${currentVolume}`);
    }, stepMs);
  });
}

public setVolume(volume: number): void {
  this.volume = Math.max(0, Math.min(1, volume));
  if (this.currentSound && !this.isFading) {
    this.currentSound.volume = this.volume;
   // // console.log(`SoundManager: Set volume to ${this.volume}`);
  }
 // // console.log(`SoundManager: Volume set to ${this.volume}`);
}

  public stop(): void {
    if (this.currentSound) {
      this.currentSound.stop();
      this.isPlaying = false;
      //// console.log("SoundManager: Music stopped");
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
    //// console.log("SoundManager: Disposed");
  }

  public isMusicPlaying(): boolean {
    return this.isPlaying;
  }
}