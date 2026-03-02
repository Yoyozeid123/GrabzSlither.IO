import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { log } from './index';

interface Player {
  id: string;
  ws: WebSocket;
  name: string;
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  hue: number;
  skin: string;
  length: number;
  segments: { x: number; y: number }[];
  alive: boolean;
  boosting: boolean;
  speed: number;
}

interface GameState {
  players: Map<string, Player>;
  pellets: { x: number; y: number; hue: number }[];
  powerUps: { x: number; y: number; type: 'speed' | 'shield' | 'magnet' }[];
}

const WORLD_SIZE = 4000;
const PELLET_COUNT = 600;
const POWERUP_COUNT = 5;
const BASE_SPEED = 5;
const BOOST_SPEED = 10;
const SEGMENT_DISTANCE = 8;

export function setupGameServer(httpServer: HTTPServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/game' });
  
  const gameState: GameState = {
    players: new Map(),
    pellets: [],
    powerUps: []
  };
  
  // Initialize pellets
  for (let i = 0; i < PELLET_COUNT; i++) {
    gameState.pellets.push({
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      hue: Math.random() * 360
    });
  }
  
  // Initialize power-ups
  const powerUpTypes: ('speed' | 'shield' | 'magnet')[] = ['speed', 'shield', 'magnet'];
  for (let i = 0; i < POWERUP_COUNT; i++) {
    gameState.powerUps.push({
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      type: powerUpTypes[i % 3]
    });
  }
  
  wss.on('connection', (ws: WebSocket) => {
    const playerId = Math.random().toString(36).substring(7);
    log(`Player ${playerId} connected`, 'websocket');
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'join') {
          const player: Player = {
            id: playerId,
            ws,
            name: message.name || 'Player',
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            angle: Math.random() * Math.PI * 2,
            targetAngle: Math.random() * Math.PI * 2,
            hue: message.hue || Math.random() * 360,
            skin: message.skin || 'classic',
            length: 10,
            segments: [],
            alive: true,
            boosting: false,
            speed: BASE_SPEED
          };
          
          // Initialize segments
          for (let i = 0; i < player.length; i++) {
            player.segments.push({ x: player.x, y: player.y });
          }
          
          gameState.players.set(playerId, player);
          
          // Send initial state to new player
          ws.send(JSON.stringify({
            type: 'init',
            playerId,
            gameState: {
              players: Array.from(gameState.players.values()).map(serializePlayer),
              pellets: gameState.pellets,
              powerUps: gameState.powerUps
            }
          }));
          
          // Broadcast new player to others
          broadcast({
            type: 'playerJoined',
            player: serializePlayer(player)
          }, playerId);
        }
        
        if (message.type === 'input') {
          const player = gameState.players.get(playerId);
          if (player && player.alive) {
            player.targetAngle = message.angle;
            player.boosting = message.boosting;
          }
        }
        
        if (message.type === 'eatPellet') {
          const player = gameState.players.get(playerId);
          const pelletIndex = message.pelletIndex;
          if (player && player.alive && pelletIndex >= 0 && pelletIndex < gameState.pellets.length) {
            player.length += 1;
            
            // Respawn pellet
            gameState.pellets[pelletIndex] = {
              x: Math.random() * WORLD_SIZE,
              y: Math.random() * WORLD_SIZE,
              hue: Math.random() * 360
            };
            
            broadcast({
              type: 'pelletEaten',
              pelletIndex,
              newPellet: gameState.pellets[pelletIndex]
            });
          }
        }
        
        if (message.type === 'eatPowerUp') {
          const powerUpIndex = message.powerUpIndex;
          if (powerUpIndex >= 0 && powerUpIndex < gameState.powerUps.length) {
            // Respawn power-up
            const powerUpTypes: ('speed' | 'shield' | 'magnet')[] = ['speed', 'shield', 'magnet'];
            gameState.powerUps[powerUpIndex] = {
              x: Math.random() * WORLD_SIZE,
              y: Math.random() * WORLD_SIZE,
              type: powerUpTypes[Math.floor(Math.random() * 3)]
            };
            
            broadcast({
              type: 'powerUpEaten',
              powerUpIndex,
              newPowerUp: gameState.powerUps[powerUpIndex]
            });
          }
        }
        
      } catch (err) {
        log(`Error parsing message: ${err}`, 'websocket');
      }
    });
    
    ws.on('close', () => {
      log(`Player ${playerId} disconnected`, 'websocket');
      gameState.players.delete(playerId);
      broadcast({
        type: 'playerLeft',
        playerId
      });
    });
  });
  
  function serializePlayer(player: Player) {
    return {
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      angle: player.angle,
      hue: player.hue,
      skin: player.skin,
      length: player.length,
      segments: player.segments,
      alive: player.alive
    };
  }
  
  function broadcast(message: any, excludeId?: string) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const player = Array.from(gameState.players.values()).find(p => p.ws === client);
        if (!excludeId || player?.id !== excludeId) {
          client.send(data);
        }
      }
    });
  }
  
  // Game loop
  setInterval(() => {
    gameState.players.forEach((player) => {
      if (!player.alive) return;
      
      // Update angle smoothly
      player.angle = player.targetAngle;
      
      // Update speed based on boosting
      player.speed = player.boosting ? BOOST_SPEED : BASE_SPEED;
      
      // Move player
      player.x += Math.cos(player.angle) * player.speed;
      player.y += Math.sin(player.angle) * player.speed;
      
      // World wrapping
      if (player.x < 0) player.x += WORLD_SIZE;
      if (player.x > WORLD_SIZE) player.x -= WORLD_SIZE;
      if (player.y < 0) player.y += WORLD_SIZE;
      if (player.y > WORLD_SIZE) player.y -= WORLD_SIZE;
      
      // Update segments
      player.segments.unshift({ x: player.x, y: player.y });
      while (player.segments.length > player.length) {
        player.segments.pop();
      }
      
      // Check collisions with other snakes (including self)
      gameState.players.forEach((other) => {
        if (!other.alive) return;
        
        // Check head collision with body segments
        const startIndex = other.id === player.id ? 10 : 5; // Skip more segments for self-collision
        for (let i = startIndex; i < other.segments.length; i++) {
          const seg = other.segments[i];
          const dist = Math.hypot(seg.x - player.x, seg.y - player.y);
          if (dist < 15) {
            player.alive = false;
            broadcast({
              type: 'playerDied',
              playerId: player.id
            });
            return;
          }
        }
      });
    });
    
    // Broadcast game state (only positions, not full state)
    if (gameState.players.size > 0) {
      const lightState = Array.from(gameState.players.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        angle: p.angle,
        length: p.length,
        alive: p.alive
      }));
      
      broadcast({
        type: 'gameState',
        players: lightState
      });
    }
  }, 50); // Back to 20 Hz for smoother sync
  
  log('WebSocket game server initialized', 'websocket');
}
