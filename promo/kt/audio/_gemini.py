"""Shared helper: call a Gemini audio model and save the result as WAV.

Needs GEMINI_API_KEY in the environment (pip install google-genai).
Uses the Interactions API that serves the current TTS and Lyria models,
and falls back to generate_content for older TTS model names.
"""
import base64, io, os, sys, wave


def _client():
    if not os.environ.get('GEMINI_API_KEY') and not os.environ.get('GOOGLE_API_KEY'):
        sys.exit('GEMINI_API_KEY is not set. Add it in the environment settings, then start a new session.')
    from google import genai
    return genai.Client()


def _to_wav(raw: bytes, mime: str, rate: int | None, channels: int | None, path: str):
    mime = (mime or '').lower()
    if raw[:4] == b'RIFF' or 'wav' in mime:
        open(path, 'wb').write(raw)
        return
    if 'mp3' in mime or 'ogg' in mime:  # let ffmpeg decode compressed audio
        tmp = path + ('.mp3' if 'mp3' in mime else '.ogg')
        open(tmp, 'wb').write(raw)
        os.system(f'ffmpeg -v error -y -i "{tmp}" "{path}" && rm -f "{tmp}"')
        return
    # raw 16-bit little-endian PCM (audio/l16 or audio/pcm)
    if 'rate=' in mime:
        rate = int(mime.split('rate=')[1].split(';')[0])
    with wave.open(path, 'wb') as w:
        w.setnchannels(channels or 1); w.setsampwidth(2); w.setframerate(rate or 24000)
        w.writeframes(raw)


def _bytes(data):
    return data if isinstance(data, (bytes, bytearray)) else base64.b64decode(data)


def generate_audio(model: str, prompt: str, path: str, speech: list | None = None):
    c = _client()
    body = dict(model=model, input=prompt, response_format={'type': 'audio', 'mime_type': 'audio/wav'})
    if speech:
        body['generation_config'] = {'speech_config': speech}
    try:
        r = c.interactions.create(**body)
        a = getattr(r, 'output_audio', None)
        if a is None or not getattr(a, 'data', None):
            raise RuntimeError(f'no audio in response: {str(r)[:400]}')
        _to_wav(_bytes(a.data), a.mime_type, getattr(a, 'sample_rate', None), getattr(a, 'channels', None), path)
        return
    except Exception as e:  # older TTS models only exist on generate_content
        if not speech:
            raise
        print(f'interactions API failed ({e}); trying generate_content', file=sys.stderr)
    from google.genai import types
    v = speech[0]
    r = c.models.generate_content(
        model=model, contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=['AUDIO'],
            speech_config=types.SpeechConfig(
                language_code=v.get('language'),
                voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=v['voice'])))))
    p = r.candidates[0].content.parts[0].inline_data
    _to_wav(_bytes(p.data), p.mime_type, None, 1, path)
