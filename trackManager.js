import * as THREE from 'three';
import { CONFIG } from './config.js';

export class TrackManager {
  constructor(scene, room) {
    this.scene = scene;
    this.room = room;
    this.rockPosition = new THREE.Vector3(0, CONFIG.ROCK_SIZE * 0.8, 0);
    this.trackMarkersGroup = new THREE.Group();
    this.trackMarkersGroup.rotation.x = CONFIG.ROCK_ROTATION_Y; 
    this.scene.add(this.trackMarkersGroup);
    
    this.categories = {
      'recent': { color: 0x00AAFF, name: 'Recent Uploads' },
      'popular': { color: 0xFF5500, name: 'Popular' },
      'ambient': { color: 0x00FF88, name: 'Ambient' },
      'energetic': { color: 0xFF0066, name: 'Energetic' },
      'other': { color: 0xFFFFFF, name: 'Other' }
    };
    
    this.categoryRings = {};
    this.trackMarkers = {};
    
    this.setupCategoryRings();
    
    this.categoryLabels = {};
    this.createCategoryLabels();
  }
  
  setupCategoryRings() {
    const categories = Object.keys(this.categories);
    const ringSpacing = CONFIG.ROCK_SIZE * 0.5;
    
    categories.forEach((category, index) => {
      const radius = CONFIG.ROCK_SIZE * 1.5 + index * ringSpacing;
      const color = this.categories[category].color;
      
      const ring = this.createRing(radius, color);
      ring.position.copy(this.rockPosition);
      ring.position.y += 0.1 * index; 
      ring.rotation.x = CONFIG.ROCK_ROTATION_Y; 
 
      this.scene.add(ring);
      this.categoryRings[category] = { ring, radius };
    });
  }
  
  createRing(radius, color) {
    const geometry = new THREE.TorusGeometry(radius, 0.1, 16, 100);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  createCategoryLabels() {
    Object.entries(this.categories).forEach(([key, data], index) => {
      const radius = this.categoryRings[key].radius;
      
      const angle = CONFIG.ROCK_ROTATION_Y;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const position = new THREE.Vector3(x, this.rockPosition.y + 1, z);
      position.add(this.rockPosition);
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 64;
      
      context.fillStyle = '#ffffff';
      context.font = 'bold 24px Arial';
      context.textAlign = 'center';
      context.fillText(data.name, canvas.width / 2, canvas.height / 2);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(5, 1.25, 1);
      
      this.scene.add(sprite);
      this.categoryLabels[key] = sprite;
    });
  }
  
  determineCategory(trackInfo) {
    const ageInDays = (Date.now() - trackInfo.timestamp) / (1000 * 60 * 60 * 24);
    
    if (ageInDays < 3) {
      return 'recent';
    }
    
    if (trackInfo.tags) {
      if (trackInfo.tags.includes('ambient')) return 'ambient';
      if (trackInfo.tags.includes('energetic')) return 'energetic';
    }
    
    return 'other';
  }
  
  updateTrackMarkers() {
    while (this.trackMarkersGroup.children.length > 0) {
      this.trackMarkersGroup.remove(this.trackMarkersGroup.children[0]);
    }
    
    this.trackMarkers = {};
    
    if (!this.room.roomState.tracks) return;
    
    const trackIds = Object.keys(this.room.roomState.tracks);
    
    const tracksByCategory = {};
    Object.entries(this.categories).forEach(([category]) => {
      tracksByCategory[category] = [];
    });
    
    trackIds.forEach(trackId => {
      const trackInfo = this.room.roomState.tracks[trackId];
      const category = this.determineCategory(trackInfo);
      tracksByCategory[category].push(trackId);
    });
    
    Object.entries(tracksByCategory).forEach(([category, categoryTrackIds]) => {
      const ringInfo = this.categoryRings[category];
      const numTracks = categoryTrackIds.length;
      
      categoryTrackIds.forEach((trackId, index) => {
        const angle = (index / numTracks) * Math.PI * 2;
        const radius = ringInfo.radius;
        
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        
        const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({
          color: this.categories[category].color,
          emissive: this.categories[category].color,
          emissiveIntensity: 0.5
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(
          x + this.rockPosition.x, 
          this.rockPosition.y, 
          z + this.rockPosition.z
        );
        marker.userData = { trackId };
        
        marker.userData.originalScale = marker.scale.clone();
        
        this.addTrackLabel(marker, this.room.roomState.tracks[trackId].name);
        
        this.trackMarkersGroup.add(marker);
        this.trackMarkers[trackId] = marker;
      });
    });
  }
  
  addTrackLabel(marker, name) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = '#ffffff';
    context.font = '18px Arial';
    context.textAlign = 'center';
    context.fillText(name, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      opacity: 0.8
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.y = 0.5;
    sprite.scale.set(2, 0.5, 1);
    sprite.visible = false; 
    
    marker.add(sprite);
    marker.userData.label = sprite;
  }
  
  handleMarkerHover(raycaster, camera) {
    const intersects = raycaster.intersectObjects(this.trackMarkersGroup.children);
    
    Object.values(this.trackMarkers).forEach(marker => {
      marker.scale.copy(marker.userData.originalScale);
      if (marker.userData.label) {
        marker.userData.label.visible = false;
      }
    });
    
    if (intersects.length > 0) {
      const hoveredMarker = intersects[0].object;
      hoveredMarker.scale.multiplyScalar(1.3);
      
      if (hoveredMarker.userData.label) {
        hoveredMarker.userData.label.visible = true;
      }
      
      document.body.style.cursor = 'pointer';
      return hoveredMarker;
    } else {
      document.body.style.cursor = 'default';
      return null;
    }
  }
}