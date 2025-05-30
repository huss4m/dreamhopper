import { Mesh, Scene, Vector3, Quaternion } from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";

export class EnemyPhysicsController {
  private physicsController: PhysicsController;
  private scene: Scene;
  private mesh: Mesh;
  private wanderObserver: any | null = null;
  private moveToObserver: any | null = null; // Added to track moveTo observer

  constructor(scene: Scene, mesh: Mesh, physicsConfig: PhysicsConfig) {
    this.scene = scene;
    this.mesh = mesh;
    this.physicsController = new PhysicsController(scene, mesh, physicsConfig);
  }

  public setInertia(inertia: Vector3): void {
    this.physicsController.getPhysicsAggregate()?.body.setMassProperties({ inertia });
  }

  public orientToForwardDirection(forwardDirection: Vector3): void {
    const normalizedForward = forwardDirection.normalizeToNew();

    const flatForward = new Vector3(normalizedForward.x, 0, normalizedForward.z).normalize();

    if (flatForward.lengthSquared() < 0.0001) return;

    const angle = Math.atan2(flatForward.x, flatForward.z) + Math.PI;

    this.mesh.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), angle);

    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }
  }

  public generateRandomDirection(): Vector3 {
    const angle = Math.random() * 2 * Math.PI;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    return new Vector3(x, 0, z);
  }

  public moveTo(position: Vector3): void {
    const physicsAggregate = this.physicsController?.getPhysicsAggregate();
    if (!this.mesh || !physicsAggregate) return;

    // Remove existing moveTo observer if any
    if (this.moveToObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
      this.moveToObserver = null;
    }

    this.moveToObserver = this.scene.onBeforeRenderObservable.add(() => {
      const aggregate = this.physicsController?.getPhysicsAggregate();
      if (!aggregate) {
        this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
        this.moveToObserver = null;
        return;
      }

      const currentPosition = this.mesh.position.clone();
      const direction = position.subtract(currentPosition);
      const distanceToTarget = direction.length();

      if (distanceToTarget > 0.1) {
        this.orientToForwardDirection(direction);
        const velocity = direction.normalize().scale(2);
        try {
          velocity.y = aggregate.body.getLinearVelocity().y;
        } catch (e) {
          console.warn("moveTo: failed to access body.getLinearVelocity, removing observer");
          this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
          this.moveToObserver = null;
          return;
        }
        aggregate.body.setLinearVelocity(velocity);
      } else {
        try {
          const y = aggregate.body.getLinearVelocity().y;
          aggregate.body.setLinearVelocity(new Vector3(0, y, 0));
        } catch (e) {
          console.warn("moveTo (end): failed to reset velocity");
        }
        this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
        this.moveToObserver = null;
      }
    });
  }

  public startWandering(maxDistance = 10): void {
    if (!this.mesh || !this.physicsController) {
      console.error(`Cannot start wandering: Mesh or physics controller is null`);
      return;
    }

    this.stopWandering();

    const moveToNextTarget = () => {
      const currentPosition = this.mesh.position.clone();
      const randomDirection = this.generateRandomDirection();
      const distance = 5 + Math.random() * (maxDistance - 5);
      const targetPosition = currentPosition.add(randomDirection.scale(distance));

      this.moveTo(targetPosition);
    };

    this.wanderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.physicsController) {
        this.stopWandering();
        return;
      }

      const physicsAggregate = this.physicsController.getPhysicsAggregate();
      if (!physicsAggregate) {
        console.warn("Physics aggregate is null. Stopping wandering.");
        this.stopWandering();
        return;
      }

      let velocity: Vector3;
      try {
        velocity = physicsAggregate.body.getLinearVelocity();
      } catch (err) {
        console.warn("Physics body is null or disposed. Stopping wandering.");
        this.stopWandering();
        return;
      }

      if (velocity.lengthSquared() < 0.01) {
        moveToNextTarget();
      }
    });

    moveToNextTarget();
  }

  public stopWandering(): void {
    if (this.wanderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.wanderObserver);
      this.wanderObserver = null;
    }

    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (physicsAggregate) {
      try {
        const y = physicsAggregate.body.getLinearVelocity().y;
        physicsAggregate.body.setLinearVelocity(new Vector3(0, y, 0));
      } catch (e) {
        console.warn("stopWandering: failed to reset velocity");
      }
    }
  }

  public stopAllMovement(): void { // Added method
    // Stop wandering
    if (this.wanderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.wanderObserver);
      this.wanderObserver = null;
    }

    // Stop moveTo
    if (this.moveToObserver) {
      this.scene.onBeforeRenderObservable.remove(this.moveToObserver);
      this.moveToObserver = null;
    }

    // Zero horizontal velocity
    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (physicsAggregate) {
      try {
        const y = physicsAggregate.body.getLinearVelocity().y;
        physicsAggregate.body.setLinearVelocity(new Vector3(0, y, 0));
        console.log("EnemyPhysicsController: All movement stopped");
      } catch (e) {
        console.warn("stopAllMovement: failed to reset velocity");
      }
    }
  }

  public getPhysicsController(): PhysicsController {
    return this.physicsController;
  }

  public dispose(): void {
    this.stopAllMovement(); // Updated to use stopAllMovement
    this.physicsController.dispose();
  }
}

export { PhysicsConfig };