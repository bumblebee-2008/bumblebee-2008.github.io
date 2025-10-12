class CircularVisualizer {
    constructor(canvas, audioProcessor, beatDetector) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioProcessor = audioProcessor;
        this.beatDetector = beatDetector;
        
        this.isActive = false;
        this.animationId = null;
        
        
        this.centerX = 0;
        this.centerY = 0;
        this.radius = 100;
        this.maxRadius = 200;
        this.numBars = 128;
        this.sensitivity = 1;
        
        
        this.colorHue = 0;
        this.beatIntensity = 0;
        this.pulseRadius = 0;
        this.rotation = 0;
        
        this.resize();
        this.setupBeatCallbacks();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.maxRadius = Math.min(this.canvas.width, this.canvas.height) * 0.3;
        this.radius = this.maxRadius * 0.3;
    }

    setupBeatCallbacks() {
        if (this.beatDetector) {
            this.beatDetector.onBeat = (beatData) => {
                this.beatIntensity = Math.min(1, beatData.intensity);
                this.pulseRadius = this.maxRadius * 0.2;
                
                this.animateBeatIntensity();
                this.animatePulseRadius();
            };
        }
    }

    
    animateBeatIntensity() {
        const startTime = performance.now();
        const startValue = this.beatIntensity;
        const duration = 600; 

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            
            this.beatIntensity = startValue * (1 - easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.beatIntensity = 0;
            }
        };
        
        requestAnimationFrame(animate);
    }

    
    animatePulseRadius() {
        const startTime = performance.now();
        const startValue = this.pulseRadius;
        const duration = 800; 

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            this.pulseRadius = startValue * (1 - easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.pulseRadius = 0;
            }
        };
        
        requestAnimationFrame(animate);
    }

    start() {
        this.isActive = true;
        this.animate();
    }

    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.clear();
    }

    animate() {
        if (!this.isActive) return;

        this.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    draw() {
        const frequencyData = this.audioProcessor.getFrequencyData();
        if (!frequencyData) return;

        
        this.drawBackground();

        
        if (this.pulseRadius > 0) {
            this.drawPulse();
        }

        
        const angleStep = (Math.PI * 2) / this.numBars;
        const dataStep = Math.floor(frequencyData.length / this.numBars);
        
        for (let i = 0; i < this.numBars; i++) {
            
            let value = 0;
            for (let j = 0; j < dataStep; j++) {
                value += frequencyData[i * dataStep + j];
            }
            value = value / dataStep;
            
            
            value *= this.sensitivity;
            
            
            const angle = i * angleStep + this.rotation;
            const barHeight = (value / 255) * this.maxRadius * 0.6;
            
            
            const innerX = this.centerX + Math.cos(angle) * this.radius;
            const innerY = this.centerY + Math.sin(angle) * this.radius;
            const outerX = this.centerX + Math.cos(angle) * (this.radius + barHeight);
            const outerY = this.centerY + Math.sin(angle) * (this.radius + barHeight);
            
            
            const hue = (this.colorHue + i * 3) % 360;
            const saturation = 70 + this.beatIntensity * 30;
            const lightness = 50 + (value / 255) * 30 + this.beatIntensity * 20;
            
            
            this.drawRadialBar(innerX, innerY, outerX, outerY, hue, saturation, lightness, value);
        }
        
        
        this.drawCenter();
        
        
        this.rotation += 0.005;
        this.colorHue = (this.colorHue + 0.5) % 360;
    }

    drawBackground() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.maxRadius * 2
        );
        gradient.addColorStop(0, `hsla(${this.colorHue}, 30%, 8%, 0.1)`);
        gradient.addColorStop(0.5, `hsla(${(this.colorHue + 120) % 360}, 30%, 5%, 0.1)`);
        gradient.addColorStop(1, `hsla(${(this.colorHue + 240) % 360}, 30%, 3%, 0.1)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawPulse() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.pulseRadius
        );
        gradient.addColorStop(0, `hsla(${this.colorHue}, 80%, 60%, 0.3)`);
        gradient.addColorStop(1, `hsla(${this.colorHue}, 80%, 60%, 0)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.pulseRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawRadialBar(x1, y1, x2, y2, hue, saturation, lightness, value) {
        
        this.ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        this.ctx.lineWidth = 3 + (value / 255) * 3;
        this.ctx.lineCap = 'round';
        
        
        if (this.beatIntensity > 0.1) {
            this.ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            this.ctx.shadowBlur = 15 * this.beatIntensity;
        }
        
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        
        
        this.ctx.shadowBlur = 0;
        
        
        this.ctx.fillStyle = `hsl(${(hue + 30) % 360}, ${saturation + 20}%, ${lightness + 10}%)`;
        this.ctx.beginPath();
        this.ctx.arc(x2, y2, 2 + (value / 255) * 2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawCenter() {
        
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.radius * 0.8
        );
        gradient.addColorStop(0, `hsla(${this.colorHue}, 80%, 60%, 0.8)`);
        gradient.addColorStop(0.7, `hsla(${this.colorHue}, 80%, 40%, 0.4)`);
        gradient.addColorStop(1, `hsla(${this.colorHue}, 80%, 20%, 0)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
        
        
        this.ctx.fillStyle = `hsl(${this.colorHue}, 60%, 30%)`;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        
        if (this.beatIntensity > 0.1) {
            this.ctx.fillStyle = `hsla(${this.colorHue}, 80%, 80%, ${this.beatIntensity * 0.5})`;
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, this.radius * 0.3 * (1 + this.beatIntensity), 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setSensitivity(sensitivity) {
        this.sensitivity = sensitivity;
    }

    setNumBars(numBars) {
        this.numBars = Math.max(32, Math.min(256, numBars));
    }
}


window.CircularVisualizer = CircularVisualizer;