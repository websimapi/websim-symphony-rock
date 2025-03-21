import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { CONFIG } from './config.js';

export class PlayerControls {
  constructor(camera, domElement, room) {
    this.camera = camera;
    this.domElement = domElement;
    this.room = room;
    this.player = null;
    this.keys = {};
    this.mode = 'orbit'; // 'orbit' or 'firstPerson'
    this.controlsEnabled = true;
    
    // Initialize controls
    this.orbitControls = new OrbitControls(camera, domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2;
    this.orbitControls.minDistance = 5;
    this.orbitControls.maxDistance = 30;
    
    this.firstPersonControls = new FirstPersonControls(camera, domElement);
    this.firstPersonControls.movementSpeed = 0;
    this.firstPersonControls.lookSpeed = 0.1;
    this.firstPersonControls.constrainVertical = true;
    this.firstPersonControls.verticalMin = Math.PI / 4;
    this.firstPersonControls.verticalMax = Math.PI / 2;
    this.firstPersonControls.enabled = false;
    
    // Setup event listeners
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('keypress', this.onKeyPress.bind(this));
  }
  
  setPlayer(player) {
    this.player = player;
  }
  
  onKeyDown(e) {
    this.keys[e.key.toLowerCase()] = true;
  }
  
  onKeyUp(e) {
    this.keys[e.key.toLowerCase()] = false;
  }
  
  onKeyPress(e) {
    // Toggle between first person and orbit mode with 'v' key
    if (e.key.toLowerCase() === 'v') {
      this.toggleViewMode();
    }
  }
  
  toggleViewMode() {
    if (this.mode === 'orbit') {
      this.mode = 'firstPerson';
      this.orbitControls.enabled = false;
      this.firstPersonControls.enabled = true;
      
      // Position camera for first person view
      if (this.player) {
        const playerPos = this.player.position.clone();
        this.camera.position.set(
          playerPos.x,
          playerPos.y + CONFIG.PLAYER_HEIGHT * 0.8,
          playerPos.z
        );
        this.camera.lookAt(playerPos.x, playerPos.y + CONFIG.PLAYER_HEIGHT * 0.8, playerPos.z - 1);
      }
    } else {
      this.mode = 'orbit';
      this.orbitControls.enabled = true;
      this.firstPersonControls.enabled = false;
      
      // Reset orbit controls target to rock
      this.orbitControls.target.set(0, CONFIG.ROCK_SIZE, 0);
    }
  }
  
  update(delta) {
    if (!this.controlsEnabled || !this.player) return;
    
    if (this.mode === 'orbit') {
      this.orbitControls.update();
    } else {
      this.firstPersonControls.update(delta);
    }
    
    // Handle player movement
    const playerSpeed = CONFIG.PLAYER_MOVE_SPEED;
    let moved = false;
    let moveDirection = new THREE.Vector3(0, 0, 0);
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();
    
    if (this.keys['w'] || this.keys['arrowup']) {
      moveDirection.add(forward);
      moved = true;
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveDirection.add(forward.clone().negate());
      moved = true;
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveDirection.add(right.clone().negate());
      moved = true;
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveDirection.add(right);
      moved = true;
    }
    
    if (moved) {
      moveDirection.normalize();
      this.player.position.addScaledVector(moveDirection, playerSpeed);
      
      // Boundary check
      const maxDistance = CONFIG.WORLD_SIZE / 2 - CONFIG.PLAYER_RADIUS;
      this.player.position.x = Math.max(-maxDistance, Math.min(maxDistance, this.player.position.x));
      this.player.position.z = Math.max(-maxDistance, Math.min(maxDistance, this.player.position.z));
      
      // Update player rotation to face movement direction
      this.player.rotation.y = Math.atan2(-moveDirection.x, -moveDirection.z);
      
      // Update first person camera position if in first person mode
      if (this.mode === 'firstPerson') {
        this.camera.position.set(
          this.player.position.x,
          this.player.position.y + CONFIG.PLAYER_HEIGHT * 0.8,
          this.player.position.z
        );
      }
      
      // Update player position in presence
      this.room.updatePresence({
        position: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z
        },
        rotation: this.player.rotation.y
      });
    }
  }
}