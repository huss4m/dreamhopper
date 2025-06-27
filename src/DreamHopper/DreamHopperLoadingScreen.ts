import { ILoadingScreen, Engine } from "@babylonjs/core";

export class DreamHopperLoadingScreen implements ILoadingScreen {
  loadingUIBackgroundColor = "rgba(0, 0, 20, 0.9)"; // Deep blue, semi-transparent
  loadingUIText = "Vous entrez dans le monde des rêves...";
  private loadingDiv: HTMLDivElement | null = null;
  private progressBar: HTMLDivElement | null = null;
  private progressText: HTMLDivElement | null = null;
  private progressPercent = 0;

  constructor(private engine: Engine) {}

  displayLoadingUI(): void {
    if (this.loadingDiv) return; // Prevent multiple instances

    // Create main loading div
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "dreamhopper-loading";
    loadingDiv.style.position = "fixed";
    loadingDiv.style.top = "0";
    loadingDiv.style.left = "0";
    loadingDiv.style.width = "100%";
    loadingDiv.style.height = "100%";
    loadingDiv.style.background = "radial-gradient(circle, rgba(0,0,50,0.9), rgba(0,0,20,1))"; // Starry effect
    loadingDiv.style.display = "flex";
    loadingDiv.style.flexDirection = "column";
    loadingDiv.style.alignItems = "center";
    loadingDiv.style.justifyContent = "center";
    loadingDiv.style.zIndex = "1000";
    loadingDiv.style.color = "#ffffff";
    loadingDiv.style.fontFamily = "'Cinzel', serif";

    // Add Google Fonts 
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);

    // Add spinning crystal image
    const crystalImg = document.createElement("img");
    crystalImg.src = "https://i.imgur.com/9qok91i.png"; 
    crystalImg.style.width = "100px";
    crystalImg.style.height = "100px";
    crystalImg.style.animation = "spin 4s linear infinite, pulse 2s ease-in-out infinite";
    crystalImg.style.marginBottom = "20px";
    loadingDiv.appendChild(crystalImg);

    // Add loading text
    const textDiv = document.createElement("div");
    textDiv.textContent = this.loadingUIText;
    textDiv.style.fontSize = "28px";
    textDiv.style.fontWeight = "700";
    textDiv.style.textShadow = "0 0 10px rgba(147, 63, 219, 0.8)"; // Purple glow
    loadingDiv.appendChild(textDiv);

    // Add small help text
    const helpTextDiv = document.createElement("div");
    helpTextDiv.textContent = "Cliquez sur le canvas avec la souris si le chargement se bloque!";
    helpTextDiv.style.fontSize = "14px";
    helpTextDiv.style.fontWeight = "400";
    helpTextDiv.style.marginTop = "10px";
    helpTextDiv.style.opacity = "0.8";
    loadingDiv.appendChild(helpTextDiv);

    // Add progress bar container
    const progressContainer = document.createElement("div");
    progressContainer.style.width = "300px";
    progressContainer.style.height = "20px";
    progressContainer.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
    progressContainer.style.borderRadius = "10px";
    progressContainer.style.overflow = "hidden";
    progressContainer.style.marginTop = "15px";
    loadingDiv.appendChild(progressContainer);

    // Add progress bar
    const progressBar = document.createElement("div");
    progressBar.style.width = "0%";
    progressBar.style.height = "100%";
    progressBar.style.background = "linear-gradient(90deg, #9370DB, #00CED1)"; // Purple to cyan
    progressBar.style.transition = "width 0.5s ease-in-out";
    progressContainer.appendChild(progressBar);
    this.progressBar = progressBar;

    // Add progress percentage
    const progressText = document.createElement("div");
    progressText.textContent = "0%";
    progressText.style.fontSize = "16px";
    progressText.style.marginTop = "10px";
    loadingDiv.appendChild(progressText);
    this.progressText = progressText;

   
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0% { filter: brightness(100%); }
        50% { filter: brightness(150%); }
        100% { filter: brightness(100%); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(loadingDiv);
    this.loadingDiv = loadingDiv;

    // Initialize progress
    this.updateProgress(0);
  }

  hideLoadingUI(): void {
    if (this.loadingDiv) {
      document.body.removeChild(this.loadingDiv);
      this.loadingDiv = null;
      this.progressBar = null;
      this.progressText = null;
    }
  }

  updateProgress(percent: number): void {
    this.progressPercent = Math.min(Math.max(percent, 0), 100);
    if (this.progressBar) {
      this.progressBar.style.width = `${this.progressPercent}%`;
    }
    if (this.progressText) {
      this.progressText.textContent = `${Math.round(this.progressPercent)}%`;
    }
  }
}