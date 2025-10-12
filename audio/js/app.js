class SoundVisualizerApp {
    constructor() {
        this.audioProcessor = null;
        this.beatDetector = null;
        this.currentVisualizer = null;
        this.visualizers = {};
        
        this.canvas2d = null;
        this.threeContainer = null;
        this.status = null;
        this.micBtn = null;
        this.fileBtn = null;
        this.fileInput = null;
        this.visualizerSelect = null;
        this.volumeSlider = null;
        this.sensitivitySlider = null;
        this.audioPlayer = null;
        
        this.isMobile = this.detectMobile();
        this.isIOS = this.detectIOS();
        
        this.currentMode = this.isMobile ? 'waveform' : 'spectrum';
        this.isActive = false;
        this.audioSource = null;
        
        this.init();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768 || 
               'ontouchstart' in window;
    }

    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    async init() {
        this.setupDOM();
        this.setupMobileSpecificUI();
        this.setupEventListeners();
        
        this.audioProcessor = new AudioProcessor();
        this.beatDetector = new BeatDetector(this.audioProcessor);
        
        this.initializeVisualizers();

        const defaultVisualizer = this.isMobile ? 'waveform' : 'spectrum';
        this.setVisualizer(defaultVisualizer);
        
        if (this.isMobile) {
            this.updateStatus('Mobile detected. Use file upload for best experience!');
        } else {
            this.updateStatus('Ready! Select an audio source to begin.');
        }
        
        this.addUserInteractionHandler();
    }

    setupMobileSpecificUI() {
        if (this.isMobile) {
            if (this.systemAudioBtn) {
                this.systemAudioBtn.style.display = 'none';
            }
            
            if (this.micBtn) {
                this.micBtn.style.display = 'none';
            }
            
            if (this.visualizerSelect) {
                this.visualizerSelect.value = 'waveform';
            }
            
            if (this.fileBtn) {
                this.fileBtn.textContent = 'Upload Audio';
                this.fileBtn.style.order = '-1';
            }
        }
    }

    addUserInteractionHandler() {
        const handleFirstInteraction = async () => {
            try {
                if (!this.audioProcessor.audioContext) {
                    await this.audioProcessor.initialize();
                    console.log('Audio context initialized on user interaction');
                }
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
            }
            
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('keydown', handleFirstInteraction);
        };
        
        document.addEventListener('click', handleFirstInteraction);
        document.addEventListener('keydown', handleFirstInteraction);
    }

    setupDOM() {
        this.canvas2d = document.getElementById('canvas2d');
        this.threeContainer = document.getElementById('three-container');
        this.status = document.getElementById('status');
        this.micBtn = document.getElementById('micBtn');
        this.systemAudioBtn = document.getElementById('systemAudioBtn');
        this.fileBtn = document.getElementById('fileBtn');
        this.fileInput = document.getElementById('fileInput');
        this.visualizerSelect = document.getElementById('visualizerSelect');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.onWindowResize();
    }

    setupEventListeners() {
        this.micBtn.addEventListener('click', () => this.toggleMicrophone());
        
        this.systemAudioBtn.addEventListener('click', () => this.toggleSystemAudio());
        
        this.fileBtn.addEventListener('click', async () => {
            try {
                if (!this.audioProcessor.audioContext) {
                    console.log('Initializing audio context on file button click...');
                    await this.audioProcessor.initialize();
                }
                
                if (this.audioProcessor.audioContext.state === 'suspended') {
                    console.log('Resuming audio context on file button click...');
                    await this.audioProcessor.audioContext.resume();
                }
                
                console.log('Audio context ready, state:', this.audioProcessor.audioContext.state);
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
            }
            
            this.fileInput.click();
        });
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        const testBtn = document.getElementById('testBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.playDemoSong());
        }
        
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        this.visualizerSelect.addEventListener('change', (e) => {
            this.setVisualizer(e.target.value);
        });
        
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audioProcessor.setVolume(volume);
        });
        

        this.sensitivitySlider.addEventListener('input', (e) => {
            const sensitivity = e.target.value;
            this.audioProcessor.setSensitivity(sensitivity);
            
            if (this.currentVisualizer && this.currentVisualizer.setSensitivity) {
                this.currentVisualizer.setSensitivity(sensitivity);
            }
        });
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
            }
        });
    }

    initializeVisualizers() {
        this.visualizers = {
            spectrum: new SpectrumVisualizer(this.canvas2d, this.audioProcessor, this.beatDetector),
            circular: new CircularVisualizer(this.canvas2d, this.audioProcessor, this.beatDetector),
            waveform: new WaveformVisualizer(this.canvas2d, this.audioProcessor, this.beatDetector)
        };
    }

    async toggleMicrophone() {
        try {
            if (this.audioSource === 'microphone' && this.isActive) {
                this.stopVisualization();
                this.micBtn.textContent = this.isMobile ? 'Microphone (Limited on Mobile)' : 'Use Microphone';
                this.micBtn.classList.remove('active');
                this.updateStatus('Microphone disconnected');
            } else {
                if (this.isMobile) {
                    if (this.isIOS) {
                        this.updateStatus('iOS: Microphone may not work in all browsers. Try Safari or Chrome.');
                    } else {
                        this.updateStatus('Mobile: Microphone access limited. File upload recommended.');
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                this.updateStatus('Requesting microphone access...');
                
                await this.audioProcessor.connectMicrophone();
                this.startVisualization('microphone');
                
                this.micBtn.textContent = 'Stop Microphone';
                this.micBtn.classList.add('active');
                this.updateStatus('Microphone connected!');
            }
        } catch (error) {
            console.error('Microphone error:', error);
            
            if (this.isMobile) {
                if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
                    this.updateStatus('Microphone denied. On mobile: 1) Check browser permissions 2) Try file upload instead');
                } else if (error.message.includes('NotFoundError')) {
                    this.updateStatus('No microphone found. Try uploading an audio file instead.');
                } else if (this.isIOS) {
                    this.updateStatus('iOS microphone issue. Try Safari browser or upload a file.');
                } else {
                    this.updateStatus('Mobile microphone failed. File upload works better on mobile!');
                }
            } else {
                this.updateStatus(`Microphone error: ${error.message}`);
            }
            
            this.micBtn.classList.remove('active');
        }
    }

    async toggleSystemAudio() {
        if (this.isMobile) {
            this.updateStatus('System audio is not supported on mobile devices. Try file upload or microphone instead.');
            return;
        }
        
        try {
            if (this.audioSource === 'system-audio' && this.isActive) {
                this.stopVisualization();
                this.systemAudioBtn.textContent = 'System Audio';
                this.systemAudioBtn.classList.remove('active');
                this.updateStatus('System audio disconnected');
            } else {
                const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                const isEdge = /Edg/.test(navigator.userAgent);
                const isFirefox = /Firefox/.test(navigator.userAgent);
                
                if (!isChrome && !isEdge && !isFirefox) {
                    this.updateStatus('System audio works best in Chrome, Edge, or Firefox. Your browser may have limited support.');
                } else if (isFirefox) {
                    this.updateStatus('Firefox support varies. If it doesn\'t work, try Chrome or Edge.');
                } else {
                    this.updateStatus('Requesting system audio access... Make sure to enable "Share system audio" option!');
                }
                
                await this.audioProcessor.connectSystemAudio();
                this.startVisualization('system-audio');
                
                this.systemAudioBtn.textContent = 'Stop System Audio';
                this.systemAudioBtn.classList.add('active');
                this.updateStatus('System audio connected! (Visualizing system sounds)');
            }
        } catch (error) {
            this.updateStatus(`System Audio Error: ${error.message}`);
            this.systemAudioBtn.classList.remove('active');
            
            setTimeout(() => {
                if (error.message.includes('NotSupportedError') || error.message.includes('not supported')) {
                    this.updateStatus('Tip: Try Chrome/Edge with latest version, or use microphone to capture speakers');
                }
            }, 3000);
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

        try {
            this.updateStatus('Loading audio file...');
            this.stopVisualization();

            if (!file.type.startsWith('audio/')) {
                throw new Error('Please select an audio file');
            }

            console.log('Playing file client-side...', { name: file.name, size: file.size, type: file.type });

            if (!this.audioProcessor.audioContext) {
                await this.audioProcessor.initialize();
            }
            if (this.audioProcessor.audioContext.state === 'suspended') {
                await this.audioProcessor.audioContext.resume();
            }

            const audioElement = await this.audioProcessor.connectAudioFile(file);
            this.setupAudioElement(audioElement);
            await audioElement.play();
            this.audioProcessor.isPlaying = true;
            this.startVisualization('file');
            this.updateStatus(`Playing: ${file.name}`);

            this.fileInput.value = '';
        } catch (error) {
            console.error('File handling error:', error);
            this.updateStatus(`Error loading file: ${error.message}`);
        }
    }


    setupAudioElement(audioElement) {
        console.log('Setting up audio element controls...');
        
        this.audioPlayer.style.display = 'none';
        
        this.playPauseBtn.style.display = 'inline-block';
        this.playPauseBtn.textContent = 'Pause';
        this.mainAudioElement = audioElement;
        
        console.log('Audio element setup complete, play/pause controls enabled');
        
        audioElement.addEventListener('ended', () => {
            console.log('Audio ended, stopping visualization');
            this.stopVisualization();
            this.updateStatus('Audio finished');
        });
        
        audioElement.addEventListener('play', () => {
            console.log('Audio started/resumed playing');
            this.playPauseBtn.textContent = 'Pause';
        });
        
        audioElement.addEventListener('pause', () => {
            console.log('Audio paused');
            this.playPauseBtn.textContent = 'Play';
        });
    }

    setVisualizer(type) {
        if (this.currentVisualizer) {
            this.currentVisualizer.stop();
        }
        
        this.canvas2d.style.display = 'block';
        this.threeContainer.style.display = 'none';
        
        while (this.threeContainer.firstChild) {
            this.threeContainer.removeChild(this.threeContainer.firstChild);
        }
        
        switch (type) {
            case 'spectrum':
                this.currentVisualizer = this.visualizers.spectrum;
                break;
            case 'circular':
                this.currentVisualizer = this.visualizers.circular;
                break;
            case 'waveform':
                this.currentVisualizer = this.visualizers.waveform;
                break;
            default:
                this.currentVisualizer = this.visualizers.spectrum;
                type = 'spectrum';
        }
        
        this.currentMode = type;
        this.visualizerSelect.value = type;
        
        if (this.isActive && this.currentVisualizer) {
            this.currentVisualizer.start();
        }
        
        this.updateStatus(`Switched to ${this.getVisualizerName(type)} visualizer`);
    }

    getVisualizerName(type) {
        const names = {
            spectrum: 'Spectrum Bars',
            circular: 'Circular Waveform',
            waveform: 'Waveform'
        };
        return names[type] || type;
    }

    startVisualization(source) {
        this.audioSource = source;
        this.isActive = true;
        
        this.beatDetector.start();
        if (this.currentVisualizer) {
            this.currentVisualizer.start();
        }
        
        this.updateControls();
    }

    stopVisualization() {
        this.isActive = false;
        this.audioSource = null;
        
        this.stopTestTone();
        
        if (this.demoAudioNodes) {
            try {
                this.demoAudioNodes.masterGain.disconnect();
            } catch (e) {
                console.log('Demo nodes already disconnected');
            }
            this.demoAudioNodes = null;
        }
        
        this.audioProcessor.disconnect();
        this.beatDetector.stop();
        
        if (this.currentVisualizer) {
            this.currentVisualizer.stop();
        }
        
        this.micBtn.textContent = 'Use Microphone';
        this.micBtn.classList.remove('active');
        this.systemAudioBtn.textContent = 'System Audio';
        this.systemAudioBtn.classList.remove('active');
        this.audioPlayer.style.display = 'none';
        this.playPauseBtn.style.display = 'none';
        
        this.mainAudioElement = null;
        
        this.updateStatus('Visualization stopped');
    }

    async generateTestTone() {
        try {
            this.updateStatus('Generating test tone...');
            
            this.stopVisualization();
            
            if (!this.audioProcessor.audioContext) {
                await this.audioProcessor.initialize();
            }
            
            if (this.audioProcessor.audioContext.state === 'suspended') {
                await this.audioProcessor.audioContext.resume();
            }
            
            if (!this.audioProcessor.gainNode) {
                this.audioProcessor.gainNode = this.audioProcessor.audioContext.createGain();
                this.audioProcessor.gainNode.gain.value = this.audioProcessor.volume;
            }
            
            const oscillator = this.audioProcessor.audioContext.createOscillator();
            const gainNode = this.audioProcessor.audioContext.createGain();
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(220, this.audioProcessor.audioContext.currentTime);
            
            const lfo = this.audioProcessor.audioContext.createOscillator();
            const lfoGain = this.audioProcessor.audioContext.createGain();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(0.5, this.audioProcessor.audioContext.currentTime);
            lfoGain.gain.setValueAtTime(50, this.audioProcessor.audioContext.currentTime);
            
            lfo.connect(lfoGain);
            lfoGain.connect(oscillator.frequency);
            
            gainNode.gain.setValueAtTime(0.3, this.audioProcessor.audioContext.currentTime);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioProcessor.gainNode);
            this.audioProcessor.gainNode.connect(this.audioProcessor.analyser);
            this.audioProcessor.analyser.connect(this.audioProcessor.audioContext.destination);
            
            oscillator.start();
            lfo.start();
            
            this.testOscillator = oscillator;
            this.testLfo = lfo;
            this.testGain = gainNode;
            
            this.audioProcessor.isPlaying = true;
            
            this.startVisualization('test');
            this.updateStatus('Playing test tone');
            
            setTimeout(() => {
                if (this.audioSource === 'test') {
                    this.stopTestTone();
                }
            }, 10000);
            
        } catch (error) {
            console.error('Test tone error:', error);
            this.updateStatus(`Error generating test tone: ${error.message}`);
        }
    }

    stopTestTone() {
        if (this.testOscillator) {
            try {
                this.testOscillator.stop();
                this.testOscillator.disconnect();
            } catch (e) {
            }
            this.testOscillator = null;
        }
        if (this.testLfo) {
            try {
                this.testLfo.stop();
                this.testLfo.disconnect();
            } catch (e) {
            }
            this.testLfo = null;
        }
        if (this.testGain) {
            try {
                this.testGain.disconnect();
            } catch (e) {
            }
            this.testGain = null;
        }
        
        this.audioProcessor.isPlaying = false;
    }

    togglePlayPause() {
        if (!this.mainAudioElement) {
            console.log('No audio loaded to play/pause');
            this.updateStatus('No audio loaded');
            return;
        }

        try {
            if (this.mainAudioElement.paused) {
                console.log('Resuming audio playback...');
                this.mainAudioElement.play();
                this.audioProcessor.isPlaying = true;
                this.updateStatus('Audio resumed');
            } else {
                console.log('Pausing audio playback...');
                this.mainAudioElement.pause();
                this.audioProcessor.isPlaying = false;
                this.updateStatus('Audio paused');
            }
        } catch (error) {
            console.error('Error toggling play/pause:', error);
            this.updateStatus(`Playback error: ${error.message}`);
        }
    }

    async playDemoSong() {
        try {
            this.updateStatus('Loading demo song...');
            console.log('Playing demo: Alan Walker - The Spectre');
            
            this.stopVisualization();
            
            if (!this.audioProcessor.audioContext) {
                await this.audioProcessor.initialize();
            }
            
            if (this.audioProcessor.audioContext.state === 'suspended') {
                await this.audioProcessor.audioContext.resume();
            }
            
            const demoUrl = '/demo/alan-walker-the-spectre.mp3';
            
            try {
                console.log('Attempting to load demo file from:', demoUrl);
                const response = await fetch(demoUrl, { method: 'HEAD' });
                if (response.ok && response.status === 200) {
                    console.log('Demo file found, loading...');
                    const audioElement = await this.audioProcessor.connectUploadedFile(demoUrl);
                    this.setupAudioElement(audioElement);
                    this.startVisualization('file');
                    this.updateStatus('Playing: Alan Walker - The Spectre');
                    return;
                } else {
                    console.log('Demo file not found (status:', response.status, '), generating demo melody...');
                    throw new Error('Demo file not available');
                }
            } catch (error) {
                console.log('Demo file not found, generating demo melody...');
            }
            
            
        } catch (error) {
            console.error('Demo song error:', error);
            this.updateStatus(`Demo error: ${error.message}`);
        }
    }

    async testAudioContext() {
        try {
            this.updateStatus('Testing audio context...');
            console.log('=== AUDIO CONTEXT TEST START ===');
            
            if (!this.audioProcessor.audioContext) {
                console.log('Initializing audio processor...');
                await this.audioProcessor.initialize();
            }
            
            console.log('Audio context state:', this.audioProcessor.audioContext.state);
            console.log('Audio context sample rate:', this.audioProcessor.audioContext.sampleRate);
            
            if (this.audioProcessor.audioContext.state === 'suspended') {
                console.log('Resuming audio context...');
                await this.audioProcessor.audioContext.resume();
                console.log('Audio context resumed, new state:', this.audioProcessor.audioContext.state);
            }
            
            console.log('Playing test tone...');
            const success = await this.audioProcessor.playTestTone(440, 1000);
            
            if (success) {
                this.updateStatus('Audio context test: SUCCESS!');
                console.log('=== AUDIO CONTEXT TEST SUCCESS ===');
            } else {
                this.updateStatus('Audio context test: FAILED');
                console.log('=== AUDIO CONTEXT TEST FAILED ===');
            }
            
        } catch (error) {
            console.error('Audio context test error:', error);
            this.updateStatus(`Audio context test error: ${error.message}`);
        }
    }

    handleKeydown(event) {
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                if (this.audioSource === 'microphone') {
                    this.toggleMicrophone();
                } else if (this.audioSource === 'file' && this.mainAudioElement) {
                    this.togglePlayPause();
                }
                break;
            case 'Digit1':
                this.setVisualizer('spectrum');
                break;
            case 'Digit2':
                this.setVisualizer('circular');
                break;
            case 'Digit3':
                this.setVisualizer('waveform');
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.adjustVolume(0.1);
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.adjustVolume(-0.1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.adjustSensitivity(-1);
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.adjustSensitivity(1);
                break;
        }
    }

    adjustVolume(delta) {
        const currentValue = parseInt(this.volumeSlider.value);
        const newValue = Math.max(0, Math.min(100, currentValue + delta * 10));
        this.volumeSlider.value = newValue;
        this.audioProcessor.setVolume(newValue / 100);
    }

    adjustSensitivity(delta) {
        const currentValue = parseInt(this.sensitivitySlider.value);
        const newValue = Math.max(1, Math.min(10, currentValue + delta));
        this.sensitivitySlider.value = newValue;
        this.audioProcessor.setSensitivity(newValue);
        
        if (this.currentVisualizer && this.currentVisualizer.setSensitivity) {
            this.currentVisualizer.setSensitivity(newValue);
        }
    }

    onWindowResize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas2d.getBoundingClientRect();
        
        this.canvas2d.style.width = window.innerWidth + 'px';
        this.canvas2d.style.height = window.innerHeight + 'px';
        
        this.canvas2d.width = window.innerWidth * dpr;
        this.canvas2d.height = window.innerHeight * dpr;
        
        const ctx = this.canvas2d.getContext('2d');
        ctx.scale(dpr, dpr);
        
        if (this.currentVisualizer && this.currentVisualizer.resize) {
            this.currentVisualizer.resize();
        }
    }

    updateControls() {
        this.volumeSlider.value = this.audioProcessor.volume * 100;
        this.sensitivitySlider.value = this.audioProcessor.smoothingTimeConstant * 10;
    }

    updateStatus(message) {
        this.status.textContent = message;
        console.log('Status:', message);
    }

    destroy() {
        this.stopVisualization();
        
        Object.values(this.visualizers).forEach(visualizer => {
            if (visualizer.destroy) {
                visualizer.destroy();
            }
        });
        
        if (this.audioProcessor) {
            this.audioProcessor.destroy();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new SoundVisualizerApp();
});

window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});