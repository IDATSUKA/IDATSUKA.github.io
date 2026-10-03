"""BGM with Gemini music (Lyria) → bgm.wav

  python3 gen_bgm.py                 # prompt from cues.json
  GEMINI_MUSIC_MODEL=lyria-3-pro-preview python3 gen_bgm.py
Generate a few takes (rename bgm.wav between runs) and keep the best;
set "offset" in cues.json if the downbeat is not at 0.0 s.
"""
import json, os
from _gemini import generate_audio

here = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(here, 'cues.json')))['bgm']
model = os.environ.get('GEMINI_MUSIC_MODEL', cfg['model'])
out = os.path.join(here, cfg['file'])
generate_audio(model, cfg['prompt'], out)
print('wrote', out)
