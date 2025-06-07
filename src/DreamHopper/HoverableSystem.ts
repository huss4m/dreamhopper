import { AbstractMesh, ActionManager, ExecuteCodeAction, Mesh, Scene } from "@babylonjs/core";

// Interface for hoverable objects
export interface Hoverable {
  getMesh(): Mesh | null;
  getScene(): Scene;
}

// Configuration for hover behavior
export interface HoverConfig {
  customCursorUrl?: string;
}

// Utility class to handle hover behavior
export class HoverHandler {
  private config: HoverConfig;
  private isHovered = false; // Track hover state

  constructor(
    private scene: Scene,
    config: Partial<HoverConfig> = {}
  ) {
    this.config = {
      customCursorUrl: config.customCursorUrl || "./images/cursorTargetAlly.png",
    };
  }

  public setupHover(hoverable: Hoverable): void {
    const mesh = hoverable.getMesh();
    if (!mesh) {
      console.warn("Cannot setup hover: Mesh is null");
      return;
    }

    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) {
      console.warn("Canvas not found; cannot apply custom cursor.");
      return;
    }

    // Setup mesh properties, actions, and cursor
    this.configureMesh(mesh);
    this.registerHoverActions(mesh, canvas);
    this.setupCursorStyle(canvas);
  }

  private configureMesh(mesh: Mesh): void {
    // Ensure mesh and children are pickable and visible
    mesh.isPickable = true;
    mesh.isVisible = true;
    mesh.getChildMeshes().forEach((child) => {
      child.isPickable = true;
      child.isVisible = true;
    });

    // Initialize ActionManager for mesh and children
    if (!mesh.actionManager) {
      mesh.actionManager = new ActionManager(this.scene);
    }
    mesh.getChildMeshes().forEach((child) => {
      if (!child.actionManager) {
        child.actionManager = new ActionManager(this.scene);
      }
    });
  }

  private registerHoverActions(mesh: Mesh, canvas: HTMLCanvasElement): void {
    const customCursorStyle = `url("${this.config.customCursorUrl}"), auto`;

    // Apply cursor on hover
    const applyHover = () => {
      if (this.isHovered) return; // Prevent re-applying
      this.isHovered = true;
      canvas.setAttribute("data-hover", "true");
    };

    // Remove cursor on hover exit
    const removeHover = () => {
      if (!this.isHovered) return; // Prevent re-removing
      this.isHovered = false;
      canvas.removeAttribute("data-hover");
    };

    // Register actions for root mesh
    mesh.actionManager!.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => applyHover())
    );
    mesh.actionManager!.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => removeHover())
    );

    // Register actions for child meshes
    mesh.getChildMeshes().forEach((child) => {
      child.actionManager!.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => applyHover())
      );
      child.actionManager!.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => removeHover())
      );
    });
  }

  private setupCursorStyle(canvas: HTMLCanvasElement): void {
    const customCursorStyle = `url("${this.config.customCursorUrl}"), auto`;
    const styleSheet = document.createElement("style");
    document.head.appendChild(styleSheet);
    styleSheet.sheet?.insertRule(`
      canvas[data-hover="true"] {
        cursor: ${customCursorStyle} !important;
      }
    `, 0);
  }
}