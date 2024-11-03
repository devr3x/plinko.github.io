const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dropBtn = document.getElementById('dropBtn');
const balanceDisplay = document.getElementById('balance');
const timerDisplay = document.getElementById('timer');
const betInput = document.getElementById('betAmount');
const ballCountInput = document.getElementById('ballCount');

function resizeCanvas() {
    const isMobile = window.innerWidth < 768;
    canvas.width = isMobile ? window.innerWidth : 1200;
    canvas.height = isMobile ? window.innerHeight * 0.8 : 900;
}

resizeCanvas();

// Game constants
let balance = 1000;
let lastFreeMoneyTime = Date.now();
const FREE_MONEY_COOLDOWN = 3600000;
const FREE_MONEY_AMOUNT = 1000;
const MAX_BALLS = 50;
const BALL_RADIUS = 10;
const PEG_RADIUS = 5;
const ROWS = 14;
const COLS = 18;
const MULTIPLIERS = [100, 25, 10, 5, 2, 1, 0.5, 0.5, 0.5, 0.2, 0.5, 0.5, 0.5, 1, 2, 5, 10, 25, 100];
const GRAVITY = 0.5;
const BOUNCE_VARIATION = 0.3;
const MAX_VELOCITY = 15;
const MAX_PARTICLES = 500;
const MAX_POPUPS = 20;

// Visual style constants
const SLOT_COLORS = {
    x200: ['#FF4D4D', '#FF6B6B'],
    x100: ['#FF6B6B', '#FF8E8E'],
    x25: ['#4ECDC4', '#45B7AF'],
    default: ['#2C3E50', '#34495E']
};

const ANIMATIONS = {
    x200: {
        colors: ['#FF4D4D', '#FF6B6B', '#FF8E8E'],
        particles: 60,
        duration: 2500,
        spread: 360
    },
    x100: {
        colors: ['#FFD700', '#FFA500', '#FF4500'],
        particles: 50,
        duration: 2000,
        spread: 360
    },
    x25: {
        colors: ['#4ECDC4', '#45B7AF', '#2FB4AE'],
        particles: 30,
        duration: 1500,
        spread: 270
    }
};

// Game state
let balls = [];
let particles = [];
let pegs = [];
let slots = [];
let popups = [];
let isProcessing = false;

function initializeGame() {
    // Clear existing arrays
    pegs = [];
    slots = [];

    // Initialize pegs
    const PEG_SPACING_X = canvas.width / (COLS + 1);
    const PEG_SPACING_Y = (canvas.height - 150) / (ROWS + 1);

    for (let row = 0; row < ROWS; row++) {
        const currentCols = row % 2 === 0 ? COLS : COLS - 1;
        const offsetX = row % 2 === 0 ? 0 : PEG_SPACING_X / 2;
        
        for (let col = 0; col < currentCols; col++) {
            pegs.push({
                x: offsetX + PEG_SPACING_X * (col + 1),
                y: PEG_SPACING_Y * (row + 1),
                glow: 0
            });
        }
    }

    // Initialize slots
    for (let i = 0; i < MULTIPLIERS.length; i++) {
        slots.push({
            x: (i + 0.5) * (canvas.width / MULTIPLIERS.length),
            y: canvas.height - 50,
            multiplier: MULTIPLIERS[i],
            width: (canvas.width / MULTIPLIERS.length) - 10,
            glow: 0
        });
    }
}

initializeGame();

function getSlotStyle(multiplier) {
    if (multiplier >= 200) return SLOT_COLORS.x200;
    if (multiplier >= 100) return SLOT_COLORS.x100;
    if (multiplier >= 25) return SLOT_COLORS.x25;
    return SLOT_COLORS.default;
}
function createParticles(x, y, color, amount = 10) {
    if (particles.length > MAX_PARTICLES) {
        particles.splice(0, amount);
    }
    
    for (let i = 0; i < amount; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            color,
            size: 3 + Math.random() * 3
        });
    }
}

