import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PlayerControls } from './controls.js';

// Initialize WebSimSocket for multiplayer
const room = new WebsimSocket();

// Track data and player state
let audioTracks = {};
let currentTrack = null;
let audioContext = null;
let audioSources = {};
let proximityTracking = {};
let clock = new THREE.Clock();
let playerControls;

// Scene setup
const scene = new THREE.Scene();
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

// Ground
const groundGeometry = new THREE.PlaneGeometry(CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({ color: CONFIG.GROUND_COLOR });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

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
scene.add(glow);

// Add track markers around the rock
const trackMarkersGroup = new THREE.Group();
scene.add(trackMarkersGroup);

// Setup camera position
camera.position.set(0, 10, 20);

// Create player avatars container
const players = {};

// Initialize audio context
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
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

// Update track markers
function updateTrackMarkers() {
  // Clear existing markers
  while (trackMarkersGroup.children.length > 0) {
    trackMarkersGroup.remove(trackMarkersGroup.children[0]);
  }
  
  if (!room.roomState.tracks) return;
  
  const trackIds = Object.keys(room.roomState.tracks);
  const numTracks = trackIds.length;
  
  trackIds.forEach((trackId, index) => {
    const angle = (index / numTracks) * Math.PI * 2;
    const radius = CONFIG.ROCK_SIZE * 1.5;
    
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    
    const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: CONFIG.ROCK_COLOR,
      emissiveIntensity: 0.5
    });
    
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x, CONFIG.ROCK_SIZE * 0.8, z);
    marker.userData = { trackId };
    
    trackMarkersGroup.add(marker);
  });
}

// Play a track
async function playTrack(trackId, broadcast = true) {
  initAudioContext();
  
  // Stop any currently playing track
  stopCurrentTrack();
  
  if (!room.roomState.tracks || !room.roomState.tracks[trackId]) {
    return;
  }
  
  const trackInfo = room.roomState.tracks[trackId];
  currentTrack = trackId;
  
  // Update UI
  document.getElementById('track-info').textContent = `Playing: ${trackInfo.name}`;
  
  try {
    // Create new audio source from track URL
    const audioElement = new Audio(trackInfo.url);
    audioElement.crossOrigin = "anonymous";
    audioElement.loop = true;
    await audioElement.play();
    
    const source = audioContext.createMediaElementSource(audioElement);
    const gainNode = audioContext.createGain();
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set volume from slider
    const volumeSlider = document.getElementById('volume-slider');
    gainNode.gain.value = volumeSlider.value / 100;
    
    audioSources[trackId] = {
      audio: audioElement,
      source,
      gain: gainNode
    };
    
    // Show audio icon above player
    if (players[room.clientId]) {
      const audioIcon = players[room.clientId].children.find(child => child.geometry instanceof THREE.PlaneGeometry);
      if (audioIcon) audioIcon.visible = true;
    }
    
    // Broadcast to nearby players if this is initiated by this client
    if (broadcast) {
      room.updatePresence({
        playingTrackId: trackId
      });
    }
    
    showNotification(`Now playing: ${trackInfo.name}`);
  } catch (error) {
    console.error('Error playing track:', error);
    showNotification('Failed to play track');
  }
}

// Stop current track
function stopCurrentTrack() {
  if (currentTrack && audioSources[currentTrack]) {
    const { audio, source, gain } = audioSources[currentTrack];
    audio.pause();
    audio.currentTime = 0;
    
    // Clean up audio connections
    try {
      source.disconnect();
      gain.disconnect();
    } catch (e) {
      console.warn('Error disconnecting audio:', e);
    }
    
    delete audioSources[currentTrack];
    currentTrack = null;
    
    // Update UI
    document.getElementById('track-info').textContent = 'No track playing';
    
    // Hide audio icon above player
    if (players[room.clientId]) {
      const audioIcon = players[room.clientId].children.find(child => child.geometry instanceof THREE.PlaneGeometry);
      if (audioIcon) audioIcon.visible = false;
    }
    
    // Update presence
    room.updatePresence({
      playingTrackId: null
    });
  }
}

