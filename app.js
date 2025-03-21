import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PlayerControls } from './controls.js';
import { InfiniteTerrain } from './terrain.js';
import { TrackManager } from './trackManager.js';
import { AudioSystem } from './audioSystem.js';

// Initialize WebSimSocket for multiplayer
const room = new WebsimSocket();

// Track modules and global state
let terrain;
let trackManager;
let audioSystem;
let clock = new THREE.Clock();
let playerControls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.SKY_COLOR);
scene.fog = new THREE.FogExp2(CONFIG.SKY_COLOR, 0.01);

const camera = new THREE.PerspectiveCamera(
  CONFIG.CAMERA_FOV, 
  window.innerWidth / window.innerHeight, 
  CONFIG.CAMERA_NEAR, 
  CONFIG.CAMERA_FAR
);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Create the Symphony Rock
const rockGeometry = new THREE.DodecahedronGeometry(CONFIG.ROCK_SIZE, 1);
const rockMaterial = new THREE.MeshStandardMaterial({ 
  color: CONFIG.ROCK_COLOR,
  roughness: 0.7,
  metalness: 0.5,
  emissive: CONFIG.ROCK_COLOR,
  emissiveIntensity: CONFIG.ROCK_GLOW_INTENSITY
});
const symphonyRock = new THREE.Mesh(rockGeometry, rockMaterial);
symphonyRock.position.y = CONFIG.ROCK_SIZE * 0.8;
symphonyRock.rotation.x = CONFIG.ROCK_ROTATION_Y; 
symphonyRock.castShadow = true;
symphonyRock.receiveShadow = true;
scene.add(symphonyRock);

// Create glow effect
const glowGeometry = new THREE.SphereGeometry(CONFIG.ROCK_SIZE * 1.2, 32, 32);
const glowMaterial = new THREE.MeshBasicMaterial({
  color: CONFIG.ROCK_COLOR,
  transparent: true,
  opacity: 0.2,
  side: THREE.BackSide
});
const glow = new THREE.Mesh(glowGeometry, glowMaterial);
glow.position.copy(symphonyRock.position);
glow.rotation.x = CONFIG.ROCK_ROTATION_Y; 
scene.add(glow);

// Create player avatars container
const players = {};

// Setup camera position
camera.position.set(0, 10, 20);

