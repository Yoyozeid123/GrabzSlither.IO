import { useEffect, useRef, useState } from "react";

interface GameCanvasProps {
  playerName: string;
  selectedHue: number;
  onGameOver: (score: number) => void;
  updateUI: (length: number, rank: number, total: number) => void;
  updateLeaderboard: (leaders: { name: string; length: number; isPlayer: boolean }[]) => void;
}

export function GameCanvas({ 
  playerName, 
  selectedHue, 
  onGameOver,
  updateUI,
  updateLeaderboard
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Ref to hold the latest onGameOver callback so the game loop uses the latest without restarting
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

    // Handle resize
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Game Constants
    const WORLD_SIZE = 4000;
    const PELLET_COUNT = 800;
    const BOT_COUNT = 15;
    const snakeEmojis = ['🐍', '🐉', '🦎', '🐊', '🦖', '🐲', '🪱', '🦕'];

    // Game State
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let animationFrameId: number;
    let isRunning = true;

    // Track mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Classes adapted from HTML
    class Snake {
      segments: { x: number; y: number }[];
      length: number;
      angle: number;
      speed: number;
      hue: number;
      isPlayer: boolean;
      name: string;
      alive: boolean;
      invincible: number;

      constructor(x: number, y: number, isPlayer = false, name = '', hue: number | null = null) {
        this.segments = [{ x, y }];
        this.length = 10;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 3;
        this.hue = hue !== null ? hue : Math.random() * 360;
        this.isPlayer = isPlayer;
        this.name = name || `${snakeEmojis[Math.floor(Math.random() * snakeEmojis.length)]} Bot${Math.floor(Math.random() * 1000)}`;
        this.alive = true;
        this.invincible = isPlayer ? 60 : 0;
      }

      update(targetX?: number, targetY?: number) {
        if (!this.alive) return;
        if (this.invincible > 0) this.invincible--;

        if (this.isPlayer && targetX !== undefined && targetY !== undefined) {
          const dx = targetX - this.segments[0].x;
          const dy = targetY - this.segments[0].y;
          this.angle = Math.atan2(dy, dx);
        } else {
          // Bot AI
          if (Math.random() < 0.02) {
            this.angle += (Math.random() - 0.5) * 0.5;
          }
          
          let nearest: Pellet | null = null;
          let minDist = Infinity;
          pellets.forEach(p => {
            const dist = Math.hypot(p.x - this.segments[0].x, p.y - this.segments[0].y);
            if (dist < minDist && dist < 200) {
              minDist = dist;
              nearest = p;
            }
          });
          
          if (nearest) {
            const dx = nearest.x - this.segments[0].x;
            const dy = nearest.y - this.segments[0].y;
            const targetAngle = Math.atan2(dy, dx);
            const diff = targetAngle - this.angle;
            this.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.1);
          }
        }

        const head = this.segments[0];
        const newHead = {
          x: head.x + Math.cos(this.angle) * this.speed,
          y: head.y + Math.sin(this.angle) * this.speed
        };

        // Wrap around world
        newHead.x = (newHead.x + WORLD_SIZE) % WORLD_SIZE;
        newHead.y = (newHead.y + WORLD_SIZE) % WORLD_SIZE;

        this.segments.unshift(newHead);
        while (this.segments.length > this.length) {
          this.segments.pop();
        }
      }

      draw(camX: number, camY: number, drawCtx: CanvasRenderingContext2D, cWidth: number, cHeight: number) {
        if (!this.alive) return;

        if (this.invincible > 0) {
          drawCtx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
        }

        drawCtx.shadowBlur = 10;
        drawCtx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;

        for (let i = this.segments.length - 1; i >= 0; i--) {
          const seg = this.segments[i];
          const screenX = seg.x - camX + cWidth / 2;
          const screenY = seg.y - camY + cHeight / 2;

          if (i === 0) {
            // Snake head - triangular/diamond shape
            const headLength = 16;
            const headWidth = 10;
            const eyeAngle = this.angle;
            
            const tipX = screenX + Math.cos(eyeAngle) * headLength;
            const tipY = screenY + Math.sin(eyeAngle) * headLength;
            const leftX = screenX + Math.cos(eyeAngle + Math.PI / 2) * headWidth;
            const leftY = screenY + Math.sin(eyeAngle + Math.PI / 2) * headWidth;
            const rightX = screenX + Math.cos(eyeAngle - Math.PI / 2) * headWidth;
            const rightY = screenY + Math.sin(eyeAngle - Math.PI / 2) * headWidth;
            const backX = screenX - Math.cos(eyeAngle) * 4;
            const backY = screenY - Math.sin(eyeAngle) * 4;
            
            const gradient = drawCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, headLength);
            gradient.addColorStop(0, `hsl(${this.hue}, 100%, 60%)`);
            gradient.addColorStop(1, `hsl(${this.hue}, 100%, 40%)`);
            
            drawCtx.fillStyle = gradient;
            drawCtx.beginPath();
            drawCtx.moveTo(tipX, tipY);
            drawCtx.lineTo(leftX, leftY);
            drawCtx.lineTo(backX, backY);
            drawCtx.lineTo(rightX, rightY);
            drawCtx.closePath();
            drawCtx.fill();
            
            // Snake eyes - slitted pupils
            const eyeOffsetX = 6;
            const eyeOffsetY = 4;
            const leftEyeX = screenX + Math.cos(eyeAngle) * eyeOffsetX + Math.cos(eyeAngle + Math.PI / 2) * eyeOffsetY;
            const leftEyeY = screenY + Math.sin(eyeAngle) * eyeOffsetX + Math.sin(eyeAngle + Math.PI / 2) * eyeOffsetY;
            const rightEyeX = screenX + Math.cos(eyeAngle) * eyeOffsetX + Math.cos(eyeAngle - Math.PI / 2) * eyeOffsetY;
            const rightEyeY = screenY + Math.sin(eyeAngle) * eyeOffsetX + Math.sin(eyeAngle - Math.PI / 2) * eyeOffsetY;
            
            // Eye background
            drawCtx.fillStyle = '#ffeb3b';
            drawCtx.beginPath();
            drawCtx.arc(leftEyeX, leftEyeY, 3, 0, Math.PI * 2);
            drawCtx.arc(rightEyeX, rightEyeY, 3, 0, Math.PI * 2);
            drawCtx.fill();
            
            // Vertical slit pupils
            drawCtx.strokeStyle = '#000';
            drawCtx.lineWidth = 1.5;
            drawCtx.beginPath();
            drawCtx.moveTo(leftEyeX, leftEyeY - 2.5);
            drawCtx.lineTo(leftEyeX, leftEyeY + 2.5);
            drawCtx.moveTo(rightEyeX, rightEyeY - 2.5);
            drawCtx.lineTo(rightEyeX, rightEyeY + 2.5);
            drawCtx.stroke();
            
            // Forked tongue
            if (Math.sin(Date.now() / 200) > 0.7) {
              drawCtx.strokeStyle = '#ff1744';
              drawCtx.lineWidth = 1;
              const tongueX = tipX + Math.cos(eyeAngle) * 8;
              const tongueY = tipY + Math.sin(eyeAngle) * 8;
              drawCtx.beginPath();
              drawCtx.moveTo(tipX, tipY);
              drawCtx.lineTo(tongueX, tongueY);
              drawCtx.moveTo(tongueX, tongueY);
              drawCtx.lineTo(tongueX + Math.cos(eyeAngle + 0.3) * 4, tongueY + Math.sin(eyeAngle + 0.3) * 4);
              drawCtx.moveTo(tongueX, tongueY);
              drawCtx.lineTo(tongueX + Math.cos(eyeAngle - 0.3) * 4, tongueY + Math.sin(eyeAngle - 0.3) * 4);
              drawCtx.stroke();
            }
          } else {
            // Body segments
            const radius = 8;
            const gradient = drawCtx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
            gradient.addColorStop(0, `hsl(${this.hue}, 100%, 60%)`);
            gradient.addColorStop(1, `hsl(${this.hue}, 100%, 40%)`);
            
            drawCtx.fillStyle = gradient;
            drawCtx.beginPath();
            drawCtx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            drawCtx.fill();
          }
        }

        drawCtx.shadowBlur = 0;
        drawCtx.globalAlpha = 1;

        if (this.segments[0]) {
          const head = this.segments[0];
          const screenX = head.x - camX + cWidth / 2;
          const screenY = head.y - camY + cHeight / 2;
          drawCtx.fillStyle = '#fff';
          drawCtx.font = 'bold 14px "Rajdhani", sans-serif';
          drawCtx.textAlign = 'center';
          drawCtx.fillText(this.name, screenX, screenY - 20);
        }
      }

      checkCollision(snakesList: Snake[]) {
        if (this.invincible > 0) return false;
        
        const head = this.segments[0];
        
        for (let snake of snakesList) {
          if (!snake.alive) continue;
          const startIdx = snake === this ? 10 : 0;
          
          for (let i = startIdx; i < snake.segments.length; i++) {
            const seg = snake.segments[i];
            const dist = Math.hypot(head.x - seg.x, head.y - seg.y);
            if (dist < 10) {
              return true;
            }
          }
        }
        return false;
      }
    }

    class Pellet {
      x: number;
      y: number;
      hue: number;
      radius: number;

      constructor(x?: number, y?: number) {
        this.x = x !== undefined ? x : Math.random() * WORLD_SIZE;
        this.y = y !== undefined ? y : Math.random() * WORLD_SIZE;
        this.hue = Math.random() * 360;
        this.radius = 4;
      }

      draw(camX: number, camY: number, drawCtx: CanvasRenderingContext2D, cWidth: number, cHeight: number) {
        const screenX = this.x - camX + cWidth / 2;
        const screenY = this.y - camY + cHeight / 2;

        if (screenX < -20 || screenX > cWidth + 20 || 
            screenY < -20 || screenY > cHeight + 20) return;

        drawCtx.shadowBlur = 5;
        drawCtx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        drawCtx.fillStyle = `hsl(${this.hue}, 100%, 50%)`;
        drawCtx.beginPath();
        drawCtx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        drawCtx.fill();
        drawCtx.shadowBlur = 0;
      }
    }

    // Initialize Game Entities
    const player = new Snake(WORLD_SIZE / 2, WORLD_SIZE / 2, true, `👑 ${playerName}`, selectedHue);
    let snakes: Snake[] = [player];
    let pellets: Pellet[] = [];

    for (let i = 0; i < BOT_COUNT; i++) {
      snakes.push(new Snake(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE, false));
    }
    
    for (let i = 0; i < PELLET_COUNT; i++) {
      pellets.push(new Pellet());
    }

    // Main Game Loop
    const gameLoop = () => {
      if (!isRunning || !ctx || !canvas) return;

      // Draw background - replicating HTML radial gradient + trailing effect
      // Create radial gradient for base background
      const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height));
      bgGrad.addColorStop(0, '#1a1a1a');
      bgGrad.addColorStop(1, '#0d0d0d');
      
      // Use semi-transparent fill for trails, but mix it with the gradient look
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(13, 13, 13, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!player.alive) {
        isRunning = false;
        onGameOverRef.current(player.length * 10); // arbitrary multiplier for higher scores
        return;
      }

      const camX = player.segments[0].x;
      const camY = player.segments[0].y;

      // Draw Grid (cyberpunk addition)
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 100;
      const offsetX = camX % gridSize;
      const offsetY = camY % gridSize;
      
      ctx.beginPath();
      for (let x = -offsetX; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = -offsetY; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // Draw pellets
      pellets.forEach(p => p.draw(camX, camY, ctx, canvas.width, canvas.height));

      // Update and draw snakes
      snakes.forEach(snake => {
        if (snake.isPlayer) {
          snake.update(camX + mouseX - canvas.width / 2, camY + mouseY - canvas.height / 2);
        } else {
          snake.update();
        }
        snake.draw(camX, camY, ctx, canvas.width, canvas.height);
      });

      // Check collisions
      snakes.forEach(snake => {
        if (!snake.alive) return;
        
        if (snake.checkCollision(snakes)) {
          snake.alive = false;
          // Drop pellets
          for (let i = 0; i < snake.length / 2; i++) {
            const seg = snake.segments[Math.floor(Math.random() * snake.segments.length)];
            if (seg) {
              pellets.push(new Pellet(seg.x, seg.y));
            }
          }
        }
      });

      // Eat pellets
      snakes.forEach(snake => {
        if (!snake.alive) return;
        const head = snake.segments[0];
        
        pellets = pellets.filter(p => {
          const dist = Math.hypot(head.x - p.x, head.y - p.y);
          if (dist < 15) {
            snake.length += 1;
            return false;
          }
          return true;
        });
      });

      // Respawn pellets
      while (pellets.length < PELLET_COUNT) {
        pellets.push(new Pellet());
      }

      // Respawn bots
      snakes = snakes.filter(s => s.isPlayer || s.alive);
      while (snakes.length < BOT_COUNT + 1) {
        snakes.push(new Snake(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE, false));
      }

      // UI Updates via React State
      const aliveSnakes = snakes.filter(s => s.alive);
      const rank = aliveSnakes.filter(s => s.length > player.length).length + 1;
      
      // Throttle React state updates to avoid excessive re-renders (every 10 frames approx)
      if (Math.random() < 0.1) {
        updateUIRef.current(player.length * 10, rank, aliveSnakes.length);
        
        const top = aliveSnakes.sort((a, b) => b.length - a.length).slice(0, 10).map(s => ({
          name: s.name,
          length: s.length * 10,
          isPlayer: s.isPlayer
        }));
        updateLeaderboardRef.current(top);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    // Cleanup
    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [playerName, selectedHue]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full block z-0"
      style={{ background: 'radial-gradient(circle, #1a1a1a 0%, #0d0d0d 100%)' }}
    />
  );
}
