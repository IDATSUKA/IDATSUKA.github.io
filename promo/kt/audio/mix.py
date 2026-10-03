"""Mix narration + BGM + SFX from cues.json and put the result into both films.

  python3 mix.py          # → mix.wav, then replaces the audio in ../kt-16x9.mp4 and ../kt-9x16.mp4

Looks for:  bgm.wav (Gemini music)  vo/<id>.wav (Gemini TTS)  sfx/<name>.wav|mp3|ogg (効果音ラボ)
Anything missing is skipped and reported. With no bgm.wav the temporary
score from ../src/score.py is used so the film is never silent.
BGM is ducked under the voice, everything is limited to -1 dBTP and
normalised to cues.json "loudness_lufs" (default -14 LUFS, web/SNS).
"""
import glob, json, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(here, *a)
cfg = json.load(open(P('cues.json')))
D = cfg['duration']
inputs, chains, missing = [], [], []


def add_input(path):
    inputs.extend(['-i', path]); return len(inputs) // 2 - 1


def find(stem):
    for ext in ('wav', 'mp3', 'ogg', 'm4a', 'aif', 'aiff'):
        f = P(stem + '.' + ext)
        if os.path.exists(f): return f


# BGM
b = cfg['bgm']
bgm = find(os.path.splitext(b['file'])[0])
temp = False
if not bgm:
    bgm = P('_temp_score.wav'); temp = True
    subprocess.run([sys.executable, P('..', 'src', 'score.py'), bgm], check=True)
    missing.append('bgm.wav (Gemini music) → 仮のBGMを使用')
i = add_input(bgm)
chains.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start={b.get('offset', 0)},asetpts=PTS-STARTPTS,"
              f"apad,atrim=0:{D},afade=t=in:d=0.05,afade=t=out:st={D - 0.9:.3f}:d=0.900,volume={b.get('gain_db', 0)}dB[bgm]")

# VO
vo = []
for line in cfg['vo']['lines']:
    f = find(os.path.join('vo', line['id']))
    if not f:
        missing.append(f"vo/{line['id']}.wav (Gemini TTS: {line['text']})"); continue
    j = add_input(f); ms = int(line['at'] * 1000)
    chains.append(f"[{j}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume={cfg['vo'].get('gain_db', 0)}dB,"
                  f"highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120[v{j}]")
    vo.append(f'[v{j}]')

# SFX
sfx = []
for c in cfg['sfx']['cues']:
    f = find(os.path.join('sfx', c['name']))
    if not f:
        missing.append(f"sfx/{c['name']} @ {c['at']}s (効果音ラボ: {c['search']})"); continue
    j = add_input(f); ms = int(c['at'] * 1000)
    chains.append(f"[{j}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms},volume={c.get('gain_db', 0)}dB[s{j}]")
    sfx.append(f'[s{j}]')

mixins = []
if vo:
    chains.append(f"{''.join(vo)}amix=inputs={len(vo)}:normalize=0,apad,atrim=0:{D},asplit[vo][vosc]")
    chains.append("[bgm][vosc]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450:makeup=1[bgmd]")
    mixins += ['[bgmd]', '[vo]']
else:
    mixins.append('[bgm]')
if sfx:
    chains.append(f"{''.join(sfx)}amix=inputs={len(sfx)}:normalize=0,apad,atrim=0:{D}[fx]")
    mixins.append('[fx]')
L = cfg.get('loudness_lufs', -14)
chains.append(f"{''.join(mixins)}amix=inputs={len(mixins)}:normalize=0,atrim=0:{D},"
              f"loudnorm=I={L}:TP=-1.5:LRA=9,alimiter=limit=0.82:level=0,aresample=48000[out]")

out = P('mix.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(chains), '-map', '[out]', '-t', str(D), out], check=True)
print('wrote', out)

for name in ('kt-16x9.mp4', 'kt-9x16.mp4'):
    film = P('..', name)
    if not os.path.exists(film): continue
    tmp = film + '.tmp.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', film, '-i', out, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '256k', '-t', str(D), '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, film); print('muxed', film)

if temp and os.path.exists(P('_temp_score.wav')): os.remove(P('_temp_score.wav'))
if missing:
    print('\n未投入の素材（あとで入れて python3 mix.py を再実行）:')
    for m in missing: print('  -', m)
