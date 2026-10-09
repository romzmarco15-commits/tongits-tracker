/* Tongits sound system - synthesized locally with Web Audio (offline-safe). */
const SOUND_SETTINGS_KEY = "tongitsTrackerSoundSettingsV1";
let soundSettings = { soundEffects: true, clickSounds: true };
let tongitsAudioContext = null;

function loadSoundSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) || "null");
        if (saved && typeof saved === "object") {
            soundSettings.soundEffects = saved.soundEffects !== false;
            soundSettings.clickSounds = saved.clickSounds !== false;
        }
    } catch (_) {}
    return soundSettings;
}
function saveSoundSettings() {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(soundSettings));
}
function setSoundEffectsEnabled(enabled) { soundSettings.soundEffects = Boolean(enabled); saveSoundSettings(); }
function setClickSoundsEnabled(enabled) { soundSettings.clickSounds = Boolean(enabled); saveSoundSettings(); }
function audioContext() {
    if (!tongitsAudioContext) tongitsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (tongitsAudioContext.state === "suspended") tongitsAudioContext.resume();
    return tongitsAudioContext;
}
function tone(freq, duration=0.08, volume=0.035, type="sine", delay=0) {
    const ctx = audioContext(); const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t + duration + 0.02);
}
function playClickSound() {
    if (!soundSettings.clickSounds) return;
    tone(720, 0.035, 0.018, "sine"); tone(980, 0.025, 0.009, "sine", 0.012);
}
function playSoundEffect(name) {
    if (!soundSettings.soundEffects) return;
    if (name === "coin") { tone(1250,.07,.035,"sine"); tone(1750,.06,.022,"sine",.035); }
    else if (name === "coins") { [0,.07,.14].forEach((d,i)=>{tone(1050+i*180,.07,.03,"sine",d);tone(1650+i*120,.05,.016,"sine",d+.025);}); }
    else if (name === "win") { [523,659,784,1047].forEach((f,i)=>tone(f,.16,.04,"sine",i*.09)); }
    else if (name === "yehey") {
        // A playful victory fanfare, synthesized locally without external audio files.
        [523,659,784,1047,988,1175,1319,1568].forEach((f,i)=>tone(f,i<4?.19:.25,.043,i%3===0?"triangle":"sine",i*.105));
        [0,.14,.28].forEach((d,i)=>tone(220+i*110,.09,.025,"triangle",.88+d));
    }
    else if (name === "potwin") { [392,523,659,784,1047,1319].forEach((f,i)=>tone(f,.22,.045,"triangle",i*.075)); }
    else if (name === "roll") { tone(440 + Math.random()*520,.045,.022,"square"); }
    else if (name === "reveal") { [659,784,988,1319].forEach((f,i)=>tone(f,.18,.04,"sine",i*.075)); }
    else if (name === "fire") { [330,440,554,659,880].forEach((f,i)=>tone(f,.11,.03,"sawtooth",i*.055)); }
    else if (name === "magic") { [880,1175,1568].forEach((f,i)=>tone(f,.2,.025,"sine",i*.08)); }
    else if (name === "jackpot") { [523,659,784,1047,1319].forEach((f,i)=>tone(f,.2,.04,"triangle",i*.07)); setTimeout(()=>playSoundEffect("coins"),260); }
}
function updateSoundSettingButtons() {
    const fx = document.getElementById("soundEffectsToggle"); const clicks = document.getElementById("clickSoundsToggle");
    if (fx) { fx.classList.toggle("selected", soundSettings.soundEffects); fx.setAttribute("aria-pressed", String(soundSettings.soundEffects)); fx.textContent = soundSettings.soundEffects ? "🔊 Sound Effects  ON" : "🔇 Sound Effects  OFF"; }
    if (clicks) { clicks.classList.toggle("selected", soundSettings.clickSounds); clicks.setAttribute("aria-pressed", String(soundSettings.clickSounds)); clicks.textContent = soundSettings.clickSounds ? "👆 Click Sounds  ON" : "👆 Click Sounds  OFF"; }
}
loadSoundSettings();
document.addEventListener("click", e => { if (e.target.closest("button, .player-select-button, .pot-area")) playClickSound(); }, true);
