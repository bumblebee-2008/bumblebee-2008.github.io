// script.js - LearnPiano static MIDI trainer

import * as Tone from "https://cdn.skypack.dev/tone@14.8.49";
import { Midi } from "https://cdn.skypack.dev/@tonejs/midi@2.0.28";
// VexFlow removed


const fileInput = document.getElementById("fileInput");
const btnLoadPrevious = document.getElementById("btnLoadPrevious");
const btnPlay = document.getElementById("btnPlay");
const btnPause = document.getElementById("btnPause");
const btnStop = document.getElementById("btnStop");
const btnRestart = document.getElementById("btnRestart");
const progress = document.getElementById("progress");
const timeLabel = document.getElementById("timeLabel");
const speed = document.getElementById("speed");
const speedLabel = document.getElementById("speedLabel");
const modeSelect = document.getElementById("modeSelect");
const tracksPanel = document.getElementById("tracksPanel");
const scoreEl = document.getElementById("score");
const midiStatus = document.getElementById("midiStatus");
const overlayMsg = document.getElementById("overlayMsg");
// Practice UI controls and panels
const noteWaitToggle = document.getElementById("noteWaitToggle");
const handLeftBtn = document.getElementById("handLeft");
const handRightBtn = document.getElementById("handRight");
const handBothBtn = document.getElementById("handBoth");
const loopToggle = document.getElementById("loopToggle");
const loopStartInput = document.getElementById("loopStart");
const loopEndInput = document.getElementById("loopEnd");
const countdownEl = document.getElementById("countdown");
// Staff view removed
const feedbackModal = document.getElementById("feedbackModal");
const feedbackClose = document.getElementById("feedbackClose");
const accPercentEl = document.getElementById("accPercent");
const accCorrectEl = document.getElementById("accCorrect");
const accTotalEl = document.getElementById("accTotal");
const missListEl = document.getElementById("missList");
// MIDI settings modal elements
const openMIDISettingsBtn = document.getElementById("openMIDISettings");
const midiModal = document.getElementById("midiModal");
const midiClose = document.getElementById("midiClose");
const midiInSelect = document.getElementById("midiInSelect");
const midiOutSelect = document.getElementById("midiOutSelect");
const midiConnDot = document.getElementById("midiConnDot");
const refreshMIDI = document.getElementById("refreshMIDI");
const testNoteBtn = document.getElementById("testNoteBtn");
const midiThruToggle = document.getElementById("midiThruToggle");
const practiceToggle = document.getElementById("practiceToggle");
const tailMsInput = document.getElementById("tailMsInput");
const tailMsLabel = document.getElementById("tailMsLabel");
// Settings modal tabs
const settingsTabMidi = document.getElementById('settingsTabMidi');
const settingsTabVisuals = document.getElementById('settingsTabVisuals');
const midiSettingsTab = document.getElementById('midiSettingsTab');
const visualSettingsTab = document.getElementById('visualSettingsTab');

// Visualization controls
const radiusSelect = document.getElementById("radiusSelect");
const fallTime = document.getElementById("fallTime");
const fallTimeLabel = document.getElementById("fallTimeLabel");
const trailToggle = document.getElementById("trailToggle");
const bounceToggle = document.getElementById("bounceToggle");
const enhancedToggle = document.getElementById("enhancedToggle");
const hitLineToggle = document.getElementById("hitLineToggle");
const gridToggle = document.getElementById("gridToggle");
const noteOpacity = document.getElementById("noteOpacity");
const noteOpacityLabel = document.getElementById("noteOpacityLabel");
const glowIntensity = document.getElementById("glowIntensity");
const glowIntensityLabel = document.getElementById("glowIntensityLabel");

const canvas = document.getElementById("pianoRoll");
const ctx = canvas.getContext("2d");
// Fullscreen piano elements
const btnPianoMode = document.getElementById('btnPianoMode');
const pianoFs = document.getElementById('pianoFs');
const fsExit = document.getElementById('fsExit');
const fsPlayPause = document.getElementById('fsPlayPause');
const fsPlayPauseIcon = document.getElementById('fsPlayPauseIcon');
const pianoFsCanvasWrap = document.getElementById('pianoFsCanvasWrap');
let canvasOriginalParent = null;
// Small delay to allow scheduling/audio engine to settle before first notes
const START_DELAY = 0.07; // 70ms

// Piano constants
const FIRST_MIDI = 21; // A0
const LAST_MIDI = 108; // C8
const TOTAL_KEYS = LAST_MIDI - FIRST_MIDI + 1; // 88 keys

// Layout constants
let WIDTH = 0;
let HEIGHT = 0;
const KEYBOARD_HEIGHT = 90; // px reserved at bottom
let NOTE_FALL_DURATION = 4; // seconds from top to hit line (configurable)
const HIT_LINE_Y = HEIGHT - KEYBOARD_HEIGHT - 4; // updated on resize

// Track colors (cycling)
const TRACK_COLORS = [
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
  "#4ade80", // green-400
  "#22d3ee", // cyan-400
];

/** @type {{
 *  midi?: Midi,
 *  duration?: number,
 *  tracks: Array<{name: string, color: string, muted: boolean, solo: boolean, notes: Array<{midi:number,time:number,duration:number,velocity:number,trackIndex:number,id:string}>}>,
 *  scheduled: boolean,
 *  synths: Tone.PolySynth[],
 *  score: number,
 *  expectedNotesByTime: Map<number, Array<{midi:number, time:number, id:string, hit:boolean, trackIndex:number}>>,
 *  liveKeys: Set<number>
 * }} */
const app = {
  midi: undefined,
  duration: 0,
  tracks: [],
  scheduled: false,
  synths: [],
  score: 0,
  expectedNotesByTime: new Map(),
  liveKeys: new Set(), // keys currently pressed from Web MIDI input
  keyGlow: new Map(), // midi -> {state: 'fade-in'|'hold'|'fade-out', start:number, end?:number, color:string}
  upcomingKeys: new Set(), // keys expected within preview window
  _lastLandingFlash: new Map(), // midi -> perfNow (ms) debounce
  practice: {
    noteWait: false,
    hand: 'both', // 'left' | 'right' | 'both'
    loop: { enabled: false, start: 0, end: 0 },
    waiting: false,
    nextExpected: null, // deprecated single-note path
    groups: [], // [{time:number, notes:number[], ids:string[] }]
    currentIndex: 0,
    requiredSet: new Set(), // required midis for current wait
    hitSet: new Set(), // hit midis from user during current wait
    lastWaitTime: -1,
    stats: { total: 0, correct: 0, misses: [], timings: [] },
  },
  midiIO: {
    access: null,
    inputs: new Map(),
    outputs: new Map(),
    inId: null,
    outId: null,
    input: null,
    output: null,
    thru: false,
    tailMs: 60,
  }
};
app._originalBpm = 120; // store the song's original BPM

// Staff view removed



