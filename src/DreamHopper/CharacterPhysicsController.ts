import {
  Mesh,
  Scene,
  Vector3,
  ArcRotateCamera,
  PhysicsAggregate,
  Quaternion,
  Space
} from "@babylonjs/core";
import { PhysicsController, PhysicsConfig, ColliderType } from "./PhysicsController";

export interface CharacterPhysicsConfig extends PhysicsConfig {
  enableCharacterMovement?: boolean;
  initialForwardDirection?: Vector3;
}

export class CharacterPhysicsController {
  private physicsController: PhysicsController;
  private forwardDirection: Vector3;
  private enableCharacterMovement: boolean;
  public isDiagonal = false;

  constructor(
    private scene: Scene,
    private mesh: Mesh,
    private config: CharacterPhysicsConfig
  ) {
    this.physicsController = new PhysicsController(scene, mesh, config);
    this.forwardDirection = config.initialForwardDirection || Vector3.Forward();
    this.enableCharacterMovement = config.enableCharacterMovement || false;
  }

  public applyJumpForce(): void {
    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;

    const aggregate = this.physicsController.getPhysicsAggregate()!;
    const currentVelocity = aggregate.body.getLinearVelocity();
    aggregate.body.setLinearVelocity(
      new Vector3(currentVelocity.x, 5, currentVelocity.z)
    );
  }

  public moveForward(speed: number): void {
    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;

    const aggregate = this.physicsController.getPhysicsAggregate()!;
    if (this.forwardDirection.lengthSquared() < 0.01 || speed === 0) {
      const currentVelocity = aggregate.body.getLinearVelocity();
      aggregate.body.setLinearVelocity(
        new Vector3(0, currentVelocity.y, 0)
      );
      return;
    }

    const currentVelocity = aggregate.body.getLinearVelocity();
    const velocity = new Vector3(
      -this.forwardDirection.x * speed,
      currentVelocity.y,
      -this.forwardDirection.z * speed
    );

    aggregate.body.setLinearVelocity(velocity);
    this.orientToForwardDirection();
  }

  public moveDiagonallyRight(speed: number): void {
    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;

    const aggregate = this.physicsController.getPhysicsAggregate()!;
    const forward = this.forwardDirection;
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();

    if (forward.lengthSquared() < 0.01 || speed === 0) {
      const currentVelocity = aggregate.body.getLinearVelocity();
      aggregate.body.setLinearVelocity(
        new Vector3(0, currentVelocity.y, 0)
      );
      return;
    }

    const direction = forward.add(right).normalize();
    const currentVelocity = aggregate.body.getLinearVelocity();
    const velocity = new Vector3(
      -direction.x * speed,
      currentVelocity.y,
      -direction.z * speed
    );

    aggregate.body.setLinearVelocity(velocity);

    if(this.isDiagonal) {
      this.orientToDirection(direction);
    }
    
  }

  public moveDiagonallyLeft(speed: number): void {


    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;


    const aggregate = this.physicsController.getPhysicsAggregate()!;
    const forward = this.forwardDirection;
    const left = Vector3.Cross(forward, Vector3.Up()).normalize();

    if (forward.lengthSquared() < 0.01 || speed === 0) {
      const currentVelocity = aggregate.body.getLinearVelocity();
      aggregate.body.setLinearVelocity(
        new Vector3(0, currentVelocity.y, 0)
      );
      return;
    }

    const direction = forward.add(left).normalize();
    const currentVelocity = aggregate.body.getLinearVelocity();
    const velocity = new Vector3(
      -direction.x * speed,
      currentVelocity.y,
      -direction.z * speed
    );

    aggregate.body.setLinearVelocity(velocity);

    if(this.isDiagonal) {
      this.orientToDirection(direction);
    }
  }

  public strafeLeft(speed: number): void {
    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;

    const aggregate = this.physicsController.getPhysicsAggregate()!;
    if (this.forwardDirection.lengthSquared() < 0.01 || speed === 0) {
      const currentVelocity = aggregate.body.getLinearVelocity();
      aggregate.body.setLinearVelocity(
        new Vector3(0, currentVelocity.y, 0)
      );
      return;
    }

    const upVector = Vector3.Up();
    const rightDirection = Vector3.Cross(
      this.forwardDirection,
      upVector
    ).normalizeToNew();
    const leftDirection = rightDirection.scale(-1);

    const currentVelocity = aggregate.body.getLinearVelocity();
    const velocity = new Vector3(
      leftDirection.x * speed,
      currentVelocity.y,
      leftDirection.z * speed
    );

    aggregate.body.setLinearVelocity(velocity);
    this.orientToForwardDirection();
  }

