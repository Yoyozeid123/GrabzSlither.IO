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
    let localX = 0;
    let localY = 0;
    let localAngle = 0;
    let localSegments: any[] = [];
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
          if (p.id === playerId) {
            mySnake = p;
            localX = p.x;
            localY = p.y;
            localAngle = p.angle;
            localSegments = [...p.segments];
          }
        });
        pellets = message.gameState.pellets;
      }

      if (message.type === 'gameState') {
        message.players.forEach((p: any) => {
          players.set(p.id, p);
          if (p.id === playerId) {
            mySnake = p;
            // Smooth correction
            localX = localX * 0.7 + p.x * 0.3;
            localY = localY * 0.7 + p.y * 0.3;
          }
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

    // Local prediction update
    const updateLocal = () => {
      if (mySnake && mySnake.alive) {
        const worldX = camera.x + mouseX;
        const worldY = camera.y + mouseY;
        const dx = worldX - localX;
        const dy = worldY - localY;
        localAngle = Math.atan2(dy, dx);
        
        const speed = isBoosting ? 10 : 5;
        localX += Math.cos(localAngle) * speed;
        localY += Math.sin(localAngle) * speed;
        
        // World wrapping
        if (localX < 0) localX += 4000;
        if (localX > 4000) localX -= 4000;
        if (localY < 0) localY += 4000;
        if (localY > 4000) localY -= 4000;
        
        // Update segments
        localSegments.unshift({ x: localX, y: localY });
        while (localSegments.length > (mySnake.length || 10)) {
          localSegments.pop();
        }
      }
    };

    // Render loop
    const render = () => {
      updateLocal();
      
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (mySnake) {
        camera.x = localX - canvas.width / 2;
        camera.y = localY - canvas.height / 2;
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
        
        // Use local prediction for own snake
        const isMe = player.id === playerId;
        const drawX = isMe ? localX : player.x;
        const drawY = isMe ? localY : player.y;
        const drawAngle = isMe ? localAngle : player.angle;
        const drawSegments = isMe ? localSegments : player.segments;
        
        // Skin-specific colors
        let bodyColor = `hsl(${player.hue}, 100%, 50%)`;
        let bellyColor = `hsl(${player.hue}, 80%, 75%)`;
        let scaleColor = `hsla(${player.hue}, 100%, 35%, 0.6)`;
        
        if (player.skin === 'neon') {
          ctx.shadowBlur = 30;
          bodyColor = `hsl(${player.hue}, 100%, 60%)`;
        } else if (player.skin === 'galaxy') {
          bodyColor = `hsl(${(player.hue + Date.now() / 50) % 360}, 100%, 50%)`;
          ctx.shadowBlur = 20;
        } else if (player.skin === 'fire') {
          bodyColor = `hsl(${20 + Math.sin(Date.now() / 100) * 20}, 100%, 50%)`;
          ctx.shadowBlur = 25;
          ctx.shadowColor = '#ff4400';
        } else if (player.skin === 'ice') {
          bodyColor = `hsl(${180 + Math.sin(Date.now() / 100) * 20}, 100%, 70%)`;
          ctx.shadowBlur = 25;
          ctx.shadowColor = '#00ffff';
        } else if (player.skin === 'toxic') {
          bodyColor = `hsl(${120 + Math.sin(Date.now() / 80) * 30}, 100%, 45%)`;
          ctx.shadowBlur = 30;
          ctx.shadowColor = '#00ff00';
        } else if (player.skin === 'electric') {
          bodyColor = `hsl(${200 + Math.sin(Date.now() / 60) * 40}, 100%, 60%)`;
          ctx.shadowBlur = 35;
          ctx.shadowColor = '#00ffff';
        } else if (player.skin === 'shadow') {
          bodyColor = `hsl(${player.hue}, 20%, 20%)`;
          bellyColor = `hsl(${player.hue}, 30%, 30%)`;
          ctx.shadowBlur = 40;
          ctx.shadowColor = '#000000';
        } else if (player.skin === 'rainbow') {
          const rainbowHue = (Date.now() / 10) % 360;
          bodyColor = `hsl(${rainbowHue}, 100%, 50%)`;
          ctx.shadowBlur = 25;
        } else if (player.skin === 'gold') {
          bodyColor = `hsl(${45 + Math.sin(Date.now() / 100) * 10}, 100%, 50%)`;
          bellyColor = `hsl(${45}, 100%, 70%)`;
          ctx.shadowBlur = 30;
          ctx.shadowColor = '#ffd700';
        }
        
        // Draw body segments
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 25;
        ctx.shadowColor = `hsl(${player.hue}, 100%, 50%)`;
        
        ctx.beginPath();
        for (let i = drawSegments.length - 1; i >= 0; i--) {
          const seg = drawSegments[i];
          const segX = seg.x - camera.x;
          const segY = seg.y - camera.y;
          
          if (i === drawSegments.length - 1) {
            ctx.moveTo(segX, segY);
          } else {
            ctx.lineTo(segX, segY);
          }
        }
        ctx.stroke();
        
        // Belly stripe
        ctx.shadowBlur = 10;
        ctx.strokeStyle = bellyColor;
        ctx.lineWidth = 8;
        ctx.beginPath();
        for (let i = drawSegments.length - 1; i >= 0; i--) {
          const seg = drawSegments[i];
          const segX = seg.x - camera.x;
          const segY = seg.y - camera.y;
          
          if (i === drawSegments.length - 1) {
            ctx.moveTo(segX, segY);
          } else {
            ctx.lineTo(segX, segY);
          }
        }
        ctx.stroke();
        
        // Scale pattern
        ctx.shadowBlur = 5;
        for (let i = drawSegments.length - 1; i >= 1; i -= 3) {
          const seg = drawSegments[i];
          const segX = seg.x - camera.x;
          const segY = seg.y - camera.y;
          
          ctx.fillStyle = scaleColor;
          ctx.beginPath();
          ctx.arc(segX, segY, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw head
        const screenX = drawX - camera.x;
        const screenY = drawY - camera.y;
        
        const headLength = 16;
        const headWidth = 10;
        const eyeAngle = drawAngle;
        
        const tipX = screenX + Math.cos(eyeAngle) * headLength;
        const tipY = screenY + Math.sin(eyeAngle) * headLength;
        const leftX = screenX + Math.cos(eyeAngle + Math.PI / 2) * headWidth;
        const leftY = screenY + Math.sin(eyeAngle + Math.PI / 2) * headWidth;
        const rightX = screenX + Math.cos(eyeAngle - Math.PI / 2) * headWidth;
        const rightY = screenY + Math.sin(eyeAngle - Math.PI / 2) * headWidth;
        const backX = screenX - Math.cos(eyeAngle) * 4;
        const backY = screenY - Math.sin(eyeAngle) * 4;
        
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, headLength);
        gradient.addColorStop(0, `hsl(${player.hue}, 100%, 60%)`);
        gradient.addColorStop(1, `hsl(${player.hue}, 100%, 40%)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(backX, backY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
        
        // Eyes
        const eyeOffsetX = 6;
        const eyeOffsetY = 4;
        const leftEyeX = screenX + Math.cos(eyeAngle) * eyeOffsetX + Math.cos(eyeAngle + Math.PI / 2) * eyeOffsetY;
        const leftEyeY = screenY + Math.sin(eyeAngle) * eyeOffsetX + Math.sin(eyeAngle + Math.PI / 2) * eyeOffsetY;
        const rightEyeX = screenX + Math.cos(eyeAngle) * eyeOffsetX + Math.cos(eyeAngle - Math.PI / 2) * eyeOffsetY;
        const rightEyeY = screenY + Math.sin(eyeAngle) * eyeOffsetX + Math.sin(eyeAngle - Math.PI / 2) * eyeOffsetY;
        
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, 3, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftEyeX, leftEyeY - 2.5);
        ctx.lineTo(leftEyeX, leftEyeY + 2.5);
        ctx.moveTo(rightEyeX, rightEyeY - 2.5);
        ctx.lineTo(rightEyeX, rightEyeY + 2.5);
        ctx.stroke();
        
        // Forked tongue
        if (Math.sin(Date.now() / 200) > 0.7) {
          ctx.strokeStyle = '#ff1744';
          ctx.lineWidth = 1;
          const tongueX = tipX + Math.cos(eyeAngle) * 8;
          const tongueY = tipY + Math.sin(eyeAngle) * 8;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tongueX, tongueY);
          ctx.moveTo(tongueX, tongueY);
          ctx.lineTo(tongueX + Math.cos(eyeAngle + 0.3) * 4, tongueY + Math.sin(eyeAngle + 0.3) * 4);
          ctx.moveTo(tongueX, tongueY);
          ctx.lineTo(tongueX + Math.cos(eyeAngle - 0.3) * 4, tongueY + Math.sin(eyeAngle - 0.3) * 4);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;

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
