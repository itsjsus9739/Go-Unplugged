# Música original sintetizada (sin pistas de terceros) para el video del stand, 50 s.
import sys, wave
import numpy as np
SR = 44100; DUR = 50.0; N = int(SR * DUR)
t = np.arange(N) / SR
out = np.zeros((N, 2))

def note(f): return 440.0 * 2 ** ((f - 69) / 12)
def env(n, a=0.02, r=0.3):
    e = np.ones(n); ai = int(a * SR); ri = int(r * SR)
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR); j = min(N, i + len(sig)); s = sig[: j - i] * gain
    out[i:j, 0] += s * (1 - max(0, pan)); out[i:j, 1] += s * (1 + min(0, pan))

def pad(freqs, start, dur, gain):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):  # leve desafinación = calidez
            s += np.sin(2 * np.pi * f * (1 + det / 100) * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)
    s /= len(freqs) * 3; add(s * env(n, 0.6, 0.8), start, gain)

def kick(start, gain=0.9):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 110 * np.exp(-tt * 18) + 42; ph = 2 * np.pi * np.cumsum(f) / SR
    add(np.sin(ph) * np.exp(-tt * 9), start, gain)

def hat(start, gain=0.05):
    n = int(0.05 * SR); s = np.random.default_rng(int(start * 1000)).standard_normal(n)
    s = np.diff(np.concatenate([[0], s])) * np.exp(-np.arange(n) / SR * 80)  # agudo suave
    add(s, start, gain, pan=0.3)

def pluck(midi, start, gain=0.18, pan=0.0):
    n = int(0.6 * SR); tt = np.arange(n) / SR; f = note(midi)
    s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 6)
    add(s, start, gain, pan)

def bass(midi, start, dur, gain=0.35):
    n = int(dur * SR); tt = np.arange(n) / SR; f = note(midi)
    add(np.tanh(2 * np.sin(2 * np.pi * f * tt)) * env(n, 0.01, 0.15), start, gain)

# Progresión: Am – F – C – G (en tríadas graves), 100 BPM
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
roots = [45, 41, 48, 43]
beat = 60 / 100; bar = 4 * beat

# 0–9.4: solo pad, golpe en el 00:00 (2.4 s)
c = 0; x = 0.0
while x < DUR - 1.5:
    pad([note(m) for m in chords[c % 4]], x, bar + 0.6, 0.16 if x < 9.4 else 0.12)
    c += 1; x += bar
kick(2.4, 1.1); add(np.random.default_rng(1).standard_normal(int(0.4 * SR)) * np.exp(-np.arange(int(0.4 * SR)) / SR * 12) * 0.08, 2.4)

# 9.4–43.4: ritmo
x = 9.6; i = 0
while x < 43.2:
    b = int((x - 0.0) / bar) % 4
    if i % 4 == 0 or i % 4 == 2: kick(x, 0.55 if x < 21.8 else 0.7)
    if x > 21.8: hat(x + beat / 2)
    if i % 2 == 0: bass(roots[b], x, beat * 0.9, 0.22 if x < 21.8 else 0.3)
    if x > 21.8 and i % 2 == 1: pluck(chords[b][(i // 2) % 3] + 12, x, 0.12, pan=-0.2 if i % 4 == 1 else 0.2)
    x += beat; i += 1

# Acentos: notificación (13.4) y "Pareja" (27.0)
for k, m in enumerate([76, 79, 84]): pluck(m, 13.4 + k * 0.09, 0.14)
for k, m in enumerate([72, 76, 79]): pluck(m, 27.0 + k * 0.08, 0.12)

# Cierre: acorde final (43.4)
pad([note(m) for m in [57, 60, 64, 69]], 43.4, 6.6, 0.22); kick(43.4, 0.8)
for k, m in enumerate([69, 72, 76, 81]): pluck(m, 43.5 + k * 0.12, 0.12)

# Mezcla: suave y sin picos
out /= np.max(np.abs(out)) + 1e-9; out *= 0.7
fade = int(1.2 * SR); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
pcm = (out * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
