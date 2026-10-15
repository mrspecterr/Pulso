#!/usr/bin/env python3
# Gerador de SFX do PULSO (Etapa 11 — Áudio e feedback).
#
# Todo o áudio do jogo é SINTETIZADO aqui (síntese aditiva + ruído com
# envelopes), coerente com a filosofia do projeto: zero assets externos,
# tudo procedural. Rode `python3 scripts/gen_sfx.py` para regenerar os
# WAVs em assets/sfx/ (16-bit PCM mono 22.05 kHz — pequenos e rápidos).
#
# O jogo acontece num subsolo: armas abafadas, beeps de engenharia,
# o Diapasão cantando. Nada de hollywood — ressonância de estação.

import math
import os
import random
import struct
import wave

SR = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')

random.seed(11)  # determinístico: mesmo áudio em toda geração


def silence(dur):
    return [0.0] * int(SR * dur)


def mix(*layers):
    n = max(len(l) for l in layers)
    out = [0.0] * n
    for l in layers:
        for i, v in enumerate(l):
            out[i] += v
    return out


def gain(buf, g):
    return [v * g for v in buf]


def env_exp(dur, k):
    """Envelope exponencial decrescente: 1 -> ~0 em `dur` segundos."""
    n = int(SR * dur)
    return [math.exp(-k * i / SR * dur) for i in range(n)]


def sine(freq, dur, a=0.0, d=0.0):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        f = freq(t) if callable(freq) else freq
        ph = 2 * math.pi * (f * t if callable(freq) else f * t)
        e = 1.0
        if a > 0 and t < a:
            e = t / a
        out.append(math.sin(ph) * e)
    return out


def noise(dur):
    return [random.uniform(-1, 1) for _ in range(int(SR * dur))]


def lp(buf, cutoff_hz):
    """Filtro passa-baixa simples (média exponencial de 1 polo)."""
    a = math.exp(-2 * math.pi * cutoff_hz / SR)
    out = []
    y = 0.0
    for x in buf:
        y = (1 - a) * x + a * y
        out.append(y)
    return out


def hp(buf, cutoff_hz):
    low = lp(buf, cutoff_hz)
    return [x - y for x, y in zip(buf, low)]


def apply_env(buf, env):
    n = min(len(buf), len(env))
    return [buf[i] * env[i] for i in range(n)] + [0.0] * (len(buf) - n)


def delay(buf, sec, feedback=0.0):
    d = int(SR * sec)
    out = list(buf) + [0.0] * d
    if feedback > 0:
        for i in range(len(out)):
            j = i - d
            if j >= 0:
                out[i] += out[j] * feedback
    return out


def normalize(buf, peak=0.86):
    m = max(1e-9, max(abs(v) for v in buf))
    return [v / m * peak for v in buf]


def clamp_soft(buf, drive=1.2):
    return [math.tanh(v * drive) / math.tanh(drive) for v in buf]


def write(name, buf):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    data = b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in buf)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    print(f'  {name:22s} {len(buf) / SR:5.2f}s  {os.path.getsize(path) // 1024:4d} KB')


# ---------------------------------------------------------------- armas --

def gun_shot(body_hz, dur, bright, crack_hz, tail=0.0):
    """Tiro genérico: estalido + corpo grave + rajada de ruído filtrada."""
    # estalido do percussor (transiente aguda, curtíssima)
    click = hp(noise(0.006), 2500)
    click = apply_env(click, env_exp(0.006, 12))
    # corpo: ruído filtrado na banda do cano
    nb = lp(noise(dur), bright)
    nb = hp(nb, crack_hz)
    # pancada grave (o "bum" do calibre)
    sub = sine(body_hz, dur * 0.8)
    sub = apply_env(sub, env_exp(dur * 0.8, 7))
    body = gain(nb, 0.8)
    shot = mix(gain(click, 0.9), gain(body, 1.0), gain(sub, 0.75))
    if tail > 0:
        # eco curto do subsolo (parede de concreto a ~10 m)
        shot = delay(shot, 0.045, feedback=0.28)
    return normalize(clamp_soft(shot, 1.15))


sfx_fire_staccato = gun_shot(150, 0.14, 2600, 500)          # pistola: seca
sfx_fire_legato = gun_shot(95, 0.19, 3400, 350, tail=1)     # fuzil: mais corpo + eco
_bot_far = gun_shot(85, 0.24, 900, 180, tail=1)              # tiro inimigo: abafado, distante
sfx_fire_bot = normalize(gain(lp(_bot_far, 1500), 0.8))

# -------------------------------------------------------------- recarga --