function createSpecialWinEffect(ball, multiplier) {
    const config = multiplier >= 200 ? ANIMATIONS.x200 : 
                  multiplier >= 100 ? ANIMATIONS.x100 : ANIMATIONS.x25;
    
    for (let i = 0; i < config.particles; i++) {
        const angle = (i / config.particles) * config.spread * Math.PI / 180;
        const speed = 2 + Math.random() * 3;
        
        if (particles.length <= MAX_PARTICLES) {
            particles.push({
                x: ball.x,
                y: ball.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: config.colors[Math.floor(Math.random() * config.colors.length)],
                size: 3 + Math.random() * 3
            });
        }
    }
    
    const shockwave = document.createElement('div');
    shockwave.className = multiplier >= 200 ? 'shockwave-200' :
                         multiplier >= 100 ? 'shockwave-100' : 'shockwave-25';
    shockwave.style.left = `${ball.x}px`;
    shockwave.style.top = `${ball.y}px`;
    document.body.appendChild(shockwave);
    
    setTimeout(() => {
        if (shockwave.parentNode) {
            shockwave.remove();
        }
    }, config.duration);
}

function createJackpotEffect(amount) {
    const jackpotDiv = document.createElement('div');
    jackpotDiv.className = 'jackpot-alert';
    jackpotDiv.textContent = `JACKPOT! $${amount}`;
    document.body.appendChild(jackpotDiv);
    
    setTimeout(() => {
        if (jackpotDiv.parentNode) {
            jackpotDiv.remove();
        }
    }, 2000);
}

function createPopup(text, x, y) {
    if (popups.length > MAX_POPUPS) {
        popups.shift();
    }
    
    popups.push({
        text,
        x,
        y,
        life: 1,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`
    });
}

function cleanup() {
    particles = particles.filter(p => p.life > 0);
    popups = popups.filter(p => p.life > 0);
    balls = balls.filter(ball => ball.y < canvas.height + 100);
    
    if (balls.length === 0) {
        isProcessing = false;
    }

    pegs.forEach(peg => {
        peg.glow *= 0.95;
    });
}

function drawPegs() {
    pegs.forEach(peg => {
        const gradient = ctx.createRadialGradient(
            peg.x, peg.y, 0,
            peg.x, peg.y, PEG_RADIUS * 3
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.5 + peg.glow})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(peg.x - PEG_RADIUS * 3, peg.y - PEG_RADIUS * 3, PEG_RADIUS * 6, PEG_RADIUS * 6);

        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });
}
function drawSlots() {
    slots.forEach(slot => {
        const colors = getSlotStyle(slot.multiplier);
        const width = slot.width * 0.95;
        
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.roundRect(slot.x - width/2, slot.y - 25, width, 50, 8);
        ctx.fill();
        
        const fontSize = slot.multiplier >= 200 ? 26 :
                        slot.multiplier >= 100 ? 24 : 
                        slot.multiplier >= 25 ? 25 : 22;
        
        ctx.font = `bold ${fontSize}px Inter, Arial`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${slot.multiplier}x`, slot.x, slot.y);
    });
}

function updateBalls() {
    const remainingBalls = [];
    
    for (const ball of balls) {
        ball.vy += GRAVITY;
        
        // Limit maximum velocity
        ball.vx = Math.max(Math.min(ball.vx, MAX_VELOCITY), -MAX_VELOCITY);
        ball.vy = Math.max(Math.min(ball.vy, MAX_VELOCITY), -MAX_VELOCITY);
        
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Bounce off walls
        if (ball.x < BALL_RADIUS) {
            ball.x = BALL_RADIUS;
            ball.vx *= -0.7;
        } else if (ball.x > canvas.width - BALL_RADIUS) {
            ball.x = canvas.width - BALL_RADIUS;
            ball.vx *= -0.7;
        }
        
        if (ball.y > canvas.height - BALL_RADIUS) {
            if (!isProcessing) {
                handleBallLanding(ball);
            }
            continue;
        }
        
        handleCollisions(ball);
        remainingBalls.push(ball);
    }
    
    balls = remainingBalls;
}

function handleBallLanding(ball) {
    isProcessing = true;
    const slot = slots.find(s => Math.abs(s.x - ball.x) < s.width/2);
    if (slot) {
        const winAmount = Math.floor(ball.bet * slot.multiplier);
        balance += winAmount;
        balanceDisplay.textContent = balance;
        
        requestAnimationFrame(() => {
            if (slot.multiplier >= 200) {
                createSpecialWinEffect(ball, 200);
                createJackpotEffect(winAmount);
            } else if (slot.multiplier >= 100) {
                createSpecialWinEffect(ball, 100);
                createJackpotEffect(winAmount);
            } else if (slot.multiplier >= 25) {
                createSpecialWinEffect(ball, 25);
            }
            createPopup(`$${winAmount}!`, ball.x, ball.y - 50);
            isProcessing = false;
        });
    } else {
        isProcessing = false;
    }
}