const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const formatTime = (sec) => {
  if (!isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

function showOverlay(text, ms = 1200) {
  overlayMsg.textContent = text;
  overlayMsg.classList.remove("hidden");
  clearTimeout(showOverlay._t);
  showOverlay._t = setTimeout(() => overlayMsg.classList.add("hidden"), ms);
}

function updatePreviousButtonLabel() {
  if (!btnLoadPrevious) return;
  try {
    const name = localStorage.getItem('lp_last_midi_name');
    if (name) {
      btnLoadPrevious.textContent = name;
      btnLoadPrevious.title = `Load previous: ${name}`;
    }
  } catch {}
}

// -------------------------------------------------------------
// Resize and canvas setup
// -------------------------------------------------------------
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  WIDTH = Math.floor(rect.width);
  HEIGHT = Math.floor(rect.height);
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  // Redraw current frame on resize
  const t = getPlaybackTime() || 0;
  drawNotes(t);
  drawKeyboard();
}

function hitLineY() {
  return HEIGHT - KEYBOARD_HEIGHT - 6;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// -------------------------------------------------------------
// Preferences (localStorage)
// -------------------------------------------------------------
const PREF_PREFIX = 'lp_pref_';
function savePref(key, value) {
  try { localStorage.setItem(PREF_PREFIX + key, JSON.stringify(value)); } catch {}
}
function loadPref(key, def) {
  try {
    const s = localStorage.getItem(PREF_PREFIX + key);
    return s == null ? def : JSON.parse(s);
  } catch { return def; }
}
function applyPrefsToUI() {
  // Mode & practice
  const mode = loadPref('mode', null);
  if (mode && modeSelect) modeSelect.value = mode;
  const practice = loadPref('practiceToggle', null);
  if (practice != null && practiceToggle) practiceToggle.checked = !!practice;
  const noteWait = loadPref('noteWait', null);
  if (noteWait != null && noteWaitToggle) noteWaitToggle.checked = !!noteWait;
  // Metronome removed
  // Tempo factor (applied to BPM later in initFromMidi)
  const tempo = loadPref('tempoFactor', null);
  if (tempo != null && speed) {
    speed.value = String(tempo);
    speedLabel.textContent = `${Math.round(tempo * 100)}%`;
  }
  // Visualization
  const radius = loadPref('radius', null);
  if (radius && radiusSelect) radiusSelect.value = radius;
  const fall = loadPref('fallTime', null);
  if (fall != null && fallTime) {
    fallTime.value = String(fall);
    NOTE_FALL_DURATION = parseFloat(fallTime.value);
    if (fallTimeLabel) fallTimeLabel.textContent = `${NOTE_FALL_DURATION.toFixed(1)}s`;
  }
  const trails = loadPref('trails', null);
  if (trails != null && trailToggle) trailToggle.checked = !!trails;
  const bounce = loadPref('bounce', null);
  if (bounce != null && bounceToggle) bounceToggle.checked = !!bounce;
  // Enhanced visuals options
  const enh = loadPref('enhanced', null);
  if (enh != null && enhancedToggle) enhancedToggle.checked = !!enh;
  const hitLine = loadPref('hitLine', null);
  if (hitLine != null && hitLineToggle) hitLineToggle.checked = !!hitLine; else if (hitLineToggle) hitLineToggle.checked = true;
  const grid = loadPref('grid', null);
  if (grid != null && gridToggle) gridToggle.checked = !!grid;
  const op = loadPref('noteOpacity', null);
  if (op != null && noteOpacity) {
    noteOpacity.value = String(op);
    if (noteOpacityLabel) noteOpacityLabel.textContent = `${Math.round(op * 100)}%`;
  }
  const glow = loadPref('glowIntensity', null);
  if (glow != null && glowIntensity) {
    glowIntensity.value = String(glow);
    if (glowIntensityLabel) glowIntensityLabel.textContent = `${parseFloat(glow).toFixed(1)}x`;
  }
  // Practice
  const hand = loadPref('hand', null);
  if (hand) setHand(hand);
  const loopEn = loadPref('loopEnabled', null);
  if (loopEn != null && loopToggle) loopToggle.checked = !!loopEn;
  const loopStart = loadPref('loopStart', null);
  if (loopStart != null && loopStartInput) loopStartInput.value = String(loopStart);
  const loopEnd = loadPref('loopEnd', null);
  if (loopEnd != null && loopEndInput) loopEndInput.value = String(loopEnd);
  // Staff prefs removed
  // MIDI settings
  const thru = loadPref('midiThru', null);
  if (thru != null && midiThruToggle) midiThruToggle.checked = !!thru;
  const tail = loadPref('tailMs', null);
  if (tail != null && tailMsInput) {
    tailMsInput.value = String(tail);
    if (tailMsLabel) tailMsLabel.textContent = `${tail}ms`;
    app.midiIO.tailMs = parseInt(tail, 10);
  }
  // Preferred device IDs
  app.midiIO.inId = loadPref('midiInId', app.midiIO.inId);
  app.midiIO.outId = loadPref('midiOutId', app.midiIO.outId);
}

// -------------------------------------------------------------
// MIDI file handling
// -------------------------------------------------------------
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    initFromMidi(midi);
    showOverlay(`Loaded: ${file.name}`);
    // Persist last MIDI in localStorage as base64
    try {
      const bytes = new Uint8Array(arrayBuffer);
      const b64 = btoa(String.fromCharCode(...bytes));
      localStorage.setItem('lp_last_midi_b64', b64);
      localStorage.setItem('lp_last_midi_name', file.name);
      updatePreviousButtonLabel();
    } catch {}
  } catch (err) {
    console.error(err);
    showOverlay("Failed to load MIDI");
  }
});

btnLoadPrevious?.addEventListener('click', () => {
  try {
    const b64 = localStorage.getItem('lp_last_midi_b64');
    if (!b64) return showOverlay('No previous MIDI saved');
    const binStr = atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i=0;i<binStr.length;i++) bytes[i] = binStr.charCodeAt(i);
    const midi = new Midi(bytes.buffer);
    initFromMidi(midi);
    const name = localStorage.getItem('lp_last_midi_name') || 'Previous MIDI';
    showOverlay(`Loaded: ${name}`);
    updatePreviousButtonLabel();
  } catch (e) {
    console.error(e);
    showOverlay('Failed to load previous MIDI');
  }
});

function initFromMidi(midi) {
  app.midi = midi;
  app.tracks = [];
  app.scheduled = false;
  app.expectedNotesByTime.clear();
  app.score = 0;
  app.liveKeys.clear();
  app.keyGlow.clear();
  scoreEl.textContent = String(app.score);
  app.practice.stats = { total: 0, correct: 0, misses: [], timings: [] };

  // Compute duration
  let duration = 0;
  midi.tracks.forEach((t) => {
    t.notes.forEach((n) => {
      duration = Math.max(duration, n.time + n.duration);
    });
  });
  app.duration = duration;

  // Set BPM from MIDI header if available
  try {
    const bpm = midi?.header?.tempos?.[0]?.bpm;
    if (bpm && isFinite(bpm)) {
      app._originalBpm = bpm;
      Tone.Transport.bpm.value = bpm;
    } else {
      app._originalBpm = 120;
      Tone.Transport.bpm.value = 120;
    }
  } catch {}

  // Reset tempo slider and label
  if (speed) {
    speed.value = '1';
    speedLabel.textContent = '100%';
  }

  // Build tracks and collect notes
  app.tracks = midi.tracks.map((t, i) => {
    const color = TRACK_COLORS[i % TRACK_COLORS.length];
    const channel = (typeof t.channel === 'number') ? t.channel : 0;
    const notes = t.notes.map((n, idx) => ({
      midi: n.midi,
      time: n.time,
      duration: n.duration,
      velocity: n.velocity,
      trackIndex: i,
      channel,
      id: `t${i}n${idx}`,
    }));
    return {
      name: t.name || `Track ${i + 1}`,
      color,
      muted: false,
      solo: false,
      channel,
      notes,
    };
  });

  // Index expected notes for scoring by quantized time bucket (100ms)
  app.expectedNotesByTime.clear();
  for (const track of app.tracks) {
    for (const n of track.notes) {
      const bucket = Math.round(n.time * 10) / 10; // 100ms buckets
      const list = app.expectedNotesByTime.get(bucket) || [];
      list.push({ midi: n.midi, time: n.time, id: n.id, hit: false, trackIndex: n.trackIndex });
      app.expectedNotesByTime.set(bucket, list);
    }
  }

  buildTrackUI();
  rescheduleTransport();
  updateTimeUI(0);
  // Staff rendering removed
  // Build practice groups for current hand
  buildPracticeGroups();
}

