# Go Unplugged — música del video del stand (v2, "más viva"). 47 s, 124 BPM.
# Sintetizada con NumPy (sin pistas de terceros). Uso: python3 music.py salida.wav
# Los golpes están sincronizados con los tiempos de index.html.
import sys, wave
import numpy as np

SR = 44100; DUR = 47.0; N = int(SR * DUR)
out = np.zeros((N, 2))
rng = np.random.default_rng(7)
BPM = 124; BEAT = 60 / BPM; BAR = 4 * BEAT
GROOVE = 5.2          # entra el ritmo (escena 2)
DROP = 39.95          # cierre

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def env(n, a=0.005, r=0.1):
    e = np.ones(n); ai = max(1, int(a * SR)); ri = max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri); return e
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig)); s = sig[: j - i] * gain
    out[i:j, 0] += s * (1 - max(0, pan)); out[i:j, 1] += s * (1 + min(0, pan))
def lowpass(x, a):  # filtro de un polo (a: 0..1, menor = más oscuro)
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y

# ---------- instrumentos ----------
def kick(t0, g=1.0):
    n = int(0.42 * SR); tt = np.arange(n) / SR
    f = 150 * np.exp(-tt * 28) + 45; ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 7.5) + 0.25 * rng.standard_normal(n) * np.exp(-tt * 120)
    add(np.tanh(1.6 * s), t0, g)
def clap(t0, g=0.32):
    n = int(0.25 * SR); tt = np.arange(n) / SR; nz = rng.standard_normal(n)
    e = sum(np.exp(-np.clip(tt - d, 0, None) * 60) * (tt >= d) for d in (0, 0.011, 0.022))
    add(np.diff(np.concatenate([[0], nz])) * e * 0.6, t0, g, pan=0.05)
def hat(t0, g=0.06, open_=False):
    n = int((0.22 if open_ else 0.05) * SR); tt = np.arange(n) / SR
    s = np.diff(np.concatenate([[0], rng.standard_normal(n)])) * np.exp(-tt * (14 if open_ else 70))
    add(s, t0, g, pan=0.25)
def bass(m, t0, dur, g=0.36):
    n = int(dur * SR); tt = np.arange(n) / SR; f = mtof(m)
    s = np.tanh(2.2 * (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt)))
    add(s * env(n, 0.004, 0.06), t0, g)
def pluck(m, t0, g=0.15, pan=0.0, dec=7):
    n = int(0.5 * SR); tt = np.arange(n) / SR; f = mtof(m)
    s = (np.sign(np.sin(2 * np.pi * f * tt)) * 0.25 + np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt))
    add(s * np.exp(-tt * dec) * env(n, 0.002, 0.05), t0, g, pan)
def bell(m, t0, g=0.2, pan=0.0):
    n = int(1.2 * SR); tt = np.arange(n) / SR; f = mtof(m)
    s = np.sin(2 * np.pi * f * tt + 1.5 * np.sin(2 * np.pi * f * 3.5 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 3.5)
    add(s, t0, g, pan)
def tick(t0, g=0.12):
    n = int(0.02 * SR); tt = np.arange(n) / SR
    add(np.sin(2 * np.pi * 2600 * tt) * np.exp(-tt * 300), t0, g, pan=-0.2)
def whoosh(t0, dur, g=0.22, up=True):
    n = int(dur * SR); x = np.linspace(0, 1, n); nz = rng.standard_normal(n)
    a = (0.02 + 0.5 * (x if up else 1 - x) ** 2)
    s = lowpass(nz, 0.2) * 0.0 + nz
    y = np.empty(n); acc = 0.0
    for k in range(n): acc += a[k] * (s[k] - acc); y[k] = acc
    shape = np.sin(np.pi * x) ** 1.5 if not up else x ** 2
    add(y * shape, t0, g)
def impact(t0, g=1.0):
    kick(t0, 1.2 * g)
    n = int(1.6 * SR); tt = np.arange(n) / SR
    add(np.sin(2 * np.pi * 42 * tt) * np.exp(-tt * 2.2), t0, 0.6 * g)       # sub
    nz = rng.standard_normal(int(0.7 * SR)); add(nz * np.exp(-np.arange(len(nz)) / SR * 7), t0, 0.12 * g)

# ---------- armonía ----------
PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]   # Am F C G
ROOT = [45, 41, 48, 43]
def chord_at(t): return int(max(0, t - GROOVE) / BAR) % 4

def pad_layer():
    sig = np.zeros(N); tt = np.arange(N) / SR
    for c in range(int(DUR / BAR) + 2):
        t0 = c * BAR; i0 = int(t0 * SR); i1 = min(N, int((t0 + BAR + 0.3) * SR))
        if i0 >= N: break
        seg = np.zeros(i1 - i0); ts = tt[i0:i1]
        for m in PROG[c % 4]:
            for det in (-0.15, 0, 0.15):
                ph = 2 * np.pi * mtof(m + 12) * (1 + det / 100) * ts
                seg += np.sin(ph) + 0.3 * np.sin(2 * ph)
        sig[i0:i1] += seg * env(len(seg), 0.08, 0.3) / 9
    return sig