def mech_click(dur, tone, noise_amt=0.5):
    c = hp(noise(dur), 1800)
    c = apply_env(c, env_exp(dur, 10))
    t = apply_env(sine(tone, dur), env_exp(dur, 9))
    return gain(mix(gain(c, noise_amt), gain(t, 0.6)), 1.0)

sfx_reload_click = normalize(mix(
    gain(mech_click(0.03, 900, 0.8), 1.0),                    # pente sai
    gain(mech_click(0.045, 620, 0.9), 0.7)[:0],              # (espaço)
))
# segundo clique deslocado no tempo (pente caindo na mesa)
_shift = silence(0.055) + gain(mech_click(0.05, 700, 1.0), 0.8)
sfx_reload_click = normalize(mix(sfx_reload_click, _shift))

sfx_reload_slam = normalize(mix(
    gain(mech_click(0.05, 750, 1.0), 1.0),                   # pente entra
    silence(0.07) + gain(mech_click(0.04, 1150, 1.1), 0.9),  # ferrolho
    silence(0.135) + gain(mech_click(0.03, 1500, 0.9), 0.55) # "pronto"
))

sfx_dry = normalize(mech_click(0.045, 2100, 1.2))

# ------------------------------------------------------------ acertos ----

def tick(freq, dur, k=14):
    t = apply_env(sine(freq, dur), env_exp(dur, k))
    n = apply_env(hp(noise(dur), 3500), env_exp(dur, 22))
    return mix(gain(t, 0.8), gain(n, 0.25))

sfx_hit = normalize(tick(1750, 0.055))
sfx_headshot = normalize(mix(
    gain(tick(2300, 0.05), 1.0),
    silence(0.055) + gain(tick(3100, 0.07), 0.85),           # segundo estalo agudo
))
sfx_kill = normalize(mix(
    gain(tick(880, 0.09), 0.95),
    silence(0.095) + gain(tick(1318, 0.16), 0.95),           # quinta acima: "confirmado"
    silence(0.095) + gain(lp(noise(0.2), 700), 0.06),        # swoosh sutil
))

# ------------------------------------------------------------- jogador ---

def thump():
    sub = apply_env(sine(65, 0.16), env_exp(0.16, 9))
    mid = apply_env(lp(noise(0.09), 500), env_exp(0.09, 14))
    return mix(gain(sub, 1.0), gain(mid, 0.55))

sfx_hurt = normalize(clamp_soft(thump(), 1.4))

# ------------------------------------------------------------ Diapasão ---

def ping(freq, dur, k=6):
    """Ping sonar: fundamental + oitava, cauda suave."""
    t = mix(
        apply_env(sine(freq, dur), env_exp(dur, k)),
        gain(apply_env(sine(freq * 2, dur * 0.7), env_exp(dur * 0.7, k * 1.6)), 0.4),
    )
    return t

sfx_plant_tick = normalize(ping(1150, 0.14, 7))

sfx_planted = normalize(mix(
    gain(ping(392, 0.22, 5), 0.9),
    silence(0.14) + gain(ping(523, 0.22, 5), 0.95),
    silence(0.28) + gain(ping(784, 0.42, 4), 0.95),          # arma: sobe uma oitava
    silence(0.28) + gain(lp(noise(0.5), 1400), 0.04),
))

sfx_charge_beep = normalize(mix(
    gain(sine(1500, 0.075), 0.85),
    gain(sine(3000, 0.075), 0.18),                            # brilho harmônico
))
# envolvimento trapezoidal (liga já forte, corta limpo)
_n = len(sfx_charge_beep)
for _i in range(_n):
    _t = _i / _n
    if _t > 0.82:
        sfx_charge_beep[_i] *= (1 - _t) / 0.18

# ------------------------------------------------------------- desfechos -

def boom():
    """Detonação do PULSO: cratera, sub-grave e chuva de entulho."""
    n = int(SR * 2.3)
    body = []
    for i in range(n):
        t = i / SR
        # sweep de ruído: 3 kHz -> 90 Hz (a onda de choque passando)
        cut = 90 + 2900 * math.exp(-t * 6)
        body.append(0.0)
    # implementação: ruído com filtro variável (aprox por blocos)
    raw = noise(2.3)
    out = []
    y = 0.0
    i = 0
    for t_step in [i / SR for i in range(n)]:
        cut = 90 + 2900 * math.exp(-t_step * 5.5)
        a = math.exp(-2 * math.pi * cut / SR)
        y = (1 - a) * raw[i] + a * y
        out.append(y)
        i += 1
    # envelope macro: ataque instantâneo, decaimento longo
    macro = [math.exp(-x / SR * 1.9) for x in range(n)]
    wave_out = [o * m for o, m in zip(out, macro)]
    # sub: o chão estremece
    sub = [math.sin(2 * math.pi * 43 * (x / SR)) * math.exp(-x / SR * 1.6) for x in range(n)]
    # crackle: entulho caindo (ruído alto esparsado no tempo)
    crack = hp(noise(2.3), 2000)
    gate = [0.0] * n
    for x in range(n):
        t_step = x / SR
        if t_step > 0.25:
            env = math.exp(-(t_step - 0.25) * 2.2)
            gate[x] = (1 if random.random() < 0.006 * env else 0)
    crack = [c * g * 0.5 for c, g in zip(crack, gate)]
    return normalize(clamp_soft(mix(gain(wave_out, 1.0), gain(sub, 0.9), gain(crack, 0.8)), 1.6))