// -------------------------------------------------------------
// Track UI
// -------------------------------------------------------------
function buildTrackUI() {
  tracksPanel.innerHTML = "";
  app.synths.forEach((s) => s.dispose());
  app.synths = [];

  app.tracks.forEach((t, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 bg-gray-900/60 rounded-xl px-3 py-2 border border-gray-700";

    const swatch = document.createElement("span");
    swatch.className = "inline-block w-3 h-3 rounded-full";
    swatch.style.background = t.color;

    const title = document.createElement("div");
    title.className = "flex-1 truncate text-sm";
    title.textContent = t.name;

    const mute = document.createElement("button");
    mute.className = `text-xs px-2 py-1 rounded-lg ${t.muted ? "bg-rose-600" : "bg-gray-700 hover:bg-gray-600"}`;
    mute.textContent = t.muted ? "Muted" : "Mute";
    mute.onclick = () => {
      t.muted = !t.muted;
      if (t.muted) t.solo = false;
      buildTrackUI();
      rescheduleTransport();
    };

    const solo = document.createElement("button");
    solo.className = `text-xs px-2 py-1 rounded-lg ${t.solo ? "bg-emerald-600" : "bg-gray-700 hover:bg-gray-600"}`;
    solo.textContent = t.solo ? "Soloed" : "Solo";
    solo.onclick = () => {
      t.solo = !t.solo;
      if (t.solo) t.muted = false;
      buildTrackUI();
      rescheduleTransport();
    };

    row.appendChild(swatch);
    row.appendChild(title);
    row.appendChild(mute);
    row.appendChild(solo);
    tracksPanel.appendChild(row);

    // Create a polysynth per track only when using local audio
    if (shouldUseLocalAudio()) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        volume: -8,
        oscillator: { type: "triangle" },
        // Slightly longer release to reduce choppiness
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.25, release: 1.05 },
      }).toDestination();
      app.synths[idx] = synth;
    }
  });
}

// -------------------------------------------------------------
// Scheduling playback with Tone.Transport
// -------------------------------------------------------------
function scheduleIfNeeded() {
  if (!app.midi || app.scheduled) return;
  Tone.Transport.cancel();
  const now = 0;

  // Optional metronome
  // Metronome removed

  const isSoloActive = app.tracks.some((t) => t.solo);

  app.tracks.forEach((t, ti) => {
    const synth = app.synths[ti];
    const enabled = isSoloActive ? t.solo : !t.muted;
    if (!enabled) return;
    const filtered = t.notes.filter(n => handFilter(n));
    filtered.forEach((n) => {
      const time = n.time + now;
      Tone.Transport.schedule((schedTime) => {
        if (shouldUseLocalAudio() && synth) {
          synth.triggerAttackRelease(Tone.Frequency(n.midi, "midi").toFrequency(), n.duration, schedTime, n.velocity);
        }
        // Mirror to MIDI OUT with channel
        sendNoteOn(n.midi, Math.round(n.velocity * 127), t.channel);
      }, time);
      // Schedule key press visual start
      Tone.Transport.schedule(() => {
        app.liveKeys.add(n.midi);
        startKeyGlow(n.midi, true, colorForNoteObj(n));
      }, time);
      // Schedule key release visual end
      Tone.Transport.schedule(() => {
        app.liveKeys.delete(n.midi);
        startKeyGlow(n.midi, false, colorForNoteObj(n));
        // Delay external noteOff slightly to create a small sustain tail
        const offDelay = app.midiIO.tailMs / 1000;
        setTimeout(() => sendNoteOff(n.midi, t.channel), Math.max(0, offDelay * 1000));
      }, time + n.duration);
      if (modeSelect.value === 'practice') app.practice.stats.total++;
    });
  });

  // Schedule sustain pedal (CC64) events to MIDI OUT (let device handle sustain)
  if (app.midi) {
    const isSolo = isSoloActive;
    app.midi.tracks.forEach((mt, mi) => {
      const enabledTrack = isSolo ? app.tracks[mi]?.solo : !app.tracks[mi]?.muted;
      if (!enabledTrack) return;
      const channel = (typeof mt.channel === 'number') ? mt.channel : (app.tracks[mi]?.channel ?? 0);
      const cc64Arr = mt.controlChanges && (mt.controlChanges[64] || mt.controlChanges["64"]) || [];
      cc64Arr.forEach(cc => {
        const val = Math.round((cc.value ?? 0) * 127);
        Tone.Transport.schedule(() => {
          sendCC(64, val, channel);
        }, (cc.time ?? 0) + now);
      });
    });
  }

  // Practice waits: schedule pause slightly before each group time
  if (modeSelect.value === 'practice') {
    buildPracticeGroups();
    app.practice.groups.forEach((g, idx) => {
      const pauseAt = Math.max(0, g.time - 0.02);
      Tone.Transport.schedule(() => {
        maybePauseForGroup(idx);
      }, pauseAt);
    });
  }

  // Update UI every frame during playback
  Tone.Transport.scheduleRepeat(() => {
    const t = getPlaybackTime();
    updateTimeUI(t);
  // Metronome indicator removed
    updateStaffScroll(t);
    // Looping
    if (app.practice.loop.enabled) {
      const { start, end } = app.practice.loop;
      if (end > start && t >= end) {
        Tone.Transport.seconds = start;
        ctx.clearRect(0, 0, WIDTH, HEIGHT - KEYBOARD_HEIGHT);
      }
    }
  }, 0.05);

  app.scheduled = true;
}

function rescheduleTransport() {
  if (!app.midi) return;
  const wasStarted = Tone.Transport.state === "started";
  const current = Tone.Transport.seconds;
  Tone.Transport.stop();
  Tone.Transport.seconds = current;
  app.scheduled = false;
  scheduleIfNeeded();
  if (wasStarted) {
    Tone.Transport.start();
  }
}

// Metronome scheduling removed

// -------------------------------------------------------------
// Controls
// -------------------------------------------------------------
btnPlay.addEventListener("click", async () => {
  await Tone.start(); // iOS/Chrome gesture requirement
  try { Tone.getContext().lookAhead = Math.max(0.1, Tone.getContext().lookAhead || 0.12); } catch {}
  if (!app.midi) return showOverlay("Upload a MIDI file first");
  scheduleIfNeeded();
  await doCountdownIfNeeded();
  // Kick off slightly in the future to avoid initial underruns/glitches
  Tone.Transport.start(`+${START_DELAY}`);
  startAnimation();
  if (fsPlayPauseIcon) fsPlayPauseIcon.textContent = 'Pause';
  // Practice waits are scheduled via scheduleIfNeeded
});

btnPause.addEventListener("click", () => {
  Tone.Transport.pause();
  stopAnimation({ clear: false });
  if (fsPlayPauseIcon) fsPlayPauseIcon.textContent = 'Play';
});

btnStop.addEventListener("click", () => {
  Tone.Transport.stop();
  Tone.Transport.seconds = 0;
  updateTimeUI(0);
  stopAnimation({ clear: true });
  panicAll();
  if (fsPlayPauseIcon) fsPlayPauseIcon.textContent = 'Play';
});

btnRestart.addEventListener("click", () => {
  Tone.Transport.stop();
  Tone.Transport.seconds = 0;
  scheduleIfNeeded();
  // Start with a tiny offset for smoother first notes
  Tone.Transport.start(`+${START_DELAY}`);
  startAnimation();
  if (fsPlayPauseIcon) fsPlayPauseIcon.textContent = 'Pause';
});

progress.addEventListener("input", () => {
  if (!app.midi) return;
  const pct = parseFloat(progress.value) / 100;
  const t = pct * app.duration;
  // Seek directly in transport seconds to match scheduled note times
  Tone.Transport.seconds = t;
  updateTimeUI(t);
  // Clear and redraw a single clean frame on seek to avoid stacking trails
  ctx.clearRect(0, 0, WIDTH, HEIGHT - KEYBOARD_HEIGHT);
  drawNotes(t);
  drawKeyboard();
});