pad = pad_layer()
# "bombeo": el pad respira con cada bombo una vez que entra el ritmo
pump = np.ones(N); tt = np.arange(N) / SR
mask = (tt > GROOVE) & (tt < DROP + 4)
phase = ((tt - GROOVE) % BEAT) / BEAT
pump[mask] = 0.35 + 0.65 * np.clip(phase[mask] * 2.2, 0, 1)
vol = np.interp(tt, [0, 2.0, 2.1, 5.2, 20.6, 39.9, 40.0, 46, 47], [0.10, 0.18, 0.22, 0.18, 0.15, 0.17, 0.26, 0.2, 0])
out[:, 0] += pad * pump * vol; out[:, 1] += pad * pump * vol

# ---------- escena 1: tic-tac acelerado → golpe en 00:00 ----------
x = 0.3; gap = 0.22
while x < 2.08:
    tick(x, 0.10 + 0.08 * x / 2.1); x += gap; gap = max(0.05, gap * 0.86)
whoosh(0.6, 1.5, 0.12, up=True)
impact(2.1)
for i, a in enumerate((2.95, 3.2, 3.45)):       # toques en "Ignorar límite"
    tick(a, 0.25); pluck(76 + i * 3, a + 0.01, 0.10)
bell(64, 3.75, 0.12)                             # "Y te lo saltas tú mismo."

# ---------- transiciones ----------
for a, d in ((4.45, 0.75), (8.6, 0.75), (20.2, 0.7), (32.3, 0.7)):
    whoosh(a, d, 0.24, up=False)
whoosh(38.4, 1.55, 0.28, up=True)                # subida al cierre

# ---------- ritmo ----------
t0 = GROOVE; i = 0
while t0 < DROP - 0.05:
    b = i % 4; c = chord_at(t0); plans = 20.6 <= t0 < 32.7
    kick(t0, 0.85)
    if b in (1, 3): clap(t0, 0.30 if t0 > 8.9 else 0.2)
    for s16 in range(4):                          # hats en semicorcheas
        ts = t0 + s16 * BEAT / 4
        hat(ts, (0.05 if s16 % 2 else 0.028) * (1.2 if plans else 1))
    if t0 > 8.9: hat(t0 + BEAT / 2, 0.05, open_=True)
    # bajo a contratiempo (octavas)
    bass(ROOT[c], t0 + BEAT / 2, BEAT * 0.45, 0.30)
    if b == 3: bass(ROOT[c] + 12, t0 + 3 * BEAT / 4, BEAT * 0.22, 0.2)
    # arpegio desde la escena 3, más denso en planes
    if t0 > 9.3:
        notes = PROG[c] + [PROG[c][0] + 12]
        steps = 4 if (plans or t0 > 33.2) else 2
        for k in range(steps):
            pluck(notes[(i * steps + k) % 4] + 12, t0 + k * BEAT / steps, 0.075, pan=(-0.35 if k % 2 else 0.35))
    t0 += BEAT; i += 1

# ---------- acentos de interfaz ----------
for k, m in enumerate((79, 84, 88)): bell(m, 12.5 + k * 0.07, 0.13, pan=0.3)       # petición enviada
tick(16.6, 0.3)                                                                   # toque "Darle 15 min"
for k, m in enumerate((72, 76, 79, 84)): bell(m, 16.95 + k * 0.08, 0.13, pan=-0.3) # aprobado
for k, a in enumerate((22.2, 23.2, 24.2, 25.4)): pluck(72 + k * 3, a + 0.25, 0.16)  # cada plan
for k, m in enumerate((84, 88, 91, 96)): bell(m, 24.7 + k * 0.05, 0.08)          # brillo en "Pareja"
for k, a in enumerate((35.1, 36.0, 36.9)): pluck(79 + k * 2, a, 0.14)              # checks del pago
bell(81, 37.7, 0.16)                                                               # sticker 7 días

# ---------- cierre ----------
impact(DROP, 0.9)
for k, m in enumerate((69, 72, 76, 81, 84)): bell(m, DROP + 0.05 + k * 0.09, 0.12, pan=(-0.3 + k * 0.15))
b2 = 0                                             # groove suave hasta el final
while DROP + 0.9 + b2 * BEAT < 46.3:
    a = DROP + 0.9 + b2 * BEAT; g = 0.55 * (1 - 0.6 * b2 / 13)
    kick(a, g); hat(a + BEAT / 2, 0.035, open_=True)
    if b2 % 2: clap(a, 0.16)
    if b2 % 4 == 0: bass(ROOT[(b2 // 4) % 4], a + BEAT / 2, BEAT * 1.4, 0.22)
    if b2 % 2 == 0: pluck([81, 84, 88, 84][(b2 // 2) % 4], a, 0.06, pan=0.3)
    b2 += 1

# ---------- master ----------
out = np.tanh(out * 1.4)                           # compresión suave
out /= np.max(np.abs(out)) + 1e-9; out *= 0.89
fi = int(0.05 * SR); out[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(1.5 * SR); out[-fo:] *= np.linspace(1, 0, fo)[:, None]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print('ok')
