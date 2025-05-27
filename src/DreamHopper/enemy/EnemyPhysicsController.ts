import { Mesh, Scene, Vector3, Quaternion } from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "../PhysicsController";

export class EnemyPhysicsController {
  private physicsController: PhysicsController;
  private scene: Scene;
  private mesh: Mesh;
  private wanderObserver: any | null = null;

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
    const physicsAggregate = this.physicsController.getPhysicsAggregate();
    if (!this.mesh || !physicsAggregate) return;

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const currentPosition = this.mesh.position.clone();
      const direction = position.subtract(currentPosition).normalize();
      const distanceThreshold = 0.1;
      const distanceToTarget = Vector3.Distance(currentPosition, position);

      if (distanceToTarget > distanceThreshold) {
        this.orientToForwardDirection(direction);

        const speed = 2;
        const velocity = direction.scale(speed);
        velocity.y = physicsAggregate.body.getLinearVelocity().y;
        physicsAggregate.body.setLinearVelocity(velocity);
      } else {
        physicsAggregate.body.setLinearVelocity(new Vector3(0, physicsAggregate.body.getLinearVelocity().y, 0));
        this.scene.onBeforeRenderObservable.remove(observer);
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
      const physicsAggregate = this.physicsController.getPhysicsAggregate()!;
      const velocity = physicsAggregate.body.getLinearVelocity();

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
      physicsAggregate.body.setLinearVelocity(new Vector3(0, physicsAggregate.body.getLinearVelocity().y, 0));
    }
  }

  public getPhysicsController(): PhysicsController {
    return this.physicsController;
  }

  public dispose(): void {
    this.stopWandering();
    this.physicsController.dispose();
  }
}

export { PhysicsConfig };