speed.addEventListener("input", () => {
  const v = parseFloat(speed.value);
  // Keep playbackRate at 1.0 to avoid drifting Transport.seconds vs. our visual timeline;
  // instead scale BPM around song's original BPM so events stay aligned.
  const newBpm = clamp(app._originalBpm * v, 20, 300);
  Tone.Transport.bpm.value = newBpm;
  speedLabel.textContent = `${Math.round(v * 100)}%`;
});

// Metronome toggle removed

modeSelect.addEventListener("change", () => {
  showOverlay(`${modeSelect.value === "practice" ? "Practice" : "Listen"} Mode`);
  app.practice.stats = { total: 0, correct: 0, misses: [], timings: [] };
  rescheduleTransport();
  savePref('mode', modeSelect.value);
  if (practiceToggle) practiceToggle.checked = (modeSelect.value === 'practice');
});

noteWaitToggle?.addEventListener('change', () => {
  app.practice.noteWait = noteWaitToggle.checked;
  rescheduleTransport();
  savePref('noteWait', noteWaitToggle.checked);
});

handLeftBtn?.addEventListener('click', () => setHand('left'));
handRightBtn?.addEventListener('click', () => setHand('right'));
handBothBtn?.addEventListener('click', () => setHand('both'));

loopToggle?.addEventListener('change', () => {
  app.practice.loop.enabled = loopToggle.checked;
  savePref('loopEnabled', loopToggle.checked);
});
loopStartInput?.addEventListener('input', () => {
  app.practice.loop.start = Math.max(0, parseFloat(loopStartInput.value) || 0);
  savePref('loopStart', app.practice.loop.start);
});
loopEndInput?.addEventListener('input', () => {
  app.practice.loop.end = Math.max(0, parseFloat(loopEndInput.value) || 0);
  savePref('loopEnd', app.practice.loop.end);
});

// Staff UI listeners removed

feedbackClose?.addEventListener('click', () => {
  feedbackModal.classList.add('hidden');
});

// MIDI modal wiring
openMIDISettingsBtn?.addEventListener('click', () => midiModal?.classList.remove('hidden'));
midiClose?.addEventListener('click', () => midiModal?.classList.add('hidden'));
refreshMIDI?.addEventListener('click', () => initMIDI(true));
practiceToggle?.addEventListener('change', () => {
  const on = practiceToggle.checked;
  modeSelect.value = on ? 'practice' : 'listen';
  const event = new Event('change');
  modeSelect.dispatchEvent(event);
  savePref('practiceToggle', on);
});
testNoteBtn?.addEventListener('click', () => {
  // Middle C test
  sendNoteOn(60, 100);
  setTimeout(() => sendNoteOff(60), 250 + (app.midiIO.tailMs || 0));
});
midiThruToggle?.addEventListener('change', () => {
  app.midiIO.thru = !!midiThruToggle.checked;
  savePref('midiThru', app.midiIO.thru);
});
tailMsInput?.addEventListener('input', () => {
  const v = parseInt(tailMsInput.value || '0', 10);
  app.midiIO.tailMs = v;
  if (tailMsLabel) tailMsLabel.textContent = `${v}ms`;
});

// Settings tabs switching
function showMidiTab() {
  if (!midiSettingsTab || !visualSettingsTab || !settingsTabMidi || !settingsTabVisuals) return;
  midiSettingsTab.classList.remove('hidden');
  visualSettingsTab.classList.add('hidden');
  // Active style
  settingsTabMidi.classList.add('text-blue-400', 'border-blue-500');
  settingsTabMidi.classList.remove('border-transparent');
  // Inactive style
  settingsTabVisuals.classList.remove('text-blue-400', 'border-blue-500');
  settingsTabVisuals.classList.add('border-transparent');
}
function showVisualsTab() {
  if (!midiSettingsTab || !visualSettingsTab || !settingsTabMidi || !settingsTabVisuals) return;
  midiSettingsTab.classList.add('hidden');
  visualSettingsTab.classList.remove('hidden');
  // Active style
  settingsTabVisuals.classList.add('text-blue-400', 'border-blue-500');
  settingsTabVisuals.classList.remove('border-transparent');
  // Inactive style
  settingsTabMidi.classList.remove('text-blue-400', 'border-blue-500');
  settingsTabMidi.classList.add('border-transparent');
}
settingsTabMidi?.addEventListener('click', showMidiTab);
settingsTabVisuals?.addEventListener('click', showVisualsTab);
openMIDISettingsBtn?.addEventListener('click', () => {
  midiModal?.classList.remove('hidden');
  // default to MIDI tab on open
  showMidiTab();
});

// Persist common preferences
radiusSelect?.addEventListener('change', () => savePref('radius', radiusSelect.value));
trailToggle?.addEventListener('change', () => savePref('trails', trailToggle.checked));
bounceToggle?.addEventListener('change', () => savePref('bounce', bounceToggle.checked));
// Fullscreen piano mode wiring
btnPianoMode?.addEventListener('click', () => {
  if (!pianoFs || !pianoFsCanvasWrap) return;
  canvasOriginalParent = canvas.parentElement;
  pianoFs.classList.remove('hidden');
  pianoFsCanvasWrap.appendChild(canvas);
  if (fsPlayPauseIcon) fsPlayPauseIcon.textContent = (Tone.Transport.state === 'started') ? 'Pause' : 'Play';
  requestAnimationFrame(() => resizeCanvas());
});
fsExit?.addEventListener('click', () => {
  if (!pianoFs || !canvasOriginalParent) return;
  canvasOriginalParent.appendChild(canvas);
  pianoFs.classList.add('hidden');
  requestAnimationFrame(() => resizeCanvas());
});
fsPlayPause?.addEventListener('click', async () => {
  await Tone.start();
  try {
    Tone.getContext().latencyHint = 'interactive';
    Tone.getContext().lookAhead = Math.max(0.1, Tone.getContext().lookAhead || 0.12);
  } catch {}
  if (Tone.Transport.state === 'started') {
    Tone.Transport.pause();
    fsPlayPauseIcon.textContent = 'Play';
  } else {
    scheduleIfNeeded();
    // If starting from the very beginning, apply small delay, else start immediately
    const atStart = (Tone.Transport.seconds || 0) < 0.02;
    Tone.Transport.start(atStart ? `+${START_DELAY}` : undefined);
    startAnimation();
    fsPlayPauseIcon.textContent = 'Pause';
  }
});
enhancedToggle?.addEventListener('change', () => savePref('enhanced', enhancedToggle.checked));
hitLineToggle?.addEventListener('change', () => savePref('hitLine', hitLineToggle.checked));
gridToggle?.addEventListener('change', () => savePref('grid', gridToggle.checked));
noteOpacity?.addEventListener('input', () => { const v = parseFloat(noteOpacity.value || '0.95'); savePref('noteOpacity', v); if (noteOpacityLabel) noteOpacityLabel.textContent = `${Math.round(v*100)}%`; });
glowIntensity?.addEventListener('input', () => { const v = parseFloat(glowIntensity.value || '1'); savePref('glowIntensity', v); if (glowIntensityLabel) glowIntensityLabel.textContent = `${v.toFixed(1)}x`; });

// -------------------------------------------------------------
// Drawing helpers
// -------------------------------------------------------------
function isBlackKey(midi) {
  const pitchClass = midi % 12;
  return [1, 3, 6, 8, 10].includes(pitchClass);
}

function midiToX(midi) {
  // Map MIDI 21..108 to [0, WIDTH)
  const idx = midi - FIRST_MIDI;
  const whiteKeys = [];
  for (let i = FIRST_MIDI; i <= LAST_MIDI; i++) if (!isBlackKey(i)) whiteKeys.push(i);
  const keyWidth = WIDTH / whiteKeys.length;
  // Place black keys between whites; we compute x by counting preceding white keys
  let whiteIndex = 0;
  for (let i = FIRST_MIDI; i < midi; i++) if (!isBlackKey(i)) whiteIndex++;
  let x = whiteIndex * keyWidth;
  // Center black keys between neighboring whites
  if (isBlackKey(midi)) x -= keyWidth * 0.3;
  return x;
}

