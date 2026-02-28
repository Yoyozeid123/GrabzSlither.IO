import { useEffect, useRef } from "react";

interface MultiplayerCanvasProps {
  playerName: string;
  selectedHue: number;
  selectedSkin: string;
  onGameOver: (score: number, stats: { kills: number; timeSurvived: number; pelletsEaten: number }) => void;
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
  const onGameOverRef = useRef(onGameOver);
  const updateUIRef = useRef(updateUI);
  const updateLeaderboardRef = useRef(updateLeaderboard);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
    updateUIRef.current = updateUI;
    updateLeaderboardRef.current = updateLeaderboard;
  }, [onGameOver, updateUI, updateLeaderboard]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const WORLD_SIZE = 4000;
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let isBoosting = false;

    // Connect to WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/game`);
    wsRef.current = ws;

    let playerId: string | null = null;
    let players: Map<string, any> = new Map();
    let pellets: any[] = [];
    let mySnake: any = null;
    let camera = { x: 0, y: 0 };
    const startTime = Date.now();

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
          if (p.id === playerId) mySnake = p;
        });
        pellets = message.gameState.pellets;
      }

      if (message.type === 'gameState') {
        message.players.forEach((p: any) => {
          players.set(p.id, p);
          if (p.id === playerId) mySnake = p;
        });
        
        // Update UI
        if (mySnake) {
          const sorted = Array.from(players.values())
            .filter(p => p.alive)
            .sort((a, b) => b.length - a.length);
          const rank = sorted.findIndex(p => p.id === playerId) + 1;
          updateUIRef.current(mySnake.length, rank, players.size);
          
          const leaders = sorted.slice(0, 10).map(p => ({
            name: p.name,
            length: p.length,
            isPlayer: p.id === playerId
          }));
          updateLeaderboardRef.current(leaders);
        }
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
        
        if (message.playerId === playerId) {
          const timeSurvived = Math.floor((Date.now() - startTime) / 1000);
          onGameOverRef.current(mySnake?.length || 0, {
            kills: 0,
            timeSurvived,
            pelletsEaten: 0
          });
        }
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

    // Mouse/touch controls
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') isBoosting = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isBoosting = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Send updates to server
    const sendUpdate = () => {
      if (mySnake && ws.readyState === WebSocket.OPEN) {
        const worldX = camera.x + mouseX;
        const worldY = camera.y + mouseY;
        const dx = worldX - mySnake.x;
        const dy = worldY - mySnake.y;
        const angle = Math.atan2(dy, dx);
        
        ws.send(JSON.stringify({
          type: 'input',
          angle,
          boosting: isBoosting
        }));
      }
    };
    const updateInterval = setInterval(sendUpdate, 50);

    // Render loop
    const render = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (mySnake) {
        camera.x = mySnake.x - canvas.width / 2;
        camera.y = mySnake.y - canvas.height / 2;
      }

      // Draw grid
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = -camera.x % gridSize; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = -camera.y % gridSize; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw pellets
      pellets.forEach(pellet => {
        const screenX = pellet.x - camera.x;
        const screenY = pellet.y - camera.y;
        if (screenX > -50 && screenX < canvas.width + 50 && screenY > -50 && screenY < canvas.height + 50) {
          ctx.fillStyle = `hsl(${pellet.hue}, 100%, 50%)`;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw snakes
      players.forEach(player => {
        if (!player.alive) return;
        
        const screenX = player.x - camera.x;
        const screenY = player.y - camera.y;
        
        // Draw segments
        player.segments.forEach((seg: any, i: number) => {
          const segX = seg.x - camera.x;
          const segY = seg.y - camera.y;
          const size = i === 0 ? 12 : 10;
          
          ctx.fillStyle = `hsl(${player.hue}, 100%, 50%)`;
          ctx.beginPath();
          ctx.arc(segX, segY, size, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw name
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, screenX, screenY - 20);
      });

      requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(updateInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [playerName, selectedHue, selectedSkin]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full block z-0"
      style={{ background: '#0a0a0a' }}
    />
  );
}
