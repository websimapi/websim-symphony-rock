import * as THREE from 'three';
import { CONFIG } from './config.js';

export class InfiniteTerrain {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.chunkSize = CONFIG.CHUNK_SIZE;
    this.chunks = new Map(); // Map of chunk coordinates to chunk meshes
    this.maxChunkDistance = CONFIG.VISIBLE_CHUNKS; // How many chunks to render in each direction
    this.lastPlayerChunkCoords = { x: null, z: null };

    this.textureLoader = new THREE.TextureLoader();
    this.groundTexture = this.textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/terrain/grasslight-big.jpg');
    this.groundTexture.wrapS = this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.repeat.set(CONFIG.TEXTURE_REPEAT, CONFIG.TEXTURE_REPEAT);
    
    this.createTerrainMaterial();
  }

  createTerrainMaterial() {
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.groundTexture,
      color: CONFIG.GROUND_COLOR,
      roughness: 0.8,
      metalness: 0.1
    });
  }

  getChunkCoords(x, z) {
    return {
      x: Math.floor(x / this.chunkSize),
      z: Math.floor(z / this.chunkSize)
    };
  }

  update() {
    if (!this.player) return;
    
    const playerChunkCoords = this.getChunkCoords(
      this.player.position.x,
      this.player.position.z
    );
    
    // Only update chunks if the player has moved to a new chunk
    if (this.lastPlayerChunkCoords.x === playerChunkCoords.x &&
        this.lastPlayerChunkCoords.z === playerChunkCoords.z) {
      return;
    }
    
    this.lastPlayerChunkCoords = playerChunkCoords;
    
    // Find chunks that should be visible
    const visibleChunks = new Set();
    
    for (let x = -this.maxChunkDistance; x <= this.maxChunkDistance; x++) {
      for (let z = -this.maxChunkDistance; z <= this.maxChunkDistance; z++) {
        const chunkX = playerChunkCoords.x + x;
        const chunkZ = playerChunkCoords.z + z;
        const chunkKey = `${chunkX}:${chunkZ}`;
        
        visibleChunks.add(chunkKey);
        
        // Create chunk if it doesn't exist
        if (!this.chunks.has(chunkKey)) {
          this.createChunk(chunkX, chunkZ, chunkKey);
        }
      }
    }
    
    // Remove chunks that are too far away
    for (const [chunkKey, chunk] of this.chunks.entries()) {
      if (!visibleChunks.has(chunkKey)) {
        this.scene.remove(chunk);
        this.chunks.delete(chunkKey);
      }
    }
  }
  
  createChunk(chunkX, chunkZ, chunkKey) {
    // Create a flat chunk with some noise
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      8,
      8
    );
    
    // Apply some height variation
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      // Skip edges to avoid seams
      if (i % (9 * 3) < 3 * 3 || i % (9 * 3) >= 6 * 3 || 
          Math.floor(i / (9 * 3)) < 3 || Math.floor(i / (9 * 3)) >= 6) {
        continue;
      }
      
      const x = vertices[i];
      const z = vertices[i + 2];
      const worldX = x + chunkX * this.chunkSize;
      const worldZ = z + chunkZ * this.chunkSize;
      
      // Simple noise function
      vertices[i + 1] = this.noise(worldX, worldZ) * CONFIG.TERRAIN_HEIGHT;
    }
    
    const mesh = new THREE.Mesh(geometry, this.terrainMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      chunkX * this.chunkSize + this.chunkSize / 2,
      0,
      chunkZ * this.chunkSize + this.chunkSize / 2
    );
    mesh.receiveShadow = true;
    
    this.scene.add(mesh);
    this.chunks.set(chunkKey, mesh);
  }
  
  // Simple noise function
  noise(x, z) {
    const scale = 0.05;
    return Math.sin(x * scale) * Math.cos(z * scale) * 0.5 + 0.5;
  }
}