function keyWidthFor(midi) {
  const whiteCount = (() => {
    let c = 0;
    for (let i = FIRST_MIDI; i <= LAST_MIDI; i++) if (!isBlackKey(i)) c++;
    return c;
  })();
  const whiteW = WIDTH / whiteCount;
  return isBlackKey(midi) ? whiteW * 0.6 : whiteW;
}

function drawKeyboard() {
  const kbY = HEIGHT - KEYBOARD_HEIGHT;
  ctx.save();
  // Background
  ctx.fillStyle = "#0b1220"; // slightly darker for contrast
  ctx.fillRect(0, kbY, WIDTH, KEYBOARD_HEIGHT);

  // White keys
  ctx.fillStyle = "#f9fafb"; // gray-50
  let wIdx = 0;
  const whiteKeys = [];
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    if (!isBlackKey(m)) {
      whiteKeys.push(m);
    }
  }
  const whiteW = WIDTH / whiteKeys.length;
  whiteKeys.forEach((m) => {
    const x = wIdx * whiteW;
    const pressed = app.liveKeys.has(m);
    // Glow level based on keyGlow state
    const glow = getKeyGlowLevel(m);
    const color = getKeyGlowColor(m, "#60a5fa");
    const fill = "#ffffff";
    ctx.fillStyle = fill;
    ctx.fillRect(x, kbY, whiteW - 1, KEYBOARD_HEIGHT);
    ctx.fillStyle = "#111827";
    ctx.fillRect(x + whiteW - 1, kbY, 1, KEYBOARD_HEIGHT);
    // colored glow overlay for pressed/highlighted white keys
    if (pressed || glow > 0.01) {
      const grad = ctx.createLinearGradient(x, kbY, x, kbY + KEYBOARD_HEIGHT);
      grad.addColorStop(0, hexToRgba(color, 0.55 * glow + (pressed ? 0.35 : 0)));
      grad.addColorStop(1, hexToRgba(color, 0.15 * glow + (pressed ? 0.15 : 0)));
      ctx.fillStyle = grad;
      ctx.fillRect(x, kbY, whiteW - 1, KEYBOARD_HEIGHT);
    }
    // red outline for visibility (stronger when pressed)
    ctx.strokeStyle = pressed ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.6)"; // red-500
    ctx.lineWidth = pressed ? 2 : 1;
    ctx.strokeRect(x + 0.5, kbY + 0.5, whiteW - 2, KEYBOARD_HEIGHT - 1);
    wIdx++;
  });

  // Black keys
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    if (isBlackKey(m)) {
      const x = midiToX(m);
      const w = keyWidthFor(m);
      const pressed = app.liveKeys.has(m);
      const glow = getKeyGlowLevel(m);
      const color = getKeyGlowColor(m, "#60a5fa");
      // base black key
      ctx.fillStyle = "#1f2937"; // gray-800
      ctx.fillRect(x, kbY, w, KEYBOARD_HEIGHT * 0.6);

      // Add colored glow overlay (pressed or glowing)
      if (pressed || glow > 0.01) {
        const grad = ctx.createLinearGradient(x, kbY, x, kbY + KEYBOARD_HEIGHT * 0.6);
        grad.addColorStop(0, hexToRgba(color, 0.6 * glow + (pressed ? 0.4 : 0)));
        grad.addColorStop(1, hexToRgba(color, 0.2 * glow + (pressed ? 0.2 : 0)));
        ctx.fillStyle = grad;
        ctx.fillRect(x, kbY, w, KEYBOARD_HEIGHT * 0.6);
      }

      // red outline for visibility (stronger when pressed)
      ctx.strokeStyle = pressed ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.6)"; // red-500
      ctx.lineWidth = pressed ? 2 : 1;
      ctx.strokeRect(x + 0.5, kbY + 0.5, w - 1, KEYBOARD_HEIGHT * 0.6 - 1);
    }
  }

  // Hit line (toggleable)
  if (!hitLineToggle || hitLineToggle.checked) {
    ctx.strokeStyle = "#38bdf8"; // sky-400
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY());
    ctx.lineTo(WIDTH, hitLineY());
    ctx.stroke();
  }

  ctx.restore();
}

