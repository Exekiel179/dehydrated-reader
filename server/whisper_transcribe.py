import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper.")
    parser.add_argument("--audio", help="Audio file path.")
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    parser.add_argument("--language", default=os.environ.get("WHISPER_LANGUAGE", ""))
    parser.add_argument("--cache-dir", default=os.environ.get("WHISPER_CACHE_DIR", ""))
    parser.add_argument("--prewarm", action="store_true")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"faster-whisper import failed: {exc}"}, ensure_ascii=False))
        return 2

    model_kwargs = {}
    if args.cache_dir:
        model_kwargs["download_root"] = args.cache_dir

    model = WhisperModel(args.model, device="auto", compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"), **model_kwargs)

    if args.prewarm:
        print(json.dumps({"ok": True, "model": args.model, "prewarmed": True}, ensure_ascii=False))
        return 0

    if not args.audio:
        print(json.dumps({"ok": False, "error": "--audio is required unless --prewarm is used."}, ensure_ascii=False))
        return 2

    segments, info = model.transcribe(
        args.audio,
        language=args.language or None,
        vad_filter=True,
        beam_size=5,
    )
    normalized_segments = [
        {
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
        }
        for segment in segments
        if segment.text.strip()
    ]
    text = "\n".join(segment["text"] for segment in normalized_segments).strip()
    print(json.dumps(
        {
            "ok": True,
            "model": args.model,
            "language": getattr(info, "language", ""),
            "duration": getattr(info, "duration", 0),
            "text": text,
            "segments": normalized_segments,
        },
        ensure_ascii=False,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
