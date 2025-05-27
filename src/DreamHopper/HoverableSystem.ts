import { AbstractMesh, ActionManager, Color3, ExecuteCodeAction, HighlightLayer, Mesh, Scene, Tags } from "@babylonjs/core";

// Interface for hoverable objects
export interface Hoverable {
  getMesh(): Mesh | null;
  getScene(): Scene;
  getHighlightMesh?(): Mesh | null; // Optional: mesh to highlight
}

// Configuration for hover behavior
export interface HoverConfig {
  highlightColor?: Color3;
  customCursorUrl?: string;
  innerGlow?: boolean;
  outerGlow?: boolean;
  blurHorizontalSize?: number;
  blurVerticalSize?: number;
}

// Utility class to handle hover behavior
export class HoverHandler {
  private highlightLayer: HighlightLayer | null;
  private config: HoverConfig;
  private isHovered = false; // Track hover state

  constructor(
    private scene: Scene,
    highlightLayer: HighlightLayer,
    config: Partial<HoverConfig> = {}
  ) {
    this.highlightLayer = highlightLayer;
    this.config = {
      highlightColor: config.highlightColor || Color3.Yellow(),
      customCursorUrl: config.customCursorUrl || "./images/cursorTargetAlly.png",
      innerGlow: config.innerGlow !== undefined ? config.innerGlow : true,
      outerGlow: config.outerGlow !== undefined ? config.outerGlow : true,
      blurHorizontalSize: config.blurHorizontalSize || 1.0,
      blurVerticalSize: config.blurVerticalSize || 1.0,
    };

    // Configure highlight layer
    this.highlightLayer.innerGlow = this.config.innerGlow!;
    this.highlightLayer.outerGlow = this.config.outerGlow!;
    this.highlightLayer.blurHorizontalSize = this.config.blurHorizontalSize!;
    this.highlightLayer.blurVerticalSize = this.config.blurVerticalSize!;
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
    this.registerHoverActions(mesh, hoverable, canvas);
    this.setupCursorStyle(canvas);
  }

  private configureMesh(mesh: Mesh): void {
    // Ensure mesh and children are pickable and visible
    mesh.isPickable = true;
    mesh.isVisible = true;
    mesh.getChildMeshes().forEach((child) => {
      child.isPickable = true;
      child.isVisible = true;
      console.log(`Configured child: ${child.name}, isVisible: ${child.isVisible}, isPickable: ${child.isPickable}`);
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

  private registerHoverActions(mesh: Mesh, hoverable: Hoverable, canvas: HTMLCanvasElement): void {
    const customCursorStyle = `url("${this.config.customCursorUrl}"), auto`;

    // Type guard for Mesh
    const isMesh = (m: AbstractMesh): m is Mesh => m instanceof Mesh;

    // Get the mesh to highlight (defaults to root mesh if not specified)
    const highlightMesh = hoverable.getHighlightMesh ? hoverable.getHighlightMesh() : mesh;

    // Highlight functions
    const applyHighlight = () => {
      if (this.isHovered) return; // Prevent re-applying
      this.isHovered = true;
      if (highlightMesh && isMesh(highlightMesh)) {
        console.log(`Applying highlight to children of ${highlightMesh.name}`);
        highlightMesh.getChildMeshes().forEach((m) => {
          if (isMesh(m) && !Tags.GetTags(m)?.includes("hitbox")) {
            console.log(`Highlighting child: ${m.name}`);
            this.highlightLayer!.addMesh(m, this.config.highlightColor!, true);
          }
        });
        canvas.setAttribute("data-hover", "true");
        console.log(`Set data-hover=true, cursor: ${customCursorStyle}`);
      }
    };
    const removeHighlight = () => {
      if (!this.isHovered) return; // Prevent re-removing
      this.isHovered = false;
      if (highlightMesh && isMesh(highlightMesh)) {
        console.log(`Removing highlight from children of ${highlightMesh.name}`);
        highlightMesh.getChildMeshes().forEach((m) => {
          if (isMesh(m)) {
            this.highlightLayer!.removeMesh(m);
          }
        });
        canvas.removeAttribute("data-hover");
        console.log(`Removed data-hover`);
      }
    };

    // Register actions for root mesh
    mesh.actionManager!.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => applyHighlight())
    );
    mesh.actionManager!.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => removeHighlight())
    );

    // Register actions for child meshes
    mesh.getChildMeshes().forEach((child) => {
      child.actionManager!.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => applyHighlight())
      );
      child.actionManager!.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => removeHighlight())
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
    console.log(`Added cursor style: ${customCursorStyle}`);
  }
}