// Show a notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove notification after animation completes
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Create player avatar
function createPlayerAvatar(clientId, username) {
  // Create avatar geometry
  const avatarGeometry = new THREE.CapsuleGeometry(CONFIG.PLAYER_RADIUS, CONFIG.PLAYER_HEIGHT - CONFIG.PLAYER_RADIUS * 2, 4, 8);
  const avatarMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
  });
  
  const avatar = new THREE.Mesh(avatarGeometry, avatarMaterial);
  avatar.castShadow = true;
  avatar.position.y = CONFIG.PLAYER_HEIGHT / 2;
  
  // Add username label
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  context.fillStyle = '#ffffff';
  context.font = '24px Arial';
  context.textAlign = 'center';
  context.fillText(username, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.y = CONFIG.PLAYER_HEIGHT + 0.5;
  sprite.scale.set(3, 0.75, 1);
  
  // Add audio icon (initially hidden)
  const audioIconGeometry = new THREE.PlaneGeometry(1, 1);
  const audioIconCanvas = document.createElement('canvas');
  const iconContext = audioIconCanvas.getContext('2d');
  audioIconCanvas.width = 64;
  audioIconCanvas.height = 64;
  
  // Draw audio icon
  iconContext.fillStyle = '#ff7b00';
  iconContext.beginPath();
  iconContext.arc(32, 32, 20, 0, Math.PI * 2);
  iconContext.fill();
  iconContext.fillStyle = '#ffffff';
  iconContext.beginPath();
  iconContext.moveTo(22, 22);
  iconContext.lineTo(22, 42);
  iconContext.lineTo(42, 32);
  iconContext.closePath();
  iconContext.fill();
  
  const audioIconTexture = new THREE.CanvasTexture(audioIconCanvas);
  const audioIconMaterial = new THREE.MeshBasicMaterial({ 
    map: audioIconTexture,
    transparent: true,
    opacity: 0.8,
  });
  const audioIcon = new THREE.Mesh(audioIconGeometry, audioIconMaterial);
  audioIcon.position.y = CONFIG.PLAYER_HEIGHT + 1.2;
  audioIcon.visible = false;
  
  // Create player group
  const playerGroup = new THREE.Group();
  playerGroup.add(avatar);
  playerGroup.add(sprite);
  playerGroup.add(audioIcon);
  scene.add(playerGroup);
  
  return playerGroup;
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Track mouse movement for hover effects
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Event listeners
document.getElementById('upload-button').addEventListener('click', () => {
  if (audioSystem) audioSystem.uploadTrack();
});
document.getElementById('stop-button').addEventListener('click', () => {
  if (audioSystem) audioSystem.stopCurrentTrack();
});
document.getElementById('volume-slider').addEventListener('input', (e) => {
  if (audioSystem) audioSystem.updateVolume(e.target.value / 100);
});

// Check for track marker clicks
renderer.domElement.addEventListener('click', (event) => {
  raycaster.setFromCamera(mouse, camera);
  if (trackManager) {
    const hoveredMarker = trackManager.handleMarkerHover(raycaster, camera);
    if (hoveredMarker && hoveredMarker.userData.trackId && audioSystem) {
      audioSystem.playTrack(hoveredMarker.userData.trackId);
    }
  }
});

// Initialize room
async function initRoom() {
  await room.initialize();
  
  // Set initial room state if empty
  if (!room.roomState.tracks) {
    // Add default track
    const defaultTrackId = 'default-track';
    const defaultTrackName = 'Hyrule Battle';
    const defaultTrackUrl = '/Hyrule Battle - Track 1 - Sonauto.wav';
    
    room.updateRoomState({
      tracks: {
        [defaultTrackId]: {
          name: defaultTrackName,
          url: defaultTrackUrl,
          uploadedBy: 'System',
          timestamp: Date.now(),
          tags: ['energetic']
        }
      }
    });
  }
  
  // Set initial player presence
  room.updatePresence({
    position: { x: 0, y: 0, z: 15 },
    rotation: 0,
    playingTrackId: null
  });
  
  // Create avatar for self
  players[room.clientId] = createPlayerAvatar(room.clientId, room.peers[room.clientId].username);
  players[room.clientId].position.set(0, 0, 15);
  
  // Initialize systems after player is created
  playerControls = new PlayerControls(camera, renderer.domElement, room);
  playerControls.setPlayer(players[room.clientId]);
  
  // Initialize terrain system
  terrain = new InfiniteTerrain(scene, players[room.clientId]);
  
  // Initialize track manager
  trackManager = new TrackManager(scene, room);
  trackManager.updateTrackMarkers();
  
  // Initialize audio system
  audioSystem = new AudioSystem(room, players);
  
  // Subscribe to presence updates
  room.subscribePresence(currentPresence => {
    // Add/update player avatars
    Object.keys(currentPresence).forEach(clientId => {
      const presence = currentPresence[clientId];
      
      // Create player avatar if it doesn't exist
      if (!players[clientId] && room.peers[clientId]) {
        players[clientId] = createPlayerAvatar(clientId, room.peers[clientId].username);
      }
      
      // Update player position
      if (players[clientId] && presence.position) {
        players[clientId].position.set(
          presence.position.x,
          0, // y is controlled by the avatar height
          presence.position.z
        );
        
        if (presence.rotation !== undefined) {
          players[clientId].rotation.y = presence.rotation;
        }
        
        // Update audio icon visibility
        if (presence.playingTrackId && players[clientId]) {
          const audioIcon = players[clientId].children.find(child => child.geometry instanceof THREE.PlaneGeometry);
          if (audioIcon) audioIcon.visible = true;
        } else if (players[clientId]) {
          const audioIcon = players[clientId].children.find(child => child.geometry instanceof THREE.PlaneGeometry);
          if (audioIcon) audioIcon.visible = false;
        }
      }
      
      // Handle remote player playing a track
      if (clientId !== room.clientId && presence.playingTrackId && 
          audioSystem && !audioSystem.isTrackPlaying(presence.playingTrackId)) {
        audioSystem.handleRemoteTrackPlay(clientId, presence.playingTrackId);
      }
    });
    
    // Remove disconnected players
    Object.keys(players).forEach(clientId => {
      if (!currentPresence[clientId]) {
        scene.remove(players[clientId]);
        delete players[clientId];
      }
    });
    
    // Update nearby player list
    if (audioSystem) audioSystem.updateNearbyPlayers();
  });
  
  // Subscribe to room state updates
  room.subscribeRoomState(state => {
    // Update track markers when tracks change
    if (trackManager) trackManager.updateTrackMarkers();
  });
}

// Game loop
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  // Update player controls
  if (playerControls) {
    playerControls.update(delta);
  }
  
  // Rotate the rock slowly
  symphonyRock.rotation.x += CONFIG.ROCK_ROTATION_SPEED;
  glow.rotation.x -= CONFIG.ROCK_ROTATION_SPEED * 0.5;
  
  // Update terrain
  if (terrain) {
    terrain.update();
  }
  
  // Update audio system
  if (audioSystem) {
    audioSystem.update();
  }
  
  // Update marker hover effects
  if (trackManager) {
    raycaster.setFromCamera(mouse, camera);
    trackManager.handleMarkerHover(raycaster, camera);
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

// Initialize and start
initRoom().then(() => {
  animate();
  showNotification('Welcome to Symphony Rock! Move with WASD keys, toggle view with V, and click on gems to play tracks.');
});