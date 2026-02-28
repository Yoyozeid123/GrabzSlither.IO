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
}

const WORLD_SIZE = 4000;
const PELLET_COUNT = 600;
const BASE_SPEED = 5;
const BOOST_SPEED = 10;
const SEGMENT_DISTANCE = 8;

export function setupGameServer(httpServer: HTTPServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/game' });
  
  const gameState: GameState = {
    players: new Map(),
    pellets: []
  };
  
  // Initialize pellets
  for (let i = 0; i < PELLET_COUNT; i++) {
    gameState.pellets.push({
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      hue: Math.random() * 360
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
              pellets: gameState.pellets
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
      
      // Check pellet collisions
      gameState.pellets.forEach((pellet, index) => {
        const dist = Math.hypot(pellet.x - player.x, pellet.y - player.y);
        if (dist < 15) {
          player.length += 1;
          
          // Respawn pellet
          gameState.pellets[index] = {
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            hue: Math.random() * 360
          };
          
          broadcast({
            type: 'pelletEaten',
            pelletIndex: index,
            newPellet: gameState.pellets[index]
          });
        }
      });
      
      // Check collisions with other snakes
      gameState.players.forEach((other) => {
        if (other.id === player.id || !other.alive) return;
        
        // Check head collision with other's body
        other.segments.forEach((seg, i) => {
          if (i < 5) return; // Skip head segments
          const dist = Math.hypot(seg.x - player.x, seg.y - player.y);
          if (dist < 15) {
            player.alive = false;
            broadcast({
              type: 'playerDied',
              playerId: player.id
            });
          }
        });
      });
    });
    
    // Broadcast game state
    if (gameState.players.size > 0) {
      broadcast({
        type: 'gameState',
        players: Array.from(gameState.players.values()).map(serializePlayer)
      });
    }
  }, 50); // 20 updates per second
  
  log('WebSocket game server initialized', 'websocket');
}
