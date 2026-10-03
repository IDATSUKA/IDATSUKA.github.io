"""Narration with Gemini TTS — one WAV per line in cues.json → vo/<id>.wav

  python3 gen_vo.py            # all lines
  python3 gen_vo.py vo2        # one line (re-take)
  GEMINI_TTS_MODEL=… GEMINI_TTS_VOICE=… to override
"""
import json, os, sys
from _gemini import generate_audio

here = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(here, 'cues.json')))['vo']
model = os.environ.get('GEMINI_TTS_MODEL', cfg['model'])
voice = os.environ.get('GEMINI_TTS_VOICE', cfg['voice'])
only = set(sys.argv[1:])
os.makedirs(os.path.join(here, 'vo'), exist_ok=True)
for line in cfg['lines']:
    if only and line['id'] not in only:
        continue
    prompt = f"{cfg['direction']}\n次の一文だけを読んでください：{line['text']}"
    out = os.path.join(here, 'vo', line['id'] + '.wav')
    generate_audio(model, prompt, out, speech=[{'voice': voice, 'language': cfg['language']}])
    print('wrote', out)