sfx_detonate = boom()

sfx_silenced = normalize(mix(
    gain(ping(920, 0.16, 5), 0.95),
    silence(0.12) + gain(ping(610, 0.16, 5), 0.9),
    silence(0.24) + gain(ping(405, 0.3, 5), 0.9),             # desce: perdeu
    silence(0.24) + gain(mech_click(0.03, 1600, 1.0), 0.5),   # clique final: desarmado
))

def motif(freqs, note_dur, gap, decay=5):
    """Arpejo curto: notas com envelope pluck."""
    layers = []
    t0 = 0.0
    for f in freqs:
        d = note_dur if f == freqs[-1] else note_dur * 0.9
        tone = apply_env(sine(f, d), env_exp(d, decay))
        tone2 = gain(apply_env(sine(f * 2, d * 0.8), env_exp(d * 0.8, decay * 2)), 0.3)
        layers.append((t0, mix(tone, tone2)))
        t0 += gap
    total = int((t0 + note_dur) * SR) + SR // 10
    out = [0.0] * total
    for t0, l in layers:
        off = int(t0 * SR)
        for i, v in enumerate(l):
            j = off + i
            if j < total:
                out[j] += v
    return out

sfx_round_win = normalize(mix(
    gain(motif([523.25, 659.25, 783.99, 1046.5], 0.16, 0.12, 5), 0.95),  # C-E-G-C: subida
    gain(lp(noise(0.8), 900), 0.05),
))
sfx_round_lose = normalize(mix(
    gain(motif([392.0, 329.63, 261.63], 0.2, 0.16, 4), 0.95),            # G-E-C: desce
    gain(lp(noise(0.9), 500), 0.06),
))

# ----------------------------------------------------------------- UI ----

sfx_buy = normalize(mix(
    gain(tick(1046, 0.05, 16), 1.0),
    silence(0.05) + gain(tick(1568, 0.09, 12), 0.9),          # caixa registradora mínima
))
sfx_ui = normalize(mix(
    gain(tick(700, 0.045, 18), 0.9),
    silence(0.05) + gain(tick(1000, 0.06, 15), 0.85),
))
sfx_traco = normalize(mix(
    gain(apply_env(hp(noise(0.22), 800), env_exp(0.22, -6 if False else 6), ), 0.5),  # whoosh
    gain([math.sin(2 * math.pi * (300 + 900 * (x / (SR * 0.22))) * (x / SR)) for x in range(int(SR * 0.22))], 0.0),
))
# whoosh de verdade: ruído com "abertura" (varredura de brilho pra cima)
_wh = noise(0.26)
_wl = _wh
_wout = []
y = 0.0
for i, x in enumerate(_wl):
    t = i / len(_wl)
    cut = 400 + 2600 * (t ** 2)          # abre o filtro com o tempo
    a = math.exp(-2 * math.pi * cut / SR)
    y = (1 - a) * x + a * y
    env = math.sin(math.pi * min(1, t * 1.15))  # sobe e desce
    _wout.append(y * env)
sfx_traco = normalize(mix(gain(_wout, 0.9), gain(apply_env(sine(220, 0.26), env_exp(0.26, 3)), 0.15)))

# ------------------------------------------------------------- ambiente --

def hum_loop(dur=8.0):
    """Zumbido contínuo do subsolo: transformador + ar + trilho distante."""
    n = int(SR * dur)
    out = []
    rnd = 0.0
    for i in range(n):
        t = i / SR
        # ruído marrom (integrado) bem grave = "ar" da estação
        rnd = rnd * 0.995 + (random.uniform(-1, 1) * 0.05)
        air = rnd * 0.5
        # hum elétrico 55 Hz + harmônico
        e = math.sin(2 * math.pi * 55 * t) * 0.32 + math.sin(2 * math.pi * 110 * t + 0.7) * 0.10
        # varredura lenta de ventilação (amplitude modulando devagar)
        wob = 0.75 + 0.25 * math.sin(2 * math.pi * t / 6.1)
        # gotejamento? não — um "clang" de trilho a cada ~3.2 s (bem longe)
        out.append((air + e) * wob * 0.5)
    buf = normalize(buf=out if False else out, peak=0.5)
    # clang metálico distante, periódico (janela que fecha no loop p/ não estalar)
    for k in range(1, 3):
        off = int(SR * (dur * k / 3))
        clang = apply_env(mix(
            gain(sine(1470, 0.5), 0.5),
            gain(sine(2210, 0.4), 0.3),
            gain(sine(735, 0.55), 0.4),
        ), env_exp(0.5, 8))
        for i, v in enumerate(gain(clang, 0.12)):
            j = off + i
            if j < n:
                buf[j] += v
    return buf