  public strafeRight(speed: number): void {
    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;

    const aggregate = this.physicsController.getPhysicsAggregate()!;
    if (this.forwardDirection.lengthSquared() < 0.01 || speed === 0) {
      const currentVelocity = aggregate.body.getLinearVelocity();
      aggregate.body.setLinearVelocity(
        new Vector3(0, currentVelocity.y, 0)
      );
      return;
    }

    const upVector = Vector3.Up();
    const rightDirection = Vector3.Cross(
      this.forwardDirection,
      upVector
    ).normalizeToNew();

    const currentVelocity = aggregate.body.getLinearVelocity();
    const velocity = new Vector3(
      rightDirection.x * speed,
      currentVelocity.y,
      rightDirection.z * speed
    );

    aggregate.body.setLinearVelocity(velocity);
    this.orientToForwardDirection();
  }

  public backPedal(speed: number): void {
    if (!this.enableCharacterMovement || !this.physicsController.getPhysicsAggregate()) return;

    const aggregate = this.physicsController.getPhysicsAggregate()!;
    if (this.forwardDirection.lengthSquared() < 0.01 || speed === 0) {
      const currentVelocity = aggregate.body.getLinearVelocity();
      aggregate.body.setLinearVelocity(
        new Vector3(0, currentVelocity.y, 0)
      );
      return;
    }

    const currentVelocity = aggregate.body.getLinearVelocity();
    const velocity = new Vector3(
      this.forwardDirection.x * speed,
      currentVelocity.y,
      this.forwardDirection.z * speed
    );

    aggregate.body.setLinearVelocity(velocity);
    this.orientToForwardDirection();
  }

  public rotateLeft(yaw: number): void {
    if (!this.enableCharacterMovement || !this.mesh) return;

    this.mesh.rotate(Vector3.Up(), -yaw, Space.LOCAL);
    const rotationQuaternion =
      this.mesh.rotationQuaternion ||
      Quaternion.FromEulerAngles(0, this.mesh.rotation.y, 0);
    this.forwardDirection = Vector3.Forward()
      .rotateByQuaternionToRef(rotationQuaternion, new Vector3())
      .normalize();

    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }

    this.orientToForwardDirection();
  }

  public rotateRight(yaw: number): void {
    if (!this.enableCharacterMovement || !this.mesh) return;

    this.mesh.rotate(Vector3.Up(), yaw, Space.LOCAL);
    const rotationQuaternion =
      this.mesh.rotationQuaternion ||
      Quaternion.FromEulerAngles(0, this.mesh.rotation.y, 0);
    this.forwardDirection = Vector3.Forward()
      .rotateByQuaternionToRef(rotationQuaternion, new Vector3())
      .normalize();

    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }

    this.orientToForwardDirection();
  }

  public syncRotationWithCamera(camera: ArcRotateCamera): void {
    if (!this.enableCharacterMovement || !this.mesh || !camera) return;

    const cameraYaw = -camera.alpha + Math.PI / 2;
    this.forwardDirection = new Vector3(
      Math.sin(cameraYaw),
      0,
      Math.cos(cameraYaw)
    ).normalize();

    if(!this.isDiagonal) {
            this.orientToForwardDirection();
    }

  }

  public orientToForwardDirection(): void {
    if (!this.enableCharacterMovement || !this.mesh) return;

    const normalizedForward = this.forwardDirection.normalizeToNew();
    const worldForward = Vector3.Forward();
    const quaternion = Quaternion.FromUnitVectorsToRef(
      worldForward,
      normalizedForward,
      new Quaternion()
    );

    this.mesh.rotationQuaternion = quaternion;

    if (!this.mesh.rotationQuaternion) {
      this.mesh.rotation = quaternion.toEulerAngles();
    }

    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }
  }

  public orientToDirection(direction: Vector3): void {
    if (!this.enableCharacterMovement || !this.mesh) return;

    const normalizedDirection = direction.normalizeToNew();
    const worldForward = Vector3.Forward();
    const quaternion = Quaternion.FromUnitVectorsToRef(
      worldForward,
      normalizedDirection,
      new Quaternion()
    );

    this.mesh.rotationQuaternion = quaternion;

    if (!this.mesh.rotationQuaternion) {
      this.mesh.rotation = quaternion.toEulerAngles();
    }

    const aggregate = this.physicsController.getPhysicsAggregate();
    if (aggregate) {
      aggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    }
  }

  public getPhysicsAggregate(): PhysicsAggregate | null {
    return this.physicsController.getPhysicsAggregate();
  }

  public dispose(): void {
    this.physicsController.dispose();
  }
}

export { ColliderType };