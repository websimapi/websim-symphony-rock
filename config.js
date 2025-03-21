export const CONFIG = {
  // Rock appearance
  ROCK_SIZE: 5,
  ROCK_COLOR: 0xff7b00,
  ROCK_GLOW_INTENSITY: 0.5,
  ROCK_ROTATION_SPEED: 0.001,
  ROCK_ROTATION_Y: Math.PI/3, // Changed from Math.PI/4 to Math.PI/3 for better rotation

  // Player settings
  PLAYER_MOVE_SPEED: 0.3,  // Increased from 0.2 for faster movement
  PLAYER_HEIGHT: 1.7,
  PLAYER_RADIUS: 0.5,
  
  // Camera settings
  CAMERA_FOV: 75,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  
  // Audio settings
  MAX_AUDIO_DISTANCE: 20,     // Maximum distance audio can be heard from
  AUDIO_ROLLOFF_FACTOR: 1.5,  // How quickly audio fades with distance
  
  // World settings
  WORLD_SIZE: 200,            // Increased from 50 for larger world
  GROUND_COLOR: 0x558855,    // Color of the ground (changed to more grass-like)
  SKY_COLOR: 0x1a1a2a,       // Color of the sky (deeper blue)
  
  // Terrain settings (new)
  CHUNK_SIZE: 50,            // Size of each terrain chunk
  VISIBLE_CHUNKS: 8,         // Increased from 5 for greater view distance
  TERRAIN_HEIGHT: 1.5,       // Increased from 1.0 for more dramatic terrain
  TEXTURE_REPEAT: 8,         // How many times to repeat ground texture
  
  // Proximity settings for player interaction
  PROXIMITY_THRESHOLD: 10,   // Distance at which players are considered "nearby"
  
  // Audio tracks 
  TRACKS_LIMIT: 50           // Maximum number of tracks stored on the rock
};