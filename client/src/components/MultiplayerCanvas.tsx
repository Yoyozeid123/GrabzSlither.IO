import { useEffect, useRef } from "react";

interface MultiplayerCanvasProps {
  playerName: string;
  selectedHue: number;
  selectedSkin: string;
  onGameOver: (score: number) => void;
  onAchievementUnlock: (achievement: any) => void;
  updateUI: (length: number, rank: number, total: number) => void;
  updateLeaderboard: (leaders: { name: string; length: number; isPlayer: boolean }[]) => void;
}

export function MultiplayerCanvas({
  playerName,
  selectedHue,
  selectedSkin,
  onGameOver,
  onAchievementUnlock,
  updateUI,
  updateLeaderboard
}: MultiplayerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Connect to WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/game`);
    wsRef.current = ws;

    let playerId: string | null = null;
    let players: Map<string, any> = new Map();
    let pellets: any[] = [];

    ws.onopen = () => {
      console.log('Connected to game server');
      ws.send(JSON.stringify({
        type: 'join',
        name: playerName,
        hue: selectedHue,
        skin: selectedSkin
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'init') {
        playerId = message.playerId;
        message.gameState.players.forEach((p: any) => {
          players.set(p.id, p);
        });
        pellets = message.gameState.pellets;
      }

      if (message.type === 'gameState') {
        message.players.forEach((p: any) => {
          players.set(p.id, p);
        });
      }

      if (message.type === 'playerJoined') {
        players.set(message.player.id, message.player);
      }

      if (message.type === 'playerLeft') {
        players.delete(message.playerId);
      }

      if (message.type === 'playerDied') {
        const player = players.get(message.playerId);
        if (player) player.alive = false;
      }

      if (message.type === 'pelletEaten') {
        pellets[message.pelletIndex] = message.newPellet;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from game server');
    };

    // Render loop
    const render = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Multiplayer Mode', canvas.width / 2, canvas.height / 2 - 50);
      ctx.fillText(`Connected Players: ${players.size}`, canvas.width / 2, canvas.height / 2);
      ctx.font = '16px Arial';
      ctx.fillText('(Full implementation coming soon)', canvas.width / 2, canvas.height / 2 + 50);

      requestAnimationFrame(render);
    };
    render();

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [playerName, selectedHue, selectedSkin]);

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      className="fixed inset-0 w-full h-full block z-0"
      style={{ background: '#000' }}
    />
  );
}