sfx_hum = hum_loop()

# ------------------------------------------- GLISSANDO (Etapa 16) -------
# Gerados por ÚLTIMO de propósito: o script é determinístico (seed fixa) e
# inserir sons no meio do fluxo deslocaria o estado do RNG e mudaria todos
# os WAVs existentes. Novos sons nascem sempre aqui embaixo.

sfx_fire_gli = gun_shot(68, 0.27, 1600, 240, tail=1)         # escopeta: pesada, oca, eco longo
# reforço de sub-grave só da escopeta (o calibre estremece o peito)
sfx_fire_gli = normalize(mix(
    gain(sfx_fire_gli, 0.9),
    gain(apply_env(sine(52, 0.22), env_exp(0.22, 6)), 0.5),
))

# corredera: puxa (desliza) e solta (bate na câmara)
sfx_pump = normalize(mix(
    gain(mech_click(0.055, 480, 1.15), 0.95),                # desliza p/ trás
    silence(0.10) + gain(mech_click(0.05, 900, 1.25), 1.0),  # trava e volta
    silence(0.155) + gain(mech_click(0.03, 1350, 1.0), 0.5), # assento final
))

# ------------------------------------------------- arsenal vivo (Etapa 24) -
# Mesma regra: novos sons nascem sempre aqui embaixo (o RNG é compartilhado
# e o script é determinístico — inserir no meio mudaria os WAVs existentes).

# TREMOLANDO: SMG — estalo seco e alto, quase sem corpo: rajada que "cospe".
# Mais brilho que o LEGATO, duração menor (o pente é rápido, o tiro é curto).
sfx_fire_trem = gun_shot(115, 0.11, 4600, 600)

# FERMATA: o rifle de precisão — a nota longa. Corpo grave e profundo com
# sub-grave de estremecer, crack agudo na boca e o eco do subsolo correndo.
sfx_fire_fermata = gun_shot(56, 0.34, 2200, 300, tail=1)
sfx_fire_fermata = normalize(mix(
    gain(sfx_fire_fermata, 0.95),
    gain(apply_env(sine(44, 0.3), env_exp(0.3, 5)), 0.6),   # o calibre no peito
    gain(hp(noise(0.012), 3000), 0.5),                     # chicote da boca do cano
))

# ferreirinho: o ferrolho da FERMATA — pesado, duas etapas + assento
sfx_bolt = normalize(mix(
    gain(mech_click(0.07, 380, 1.2), 1.0),                  # alavanca sobe
    silence(0.12) + gain(mech_click(0.06, 640, 1.3), 1.0),  # puxa e ejeta
    silence(0.2) + gain(mech_click(0.04, 980, 1.0), 0.55),  # fecha na câmara
))

# ---------------------------------------------------------------- salva --

print('Gerando SFX do PULSO em', os.path.normpath(OUT))
write('fire_staccato.wav', sfx_fire_staccato)
write('fire_legato.wav', sfx_fire_legato)
write('fire_gli.wav', sfx_fire_gli)
write('fire_trem.wav', sfx_fire_trem)
write('fire_fermata.wav', sfx_fire_fermata)
write('bolt.wav', sfx_bolt)
write('pump.wav', sfx_pump)
write('fire_bot.wav', sfx_fire_bot)
write('reload_click.wav', sfx_reload_click)
write('reload_slam.wav', sfx_reload_slam)
write('dry.wav', sfx_dry)
write('hit.wav', sfx_hit)
write('headshot.wav', sfx_headshot)
write('kill.wav', sfx_kill)
write('hurt.wav', sfx_hurt)
write('plant_tick.wav', sfx_plant_tick)
write('planted.wav', sfx_planted)
write('charge_beep.wav', sfx_charge_beep)
write('detonate.wav', sfx_detonate)
write('silenced.wav', sfx_silenced)
write('round_win.wav', sfx_round_win)
write('round_lose.wav', sfx_round_lose)
write('buy.wav', sfx_buy)
write('ui.wav', sfx_ui)
write('traco.wav', sfx_traco)
write('hum.wav', sfx_hum)
print("OK — 26 arquivos")
