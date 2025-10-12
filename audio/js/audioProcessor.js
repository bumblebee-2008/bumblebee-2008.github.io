class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.source = null;
        this.isPlaying = false;
        this.mediaStream = null;
        this.audioElement = null;
        
        this.fftSize = 2048;
        this.smoothingTimeConstant = 0.8;
        
        this.gainNode = null;
        this.volume = 0.5;
    }

    async initialize() {
        try {
            console.log('Initializing audio context...');
            
            if (this.audioContext && this.audioContext.state !== 'closed') {
                console.log('Closing existing audio context...');
                await this.audioContext.close();
            }
            
            const audioContextOptions = {
                sampleRate: 44100,
                latencyHint: 'playback'
            };
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
            
            console.log('Audio context created:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state,
                baseLatency: this.audioContext.baseLatency,
                outputLatency: this.audioContext.outputLatency
            });
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            console.log('Analyser configured:', {
                fftSize: this.analyser.fftSize,
                frequencyBinCount: this.analyser.frequencyBinCount,
                smoothingTimeConstant: this.analyser.smoothingTimeConstant,
                sampleRate: this.audioContext.sampleRate
            });
            
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
            
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            this.timeDomainArray = new Uint8Array(this.bufferLength);
            
            console.log('Audio processor initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio processor:', error);
            return false;
        }
    }

    async connectMicrophone() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Microphone access is not supported in this browser');
            }

            if (!this.audioContext) {
                await this.initialize();
            }

            if (!this.audioContext || this.audioContext.state === 'closed') {
                throw new Error('Audio context is not available or closed');
            }

            if (this.audioContext.state === 'suspended') {
                console.log('Resuming suspended audio context...');
                await this.audioContext.resume();
                console.log('Audio context resumed, state:', this.audioContext.state);
            }
            
            if (this.audioContext.state !== 'running') {
                throw new Error(`Audio context is not running (state: ${this.audioContext.state})`);
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });

            console.log('MediaStream received:', this.mediaStream);
            console.log('MediaStream type:', typeof this.mediaStream);
            console.log('MediaStream constructor:', this.mediaStream.constructor.name);
            
            if (!this.mediaStream) {
                throw new Error('Failed to get media stream - stream is null');
            }
            
            if (!(this.mediaStream instanceof MediaStream)) {
                throw new Error('Invalid media stream - not a MediaStream instance');
            }
            
            if (!this.mediaStream.getAudioTracks) {
                throw new Error('MediaStream does not have getAudioTracks method');
            }
            
            const audioTracks = this.mediaStream.getAudioTracks();
            console.log('Audio tracks:', audioTracks);
            
            if (audioTracks.length === 0) {
                throw new Error('No audio tracks available in media stream');
            }
            
            const activeTracks = audioTracks.filter(track => track.readyState === 'live');
            if (activeTracks.length === 0) {
                throw new Error('No active audio tracks available');
            }
            
            console.log('MediaStream validation passed, creating audio source...');
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!this.mediaStream.active) {
                throw new Error('MediaStream became inactive');
            }

            const newMediaStream = this.mediaStream;

            if (this.source) {
                try {
                    this.source.disconnect();
                    console.log('Previous audio source disconnected');
                } catch (e) {
                    console.log('Source already disconnected:', e.message);
                }
                this.source = null;
            }

            try {
                console.log('Creating MediaStreamSource with audioContext:', this.audioContext);
                console.log('AudioContext state:', this.audioContext.state);
                console.log('About to create source with MediaStream:', newMediaStream);
                this.source = this.audioContext.createMediaStreamSource(newMediaStream);
                console.log('MediaStreamSource created successfully:', this.source);
            } catch (createSourceError) {
                console.error('Failed to create MediaStreamSource:', createSourceError);
                throw new Error(`Failed to create audio source: ${createSourceError.message}`);
            }
            
            if (!this.source) {
                throw new Error('MediaStreamSource was not created successfully');
            }
            
            console.log('Connecting microphone audio graph (visualization only, no output)...');
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            
            this.mediaStream = newMediaStream;
            
            this.isPlaying = true;
            console.log('Microphone connected successfully');
            return true;
        } catch (error) {
            console.error('Failed to connect microphone:', error);
            throw new Error('Microphone access denied. Please allow microphone access and try again.');
        }
    }

    async connectSystemAudio() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('System audio capture is not supported in this browser. Please use Chrome, Edge, or Firefox.');
            }

            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            const isEdge = /Edg/.test(navigator.userAgent);
            const isFirefox = /Firefox/.test(navigator.userAgent);
            
            console.log('Browser detection:', { isChrome, isEdge, isFirefox });
            
            if (!isChrome && !isEdge && !isFirefox) {
                console.warn('Browser may have limited system audio support');
            }

            if (!this.audioContext) {
                await this.initialize();
            }

            if (!this.audioContext || this.audioContext.state === 'closed') {
                throw new Error('Audio context is not available or closed');
            }

            if (this.audioContext.state === 'suspended') {
                console.log('Resuming suspended audio context...');
                await this.audioContext.resume();
                console.log('Audio context resumed, state:', this.audioContext.state);
            }
            
            if (this.audioContext.state !== 'running') {
                throw new Error(`Audio context is not running (state: ${this.audioContext.state})`);
            }

            console.log('Requesting system audio capture...');
            
            let displayMediaOptions;
            
            try {
                displayMediaOptions = { 
                    video: false,
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        systemAudio: 'include'
                    } 
                };
                
                console.log('Trying systemAudio: include approach...');
                this.mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                
            } catch (systemAudioError) {
                console.log('systemAudio approach failed, trying fallback...');
                
                try {
                    displayMediaOptions = { 
                        video: true,
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        } 
                    };
                    
                    console.log('Trying standard display media approach...');
                    this.mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                    
                } catch (displayMediaError) {
                    console.log('Display media approach failed, trying audio-only...');
                    
                    try {
                        displayMediaOptions = { 
                            audio: {
                                echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false,
                                googEchoCancellation: false,
                                googNoiseSuppression: false,
                                googAutoGainControl: false
                            } 
                        };
                        
                        console.log('Trying getUserMedia approach...');
                        this.mediaStream = await navigator.mediaDevices.getUserMedia(displayMediaOptions);
                        
                    } catch (getUserMediaError) {
                        displayMediaOptions = { 
                            audio: {
                                echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false
                            } 
                        };
                        
                        console.log('Trying final audio-only display media approach...');
                        this.mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                    }
                }
            }

            console.log('System MediaStream received:', this.mediaStream);
            console.log('MediaStream type:', typeof this.mediaStream);
            console.log('MediaStream constructor:', this.mediaStream.constructor.name);
            
            if (!this.mediaStream) {
                throw new Error('Failed to get system audio stream - stream is null');
            }
            
            if (!(this.mediaStream instanceof MediaStream)) {
                throw new Error('Invalid system audio stream - not a MediaStream instance');
            }
            
            if (!this.mediaStream.getAudioTracks) {
                throw new Error('MediaStream does not have getAudioTracks method');
            }
            
            const audioTracks = this.mediaStream.getAudioTracks();
            console.log('System audio tracks:', audioTracks);
            
            if (audioTracks.length === 0) {
                throw new Error('No system audio tracks available - try enabling "Share system audio" in the browser dialog');
            }
            
            const activeTracks = audioTracks.filter(track => track.readyState === 'live');
            if (activeTracks.length === 0) {
                throw new Error('No active system audio tracks available');
            }
            
            console.log('System audio validation passed, creating audio source...');
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!this.mediaStream.active) {
                throw new Error('System audio stream became inactive');
            }

            const newMediaStream = this.mediaStream;

            if (this.source) {
                try {
                    this.source.disconnect();
                    console.log('Previous audio source disconnected');
                } catch (e) {
                    console.log('Source already disconnected:', e.message);
                }
                this.source = null;
            }

            try {
                console.log('Creating MediaStreamSource with audioContext:', this.audioContext);
                console.log('AudioContext state:', this.audioContext.state);
                console.log('About to create source with system MediaStream:', newMediaStream);
                this.source = this.audioContext.createMediaStreamSource(newMediaStream);
                console.log('System MediaStreamSource created successfully:', this.source);
            } catch (createSourceError) {
                console.error('Failed to create system MediaStreamSource:', createSourceError);
                throw new Error(`Failed to create system audio source: ${createSourceError.message}`);
            }
            
            if (!this.source) {
                throw new Error('System MediaStreamSource was not created successfully');
            }
            
            console.log('Connecting system audio graph (visualization only, no output)...');
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            
            this.mediaStream = newMediaStream;
            
            this.isPlaying = true;
            console.log('System audio connected successfully');
            return true;
        } catch (error) {
            console.error('Failed to connect system audio:', error);
            
            let errorMessage = 'System audio capture failed. ';
            
            if (error.name === 'NotSupportedError') {
                errorMessage += 'Your browser may not support system audio capture. Try using Chrome or Edge with the latest version.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage += 'Permission denied. Please allow screen sharing and make sure to enable "Share system audio" option.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No audio source found. Make sure audio is playing on your system.';
            } else if (error.message.includes('no audio tracks')) {
                errorMessage += 'No system audio detected. Make sure to:\n1. Enable "Share system audio" in the dialog\n2. Have audio playing on your system\n3. Check your system audio settings';
            } else {
                errorMessage += `${error.message}`;
            }
            
            throw new Error(errorMessage);
        }
    }

    async connectAudioFile(file) {
        try {
            console.log('=== CONNECT AUDIO FILE START ===');
            console.log('Connecting to audio file:', file.name, 'Size:', file.size, 'Type:', file.type);
            
            if (!this.audioContext) {
                throw new Error('Audio context not initialized - call initialize() first');
            }
            
            if (this.audioContext.state !== 'running') {
                throw new Error(`Audio context not running - state is: ${this.audioContext.state}`);
            }

            console.log('Audio context verified - state:', this.audioContext.state, 'sample rate:', this.audioContext.sampleRate);
            
            console.log('Disconnecting previous sources...');
            this.disconnect();

            console.log('Creating audio element...');
            this.audioElement = new Audio();
            const url = URL.createObjectURL(file);
            console.log('Created blob URL:', url);
            
            this.audioElement.src = url;
            this.audioElement.crossOrigin = 'anonymous';
            this.audioElement.preload = 'auto';
            this.audioElement.volume = this.volume;
            
            this.audioElement.playbackRate = 1.0;
            this.audioElement.preservesPitch = true;
            this.audioElement.defaultPlaybackRate = 1.0;
            
            if (this.audioElement.buffered) {
                this.audioElement.preload = 'auto';
            }
            
            this.audioElement.mozAudioChannelType = 'content';
            
            console.log('Audio element configured:', {
                volume: this.audioElement.volume,
                playbackRate: this.audioElement.playbackRate,
                defaultPlaybackRate: this.audioElement.defaultPlaybackRate,
                preservesPitch: this.audioElement.preservesPitch,
                preload: this.audioElement.preload
            });

            console.log('Audio element configured, waiting for load...');

            await new Promise((resolve, reject) => {
                let timeoutId;
                let loadAttempts = 0;
                const maxAttempts = 3;
                
                const cleanup = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    this.audioElement.removeEventListener('canplaythrough', handleSuccess);
                    this.audioElement.removeEventListener('error', handleError);
                    this.audioElement.removeEventListener('loadeddata', handleSuccess);
                    this.audioElement.removeEventListener('loadstart', handleLoadStart);
                    this.audioElement.removeEventListener('progress', handleProgress);
                };
                
                const handleSuccess = (event) => {
                    console.log('Audio file loaded successfully, event:', event.type);
                    console.log('Audio duration:', this.audioElement.duration);
                    console.log('Audio ready state:', this.audioElement.readyState);
                    cleanup();
                    resolve();
                };
                
                const handleError = (error) => {
                    console.error('Audio loading error event:', error);
                    console.error('Audio element error:', this.audioElement.error);
                    
                    loadAttempts++;
                    if (loadAttempts < maxAttempts) {
                        console.log(`Retrying audio load, attempt ${loadAttempts + 1}/${maxAttempts}`);
                        setTimeout(() => {
                            this.audioElement.load();
                        }, 1000);
                        return;
                    }
                    
                    cleanup();
                    reject(new Error(`Failed to load audio file after ${maxAttempts} attempts: ${error.message || 'Unknown error'}`));
                };
                
                const handleLoadStart = () => {
                    console.log('Audio load started');
                };
                
                const handleProgress = () => {
                    if (this.audioElement.buffered.length > 0) {
                        const bufferedEnd = this.audioElement.buffered.end(this.audioElement.buffered.length - 1);
                        const duration = this.audioElement.duration;
                        if (duration > 0) {
                            const bufferedPercent = (bufferedEnd / duration) * 100;
                            console.log(`Audio buffered: ${bufferedPercent.toFixed(1)}%`);
                        }
                    }
                };
                
                this.audioElement.addEventListener('canplaythrough', handleSuccess, { once: true });
                this.audioElement.addEventListener('loadeddata', handleSuccess, { once: true });
                this.audioElement.addEventListener('error', handleError);
                this.audioElement.addEventListener('loadstart', handleLoadStart, { once: true });
                this.audioElement.addEventListener('progress', handleProgress);
                
                timeoutId = setTimeout(() => {
                    console.error('Audio loading timeout after 15 seconds');
                    cleanup();
                    reject(new Error('Audio loading timeout'));
                }, 15000);
                
                console.log('Starting audio load...');
                this.audioElement.load();
            });

            console.log('Audio loaded, checking properties...');
            console.log('Audio file properties:', {
                duration: this.audioElement.duration,
                playbackRate: this.audioElement.playbackRate,
                defaultPlaybackRate: this.audioElement.defaultPlaybackRate,
                volume: this.audioElement.volume,
                readyState: this.audioElement.readyState,
                networkState: this.audioElement.networkState
            });
            
            console.log('Audio context properties:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state,
                currentTime: this.audioContext.currentTime
            });
            
            if (this.audioContext.state !== 'running') {
                console.error('Audio context is not running before connection:', this.audioContext.state);
                throw new Error(`Audio context not running during connection: ${this.audioContext.state}`);
            }
            
            console.log('Audio loaded, creating media element source...');
            this.source = this.audioContext.createMediaElementSource(this.audioElement);
            
            console.log('Connecting audio graph...');
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            console.log('Audio graph connected successfully');
            console.log('Graph: source -> gain -> analyser -> destination');
            
            console.log('Setting up audio element events...');
            this.audioElement.addEventListener('ended', () => {
                console.log('Audio playback ended');
                this.isPlaying = false;
            });
            
            this.audioElement.addEventListener('stalled', () => {
                console.warn('Audio stalled - network issues or buffering problems');
            });
            
            this.audioElement.addEventListener('waiting', () => {
                console.warn('Audio waiting - buffering...');
            });
            
            this.audioElement.addEventListener('suspend', () => {
                console.log('Audio suspended');
            });
            
            this.audioElement.addEventListener('abort', () => {
                console.warn('Audio aborted');
            });
            
            this.audioElement.addEventListener('emptied', () => {
                console.warn('Audio emptied - media element reset');
            });
            
            this.audioElement.addEventListener('canplay', () => {
                console.log('Audio can start playing');
            });
            
            this.audioElement.addEventListener('playing', () => {
                console.log('Audio is playing');
            });
            
            this.audioElement.addEventListener('pause', () => {
                console.log('Audio paused');
            });

            console.log('=== CONNECT AUDIO FILE SUCCESS ===');
            console.log('Audio file connected, ready for playback');
            console.log('Audio element state:', {
                currentTime: this.audioElement.currentTime,
                duration: this.audioElement.duration,
                paused: this.audioElement.paused,
                playbackRate: this.audioElement.playbackRate,
                volume: this.audioElement.volume,
                readyState: this.audioElement.readyState
            });
            
            return this.audioElement;
        } catch (error) {
            console.error('=== CONNECT AUDIO FILE FAILED ===');
            console.error('Failed to connect audio file:', error);
            console.error('Error stack:', error.stack);
            console.error('Audio context state:', this.audioContext?.state);
            console.error('Audio element state:', {
                readyState: this.audioElement?.readyState,
                networkState: this.audioElement?.networkState,
                error: this.audioElement?.error
            });
            throw error;
        }
    }

    async connectUploadedFile(filePath) {
        try {
            console.log('Connecting to uploaded file:', filePath);
            
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('Invalid file path provided');
            }
            
            if (!this.audioContext) {
                await this.initialize();
            }

            if (this.audioContext.state === 'suspended') {
                console.log('Resuming audio context...');
                await this.audioContext.resume();
            }

            this.disconnect();

            this.audioElement = new Audio();
            const url = filePath + '?t=' + Date.now();
            this.audioElement.src = url;
            this.audioElement.crossOrigin = 'anonymous';
            this.audioElement.preload = 'auto';
            this.audioElement.volume = this.volume;

            console.log('Audio element created with src:', url);

            await new Promise((resolve, reject) => {
                let timeoutId;
                
                const cleanup = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (this.audioElement) {
                        this.audioElement.removeEventListener('canplaythrough', resolve);
                        this.audioElement.removeEventListener('error', reject);
                        this.audioElement.removeEventListener('loadeddata', resolve);
                    }
                };
                
                const handleSuccess = () => {
                    console.log('Audio file loaded successfully');
                    cleanup();
                    resolve();
                };
                
                const handleError = (error) => {
                    console.error('Audio loading error:', error);
                    cleanup();
                    if (this.audioElement) {
                        this.audioElement.src = '';
                        this.audioElement = null;
                    }
                    reject(new Error('Failed to load audio file: ' + (error.message || 'Unknown error')));
                };
                
                this.audioElement.addEventListener('canplaythrough', handleSuccess, { once: true });
                this.audioElement.addEventListener('loadeddata', handleSuccess, { once: true });
                this.audioElement.addEventListener('error', handleError, { once: true });
                
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error('Audio loading timeout'));
                }, 10000);
                
                this.audioElement.load();
            });

            this.source = this.audioContext.createMediaElementSource(this.audioElement);
            
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            console.log('Starting playback...');
            await this.audioElement.play();
            this.isPlaying = true;
            
            console.log('Uploaded file connected and playing');
            return this.audioElement;
        } catch (error) {
            console.error('Failed to connect uploaded file:', error);
            throw error;
        }
    }

    getFrequencyData() {
        if (!this.analyser || !this.dataArray) return null;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    getTimeDomainData() {
        if (!this.analyser || !this.timeDomainArray) return null;
        
        this.analyser.getByteTimeDomainData(this.timeDomainArray);
        return this.timeDomainArray;
    }

    getAverageFrequency() {
        const data = this.getFrequencyData();
        if (!data) return 0;
        
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return sum / data.length;
    }

    getBass() {
        const data = this.getFrequencyData();
        if (!data) return 0;
        
        const bassEnd = Math.floor(data.length * 0.1);
        let sum = 0;
        for (let i = 0; i < bassEnd; i++) {
            sum += data[i];
        }
        return sum / bassEnd;
    }

    getMids() {
        const data = this.getFrequencyData();
        if (!data) return 0;
        
        const midStart = Math.floor(data.length * 0.1);
        const midEnd = Math.floor(data.length * 0.4);
        let sum = 0;
        for (let i = midStart; i < midEnd; i++) {
            sum += data[i];
        }
        return sum / (midEnd - midStart);
    }

    getTreble() {
        const data = this.getFrequencyData();
        if (!data) return 0;
        
        const trebleStart = Math.floor(data.length * 0.4);
        let sum = 0;
        for (let i = trebleStart; i < data.length; i++) {
            sum += data[i];
        }
        return sum / (data.length - trebleStart);
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }

    setSensitivity(sensitivity) {
        this.smoothingTimeConstant = Math.max(0.1, Math.min(0.9, 1 - (sensitivity / 10)));
        if (this.analyser) {
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
        }
    }

    disconnect() {
        console.log('Disconnecting audio sources...');
        
        if (this.source) {
            try {
                this.source.disconnect();
                console.log('Audio source disconnected');
            } catch (e) {
                console.log('Source already disconnected:', e.message);
            }
            this.source = null;
        }

        if (this.mediaStream) {
            try {
                this.mediaStream.getTracks().forEach(track => track.stop());
                console.log('Media stream stopped');
            } catch (e) {
                console.log('Error stopping media stream:', e.message);
            }
            this.mediaStream = null;
        }

        if (this.audioElement) {
            try {
                this.audioElement.pause();
                
                if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
                    URL.revokeObjectURL(this.audioElement.src);
                    console.log('Revoked blob URL');
                }
                
                this.audioElement.src = '';
                console.log('Audio element cleaned up');
            } catch (e) {
                console.log('Error cleaning up audio element:', e.message);
            }
            this.audioElement = null;
        }

        this.isPlaying = false;
    }

    checkAudioData() {
        if (!this.analyser) return null;
        
        const data = this.getFrequencyData();
        const timeData = this.getTimeDomainData();
        
        const freqSum = data ? Array.from(data).reduce((a, b) => a + b, 0) : 0;
        const timeSum = timeData ? Array.from(timeData).reduce((a, b) => a + b, 0) : 0;
        
        return {
            frequencyDataSum: freqSum,
            timeDomainDataSum: timeSum,
            averageFreq: data ? freqSum / data.length : 0,
            averageTime: timeData ? timeSum / timeData.length : 0,
            isPlaying: this.isPlaying,
            contextState: this.audioContext?.state,
            hasSource: !!this.source,
            hasAnalyser: !!this.analyser
        };
    }

    async playTestTone(frequency = 440, duration = 1000) {
        try {
            console.log('Playing test tone...');
            
            if (!this.audioContext || this.audioContext.state === 'closed') {
                await this.initialize();
            }
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
            
            console.log('Test tone played successfully');
            return true;
        } catch (error) {
            console.error('Test tone failed:', error);
            return false;
        }
    }

    suspend() {
        if (this.audioContext && this.audioContext.state === 'running') {
            return this.audioContext.suspend();
        }
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            return this.audioContext.resume();
        }
    }

    destroy() {
        this.disconnect();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

window.AudioProcessor = AudioProcessor;