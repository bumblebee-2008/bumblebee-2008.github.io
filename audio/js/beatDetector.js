class BeatDetector {
    constructor(audioProcessor) {
        this.audioProcessor = audioProcessor;
        this.isDetecting = false;
        
        this.threshold = 1.3;
        this.minTimeBetweenBeats = 200;
        this.lastBeatTime = 0;
        
        this.energyHistory = [];
        this.historySize = 42;
        this.variance = 0;
        this.averageEnergy = 0;
        
        this.onBeat = null;
        this.onEnergyChange = null;
        
        this.bassHistory = [];
        this.midsHistory = [];
        this.trebleHistory = [];
        
        this.bassThreshold = 1.4;
        this.midsThreshold = 1.2;
        this.trebleThreshold = 1.1;
    }

    start() {
        this.isDetecting = true;
        this.analyze();
    }

    stop() {
        this.isDetecting = false;
    }

    analyze() {
        if (!this.isDetecting) return;

        const frequencyData = this.audioProcessor.getFrequencyData();
        if (!frequencyData) {
            requestAnimationFrame(() => this.analyze());
            return;
        }

        let totalEnergy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            totalEnergy += frequencyData[i] * frequencyData[i];
        }
        totalEnergy = Math.sqrt(totalEnergy / frequencyData.length);

        this.energyHistory.push(totalEnergy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        if (this.energyHistory.length >= this.historySize) {
            this.averageEnergy = this.energyHistory.reduce((a, b) => a + b) / this.energyHistory.length;
            
            let varianceSum = 0;
            for (let energy of this.energyHistory) {
                varianceSum += Math.pow(energy - this.averageEnergy, 2);
            }
            this.variance = varianceSum / this.energyHistory.length;
        }

        const currentTime = Date.now();
        const timeSinceLastBeat = currentTime - this.lastBeatTime;
        
        if (timeSinceLastBeat > this.minTimeBetweenBeats && 
            this.energyHistory.length >= this.historySize) {
            
            const threshold = this.averageEnergy * this.threshold;
            
            if (totalEnergy > threshold && totalEnergy > this.variance * 2) {
                this.lastBeatTime = currentTime;
                this.triggerBeat(totalEnergy, 'overall');
            }
        }

        this.analyzeBands(frequencyData, currentTime, timeSinceLastBeat);

        if (this.onEnergyChange) {
            this.onEnergyChange({
                totalEnergy,
                averageEnergy: this.averageEnergy,
                variance: this.variance,
                bass: this.audioProcessor.getBass(),
                mids: this.audioProcessor.getMids(),
                treble: this.audioProcessor.getTreble()
            });
        }

        requestAnimationFrame(() => this.analyze());
    }

    analyzeBands(frequencyData, currentTime, timeSinceLastBeat) {
        const bass = this.audioProcessor.getBass();
        const mids = this.audioProcessor.getMids();
        const treble = this.audioProcessor.getTreble();

        this.bassHistory.push(bass);
        this.midsHistory.push(mids);
        this.trebleHistory.push(treble);

        const bandHistorySize = Math.floor(this.historySize / 2);
        if (this.bassHistory.length > bandHistorySize) this.bassHistory.shift();
        if (this.midsHistory.length > bandHistorySize) this.midsHistory.shift();
        if (this.trebleHistory.length > bandHistorySize) this.trebleHistory.shift();

        if (timeSinceLastBeat > this.minTimeBetweenBeats / 2) {
            if (this.bassHistory.length >= bandHistorySize) {
                const avgBass = this.bassHistory.reduce((a, b) => a + b) / this.bassHistory.length;
                if (bass > avgBass * this.bassThreshold) {
                    this.triggerBeat(bass, 'bass');
                }
            }

            if (this.midsHistory.length >= bandHistorySize) {
                const avgMids = this.midsHistory.reduce((a, b) => a + b) / this.midsHistory.length;
                if (mids > avgMids * this.midsThreshold) {
                    this.triggerBeat(mids, 'mids');
                }
            }

            if (this.trebleHistory.length >= bandHistorySize) {
                const avgTreble = this.trebleHistory.reduce((a, b) => a + b) / this.trebleHistory.length;
                if (treble > avgTreble * this.trebleThreshold) {
                    this.triggerBeat(treble, 'treble');
                }
            }
        }
    }

    triggerBeat(energy, type = 'overall') {
        if (this.onBeat) {
            this.onBeat({
                energy,
                type,
                timestamp: Date.now(),
                intensity: this.calculateIntensity(energy, type)
            });
        }
    }

    calculateIntensity(energy, type) {
        let intensity = 0;
        
        switch (type) {
            case 'bass':
                if (this.bassHistory.length > 0) {
                    const avgBass = this.bassHistory.reduce((a, b) => a + b) / this.bassHistory.length;
                    intensity = Math.min(1, (energy - avgBass) / avgBass);
                }
                break;
            case 'mids':
                if (this.midsHistory.length > 0) {
                    const avgMids = this.midsHistory.reduce((a, b) => a + b) / this.midsHistory.length;
                    intensity = Math.min(1, (energy - avgMids) / avgMids);
                }
                break;
            case 'treble':
                if (this.trebleHistory.length > 0) {
                    const avgTreble = this.trebleHistory.reduce((a, b) => a + b) / this.trebleHistory.length;
                    intensity = Math.min(1, (energy - avgTreble) / avgTreble);
                }
                break;
            default:
                if (this.averageEnergy > 0) {
                    intensity = Math.min(1, (energy - this.averageEnergy) / this.averageEnergy);
                }
        }
        
        return Math.max(0, intensity);
    }

    setThreshold(threshold) {
        this.threshold = Math.max(1.0, Math.min(3.0, threshold));
    }

    setBandThresholds(bass, mids, treble) {
        this.bassThreshold = Math.max(1.0, Math.min(3.0, bass));
        this.midsThreshold = Math.max(1.0, Math.min(3.0, mids));
        this.trebleThreshold = Math.max(1.0, Math.min(3.0, treble));
    }

    reset() {
        this.energyHistory = [];
        this.bassHistory = [];
        this.midsHistory = [];
        this.trebleHistory = [];
        this.lastBeatTime = 0;
        this.averageEnergy = 0;
        this.variance = 0;
    }
}

window.BeatDetector = BeatDetector;