// Handle file upload
async function uploadTrack() {
  const trackNameInput = document.getElementById('track-name');
  const fileInput = document.getElementById('audio-file');
  
  const trackName = trackNameInput.value.trim() || 'Unnamed Track';
  const file = fileInput.files[0];
  
  if (!file) {
    showNotification('Please select an audio file');
    return;
  }
  
  try {
    showNotification('Uploading track...');
    
    // Upload to blob storage
    const url = await window.websim.upload(file);
    
    // Generate a unique ID for the track
    const trackId = `track-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Add track to room state
    const tracks = room.roomState.tracks || {};
    
    // Limit the number of tracks
    const trackIds = Object.keys(tracks);
    if (trackIds.length >= CONFIG.TRACKS_LIMIT) {
      // Remove oldest track if we've reached the limit
      const oldestTrackId = trackIds[0];
      delete tracks[oldestTrackId];
    }
    
    // Add new track
    tracks[trackId] = {
      name: trackName,
      url: url,
      uploadedBy: room.peers[room.clientId].username,
      timestamp: Date.now()
    };
    
    // Update room state
    room.updateRoomState({ tracks });
    
    // Clear form
    trackNameInput.value = '';
    fileInput.value = '';
    
    showNotification('Track added to Symphony Rock!');
  } catch (error) {
    console.error('Error uploading track:', error);
    showNotification('Failed to upload track');
  }
}

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

// Update player list based on proximity
function updateNearbyPlayers() {
  const playerListEl = document.getElementById('nearby-players');
  playerListEl.innerHTML = '';
  
  const myPosition = players[room.clientId] ? players[room.clientId].position : new THREE.Vector3();
  
  Object.keys(room.peers).forEach(clientId => {
    if (clientId === room.clientId) return; // Skip self
    
    const peer = room.peers[clientId];
    const peerPresence = room.presence[clientId] || {};
    
    if (!peerPresence.position) return; // Skip players without position
    
    const peerPosition = new THREE.Vector3(
      peerPresence.position.x,
      peerPresence.position.y,
      peerPresence.position.z
    );
    
    const distance = myPosition.distanceTo(peerPosition);
    
    // Track if player is within proximity
    const wasInProximity = proximityTracking[clientId] || false;
    const isInProximity = distance < CONFIG.PROXIMITY_THRESHOLD;
    proximityTracking[clientId] = isInProximity;
    
    // If player entered proximity
    if (!wasInProximity && isInProximity) {
      showNotification(`${peer.username} is nearby`);
    }
    
    // Add to nearby list if in proximity
    if (isInProximity) {
      const listItem = document.createElement('li');
      
      const avatar = document.createElement('img');
      avatar.className = 'player-avatar';
      avatar.src = `https://images.websim.ai/avatar/${peer.username}`;
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = peer.username;
      
      if (peerPresence.playingTrackId && room.roomState.tracks && room.roomState.tracks[peerPresence.playingTrackId]) {
        nameSpan.textContent += ` (Playing: ${room.roomState.tracks[peerPresence.playingTrackId].name})`;
      }
      
      listItem.appendChild(avatar);
      listItem.appendChild(nameSpan);
      playerListEl.appendChild(listItem);
    }
  });
}

