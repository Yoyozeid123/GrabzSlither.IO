import { useEffect, useRef, useState } from "react";
import { getAchievements, checkAchievement } from "@/lib/achievements";

interface GameCanvasProps {
  playerName: string;
  selectedHue: number;
  selectedSkin: string;
  gameMode: string;
  onGameOver: (score: number, stats: { kills: number; timeSurvived: number; pelletsEaten: number }) => void;
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
      const savedVolume = localStorage.getItem('musicVolume');
      audioRef.current.volume = savedVolume ? parseInt(savedVolume) / 100 : 0.3;
      audioRef.current.play().catch(e => console.log('Audio autoplay blocked:', e));
    }
    
    // Listen for volume changes
    const handleMusicVolumeChange = (e: any) => {
      if (audioRef.current) {
        audioRef.current.volume = e.detail;
      }
    };
    window.addEventListener('musicVolumeChange', handleMusicVolumeChange);
    
    // Preload bite sound
    if (!biteAudioRef.current) {
      biteAudioRef.current = new Audio('/bite-sound.mp3');
      const savedSfx = localStorage.getItem('sfxVolume');
      biteAudioRef.current.volume = savedSfx ? parseInt(savedSfx) / 100 : 0.5;
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
    const PELLET_COUNT = 600; // Reduced from 800
    const BOT_COUNT = 12; // Reduced from 15
    const snakeEmojis = ['🐍', '🐉', '🦎', '🐊', '🦖', '🐲', '🪱', '🦕'];

    // Game State
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let animationFrameId: number;
    let isRunning = true;
    let isBoosting = false;
    let screenShake = 0;
    let deathFlash = 0;
    
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
    
    // Trail system
    interface Trail {
      x: number;
      y: number;
      hue: number;
      life: number;
      maxLife: number;
      size: number;
    }
    let trails: Trail[] = [];
    
    // Sound effects (using Web Audio API for simple sounds)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const getSfxVolume = () => {
      const saved = localStorage.getItem('sfxVolume');
      return saved ? parseInt(saved) / 100 : 0.5;
    };
    
    const playEatSound = () => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1 * getSfxVolume(), audioContext.currentTime);
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
      gain.gain.setValueAtTime(0.2 * getSfxVolume(), audioContext.currentTime);
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
      gain.gain.setValueAtTime(0.05 * getSfxVolume(), audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.15);
    };
    
    let lastBoostSound = 0;
    
    // Achievement tracking
    let achievements = getAchievements();
    let boostCount = 0;
    let pelletsEaten = 0;
    let killCount = 0;
    const startTime = Date.now();
    
    // Kill feed
    interface KillEvent {
      killer: string;
      victim: string;
      time: number;
    }
    let killFeed: KillEvent[] = [];

    // Track mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    // Track touch (mobile)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
        e.preventDefault();
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
        e.preventDefault();
      }
      
      // Two finger touch = boost
      if (e.touches.length >= 2) {
        isBoosting = true;
      }
    };
    
    // Mobile boost (double tap)
    let lastTapTime = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTapTime < 300 && e.touches.length === 0) {
        // Double tap detected - toggle boost
        isBoosting = !isBoosting;
      }
      lastTapTime = now;
      
      // Stop boost when lifting all fingers (unless toggled on)
      if (e.touches.length === 0 && now - lastTapTime > 300) {
        // Only stop if not double-tap toggled
      }
      
      e.preventDefault();
    };
    
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Boost controls (keyboard)
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
          if (Math.random() < 0.3) { // Reduced from 0.5
            particles.push({
              x: head.x,
              y: head.y,
              vx: -Math.cos(this.angle) * 2 + (Math.random() - 0.5),
              vy: -Math.sin(this.angle) * 2 + (Math.random() - 0.5),
              hue: this.hue,
              life: 15, // Reduced from 20
              maxLife: 15,
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
        } else if (this.skin === 'toxic') {
          bodyColor = `hsl(${120 + Math.sin(Date.now() / 80) * 30}, 100%, 45%)`;
          drawCtx.shadowBlur = 30;
          drawCtx.shadowColor = '#00ff00';
        } else if (this.skin === 'electric') {
          bodyColor = `hsl(${200 + Math.sin(Date.now() / 60) * 40}, 100%, 60%)`;
          drawCtx.shadowBlur = 35;
          drawCtx.shadowColor = '#00ffff';
        } else if (this.skin === 'shadow') {
          bodyColor = `hsl(${this.hue}, 20%, 20%)`;
          bellyColor = `hsl(${this.hue}, 30%, 30%)`;
          drawCtx.shadowBlur = 40;
          drawCtx.shadowColor = '#000000';
        } else if (this.skin === 'rainbow') {
          const rainbowHue = (Date.now() / 10) % 360;
          bodyColor = `hsl(${rainbowHue}, 100%, 50%)`;
          drawCtx.shadowBlur = 25;
        } else if (this.skin === 'gold') {
          bodyColor = `hsl(${45 + Math.sin(Date.now() / 100) * 10}, 100%, 50%)`;
          bellyColor = `hsl(${45}, 100%, 70%)`;
          drawCtx.shadowBlur = 30;
          drawCtx.shadowColor = '#ffd700';
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
    
    class PowerUp {
      x: number;
      y: number;
      type: 'speed' | 'shield' | 'magnet';
      radius: number;
      spawnTime: number;

      constructor(x: number, y: number, type: 'speed' | 'shield' | 'magnet') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 10;
        this.spawnTime = Date.now();
      }

      draw(camX: number, camY: number, drawCtx: CanvasRenderingContext2D, cWidth: number, cHeight: number) {
        const screenX = this.x - camX + cWidth / 2;
        const screenY = this.y - camY + cHeight / 2;

        if (screenX < -30 || screenX > cWidth + 30 || 
            screenY < -30 || screenY > cHeight + 30) return;

        const time = Date.now() / 1000;
        const pulse = 1 + Math.sin(time * 4) * 0.2;

        // Glow
        const color = this.type === 'speed' ? '#ffff00' : this.type === 'shield' ? '#00ffff' : '#ff00ff';
        drawCtx.shadowBlur = 20;
        drawCtx.shadowColor = color;
        
        // Icon background
        drawCtx.fillStyle = color;
        drawCtx.beginPath();
        drawCtx.arc(screenX, screenY, this.radius * pulse, 0, Math.PI * 2);
        drawCtx.fill();
        
        // Icon
        drawCtx.shadowBlur = 0;
        drawCtx.fillStyle = '#000';
        drawCtx.font = 'bold 16px Arial';
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        const icon = this.type === 'speed' ? '⚡' : this.type === 'shield' ? '🛡️' : '🧲';
        drawCtx.fillText(icon, screenX, screenY);
      }
    }

    // Initialize Game Entities
    const player = new Snake(WORLD_SIZE / 2, WORLD_SIZE / 2, true, `👑 ${playerName}`, selectedHue, selectedSkin);
    let snakes: Snake[] = [player];
    let pellets: Pellet[] = [];
    let powerUps: PowerUp[] = [];

    for (let i = 0; i < BOT_COUNT; i++) {
      snakes.push(new Snake(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE, false));
    }
    
    for (let i = 0; i < PELLET_COUNT; i++) {
      pellets.push(new Pellet());
    }
    
    // Spawn initial power-ups
    for (let i = 0; i < 3; i++) {
      const types: ('speed' | 'shield' | 'magnet')[] = ['speed', 'shield', 'magnet'];
      powerUps.push(new PowerUp(
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        types[Math.floor(Math.random() * types.length)]
      ));
    }

    // Main Game Loop
    const gameLoop = () => {
      if (!isRunning || !ctx || !canvas) return;

      // Apply screen shake
      ctx.save();
      if (screenShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * screenShake,
          (Math.random() - 0.5) * screenShake
        );
        screenShake *= 0.9;
      }

      // Dark background with subtle gradient
      const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height));
      bgGrad.addColorStop(0, '#0a0a0a');
      bgGrad.addColorStop(1, '#000000');
      
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Death flash
      if (deathFlash > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${deathFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        deathFlash *= 0.85;
      }

      if (!player.alive) {
        isRunning = false;
        
        // Lower music volume
        if (audioRef.current) {
          audioRef.current.volume = 0.1;
        }
        
        ctx.restore();
        const timeSurvived = Math.floor((Date.now() - startTime) / 1000);
        onGameOverRef.current(player.length * 10, {
          kills: killCount,
          timeSurvived,
          pelletsEaten
        });
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
      
      // Background stars (static based on world position)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < 50; i++) {
        const starX = ((i * 137.5) % WORLD_SIZE - camX + canvas.width / 2) % canvas.width;
        const starY = ((i * 217.3) % WORLD_SIZE - camY + canvas.height / 2) % canvas.height;
        const size = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(starX, starY, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw pellets with enhanced glow
      pellets.forEach(p => {
        const screenX = p.x - camX + canvas.width / 2;
        const screenY = p.y - camY + canvas.height / 2;

        if (screenX < -20 || screenX > canvas.width + 20 || 
            screenY < -20 || screenY > canvas.height + 20) return;

        const time = Date.now() / 1000;
        const pulse = 1 + Math.sin(time * 3 + p.x + p.y) * 0.15; // Reduced pulse

        // Outer glow (simplified)
        const glowGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 12 * pulse);
        glowGrad.addColorStop(0, `hsla(${p.hue}, 100%, 50%, 0.6)`);
        glowGrad.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 12 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Main pellet body
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
        ctx.fillStyle = `hsl(${p.hue}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Sparkle highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(screenX - 1, screenY - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw power-ups
      powerUps.forEach(p => p.draw(camX, camY, ctx, canvas.width, canvas.height));

      // Update and draw snakes
      snakes.forEach(snake => {
        if (snake.isPlayer) {
          snake.update(camX + mouseX - canvas.width / 2, camY + mouseY - canvas.height / 2);
        } else {
          snake.update();
        }
        
        // Add trail
        if (snake.alive && Math.random() < 0.15) { // Reduced from 0.3
          const head = snake.segments[0];
          trails.push({
            x: head.x,
            y: head.y,
            hue: snake.hue,
            life: 20, // Reduced from 30
            maxLife: 20,
            size: 6, // Reduced from 8
          });
        }
        
        snake.draw(camX, camY, ctx, canvas.width, canvas.height);
      });
      
      // Update and draw trails
      trails = trails.filter(t => {
        t.life--;
        
        const screenX = t.x - camX + canvas.width / 2;
        const screenY = t.y - camY + canvas.height / 2;
        
        const alpha = (t.life / t.maxLife) * 0.4;
        const size = t.size * (t.life / t.maxLife);
        
        ctx.fillStyle = `hsla(${t.hue}, 100%, 50%, ${alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${t.hue}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        return t.life > 0;
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
          
          // Find who killed them
          const killer = snakes.find(s => {
            if (!s.alive || s === snake) return false;
            const head = snake.segments[0];
            for (let i = 10; i < s.segments.length; i++) {
              const seg = s.segments[i];
              const dist = Math.hypot(head.x - seg.x, head.y - seg.y);
              if (dist < 10) return true;
            }
            return false;
          });
          
          if (killer) {
            if (killer.isPlayer) killCount++;
            
            killFeed.unshift({
              killer: killer.name,
              victim: snake.name,
              time: Date.now(),
            });
            if (killFeed.length > 5) killFeed.pop();
          }
          
          if (snake.isPlayer) {
            playDeathSound();
            screenShake = 20;
            deathFlash = 0.6;
            // Play FNAF bite sound
            if (biteAudioRef.current) {
              biteAudioRef.current.currentTime = 0;
              biteAudioRef.current.play().catch(e => console.log('Bite sound error:', e));
            }
          }
          // Explosion particles
          for (let i = 0; i < 20; i++) { // Reduced from 30
            const angle = (Math.PI * 2 * i) / 20;
            particles.push({
              x: snake.segments[0].x,
              y: snake.segments[0].y,
              vx: Math.cos(angle) * (2 + Math.random() * 3),
              vy: Math.sin(angle) * (2 + Math.random() * 3),
              hue: snake.hue,
              life: 40, // Reduced from 60
              maxLife: 40,
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
            for (let i = 0; i < 5; i++) { // Reduced from 8
              const angle = Math.random() * Math.PI * 2;
              particles.push({
                x: p.x,
                y: p.y,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2,
                hue: p.hue,
                life: 20, // Reduced from 30
                maxLife: 20,
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
      
      // Collect power-ups
      if (player.alive) {
        const head = player.segments[0];
        powerUps = powerUps.filter(p => {
          const dist = Math.hypot(head.x - p.x, head.y - p.y);
          if (dist < 20) {
            // Apply power-up effect
            if (p.type === 'speed') {
              player.speed = 5; // Boost speed
              setTimeout(() => { player.speed = 3; }, 5000); // Reset after 5s
            } else if (p.type === 'shield') {
              player.invincible = 300; // 5 seconds of invincibility
            } else if (p.type === 'magnet') {
              // Attract nearby pellets
              pellets.forEach(pellet => {
                const dx = head.x - pellet.x;
                const dy = head.y - pellet.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 200) {
                  pellet.x += dx * 0.1;
                  pellet.y += dy * 0.1;
                }
              });
            }
            return false; // Remove power-up
          }
          return true;
        });
      }
      
      // Respawn power-ups (max 3)
      if (powerUps.length < 3 && Math.random() < 0.01) {
        const types: ('speed' | 'shield' | 'magnet')[] = ['speed', 'shield', 'magnet'];
        powerUps.push(new PowerUp(
          Math.random() * WORLD_SIZE,
          Math.random() * WORLD_SIZE,
          types[Math.floor(Math.random() * types.length)]
        ));
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
        
        const godMode = checkAchievement(achievements, 'god_mode', currentScore);
        if (godMode) onAchievementUnlock(godMode);
        
        // Check boost achievements
        const boostMaster = checkAchievement(achievements, 'boost_master', boostCount);
        if (boostMaster) onAchievementUnlock(boostMaster);
        
        // Check pellet achievements
        const feast = checkAchievement(achievements, 'feast', pelletsEaten);
        if (feast) onAchievementUnlock(feast);
        
        // Check survivor achievement
        const survivalTime = Math.floor((Date.now() - startTime) / 1000);
        const survivor = checkAchievement(achievements, 'survivor', survivalTime);
        if (survivor) onAchievementUnlock(survivor);
        
        const marathon = checkAchievement(achievements, 'marathon', survivalTime);
        if (marathon) onAchievementUnlock(marathon);
        
        // Check rank achievements
        if (rank <= 3) {
          const top3 = checkAchievement(achievements, 'top_3', 4 - rank);
          if (top3) onAchievementUnlock(top3);
        }
        
        if (rank === 1) {
          const champion = checkAchievement(achievements, 'champion', 1);
          if (champion) onAchievementUnlock(champion);
        }
        
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
      
      // Draw kill feed
      ctx.font = 'bold 14px "Rajdhani", sans-serif';
      ctx.textAlign = 'right';
      killFeed.forEach((kill, i) => {
        const age = Date.now() - kill.time;
        const alpha = Math.max(0, 1 - age / 5000);
        const y = 20 + i * 25;
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width - 320, y - 18, 300, 22);
        
        ctx.fillStyle = '#ff4444';
        ctx.fillText(kill.killer, canvas.width - 170, y);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText('eliminated', canvas.width - 100, y);
        
        ctx.fillStyle = '#888888';
        ctx.fillText(kill.victim, canvas.width - 20, y);
      });
      ctx.globalAlpha = 1;
      
      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    // Cleanup
    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
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
