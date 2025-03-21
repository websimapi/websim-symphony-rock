export const CONFIG = {
  // Rock appearance
  ROCK_SIZE: 5,
  ROCK_COLOR: 0xff7b00,
  ROCK_GLOW_INTENSITY: 0.5,
  ROCK_ROTATION_SPEED: 0.001,
  
  // Player settings
  PLAYER_MOVE_SPEED: 0.1,
  PLAYER_HEIGHT: 1.7,
  PLAYER_RADIUS: 0.5,
  
  // Audio settings
  MAX_AUDIO_DISTANCE: 20,     // Maximum distance audio can be heard from
  AUDIO_ROLLOFF_FACTOR: 1.5,  // How quickly audio fades with distance
  
  // World settings
  WORLD_SIZE: 50,            // Size of the ground plane
  GROUND_COLOR: 0x222222,    // Color of the ground
  SKY_COLOR: 0x000022,       // Color of the sky
  
  // Proximity settings for player interaction
  PROXIMITY_THRESHOLD: 10,   // Distance at which players are considered "nearby"
  
  // Audio tracks 
  TRACKS_LIMIT: 50           // Maximum number of tracks stored on the rock
};