// Check for track marker clicks
function checkTrackMarkerClick(event) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(trackMarkersGroup.children);
  
  if (intersects.length > 0) {
    const trackId = intersects[0].object.userData.trackId;
    playTrack(trackId);
  }
}

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
          timestamp: Date.now()
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
  
  // Initialize player controls after player is created
  playerControls = new PlayerControls(camera, renderer.domElement, room);
  playerControls.setPlayer(players[room.clientId]);
  
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
          (!currentTrack || currentTrack !== presence.playingTrackId)) {
        // Calculate distance to determine if we should play the track
        const myPosition = players[room.clientId] ? players[room.clientId].position : new THREE.Vector3();
        const theirPosition = presence.position ? 
          new THREE.Vector3(presence.position.x, presence.position.y, presence.position.z) : 
          new THREE.Vector3();
        
        const distance = myPosition.distanceTo(theirPosition);
        
        // Only play if player is within audio distance
        if (distance < CONFIG.MAX_AUDIO_DISTANCE) {
          playTrack(presence.playingTrackId, false);
        }
      }
    });
    
    // Remove disconnected players
    Object.keys(players).forEach(clientId => {
      if (!currentPresence[clientId]) {
        scene.remove(players[clientId]);
        delete players[clientId];
        delete proximityTracking[clientId];
      }
    });
    
    // Update nearby player list
    updateNearbyPlayers();
  });
  
  // Subscribe to room state updates
  room.subscribeRoomState(state => {
    // Update track markers when tracks change
    updateTrackMarkers();
    
    // Get available tracks
    audioTracks = state.tracks || {};
  });
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Event listeners
document.getElementById('upload-button').addEventListener('click', uploadTrack);
document.getElementById('stop-button').addEventListener('click', stopCurrentTrack);
document.getElementById('volume-slider').addEventListener('input', (e) => {
  if (currentTrack && audioSources[currentTrack]) {
    audioSources[currentTrack].gain.gain.value = e.target.value / 100;
  }
});
renderer.domElement.addEventListener('click', checkTrackMarkerClick);

// Update audio volume based on distance
function updateAudioLevels() {
  Object.keys(room.presence).forEach(clientId => {
    const presence = room.presence[clientId];
    
    // Skip if not playing a track
    if (!presence.playingTrackId || !room.roomState.tracks || !room.roomState.tracks[presence.playingTrackId]) {
      return;
    }
    
    // Skip if no position data
    if (!presence.position || !players[room.clientId]) {
      return;
    }
    
    // Calculate distance between listener and audio source
    const listenerPos = players[room.clientId].position;
    const sourcePos = new THREE.Vector3(
      presence.position.x,
      presence.position.y,
      presence.position.z
    );
    
    const distance = listenerPos.distanceTo(sourcePos);
    
    // Update volume based on distance
    if (clientId === room.clientId && currentTrack && audioSources[currentTrack]) {
      // Own audio - keep at set volume
      const volumeSlider = document.getElementById('volume-slider');
      audioSources[currentTrack].gain.gain.value = volumeSlider.value / 100;
    } else if (currentTrack === presence.playingTrackId && audioSources[currentTrack]) {
      // Remote audio - fade with distance
      let volume = 1 - Math.min(distance / CONFIG.MAX_AUDIO_DISTANCE, 1);
      volume = Math.pow(volume, CONFIG.AUDIO_ROLLOFF_FACTOR);
      
      // Apply volume attenuation
      const volumeSlider = document.getElementById('volume-slider');
      audioSources[currentTrack].gain.gain.value = (volumeSlider.value / 100) * volume;
      
      // Stop playing if too far away
      if (distance > CONFIG.MAX_AUDIO_DISTANCE && currentTrack === presence.playingTrackId) {
        stopCurrentTrack();
      }
    }
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
  symphonyRock.rotation.y += CONFIG.ROCK_ROTATION_SPEED;
  glow.rotation.y -= CONFIG.ROCK_ROTATION_SPEED * 0.5;
  
  // Update audio levels based on distances
  updateAudioLevels();
  
  // Update nearby players list
  updateNearbyPlayers();
  
  // Render the scene
  renderer.render(scene, camera);
}

// Initialize and start
initRoom().then(() => {
  animate();
  updateTrackMarkers();
  showNotification('Welcome to Symphony Rock! Move with WASD keys, toggle view with V, and click on gems to play tracks.');
});