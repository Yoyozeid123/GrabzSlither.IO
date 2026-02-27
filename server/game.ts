import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { log } from './index';

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  hue: number;
  skin: string;
  length: number;
  segments: { x: number; y: number }[];
  alive: boolean;
}

interface GameState {
  players: Map<string, Player>;
  pellets: { x: number; y: number; hue: number }[];
}

const WORLD_SIZE = 4000;
const PELLET_COUNT = 600;

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
          // New player joins
          const player: Player = {
            id: playerId,
            name: message.name || 'Player',
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            angle: Math.random() * Math.PI * 2,
            hue: message.hue || Math.random() * 360,
            skin: message.skin || 'classic',
            length: 10,
            segments: [],
            alive: true
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
              players: Array.from(gameState.players.values()),
              pellets: gameState.pellets
            }
          }));
          
          // Broadcast new player to others
          broadcast({
            type: 'playerJoined',
            player
          }, playerId);
        }
        
        if (message.type === 'update') {
          // Update player position
          const player = gameState.players.get(playerId);
          if (player && player.alive) {
            player.x = message.x;
            player.y = message.y;
            player.angle = message.angle;
            player.length = message.length;
            player.segments = message.segments;
          }
        }
        
        if (message.type === 'eat') {
          // Player ate a pellet
          const pelletIndex = message.pelletIndex;
          if (pelletIndex >= 0 && pelletIndex < gameState.pellets.length) {
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
        
        if (message.type === 'death') {
          // Player died
          const player = gameState.players.get(playerId);
          if (player) {
            player.alive = false;
            broadcast({
              type: 'playerDied',
              playerId
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
  
  // Broadcast game state to all players
  function broadcast(message: any, excludeId?: string) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Skip the excluded player if specified
        if (!excludeId || (client as any).playerId !== excludeId) {
          client.send(data);
        }
      }
    });
  }
  
  // Game loop - broadcast state updates
  setInterval(() => {
    if (gameState.players.size > 0) {
      broadcast({
        type: 'gameState',
        players: Array.from(gameState.players.values())
      });
    }
  }, 50); // 20 updates per second
  
  log('WebSocket game server initialized', 'websocket');
}
