import * as THREE from 'three';
import { CONFIG } from './config.js';

export class AudioSystem {
  constructor(room, players) {
    this.room = room;
    this.players = players;
    this.audioContext = null;
    this.audioSources = {};
    this.currentTrack = null;
    this.proximityTracking = {};
  }
  
  initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  
  isTrackPlaying(trackId) {
    return this.currentTrack === trackId;
  }
  
  async uploadTrack() {
    const trackNameInput = document.getElementById('track-name');
    const fileInput = document.getElementById('audio-file');
    const tagSelect = document.getElementById('track-tag');
    
    const trackName = trackNameInput.value.trim() || 'Unnamed Track';
    const file = fileInput.files[0];
    const tag = tagSelect ? tagSelect.value : 'other';
    
    if (!file) {
      this.showNotification('Please select an audio file');
      return;
    }
    
    try {
      this.showNotification('Uploading track...');
      
      // Upload to blob storage
      const url = await window.websim.upload(file);
      
      // Generate a unique ID for the track
      const trackId = `track-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Add track to room state
      const tracks = this.room.roomState.tracks || {};
      
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
        uploadedBy: this.room.peers[this.room.clientId].username,
        timestamp: Date.now(),
        tags: [tag]
      };
      
      // Update room state
      this.room.updateRoomState({ tracks });
      
      // Clear form
      trackNameInput.value = '';
      fileInput.value = '';
      
      this.showNotification('Track added to Symphony Rock!');
    } catch (error) {
      console.error('Error uploading track:', error);
      this.showNotification('Failed to upload track');
    }
  }
  
  // Play a track
  async playTrack(trackId, broadcast = true) {
    this.initAudioContext();
    
    // Stop any currently playing track
    this.stopCurrentTrack();
    
    if (!this.room.roomState.tracks || !this.room.roomState.tracks[trackId]) {
      return;
    }
    
    const trackInfo = this.room.roomState.tracks[trackId];
    this.currentTrack = trackId;
    
    // Update UI
    document.getElementById('track-info').textContent = `Playing: ${trackInfo.name}`;
    
    try {
      // Create new audio source from track URL
      const audioElement = new Audio(trackInfo.url);
      audioElement.crossOrigin = "anonymous";
      audioElement.loop = true;
      await audioElement.play();
      
      const source = this.audioContext.createMediaElementSource(audioElement);
      const gainNode = this.audioContext.createGain();
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Set volume from slider
      const volumeSlider = document.getElementById('volume-slider');
      gainNode.gain.value = volumeSlider.value / 100;
      
      this.audioSources[trackId] = {
        audio: audioElement,
        source,
        gain: gainNode
      };
      
      // Show audio icon above player
      if (this.players[this.room.clientId]) {
        const audioIcon = this.players[this.room.clientId].children.find(child => child.geometry instanceof THREE.PlaneGeometry);
        if (audioIcon) audioIcon.visible = true;
      }
      
      // Broadcast to nearby players if this is initiated by this client
      if (broadcast) {
        this.room.updatePresence({
          playingTrackId: trackId
        });
      }
      
      this.showNotification(`Now playing: ${trackInfo.name}`);
    } catch (error) {
      console.error('Error playing track:', error);
      this.showNotification('Failed to play track');
    }
  }
  
  // Stop current track
  stopCurrentTrack() {
    if (this.currentTrack && this.audioSources[this.currentTrack]) {
      const { audio, source, gain } = this.audioSources[this.currentTrack];
      audio.pause();
      audio.currentTime = 0;
      
      // Clean up audio connections
      try {
        source.disconnect();
        gain.disconnect();
      } catch (e) {
        console.warn('Error disconnecting audio:', e);
      }
      
      delete this.audioSources[this.currentTrack];
      this.currentTrack = null;
      
      // Update UI
      document.getElementById('track-info').textContent = 'No track playing';
      
      // Hide audio icon above player
      if (this.players[this.room.clientId]) {
        const audioIcon = this.players[this.room.clientId].children.find(child => child.geometry instanceof THREE.PlaneGeometry);
        if (audioIcon) audioIcon.visible = false;
      }
      
      // Update presence
      this.room.updatePresence({
        playingTrackId: null
      });
    }
  }
  
  // Update volume
  updateVolume(volume) {
    if (this.currentTrack && this.audioSources[this.currentTrack]) {
      this.audioSources[this.currentTrack].gain.gain.value = volume;
    }
  }
  
  // Handle remote player playing a track
  handleRemoteTrackPlay(clientId, trackId) {
    // Calculate distance to determine if we should play the track
    const myPosition = this.players[this.room.clientId] ? this.players[this.room.clientId].position : new THREE.Vector3();
    const presence = this.room.presence[clientId];
    const theirPosition = presence.position ? 
      new THREE.Vector3(presence.position.x, presence.position.y, presence.position.z) : 
      new THREE.Vector3();
    
    const distance = myPosition.distanceTo(theirPosition);
    
    // Only play if player is within audio distance
    if (distance < CONFIG.MAX_AUDIO_DISTANCE) {
      this.playTrack(trackId, false);
    }
  }
  
  // Update nearby player list
  updateNearbyPlayers() {
    const playerListEl = document.getElementById('nearby-players');
    playerListEl.innerHTML = '';
    
    const myPosition = this.players[this.room.clientId] ? this.players[this.room.clientId].position : new THREE.Vector3();
    
    Object.keys(this.room.peers).forEach(clientId => {
      if (clientId === this.room.clientId) return; // Skip self
      
      const peer = this.room.peers[clientId];
      const peerPresence = this.room.presence[clientId] || {};
      
      if (!peerPresence.position) return; // Skip players without position
      
      const peerPosition = new THREE.Vector3(
        peerPresence.position.x,
        peerPresence.position.y,
        peerPresence.position.z
      );
      
      const distance = myPosition.distanceTo(peerPosition);
      
      // Track if player is within proximity
      const wasInProximity = this.proximityTracking[clientId] || false;
      const isInProximity = distance < CONFIG.PROXIMITY_THRESHOLD;
      this.proximityTracking[clientId] = isInProximity;
      
      // If player entered proximity
      if (!wasInProximity && isInProximity) {
        this.showNotification(`${peer.username} is nearby`);
      }
      
      // Add to nearby list if in proximity
      if (isInProximity) {
        const listItem = document.createElement('li');
        
        const avatar = document.createElement('img');
        avatar.className = 'player-avatar';
        avatar.src = `https://images.websim.ai/avatar/${peer.username}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = peer.username;
        
        if (peerPresence.playingTrackId && this.room.roomState.tracks && this.room.roomState.tracks[peerPresence.playingTrackId]) {
          nameSpan.textContent += ` (Playing: ${this.room.roomState.tracks[peerPresence.playingTrackId].name})`;
        }
        
        listItem.appendChild(avatar);
        listItem.appendChild(nameSpan);
        playerListEl.appendChild(listItem);
      }
    });
  }
  
  // Update audio levels based on distance
  update() {
    this.updateAudioLevels();
  }
  
  updateAudioLevels() {
    Object.keys(this.room.presence).forEach(clientId => {
      const presence = this.room.presence[clientId];
      
      // Skip if not playing a track
      if (!presence.playingTrackId || !this.room.roomState.tracks || !this.room.roomState.tracks[presence.playingTrackId]) {
        return;
      }
      
      // Skip if no position data
      if (!presence.position || !this.players[this.room.clientId]) {
        return;
      }
      
      // Calculate distance between listener and audio source
      const listenerPos = this.players[this.room.clientId].position;
      const sourcePos = new THREE.Vector3(
        presence.position.x,
        presence.position.y,
        presence.position.z
      );
      
      const distance = listenerPos.distanceTo(sourcePos);
      
      // Update volume based on distance
      if (clientId === this.room.clientId && this.currentTrack && this.audioSources[this.currentTrack]) {
        // Own audio - keep at set volume
        const volumeSlider = document.getElementById('volume-slider');
        this.audioSources[this.currentTrack].gain.gain.value = volumeSlider.value / 100;
      } else if (this.currentTrack === presence.playingTrackId && this.audioSources[this.currentTrack]) {
        // Remote audio - fade with distance
        let volume = 1 - Math.min(distance / CONFIG.MAX_AUDIO_DISTANCE, 1);
        volume = Math.pow(volume, CONFIG.AUDIO_ROLLOFF_FACTOR);
        
        // Apply volume attenuation
        const volumeSlider = document.getElementById('volume-slider');
        this.audioSources[this.currentTrack].gain.gain.value = (volumeSlider.value / 100) * volume;
        
        // Stop playing if too far away
        if (distance > CONFIG.MAX_AUDIO_DISTANCE && this.currentTrack === presence.playingTrackId) {
          this.stopCurrentTrack();
        }
      }
    });
  }
  
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after animation completes
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}