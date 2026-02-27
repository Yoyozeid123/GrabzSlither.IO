import { useEffect, useRef, useState } from "react";
import { getAchievements, checkAchievement } from "@/lib/achievements";

interface GameCanvasProps {
  playerName: string;
  selectedHue: number;
  selectedSkin: string;
  gameMode: string;
  onGameOver: (score: number) => void;
  onAchievementUnlock: (achievement: any) => void;
  updateUI: (length: number, rank: number, total: number) => void;
  updateLeaderboard: (leaders: { name: string; length: number; isPlayer: boolean }[]) => void;
}

export function GameCanvas({ 
  playerName, 
  selectedHue,
  selectedSkin,
  gameMode,
  onGameOver,
  onAchievementUnlock,
  updateUI,
  updateLeaderboard
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const biteAudioRef = useRef<HTMLAudioElement | null>(null);
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
    // Start background music
    if (!audioRef.current) {
      audioRef.current = new Audio('/here-we-are.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(e => console.log('Audio autoplay blocked:', e));
    }
    
    // Preload bite sound
    if (!biteAudioRef.current) {
      biteAudioRef.current = new Audio('/bite-sound.mp3');
      biteAudioRef.current.volume = 0.5;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Multiplayer mode - connect to WebSocket server
    if (gameMode === 'multiplayer') {
      // TODO: Implement WebSocket multiplayer
      console.log('Multiplayer mode - WebSocket connection coming soon!');
      // For now, fall back to singleplayer
    }
    
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
    let isBoosting = false;
    
    // Particle system
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      hue: number;
      life: number;
      maxLife: number;
    }
    let particles: Particle[] = [];
    
    // Sound effects (using Web Audio API for simple sounds)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playEatSound = () => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.1);
    };
    
    const playDeathSound = () => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.setValueAtTime(400, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    };
    
    const playBoostSound = () => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.setValueAtTime(200, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);
      osc.type = 'square';
      gain.gain.setValueAtTime(0.05, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.15);
    };
    
    let lastBoostSound = 0;
    
    // Achievement tracking
    let achievements = getAchievements();
    let boostCount = 0;
    let pelletsEaten = 0;
    const startTime = Date.now();

    // Track mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    // Boost controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isBoosting = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isBoosting = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

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
      skin: string;

      constructor(x: number, y: number, isPlayer = false, name = '', hue: number | null = null, skin = 'classic') {
        this.segments = [{ x, y }];
        this.length = 10;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 3;
        this.hue = hue !== null ? hue : Math.random() * 360;
        this.isPlayer = isPlayer;
        this.name = name || `${snakeEmojis[Math.floor(Math.random() * snakeEmojis.length)]} Bot${Math.floor(Math.random() * 1000)}`;
        this.alive = true;
        this.invincible = isPlayer ? 60 : 0;
        this.skin = skin;
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
        const currentSpeed = this.isPlayer && isBoosting && this.length > 10 ? this.speed * 2 : this.speed;
        
        const newHead = {
          x: head.x + Math.cos(this.angle) * currentSpeed,
          y: head.y + Math.sin(this.angle) * currentSpeed
        };

        // Wrap around world
        newHead.x = (newHead.x + WORLD_SIZE) % WORLD_SIZE;
        newHead.y = (newHead.y + WORLD_SIZE) % WORLD_SIZE;

        this.segments.unshift(newHead);
        
        // Boost costs length
        if (this.isPlayer && isBoosting && this.length > 10) {
          this.length -= 0.1;
          // Boost trail particles
          if (Math.random() < 0.5) {
            particles.push({
              x: head.x,
              y: head.y,
              vx: -Math.cos(this.angle) * 2 + (Math.random() - 0.5),
              vy: -Math.sin(this.angle) * 2 + (Math.random() - 0.5),
              hue: this.hue,
              life: 20,
              maxLife: 20,
            });
          }
          // Boost sound (throttled)
          const now = Date.now();
          if (now - lastBoostSound > 500) {
            playBoostSound();
            lastBoostSound = now;
            boostCount++;
            
            // Check speed demon achievement
            const speedDemon = checkAchievement(achievements, 'speed_demon', boostCount);
            if (speedDemon) onAchievementUnlock(speedDemon);
          }
        }
        
        while (this.segments.length > this.length) {
          this.segments.pop();
        }
      }

      draw(camX: number, camY: number, drawCtx: CanvasRenderingContext2D, cWidth: number, cHeight: number) {
        if (!this.alive) return;

        if (this.invincible > 0) {
          drawCtx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
        }

        drawCtx.shadowBlur = 15;
        drawCtx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;

        // Skin-specific colors
        let bodyColor = `hsl(${this.hue}, 100%, 50%)`;
        let bellyColor = `hsl(${this.hue}, 80%, 75%)`;
        let scaleColor = `hsla(${this.hue}, 100%, 35%, 0.6)`;
        
        if (this.skin === 'neon') {
          drawCtx.shadowBlur = 30;
          bodyColor = `hsl(${this.hue}, 100%, 60%)`;
        } else if (this.skin === 'galaxy') {
          bodyColor = `hsl(${(this.hue + Date.now() / 50) % 360}, 100%, 50%)`;
          drawCtx.shadowBlur = 20;
        } else if (this.skin === 'fire') {
          bodyColor = `hsl(${20 + Math.sin(Date.now() / 100) * 20}, 100%, 50%)`;
          drawCtx.shadowBlur = 25;
          drawCtx.shadowColor = '#ff4400';
        } else if (this.skin === 'ice') {
          bodyColor = `hsl(${180 + Math.sin(Date.now() / 100) * 20}, 100%, 70%)`;
          drawCtx.shadowBlur = 25;
          drawCtx.shadowColor = '#00ffff';
        }

        // Draw body as connected segments first (more efficient)
        drawCtx.strokeStyle = bodyColor;
        drawCtx.lineWidth = 18;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        
        // Outer glow layer
        drawCtx.shadowBlur = 25;
        drawCtx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        
        drawCtx.beginPath();
        for (let i = this.segments.length - 1; i >= 0; i--) {
          const seg = this.segments[i];
          const screenX = seg.x - camX + cWidth / 2;
          const screenY = seg.y - camY + cHeight / 2;
          
          if (i === this.segments.length - 1) {
            drawCtx.moveTo(screenX, screenY);
          } else {
            drawCtx.lineTo(screenX, screenY);
          }
        }
        drawCtx.stroke();
        
        // Belly stripe
        drawCtx.shadowBlur = 10;
        drawCtx.strokeStyle = bellyColor;
        drawCtx.lineWidth = 8;
        drawCtx.beginPath();
        for (let i = this.segments.length - 1; i >= 0; i--) {
          const seg = this.segments[i];
          const screenX = seg.x - camX + cWidth / 2;
          const screenY = seg.y - camY + cHeight / 2;
          
          if (i === this.segments.length - 1) {
            drawCtx.moveTo(screenX, screenY);
          } else {
            drawCtx.lineTo(screenX, screenY);
          }
        }
        drawCtx.stroke();
        
        // Scale pattern (every 3rd segment for performance)
        drawCtx.shadowBlur = 5;
        for (let i = this.segments.length - 1; i >= 1; i -= 3) {
          const seg = this.segments[i];
          const screenX = seg.x - camX + cWidth / 2;
          const screenY = seg.y - camY + cHeight / 2;
          
          drawCtx.fillStyle = scaleColor;
          drawCtx.beginPath();
          drawCtx.arc(screenX, screenY, 6, 0, Math.PI * 2);
          drawCtx.fill();
        }
        
        // Draw head last
        const seg = this.segments[0];
        const screenX = seg.x - camX + cWidth / 2;
        const screenY = seg.y - camY + cHeight / 2;

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
    const player = new Snake(WORLD_SIZE / 2, WORLD_SIZE / 2, true, `👑 ${playerName}`, selectedHue, selectedSkin);
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

      // Dark background with subtle gradient
      const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height));
      bgGrad.addColorStop(0, '#0a0a0a');
      bgGrad.addColorStop(1, '#000000');
      
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!player.alive) {
        isRunning = false;
        
        // Lower music volume
        if (audioRef.current) {
          audioRef.current.volume = 0.1;
        }
        
        onGameOverRef.current(player.length * 10);
        return;
      }

      const camX = player.segments[0].x;
      const camY = player.segments[0].y;

      // Animated neon grid
      ctx.strokeStyle = `rgba(57, 255, 20, ${0.08 + Math.sin(Date.now() / 1000) * 0.02})`;
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
      
      // Grid intersections glow
      ctx.fillStyle = 'rgba(57, 255, 20, 0.15)';
      for (let x = -offsetX; x < canvas.width; x += gridSize) {
        for (let y = -offsetY; y < canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw pellets with enhanced glow
      pellets.forEach(p => {
        const screenX = p.x - camX + canvas.width / 2;
        const screenY = p.y - camY + canvas.height / 2;

        if (screenX < -20 || screenX > canvas.width + 20 || 
            screenY < -20 || screenY > canvas.height + 20) return;

        const time = Date.now() / 1000;
        const pulse = 1 + Math.sin(time * 3 + p.x + p.y) * 0.2;

        // Outer glow ring
        const glowGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 16 * pulse);
        glowGrad.addColorStop(0, `hsla(${p.hue}, 100%, 50%, 0.8)`);
        glowGrad.addColorStop(0.5, `hsla(${p.hue}, 100%, 50%, 0.3)`);
        glowGrad.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 16 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Main pellet body with gradient
        const bodyGrad = ctx.createRadialGradient(screenX - 2, screenY - 2, 0, screenX, screenY, p.radius * 1.5);
        bodyGrad.addColorStop(0, `hsl(${p.hue}, 100%, 80%)`);
        bodyGrad.addColorStop(0.5, `hsl(${p.hue}, 100%, 60%)`);
        bodyGrad.addColorStop(1, `hsl(${p.hue}, 100%, 40%)`);
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = `hsl(${p.hue}, 100%, 90%)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Sparkle highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(screenX - 1.5, screenY - 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Rotating ring effect
        ctx.strokeStyle = `hsla(${p.hue}, 100%, 70%, 0.4)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const ringAngle = time * 2 + p.x;
        ctx.arc(screenX, screenY, p.radius * 2, ringAngle, ringAngle + Math.PI);
        ctx.stroke();
      });

      // Update and draw snakes
      snakes.forEach(snake => {
        if (snake.isPlayer) {
          snake.update(camX + mouseX - canvas.width / 2, camY + mouseY - canvas.height / 2);
        } else {
          snake.update();
        }
        snake.draw(camX, camY, ctx, canvas.width, canvas.height);
      });
      
      // Update and draw particles
      particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life--;
        
        const screenX = p.x - camX + canvas.width / 2;
        const screenY = p.y - camY + canvas.height / 2;
        
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, ${alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        return p.life > 0;
      });

      // Check collisions
      snakes.forEach(snake => {
        if (!snake.alive) return;
        
        if (snake.checkCollision(snakes)) {
          snake.alive = false;
          if (snake.isPlayer) {
            playDeathSound();
            // Play FNAF bite sound
            if (biteAudioRef.current) {
              biteAudioRef.current.currentTime = 0;
              biteAudioRef.current.play().catch(e => console.log('Bite sound error:', e));
            }
          }
          // Explosion particles
          for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            particles.push({
              x: snake.segments[0].x,
              y: snake.segments[0].y,
              vx: Math.cos(angle) * (2 + Math.random() * 3),
              vy: Math.sin(angle) * (2 + Math.random() * 3),
              hue: snake.hue,
              life: 60,
              maxLife: 60,
            });
          }
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
            if (snake.isPlayer) {
              playEatSound();
              pelletsEaten++;
              
              // Check glutton achievement
              const glutton = checkAchievement(achievements, 'glutton', pelletsEaten);
              if (glutton) onAchievementUnlock(glutton);
            }
            // Eat particles
            for (let i = 0; i < 8; i++) {
              const angle = Math.random() * Math.PI * 2;
              particles.push({
                x: p.x,
                y: p.y,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                hue: p.hue,
                life: 30,
                maxLife: 30,
              });
            }
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
        const currentScore = player.length * 10;
        updateUIRef.current(currentScore, rank, aliveSnakes.length);
        
        // Check score achievements
        const firstBlood = checkAchievement(achievements, 'first_blood', currentScore);
        if (firstBlood) onAchievementUnlock(firstBlood);
        
        const growingStrong = checkAchievement(achievements, 'growing_strong', currentScore);
        if (growingStrong) onAchievementUnlock(growingStrong);
        
        const beastMode = checkAchievement(achievements, 'beast_mode', currentScore);
        if (beastMode) onAchievementUnlock(beastMode);
        
        const unstoppable = checkAchievement(achievements, 'unstoppable', currentScore);
        if (unstoppable) onAchievementUnlock(unstoppable);
        
        const legend = checkAchievement(achievements, 'legend', currentScore);
        if (legend) onAchievementUnlock(legend);
        
        // Check survivor achievement
        const survivalTime = Math.floor((Date.now() - startTime) / 1000);
        const survivor = checkAchievement(achievements, 'survivor', survivalTime);
        if (survivor) onAchievementUnlock(survivor);
        
        const top = aliveSnakes.sort((a, b) => b.length - a.length).slice(0, 10).map(s => ({
          name: s.name,
          length: s.length * 10,
          isPlayer: s.isPlayer
        }));
        updateLeaderboardRef.current(top);
      }
      
      // Draw minimap
      const minimapSize = 150;
      const minimapX = canvas.width - minimapSize - 20;
      const minimapY = canvas.height - minimapSize - 20;
      const minimapScale = minimapSize / WORLD_SIZE;
      
      // Minimap background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
      
      // Draw snakes on minimap
      aliveSnakes.forEach(snake => {
        const head = snake.segments[0];
        const mapX = minimapX + head.x * minimapScale;
        const mapY = minimapY + head.y * minimapScale;
        
        ctx.fillStyle = snake.isPlayer ? '#39ff14' : `hsl(${snake.hue}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(mapX, mapY, snake.isPlayer ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    // Cleanup
    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      // Stop music and reset volume for next game
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.volume = 0.3;
        audioRef.current = null;
      }
      
      if (biteAudioRef.current) {
        biteAudioRef.current.pause();
        biteAudioRef.current = null;
      }
    };
  }, [playerName, selectedHue, selectedSkin, gameMode]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full block z-0"
      style={{ background: 'radial-gradient(circle, #1a1a1a 0%, #0d0d0d 100%)' }}
    />
  );
}
