import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { PLAYER, WORLD } from '../config.js';
import { angleDamp, damp } from '../util.js';

export class Player {
  constructor(scene, colliders) {
    this.avatar = new Avatar({ shirt: 0x2f7dff, pants: 0x2a3550, shoes: 0xffffff, hat: 'cap' });
    scene.add(this.avatar.root);
    this.colliders = colliders;
    this.pos = this.avatar.root.position;
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.grounded = true;
    this.carrying = null;
    this.training = null;
    this.trainIdle = 0;
    this.caught = false;
    this.safe = true;
    this.horizSpeed = 0;
    this.respawn();

    // carry-direction arrow (points home when holding an egg)
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x6dff8a, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.9); shape.lineTo(0.6, 0); shape.lineTo(0.22, 0); shape.lineTo(0.22, -0.7); shape.lineTo(-0.22, -0.7); shape.lineTo(-0.22, 0); shape.lineTo(-0.6, 0);
    this.arrow = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }), arrowMat);
    this.arrow.geometry.rotateX(-Math.PI / 2);
    this.arrow.geometry.translate(0, 0, 0);
    this.arrow.visible = false;
    this.arrow.userData.noAO = true;
    scene.add(this.arrow);
  }

  respawn() {
    this.pos.set(WORLD.spawn.x, 0, WORLD.spawn.z);
    this.vel.set(0, 0, 0);
    this.yaw = Math.PI;
    this.training = null;
  }

  /**
   * Returns true if the player is actively steering this frame.
   */
  update(dt, input, camYaw, walkSpeed, t, carryPenalty = true) {
    const mv = input.moveVector();
    const steering = Math.hypot(mv.x, mv.y) > 0.05;
    const jump = input.hit(' ') || input.touchJump;

    if (this.training) {
      // locked onto the belt: running in place
      const tm = this.training;
      this.pos.x = damp(this.pos.x, tm.x - 0.4, 12, dt);
      this.pos.z = damp(this.pos.z, tm.z, 12, dt);
      this.pos.y = 0.46;
      this.yaw = angleDamp(this.yaw, Math.PI / 2, 12, dt);
      this.vel.set(0, 0, 0);
      this.horizSpeed = 0;
      this.avatar.root.rotation.y = this.yaw;
      this.avatar.animate(dt, { speed: 0, running: 1, grounded: true, carrying: false });
      if (steering || jump) { this.training = null; this.trainIdle = -0.4; if (jump) { this.vel.y = PLAYER.jumpVelocity; this.grounded = false; } }
      this.updateArrow(t);
      return steering;
    }

    let speed = walkSpeed;
    if (this.carrying && carryPenalty) speed *= this.carrying.huge ? PLAYER.hugeCarryPenalty : PLAYER.carryPenalty;

    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const dx = fx * -mv.y + rx * mv.x;
    const dz = fz * -mv.y + rz * mv.x;
    const accel = this.grounded ? 14 : 5;
    this.vel.x = damp(this.vel.x, dx * speed, accel, dt);
    this.vel.z = damp(this.vel.z, dz * speed, accel, dt);

    if (jump && this.grounded) {
      this.vel.y = PLAYER.jumpVelocity;
      this.grounded = false;
      this.jumped = true;
    }
    this.vel.y -= PLAYER.gravity * dt;

    // sub-step horizontal motion so very fast runners never tunnel through walls
    const travel = Math.hypot(this.vel.x, this.vel.z) * dt;
    const steps = Math.min(80, Math.max(1, Math.ceil(travel / 0.45)));
    this.pos.y += this.vel.y * dt;
    for (let s = 0; s < steps; s++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      this.colliders.resolve(this.pos, PLAYER.radius);
    }
    const ground = this.colliders.groundAt(this.pos.x, this.pos.z, this.pos.y, PLAYER.radius);
    if (this.pos.y <= ground) {
      // snap up small steps; land
      this.pos.y = ground;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    } else if (this.pos.y - ground < 0.12 && this.vel.y <= 0) {
      this.pos.y = ground; this.vel.y = 0; this.grounded = true;
    } else this.grounded = false;

    this.horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.horizSpeed > 0.5) this.yaw = angleDamp(this.yaw, Math.atan2(this.vel.x, this.vel.z), 12, dt);
    this.avatar.root.rotation.y = this.yaw;
    this.avatar.animate(dt, { speed: this.horizSpeed, grounded: this.grounded, carrying: !!this.carrying });
    this.updateArrow(t);
    return steering;
  }

  updateArrow(t) {
    this.arrow.visible = !!this.carrying;
    if (!this.carrying) return;
    const tgt = this.arrowTarget || WORLD.spawn;
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
    const yaw = Math.atan2(dx, dz);
    const extra = this.carrying.huge ? 2.2 : 1.1;
    this.arrow.position.set(this.pos.x + Math.sin(yaw) * 2.2, this.pos.y + 0.25 + Math.sin(t * 5) * 0.05, this.pos.z + Math.cos(yaw) * 2.2);
    this.arrow.rotation.y = yaw + Math.PI;
    this.arrow.scale.setScalar(0.9 + extra * 0.05);
  }
}
