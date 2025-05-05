import {
  AbstractMesh,
  PhysicsAggregate,
  PhysicsShapeCapsule,
  PhysicsShapeBox,
  PhysicsShapeSphere,
  PhysicsShapeMesh,
  PhysicsShapeCylinder,
  Scene,
  Vector3,
  Quaternion,
  PhysicsShape,
  PhysicsShapeType,
  Mesh
} from "@babylonjs/core";

export enum ColliderType {
  Capsule = "capsule",
  Box = "box",
  Sphere = "sphere",
  Mesh = "mesh",
  Cylinder = "cylinder"
}

export interface PhysicsConfig {
  colliderType: ColliderType;
  colliderParams: {
    auto?: boolean; // Default: true, auto-compute parameters
    radius?: number;
    height?: number;
    pointA?: Vector3;
    pointB?: Vector3;
    width?: number;
    depth?: number;
    mesh?: Mesh; // Optional mesh for manual mesh collider
  };
  physicsProps: {
    mass: number;
    friction?: number;
    restitution?: number;
    inertia?: Vector3;
  };
}

export class PhysicsController {
  private physicsAggregate: PhysicsAggregate | null = null;

  constructor(
    private scene: Scene,
    private mesh: Mesh,
    private config: PhysicsConfig
  ) {
    this.setupCollider();
  }

  private setupCollider(): void {
    if (!this.mesh) return;

    const { colliderType, colliderParams, physicsProps } = this.config;
    const auto = colliderParams.auto !== false; // Default to true

    // Enforce mass: 0 for mesh colliders (static)
    const mass = colliderType === ColliderType.Mesh ? 0 : physicsProps.mass;

    if (auto) {
      // Map ColliderType to PhysicsShapeType
      let shapeType: number;
      switch (colliderType) {
        case ColliderType.Capsule:
          shapeType = PhysicsShapeType.CAPSULE;
          break;
        case ColliderType.Box:
          shapeType = PhysicsShapeType.BOX;
          break;
        case ColliderType.Sphere:
          shapeType = PhysicsShapeType.SPHERE;
          break;
        case ColliderType.Mesh:
          shapeType = PhysicsShapeType.MESH;
          break;
        case ColliderType.Cylinder:
          shapeType = PhysicsShapeType.CYLINDER;
          break;
        default:
          throw new Error(`Unsupported collider type: ${colliderType}`);
      }

      this.physicsAggregate = new PhysicsAggregate(
        this.mesh,
        shapeType,
        {
          mass,
          friction: physicsProps.friction ?? 0.5,
          restitution: physicsProps.restitution ?? 0.0
        },
        this.scene
      );
    } else {
      const shape = this.createPhysicsShape();
      this.physicsAggregate = new PhysicsAggregate(
        this.mesh,
        shape,
        {
          mass,
          friction: physicsProps.friction ?? 0.5,
          restitution: physicsProps.restitution ?? 0.0
        },
        this.scene
      );
    }

    this.physicsAggregate.body.disablePreStep = false;
    if (physicsProps.inertia && colliderType !== ColliderType.Mesh) {
      this.physicsAggregate.body.setMassProperties({
        inertia: physicsProps.inertia
      });
    }
  }

  private createPhysicsShape(): PhysicsShape {
    const { colliderType, colliderParams } = this.config;

    switch (colliderType) {
      case ColliderType.Capsule: {
        const { pointA, pointB, radius } = colliderParams;
        if (!pointA || !pointB || radius === undefined) {
          throw new Error("Capsule requires pointA, pointB, and radius when auto is false");
        }
        if (radius <= 0) {
          throw new Error("Capsule radius must be positive");
        }
        return new PhysicsShapeCapsule(pointA, pointB, radius, this.scene);
      }
      case ColliderType.Box: {
        const { width, height, depth } = colliderParams;
        if (width === undefined || height === undefined || depth === undefined) {
          throw new Error("Box requires width, height, and depth when auto is false");
        }
        if (width <= 0 || height <= 0 || depth <= 0) {
          throw new Error("Box dimensions must be positive");
        }
        return new PhysicsShapeBox(
          new Vector3(0, height / 2, 0),
          Quaternion.Identity(),
          new Vector3(width, height, depth),
          this.scene
        );
      }
      case ColliderType.Sphere: {
        const { radius } = colliderParams;
        if (radius === undefined) {
          throw new Error("Sphere requires radius when auto is false");
        }
        if (radius <= 0) {
          throw new Error("Sphere radius must be positive");
        }
        return new PhysicsShapeSphere(Vector3.Zero(), radius, this.scene);
      }
      case ColliderType.Mesh: {
        const { mesh } = colliderParams;
        const targetMesh = mesh ?? this.mesh;
        if (!targetMesh) {
          throw new Error("Mesh collider requires a valid mesh when auto is false");
        }
        return new PhysicsShapeMesh(targetMesh, this.scene);
      }
      case ColliderType.Cylinder: {
        const { height, radius } = colliderParams;
        if (height === undefined || radius === undefined) {
          throw new Error("Cylinder requires height and radius when auto is false");
        }
        if (height <= 0 || radius <= 0) {
          throw new Error("Cylinder height and radius must be positive");
        }
        return new PhysicsShapeCylinder(new Vector3(0, -height / 2, 0), new Vector3(0, height / 2, 0), radius, this.scene);
      }
      default:
        throw new Error(`Unsupported collider type: ${colliderType}`);
    }
  }

  public getPhysicsAggregate(): PhysicsAggregate | null {
    return this.physicsAggregate;
  }

  public dispose(): void {
    if (this.physicsAggregate) {
      this.physicsAggregate.dispose();
      this.physicsAggregate = null;
    }
  }
}