function drawNotes(currentTime) {
  if (!app.midi) return;
  // Trails only applied when transport is running and time is advancing
  const timeAdvanced = lastTimeDrawn < 0 || Math.abs(currentTime - lastTimeDrawn) > 1e-3;
  if (trailToggle?.checked && Tone.Transport.state === "started" && timeAdvanced) {
    ctx.fillStyle = "rgba(9, 12, 22, 0.25)"; // darker wash
    ctx.fillRect(0, 0, WIDTH, HEIGHT - KEYBOARD_HEIGHT);
  } else {
    ctx.clearRect(0, 0, WIDTH, HEIGHT - KEYBOARD_HEIGHT);
  }
  // Background strip for fall zone for clarity
  if (enhancedToggle?.checked) {
    ctx.fillStyle = "rgba(2,6,14,0.5)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT - KEYBOARD_HEIGHT);
  }

  // Optional beat grid
  if (gridToggle?.checked) {
    drawBeatGrid(currentTime);
  }

  const drawAhead = NOTE_FALL_DURATION + 0.3; // show full fall window

  // Determine solo/mute status
  const isSoloActive = app.tracks.some((t) => t.solo);

  // For pulse animation on waiting group
  const nowMs = performance.now();
  const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(nowMs / 250)); // 0.5..1 scale-ish
  const waitingRequired = app.practice.waiting ? new Set(app.practice.requiredSet) : null;

  // Reset upcoming preview set
  app.upcomingKeys.clear();

  // Precompute minor horizontal offsets per near-same-time notes
  const overlapMap = new Map(); // key `${bucket}:${midi}` -> count index

  app.tracks.forEach((t) => {
    const enabled = isSoloActive ? t.solo : !t.muted;
    if (!enabled) return;
  const tNotes = t.notes.filter(n => handFilter(n));
    // color is based on hand, not track
    tNotes.forEach((n) => {
      const start = n.time;
      const end = n.time + n.duration;

      // Skip if already ended
      if (currentTime >= end) return;
      // Skip if too far in the future
  if (start - currentTime > drawAhead) return;

  let x = midiToX(n.midi);
  const baseW = keyWidthFor(n.midi) * 0.9;
  let w = baseW;
      const baseH = Math.max(6, n.duration * (HEIGHT - KEYBOARD_HEIGHT) / NOTE_FALL_DURATION);
      const r = getRadius();
      const targetY = hitLineY();
      const startY = -40; // offscreen start

      let y, h;
      if (currentTime < start) {
        // Falling phase before note start
        const dt = start - currentTime; // seconds until start
        const tNorm = clamp(1 - dt / NOTE_FALL_DURATION, 0, 1); // 0..1 progress of fall
        const eased = easeInOutCubic(tNorm);
        y = startY + (targetY - startY) * eased;
        h = baseH;
      } else {
        // Sustain phase: shrink height as note plays, anchored on hit line
        const remaining = end - currentTime;
        const frac = clamp(remaining / n.duration, 0, 1);
        y = targetY;
        h = Math.max(0, baseH * frac);
        if (h < 1.5) return; // effectively disappeared
      }

      // subtle anti-overlap jitter: spread notes sharing same start time bucket
      const bucket = Math.round(start * 100) / 100; // 10ms bucket
      const key = `${bucket}:${n.midi}`;
      const idx = overlapMap.get(key) || 0;
      overlapMap.set(key, idx + 1);
      x += (idx % 2 === 0 ? 1 : -1) * Math.min(2, idx);

  // Track-based color when multiple tracks; fallback to pitch when single
  const col = colorForNoteObj(n);
      // Pulse size if waiting for this note
      const isWaitingNote = waitingRequired?.has(n.midi) && Math.abs(start - currentTime) < 2; // show pulse before it reaches
      if (isWaitingNote) {
        w = baseW * (0.95 + 0.06 * pulse);
      }
      // Rounded glossy rectangle with vertical opacity gradient
      const baseOpacity = parseFloat(noteOpacity?.value || '0.95');
      const grad = ctx.createLinearGradient(x, y - h, x, y);
      grad.addColorStop(0, hexToRgba(col, Math.min(1, baseOpacity * 0.8)));
      grad.addColorStop(1, hexToRgba(shadeColor(col, -10), Math.min(1, baseOpacity * 1.0)));
      ctx.fillStyle = grad;
      roundRect(ctx, x, y - h, w, h, r);
      ctx.fill();

      // Subtle drop shadow
  ctx.save();
  const glowFactor = parseFloat(glowIntensity?.value || '1');
  ctx.shadowColor = hexToRgba(col, 0.35 * (enhancedToggle?.checked ? glowFactor : 0.8));
      ctx.shadowBlur = 8 * (enhancedToggle?.checked ? glowFactor : 0.8);
      ctx.shadowOffsetY = 2;
      roundRect(ctx, x, y - h, w, h, r);
      ctx.fill();
      ctx.restore();

      // If near start, add outline for guidance; if waiting, outline the expected note
      const nearStart = Math.abs(start - currentTime) < 0.06;
      const pressed = app.liveKeys.has(n.midi);
      const isWaitingTarget = app.practice.waiting && waitingRequired?.has(n.midi);
      if (nearStart || isWaitingTarget) {
        // Outline; red if waiting and not pressed, green if pressed
        ctx.strokeStyle = pressed ? "#22c55e" : (isWaitingTarget ? "#ef4444" : "#f43f5e");
        ctx.lineWidth = 2;
        roundRect(ctx, x, y - h, w, h, r);
        ctx.stroke();
        if (isWaitingTarget) {
          // Soft glow pulse
          ctx.save();
          ctx.shadowColor = hexToRgba('#ef4444', 0.7);
          ctx.shadowBlur = 12 * pulse * (enhancedToggle?.checked ? glowFactor : 1);
          roundRect(ctx, x, y - h, w, h, r);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Pre-highlight keys within next 0.4s
      if (start - currentTime <= 0.4 && start - currentTime > 0) {
        app.upcomingKeys.add(n.midi);
        startKeyGlow(n.midi, true, col);
      }
      // On landing, flash key once (debounced)
      if (Math.abs(start - currentTime) < 1/60) {
        const last = app._lastLandingFlash.get(n.midi) || 0;
        const now = performance.now();
        if (now - last > 120) {
          keyLandingFlash(n.midi, col);
          app._lastLandingFlash.set(n.midi, now);
        }
      }
    });
  });
}

function drawBeatGrid(currentTime) {
  const bpm = Tone.Transport.bpm.value || 120;
  const spb = 60 / bpm; // seconds per beat
  const top = 0, bottom = HEIGHT - KEYBOARD_HEIGHT;
  ctx.save();
  ctx.strokeStyle = 'rgba(148,163,184,0.2)'; // slate-400 @ 20%
  ctx.lineWidth = 1;
  const windowStart = currentTime - 0.2;
  const windowEnd = currentTime + NOTE_FALL_DURATION + 0.5;
  const firstBeatIndex = Math.ceil(windowStart / spb);
  for (let i = firstBeatIndex; i * spb <= windowEnd; i++) {
    const beatTime = i * spb;
    const dt = beatTime - currentTime;
    const tNorm = clamp(1 - dt / NOTE_FALL_DURATION, 0, 1);
    const eased = easeInOutCubic(tNorm);
    const y = (-40) + (hitLineY() - (-40)) * eased;
    if (y >= top && y <= bottom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Landing flash effect on key: white -> hand color -> fade
function keyLandingFlash(midi, col) {
  const now = performance.now();
  app.keyGlow.set(midi, { state: 'fade-in', start: now, end: now + 60, color: '#ffffff' });
  setTimeout(() => {
    startKeyGlow(midi, true, col);
    setTimeout(() => startKeyGlow(midi, false, col), 120);
  }, 70);
}

// -------------------------------------------------------------
// Animation loop
// -------------------------------------------------------------
let rafId = null;
let animRunning = false;
let lastTimeDrawn = -1;
function startAnimation() {
  if (animRunning) return;
  animRunning = true;
  cancelAnimationFrame(rafId);
  const loop = () => {
    if (!animRunning) return;
    const t = getPlaybackTime();
    drawNotes(t);
    drawKeyboard();
    // Also advance UI timer/progress here to be robust
    updateTimeUI(t);
    lastTimeDrawn = t;
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
function stopAnimation({ clear = false } = {}) {
  animRunning = false;
  cancelAnimationFrame(rafId);
  if (clear) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT - KEYBOARD_HEIGHT);
    drawKeyboard();
  }
}

// -------------------------------------------------------------
// Time/Progress UI
// -------------------------------------------------------------
function updateTimeUI(t) {
  const d = app.duration || 0;
  timeLabel.textContent = `${formatTime(t)} / ${formatTime(d)}`;
  const pct = d ? (t / d) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  if (!isNaN(clamped)) setProgressPercent(clamped);
  if (d && t >= d) {
    // Auto stop
    Tone.Transport.stop();
    stopAnimation({ clear: true });
    if (modeSelect.value === 'practice') showFeedback();
  }
}

function setProgressPercent(pct) {
  try {
    progress.value = String(pct);
    // Let CSS paint the left side using a CSS custom property
    progress.style.setProperty('--progress', `${pct}%`);
  } catch {}
}

// Staff helpers removed

// -------------------------------------------------------------
// Web MIDI I/O and scoring
// -------------------------------------------------------------
const BASE_TOLERANCE = 0.1; // ±100ms

async function initMIDI(forceRefresh = false) {
  if (!navigator.requestMIDIAccess) {
    midiStatus.textContent = "Web MIDI not supported (HTTPS/localhost).";
    if (midiConnDot) midiConnDot.style.backgroundColor = '#ef4444';
    return;
  }
  try {
    if (!app.midiIO.access || forceRefresh) {
      app.midiIO.access = await navigator.requestMIDIAccess({ sysex: false });
      app.midiIO.access.onstatechange = () => populateMIDIDevices();
    }
    populateMIDIDevices();
  } catch (e) {
    midiStatus.textContent = "MIDI access denied.";
    if (midiConnDot) midiConnDot.style.backgroundColor = '#ef4444';
  }
}

function populateMIDIDevices() {
  const access = app.midiIO.access;
  if (!access) return;
  app.midiIO.inputs = new Map(access.inputs);
  app.midiIO.outputs = new Map(access.outputs);
  // Update selects
  if (midiInSelect) {
    midiInSelect.innerHTML = '';
    for (const [id, input] of app.midiIO.inputs) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = input.name || id;
      midiInSelect.appendChild(opt);
    }
    // Keep previous selection if still present
    if (app.midiIO.inId && app.midiIO.inputs.has(app.midiIO.inId)) {
      midiInSelect.value = app.midiIO.inId;
    } else if (midiInSelect.options.length) {
      midiInSelect.selectedIndex = 0;
      app.midiIO.inId = midiInSelect.value;
    }
    // Bind input listener
    bindSelectedInput();
    midiInSelect.onchange = () => {
      app.midiIO.inId = midiInSelect.value;
      bindSelectedInput();
      savePref('midiInId', app.midiIO.inId);
    };
  }
  if (midiOutSelect) {
    midiOutSelect.innerHTML = '';
    const DEFAULT_OUT_ID = 'default';
    // Always include a default (WebAudio) option at the top
    const defOpt = document.createElement('option');
    defOpt.value = DEFAULT_OUT_ID;
    defOpt.textContent = 'Default (WebAudio)';
    midiOutSelect.appendChild(defOpt);
    for (const [id, output] of app.midiIO.outputs) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = output.name || id;
      midiOutSelect.appendChild(opt);
    }
    if (app.midiIO.outId && (app.midiIO.outId === DEFAULT_OUT_ID || app.midiIO.outputs.has(app.midiIO.outId))) {
      midiOutSelect.value = app.midiIO.outId;
    } else if (midiOutSelect.options.length) {
      // Default to WebAudio (local) by default
      midiOutSelect.value = DEFAULT_OUT_ID;
      app.midiIO.outId = DEFAULT_OUT_ID;
    }
    app.midiIO.output = (app.midiIO.outId && app.midiIO.outId !== DEFAULT_OUT_ID) ? (app.midiIO.outputs.get(app.midiIO.outId) || null) : null;
    midiOutSelect.onchange = () => {
      app.midiIO.outId = midiOutSelect.value;
      app.midiIO.output = (app.midiIO.outId && app.midiIO.outId !== DEFAULT_OUT_ID) ? (app.midiIO.outputs.get(app.midiIO.outId) || null) : null;
      savePref('midiOutId', app.midiIO.outId);
      // Rebuild synths depending on whether local audio should be used
      try { app.synths.forEach(s => s.dispose?.()); } catch {}
      app.synths = [];
      buildTrackUI();
      rescheduleTransport();
    };
  }
  // Status
  const inNames = [...app.midiIO.inputs.values()].map(i => i.name).join(', ');
  const outNames = [...app.midiIO.outputs.values()].map(o => o.name).join(', ');
  midiStatus.textContent = `MIDI In: ${inNames || '—'} | Out: ${outNames || '—'}`;
  if (midiConnDot) midiConnDot.style.backgroundColor = (app.midiIO.inputs.size || app.midiIO.outputs.size) ? '#22c55e' : '#ef4444';
}

function bindSelectedInput() {
  // Remove listener from old input
  if (app.midiIO.input) {
    try { app.midiIO.input.onmidimessage = null; } catch {}
  }
  app.midiIO.input = app.midiIO.inputs.get(app.midiIO.inId) || null;
  if (app.midiIO.input) {
    app.midiIO.input.onmidimessage = onMIDIMessage;
  }
}

function onMIDIMessage(e) {
  const [status, data1, data2] = e.data;
  const cmd = status & 0xf0;
  const note = data1;
  const velocity = data2 / 127;
  const now = Tone.Transport.seconds;

  if (cmd === 0x90 && velocity > 0) {
    // note on
    app.liveKeys.add(note);
    startKeyGlow(note, true, colorForIncoming(note) );
    if (app.midiIO.thru) sendNoteOn(note, Math.round(velocity * 127));
    checkNoteHit(note, now);
    // Practice wait: chord handling
    if (app.practice.waiting) {
      if (app.practice.requiredSet.has(note)) {
        app.practice.hitSet.add(note);
        if (isCurrentChordSatisfied()) {
          resumeFromGroupWait(now);
        }
      } else {
        flashKey(note, false);
        app.practice.stats.misses.push({ midi: note, time: now });
      }
    }
  } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
    // note off
    app.liveKeys.delete(note);
    startKeyGlow(note, false, colorForIncoming(note));
    if (app.midiIO.thru) sendNoteOff(note);
  } else if (cmd === 0xB0) {
    // Control change (e.g., sustain pedal CC64)
    const controller = data1 & 0x7f;
    const value = data2 & 0x7f;
    if (app.midiIO.thru) sendCC(controller, value);
  }
}

function checkNoteHit(midi, timeSec) {
  if (!app.midi) return false;
  const tolerance = modeSelect.value === "practice" ? BASE_TOLERANCE * 0.8 : BASE_TOLERANCE * 1.2;
  // Find nearest bucket(s)
  const bucket = Math.round(timeSec * 10) / 10;
  const neighborBuckets = [bucket, Math.round((timeSec + 0.05) * 10) / 10, Math.round((timeSec - 0.05) * 10) / 10];

  let matched = false;
  for (const b of neighborBuckets) {
    const list = app.expectedNotesByTime.get(b);
    if (!list) continue;
    for (const note of list) {
      if (!note.hit && note.midi === midi && Math.abs(note.time - timeSec) <= tolerance) {
        note.hit = true;
        matched = true;
        app.score += 1;
        scoreEl.textContent = String(app.score);
        flashKey(midi, true);
        // correct hit feedback: quick green flash
        startKeyGlow(midi, true, '#22c55e');
        setTimeout(() => startKeyGlow(midi, false, '#22c55e'), 140);
        return true;
      }
    }
  }
  // No match
  flashKey(midi, false);
  // incorrect feedback: quick red flash
  startKeyGlow(midi, true, '#ef4444');
  setTimeout(() => startKeyGlow(midi, false, '#ef4444'), 200);
  return false;
}

function flashKey(midi, ok) {
  // Temporary visual via overlay; keyboard also shows pressed state
  showOverlay(ok ? "Correct!" : "Oops", 400);
}

// Initialize prefs and MIDI on load
applyPrefsToUI();
initMIDI();

// Initial draw
drawKeyboard();

// Auto-load previous MIDI on startup if present
(function autoLoadPrevious() {
  try {
    const b64 = localStorage.getItem('lp_last_midi_b64');
    if (!b64) return;
    const binStr = atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i=0;i<binStr.length;i++) bytes[i] = binStr.charCodeAt(i);
    const midi = new Midi(bytes.buffer);
    initFromMidi(midi);
    const name = localStorage.getItem('lp_last_midi_name') || 'Previous MIDI';
    showOverlay(`Loaded previous: ${name}`);
    updatePreviousButtonLabel();
  } catch {}
})();