function handleCollisions(ball) {
    ball.trail = ball.trail || [];
    ball.trail.push({x: ball.x, y: ball.y});
    if (ball.trail.length > 10) ball.trail.shift();

    const nearbyPegs = pegs.filter(peg => 
        Math.abs(peg.x - ball.x) < 50 && 
        Math.abs(peg.y - ball.y) < 50
    );

    nearbyPegs.forEach(peg => {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < BALL_RADIUS + PEG_RADIUS) {
            peg.glow = 0.5;
            const angle = Math.atan2(dy, dx);
            ball.vx = Math.cos(angle) * 4 * (1 + Math.random() * BOUNCE_VARIATION);
            ball.vy = Math.sin(angle) * 4 * (1 + Math.random() * BOUNCE_VARIATION);
            ball.vx += (Math.random() - 0.5) * 2;
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawPegs();
    drawSlots();

    // Draw balls and trails
    balls.forEach(ball => {
        if (ball.trail) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ball.trail.forEach((pos, i) => {
                ctx.lineWidth = i / ball.trail.length * 5;
                if (i === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();
        }

        const gradient = ctx.createRadialGradient(
            ball.x - 3, ball.y - 3, 0,
            ball.x, ball.y, BALL_RADIUS
        );
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ff0');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw particles and popups
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;
        
        if (particle.life > 0) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(${particle.color}, ${particle.life})`;
            ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    popups.forEach(popup => {
        if (popup.life > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${popup.life})`;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(popup.text, popup.x, popup.y);
            popup.y -= 2;
            popup.life -= 0.02;
        }
    });
}
function updateGameState() {
    requestAnimationFrame(() => {
        cleanup();
        updateBalls();
        draw();
        updateGameState();
    });
}

function dropBalls() {
    const betAmount = parseInt(betInput.value);
    const ballCount = Math.min(parseInt(ballCountInput.value), MAX_BALLS);
    const totalCost = betAmount * ballCount;

    if (betAmount >= 20 && balance >= totalCost) {
        balance -= totalCost;
        balanceDisplay.textContent = balance;

        const dropWidth = Math.min(canvas.width * 0.3, 200);
        for (let i = 0; i < ballCount; i++) {
            setTimeout(() => {
                balls.push({
                    x: canvas.width / 2 + (Math.random() - 0.5) * dropWidth,
                    y: 0,
                    vx: (Math.random() - 0.5) * 2,
                    vy: 0,
                    bet: betAmount,
                    trail: []
                });
            }, i * 100);
        }
    }
}

function updateTimer() {
    const now = Date.now();
    const timeLeft = Math.max(0, FREE_MONEY_COOLDOWN - (now - lastFreeMoneyTime));
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft === 0) {
        balance += FREE_MONEY_AMOUNT;
        balanceDisplay.textContent = balance;
        lastFreeMoneyTime = now;
        createPopup(`+$${FREE_MONEY_AMOUNT} FREE!`, canvas.width/2, canvas.height/2);
    }
}

// Event Listeners
window.addEventListener('resize', () => {
    resizeCanvas();
    initializeGame();
});

document.addEventListener('DOMContentLoaded', () => {
    const closeAdBtn = document.querySelector('.close-ad');
    const adBanner = document.querySelector('.ad-banner');
    
    if (closeAdBtn && adBanner) {
        closeAdBtn.addEventListener('click', () => {
            adBanner.style.transform = 'translate(-50%, 100%)';
        });
    }
});

ballCountInput.addEventListener('change', () => {
    if (parseInt(ballCountInput.value) > MAX_BALLS) {
        ballCountInput.value = MAX_BALLS;
    }
    if (parseInt(ballCountInput.value) < 1) {
        ballCountInput.value = 1;
    }
});

betInput.addEventListener('change', () => {
    if (parseInt(betInput.value) < 20) {
        betInput.value = 20;
    }
});

dropBtn.addEventListener('click', dropBalls);

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
});

// Start the game
updateGameState();
setInterval(updateTimer, 1000);
