class WaveformVisualizer {
    constructor(canvas, audioProcessor, beatDetector) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioProcessor = audioProcessor;
        this.beatDetector = beatDetector;
        
        this.isActive = false;
        this.animationId = null;
        
        
        this.sensitivity = 1;
        this.waveColor = 'cyan';
        this.lineWidth = 2;
        
        
        this.colorHue = 180;
        this.beatIntensity = 0;
        this.amplitude = 1;
        this.offset = 0;
        
        
        this.waveHistory = [];
        this.maxHistory = 5;
        
        this.resize();
        this.setupBeatCallbacks();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupBeatCallbacks() {
        if (this.beatDetector) {
            this.beatDetector.onBeat = (beatData) => {
                this.beatIntensity = Math.min(1, beatData.intensity);
                this.amplitude = 1 + beatData.intensity * 0.5;
                
                
                this.animateBeatIntensity();
                this.animateAmplitude();
            };
        }
    }

    
    animateBeatIntensity() {
        const startTime = performance.now();
        const startValue = this.beatIntensity;
        const duration = 500; 

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

    
    animateAmplitude() {
        const startTime = performance.now();
        const startValue = this.amplitude;
        const targetValue = 1;
        const duration = 800; 

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            
            const elasticProgress = progress === 0 ? 0 : 
                progress === 1 ? 1 : 
                Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
            
            this.amplitude = startValue + (targetValue - startValue) * elasticProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.amplitude = 1;
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
        const timeDomainData = this.audioProcessor.getTimeDomainData();
        if (!timeDomainData) return;

        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        
        this.waveHistory.push([...timeDomainData]);
        if (this.waveHistory.length > this.maxHistory) {
            this.waveHistory.shift();
        }

        
        this.drawWaveformTrails();

        
        this.drawWaveform(timeDomainData, 1.0);

        
        this.drawFrequencyOverlay();

        
        this.colorHue = (this.colorHue + 0.5) % 360;
        this.offset += 0.02;
    }

    drawWaveformTrails() {
        for (let i = 0; i < this.waveHistory.length - 1; i++) {
            const alpha = (i + 1) / this.waveHistory.length * 0.3;
            this.drawWaveform(this.waveHistory[i], alpha);
        }
    }

    drawWaveform(data, alpha = 1.0) {
        const sliceWidth = this.canvas.width / data.length;
        const centerY = this.canvas.height / 2;
        
        
        const hue = (this.colorHue + this.beatIntensity * 60) % 360;
        const saturation = 70 + this.beatIntensity * 30;
        const lightness = 50 + this.beatIntensity * 30;
        
        
        this.ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
        this.ctx.lineWidth = this.lineWidth + this.beatIntensity * 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        
        if (this.beatIntensity > 0.1 && alpha > 0.8) {
            this.ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            this.ctx.shadowBlur = 20 * this.beatIntensity;
        }
        
        
        this.ctx.beginPath();
        
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            
            const normalized = (data[i] - 128) / 128;
            
            
            const y = centerY + (normalized * centerY * 0.8 * this.sensitivity * this.amplitude);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        
        if (alpha > 0.8) {
            this.drawWaveformFill(data);
        }
    }

    drawWaveformFill(data) {
        const sliceWidth = this.canvas.width / data.length;
        const centerY = this.canvas.height / 2;
        
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, `hsla(${this.colorHue}, 70%, 60%, 0.1)`);
        gradient.addColorStop(0.5, `hsla(${this.colorHue}, 70%, 50%, 0.2)`);
        gradient.addColorStop(1, `hsla(${this.colorHue}, 70%, 40%, 0.1)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        
        
        this.ctx.moveTo(0, this.canvas.height);
        
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            const normalized = (data[i] - 128) / 128;
            const y = centerY + (normalized * centerY * 0.8 * this.sensitivity * this.amplitude);
            this.ctx.lineTo(x, y);
            x += sliceWidth;
        }
        
        
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawFrequencyOverlay() {
        const frequencyData = this.audioProcessor.getFrequencyData();
        if (!frequencyData) return;

        
        const barWidth = this.canvas.width / 64;
        for (let i = 0; i < 64; i++) {
            const value = frequencyData[i * 4] || 0; 
            const height = (value / 255) * this.canvas.height * 0.3;
            
            const x = i * barWidth;
            const y = this.canvas.height - height;
            
            const alpha = 0.1 + (value / 255) * 0.2;
            const hue = (this.colorHue + i * 2) % 360;
            
            this.ctx.fillStyle = `hsla(${hue}, 60%, 50%, ${alpha})`;
            this.ctx.fillRect(x, y, barWidth * 0.8, height);
        }
    }

    drawParticles() {
        const frequencyData = this.audioProcessor.getFrequencyData();
        if (!frequencyData) return;

        
        for (let i = 0; i < 32; i++) {
            const value = frequencyData[i * 8] || 0;
            if (value > 100) {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                const size = (value / 255) * 5 + 1;
                
                const hue = (this.colorHue + i * 10) % 360;
                const alpha = (value / 255) * 0.6;
                
                this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.waveHistory = [];
    }

    setSensitivity(sensitivity) {
        this.sensitivity = sensitivity;
    }

    setLineWidth(width) {
        this.lineWidth = Math.max(1, Math.min(10, width));
    }

    setMaxHistory(maxHistory) {
        this.maxHistory = Math.max(1, Math.min(20, maxHistory));
    }
}


window.WaveformVisualizer = WaveformVisualizer;