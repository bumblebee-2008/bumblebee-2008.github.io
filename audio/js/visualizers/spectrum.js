class SpectrumVisualizer {
    constructor(canvas, audioProcessor, beatDetector) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioProcessor = audioProcessor;
        this.beatDetector = beatDetector;
        
        this.isActive = false;
        this.animationId = null;
        
        this.barWidth = 0;
        this.barSpacing = 2;
        this.numBars = 128;
        this.sensitivity = 1;
        
        this.colorHue = 0;
        this.beatColorBoost = 0;
        
        this.beatIntensity = 0;
        this.bassIntensity = 0;
        
        this.resize();
        this.setupBeatCallbacks();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.barWidth = (this.canvas.width - (this.numBars * this.barSpacing)) / this.numBars;
    }

    setupBeatCallbacks() {
        if (this.beatDetector) {
            this.beatDetector.onBeat = (beatData) => {
                if (beatData.type === 'bass') {
                    this.bassIntensity = Math.min(1, beatData.intensity * 2);
                    this.animateBassIntensity();
                }
                
                this.beatIntensity = Math.min(1, beatData.intensity);
                this.beatColorBoost = 50;
                this.animateBeatIntensity();
                this.animateBeatColorBoost();
            };
        }
    }

    animateBassIntensity() {
        const startTime = performance.now();
        const startValue = this.bassIntensity;
        const duration = 300;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            
            this.bassIntensity = startValue * (1 - easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.bassIntensity = 0;
            }
        };
        
        requestAnimationFrame(animate);
    }

    animateBeatIntensity() {
        const startTime = performance.now();
        const startValue = this.beatIntensity;
        const duration = 400;

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

    animateBeatColorBoost() {
        const startTime = performance.now();
        const startValue = this.beatColorBoost;
        const duration = 500;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            
            this.beatColorBoost = startValue * (1 - easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.beatColorBoost = 0;
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
        if (!frequencyData) {
            console.log('No frequency data available');
            return;
        }

        this.drawBackground();

        const dataStep = Math.floor(frequencyData.length / this.numBars);
        
        for (let i = 0; i < this.numBars; i++) {
            let value = 0;
            const startIndex = i * dataStep;
            const endIndex = Math.min(startIndex + dataStep, frequencyData.length);
            
            for (let j = startIndex; j < endIndex; j++) {
                value += frequencyData[j] || 0;
            }
            value = value / (endIndex - startIndex);
            
            value *= this.sensitivity;
            if (i < this.numBars * 0.2) {
                value *= (1 + this.bassIntensity * 0.5);
            }
            
            const barHeight = Math.max(2, (value / 255) * this.canvas.height * 0.8);
            
            const x = i * (this.barWidth + this.barSpacing);
            const y = this.canvas.height - barHeight;
            
            const hue = (this.colorHue + i * 2 + this.beatColorBoost) % 360;
            const saturation = 70 + this.beatIntensity * 30;
            const lightness = 50 + (value / 255) * 30 + this.beatIntensity * 20;
            
            this.drawBar(x, y, this.barWidth, barHeight, hue, saturation, lightness);
            
            this.drawReflection(x, this.canvas.height, this.barWidth, barHeight * 0.3, hue, saturation, lightness);
        }
        
        this.colorHue = (this.colorHue + 0.5) % 360;
    }

    drawBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, `hsla(${this.colorHue}, 20%, 5%, 0.1)`);
        gradient.addColorStop(1, `hsla(${(this.colorHue + 180) % 360}, 20%, 10%, 0.1)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBar(x, y, width, height, hue, saturation, lightness) {
        const gradient = this.ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`);
        gradient.addColorStop(0.7, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
        
        if (this.beatIntensity > 0.1) {
            this.ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            this.ctx.shadowBlur = 20 * this.beatIntensity;
            this.ctx.fillRect(x, y, width, height);
            this.ctx.shadowBlur = 0;
        }
    }

    drawReflection(x, y, width, height, hue, saturation, lightness) {
        const gradient = this.ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness - 30}%, 0.3)`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness - 30}%, 0)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, width, height);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setSensitivity(sensitivity) {
        this.sensitivity = sensitivity;
    }

    setNumBars(numBars) {
        this.numBars = Math.max(32, Math.min(256, numBars));
        this.barWidth = (this.canvas.width - (this.numBars * this.barSpacing)) / this.numBars;
    }
}

window.SpectrumVisualizer = SpectrumVisualizer;