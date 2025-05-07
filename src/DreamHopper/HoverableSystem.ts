import { AbstractMesh, ActionManager, Color3, ExecuteCodeAction, HighlightLayer, Mesh, Scene, Vector3 } from "@babylonjs/core";

// Interface for hoverable objects
export interface Hoverable {
  getMesh(): Mesh | null;
  getScene(): Scene;
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
      outerGlow: config.outerGlow !== undefined ? config.outerGlow : false,
      blurHorizontalSize: config.blurHorizontalSize || 0.5,
      blurVerticalSize: config.blurVerticalSize || 0.5,
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

    // Setup mesh properties, actions, cursor, and debugging
    this.configureMesh(mesh);
    this.registerHoverActions(mesh, canvas);
    this.setupCursorStyle(canvas);
    this.setupDebugging(mesh);
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

    // Type guard for Mesh
    const isMesh = (m: AbstractMesh): m is Mesh => m instanceof Mesh;

    // Highlight functions
    const applyHighlight = (m: AbstractMesh) => {
      if (isMesh(m)) {
        this.highlightLayer!.addMesh(m, this.config.highlightColor!, true);
      }
    };
    const removeHighlight = (m: AbstractMesh) => {
      if (isMesh(m)) {
        this.highlightLayer!.removeMesh(m);
      }
    };

    // Hover handlers
    const onHoverIn = (meshName: string) => {
      //console.log(`HOVERING on mesh: ${meshName}`);
      applyHighlight(mesh);
      mesh.getChildMeshes().forEach(applyHighlight);
      canvas.setAttribute("data-hover", "true");
    };

    const onHoverOut = (meshName: string) => {
      //console.log(`UNHOVERING from mesh: ${meshName}`);
      removeHighlight(mesh);
      mesh.getChildMeshes().forEach(removeHighlight);
      canvas.removeAttribute("data-hover");
    };

    // Register actions for root mesh
    mesh.actionManager!.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => onHoverIn(mesh.name))
    );
    mesh.actionManager!.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => onHoverOut(mesh.name))
    );

    // Register actions for child meshes
    mesh.getChildMeshes().forEach((child) => {
      child.actionManager!.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => onHoverIn(child.name))
      );
      child.actionManager!.registerAction(
        new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => onHoverOut(child.name))
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

  private setupDebugging(mesh: Mesh): void {
    // Debug pointer interactions
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === 1) { // PointerEventTypes.POINTERMOVE
        const pickResult = pointerInfo.pickInfo;
        if (pickResult?.hit && pickResult.pickedMesh) {
          console.log("Pointer hit mesh:", pickResult.pickedMesh.name, "at position:", pickResult.pickedPoint?.asArray());
          if (pickResult.pickedMesh === mesh || mesh.getChildMeshes().includes(pickResult.pickedMesh)) {
            //console.log("Pointer is over hoverable mesh or its child:", pickResult.pickedMesh.name);
          }
        } else {
          console.log("Pointer move, no mesh hit");
        }
      }
    });

    // Debug mesh properties
    console.log("Hoverable Mesh Setup:", {
      name: mesh.name,
      isPickable: mesh.isPickable,
      isVisible: mesh.isVisible,
      position: mesh.position.asArray(),
      hasActionManager: !!mesh.actionManager,
      boundingBox: mesh.getBoundingInfo()?.boundingBox,
      childMeshes: mesh.getChildMeshes().map((m) => ({
        name: m.name,
        isPickable: m.isPickable,
        isVisible: m.isVisible,
        hasActionManager: !!m.actionManager,
        boundingBox: m.getBoundingInfo()?.boundingBox,
      })),
    });
  }
}