// ----------------------- Visual helpers -----------------------
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function hexToRgba(hex, a) {
  const c = hex.replace('#', '');
  const bigint = parseInt(c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function shadeColor(hex, percent) {
  const c = hex.replace('#', '');
  const bigint = parseInt(c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c, 16);
  let r = (bigint >> 16) & 255;
  let g = (bigint >> 8) & 255;
  let b = bigint & 255;
  r = Math.round(r * (100 + percent) / 100);
  g = Math.round(g * (100 + percent) / 100);
  b = Math.round(b * (100 + percent) / 100);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getRadius() {
  switch (radiusSelect?.value) {
    case 'square': return 2;
    case 'pill': return 24;
    case 'soft':
    default: return 10;
  }
}

// Key glow manager (fade-in 100ms, hold while pressed, fade-out 300ms). Also bounce option.
function startKeyGlow(midi, pressed, color) {
  const now = performance.now();
  const item = app.keyGlow.get(midi) || { state: 'idle', start: now, color };
  if (pressed) {
    app.keyGlow.set(midi, { state: 'fade-in', start: now, end: now + 100, color });
  } else {
    // keep last color during fade out
    app.keyGlow.set(midi, { state: 'fade-out', start: now, end: now + 300, color: item.color || color });
  }
}

function getKeyGlowLevel(midi) {
  const now = performance.now();
  const item = app.keyGlow.get(midi);
  if (!item) return 0;
  if (item.state === 'fade-in') {
    const t = clamp((now - item.start) / (item.end - item.start), 0, 1);
    if (t >= 1) app.keyGlow.set(midi, { state: 'hold', start: now, color: item.color });
    return t;
  }
  if (item.state === 'hold') {
    return 1;
  }
  if (item.state === 'fade-out') {
    const t = clamp((now - item.start) / (item.end - item.start), 0, 1);
    if (t >= 1) app.keyGlow.delete(midi);
    return 1 - t;
  }
  return 0;
}

function getKeyGlowColor(midi, fallback = "#60a5fa") {
  const item = app.keyGlow.get(midi);
  return item?.color || handColorForMidi(midi) || fallback;
}

// UI wiring for visualization controls
fallTime?.addEventListener('input', () => {
  NOTE_FALL_DURATION = parseFloat(fallTime.value);
  fallTimeLabel.textContent = `${NOTE_FALL_DURATION.toFixed(1)}s`;
  savePref('fallTime', NOTE_FALL_DURATION);
});

// ------------------------- Practice helpers -------------------------
function setHand(hand) {
  app.practice.hand = hand;
  if (handLeftBtn && handRightBtn && handBothBtn) {
    handLeftBtn.className = `px-2 py-1 ${hand === 'left' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`;
    handBothBtn.className = `px-2 py-1 ${hand === 'both' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`;
    handRightBtn.className = `px-2 py-1 ${hand === 'right' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`;
  }
  buildPracticeGroups();
  rescheduleTransport();
}

function handFilter(n) {
  if (app.practice?.hand === 'left') return n.midi < 60;
  if (app.practice?.hand === 'right') return n.midi >= 60;
  return true;
}

async function doCountdownIfNeeded() {
  if (modeSelect.value !== 'practice') return;
  if (!countdownEl) return;
  countdownEl.classList.remove('hidden');
  for (let i = 3; i >= 1; i--) {
    countdownEl.textContent = String(i);
    await sleep(500);
  }
  countdownEl.classList.add('hidden');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Metronome indicator removed

function initNoteWait() {
  const t = Tone.Transport.seconds;
  const all = app.tracks.flatMap((tr, ti) => tr.notes.map(n => ({...n, color: app.tracks[ti].color})));
  const next = all.filter(handFilter).filter(n => n.time >= t).sort((a,b)=>a.time-b.time)[0];
  if (next) {
    app.practice.waiting = true;
    app.practice.nextExpected = { midi: next.midi, time: next.time, id: next.id, color: next.color };
    Tone.Transport.pause();
  }
}

// Practice mode v2: grouped waits
function buildPracticeGroups() {
  if (!app.midi) { app.practice.groups = []; return; }
  const all = app.tracks.flatMap((tr) => tr.notes);
  const filtered = all.filter(n => handFilter(n));
  const sorted = filtered.sort((a,b)=>a.time - b.time);
  const groups = [];
  const tol = 0.05; // 50ms grouping tolerance
  let current = null;
  for (const n of sorted) {
    if (!current || Math.abs(n.time - current.time) > tol) {
      current = { time: n.time, notes: [n.midi], ids: [n.id] };
      groups.push(current);
    } else {
      current.notes.push(n.midi);
      current.ids.push(n.id);
    }
  }
  app.practice.groups = groups;
  app.practice.currentIndex = 0;
}

function maybePauseForGroup(index) {
  if (!app.practice.noteWait || modeSelect.value !== 'practice') return;
  const g = app.practice.groups[index];
  if (!g) return;
  const t = Tone.Transport.seconds;
  // Avoid pausing if we're already past this group
  if (t > g.time + 0.02) return;
  // Set wait state if not already waiting for this index
  if (app.practice.waiting && app.practice.currentIndex === index) return;
  app.practice.waiting = true;
  app.practice.currentIndex = index;
  app.practice.requiredSet = new Set(g.notes);
  app.practice.hitSet = new Set();
  app.practice.lastWaitTime = g.time;
  Tone.Transport.pause();
}

function isCurrentChordSatisfied() {
  if (!app.practice.waiting) return false;
  for (const n of app.practice.requiredSet) {
    if (!app.practice.hitSet.has(n)) return false;
  }
  return true;
}

function resumeFromGroupWait(now) {
  app.practice.waiting = false;
  // Mark stats for chord
  app.practice.stats.correct += app.practice.requiredSet.size;
  const delta = now - (app.practice.lastWaitTime ?? now);
  app.practice.stats.timings.push(delta);
  // Resume transport; events at the group time will play (we paused just before)
  Tone.Transport.start();
}

function showFeedback() {
  if (!feedbackModal) return;
  const { total, correct, timings, misses } = app.practice.stats;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  if (accPercentEl) accPercentEl.textContent = String(percent);
  if (accCorrectEl) accCorrectEl.textContent = String(correct);
  if (accTotalEl) accTotalEl.textContent = String(total);
  if (missListEl) {
    missListEl.innerHTML = '';
    misses.forEach(m => {
      const li = document.createElement('li');
      li.textContent = `Note ${m.midi} at ${formatTime(m.time)}`;
      missListEl.appendChild(li);
    });
  }
  try { localStorage.setItem('practiceStats', JSON.stringify(app.practice.stats)); } catch {}
  feedbackModal.classList.remove('hidden');
}

// Staff view removed

// ------------------------- MIDI helpers -------------------------
function sendNoteOn(midi, velocity = 100, channel = 0) {
  const out = app.midiIO.output;
  if (!out) return;
  const status = 0x90 | (channel & 0x0f);
  try { out.send([status, midi & 0x7f, clamp(velocity, 0, 127)]); } catch {}
}
function sendNoteOff(midi, channel = 0) {
  const out = app.midiIO.output;
  if (!out) return;
  const status = 0x80 | (channel & 0x0f);
  try { out.send([status, midi & 0x7f, 0x00]); } catch {}
}
function sendCC(controller, value, channel = 0) {
  const out = app.midiIO.output;
  if (!out) return;
  const status = 0xB0 | (channel & 0x0f);
  try { out.send([status, controller & 0x7f, clamp(value, 0, 127)]); } catch {}
}

function panicAll() {
  // Send sustain off and all notes off on channels 1..16
  for (let ch = 0; ch < 16; ch++) {
    sendCC(64, 0, ch); // sustain off
    const out = app.midiIO.output;
    if (!out) continue;
    try { out.send([0xB0 | ch, 123, 0]); } catch {}
  }
}

function handColorForMidi(midi) {
  // Left = Blue (#60a5fa), Right = Orange (#fb923c)
  return midi < 60 ? '#60a5fa' : '#fb923c';
}

// Track-aware color: if multiple tracks exist, use track index palette mapping
function colorForNoteObj(n) {
  const trackCount = app.tracks?.length || 0;
  if (trackCount > 1) {
    // For two tracks, treat 0=left(blue), 1=right(orange). For >2, cycle palette.
    if (n.trackIndex === 0) return '#60a5fa';
    if (n.trackIndex === 1) return '#fb923c';
    return TRACK_COLORS[n.trackIndex % TRACK_COLORS.length] || '#a78bfa';
  }
  return handColorForMidi(n.midi);
}

// For incoming user notes, infer likely track by finding nearest scheduled note at this pitch
function colorForIncoming(midi) {
  const trackCount = app.tracks?.length || 0;
  if (trackCount <= 1) return handColorForMidi(midi);
  const now = Tone.Transport.seconds;
  let best = null;
  for (let ti = 0; ti < app.tracks.length; ti++) {
    const notes = app.tracks[ti].notes;
    // Find nearest note with same midi within small window
    let nearestDt = Infinity;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.midi !== midi) continue;
      const dt = Math.abs(n.time - now);
      if (dt < nearestDt) {
        nearestDt = dt;
        best = { trackIndex: ti };
      }
      if (dt < 0.02) break; // good enough
    }
  }
  if (best) {
    if (best.trackIndex === 0) return '#60a5fa';
    if (best.trackIndex === 1) return '#fb923c';
    return TRACK_COLORS[best.trackIndex % TRACK_COLORS.length] || '#a78bfa';
  }
  // Fallback
  return handColorForMidi(midi);
}

// Use local audio only when no MIDI output device is selected
function shouldUseLocalAudio() {
  // Only use local audio if the selected output is the default (WebAudio)
  return !app.midiIO.output; // output is null when 'default' is selected
}

// ------------------------- Time helpers -------------------------
// Return raw transport seconds for UI/progress to match scheduled events exactly.
function getPlaybackTime() { try { return Tone.Transport.seconds || 0; } catch { return 0; } }

