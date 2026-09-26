# usage: sh sheet.sh NAME t1 t2 ... → out/NAME.png (3x3 contact sheet)
name=$1; shift
d=out/seq-$name; mkdir -p $d
node render.mjs stills "$@" 2>&1 | tail -5
i=0; for t in "$@"; do cp out/still-$t.png $d/s$(printf %03d $i).png; i=$((i+1)); done
ffmpeg -hide_banner -loglevel error -y -framerate 1 -i $d/s%03d.png -vf "scale=768:432,tile=3x3:padding=6:color=0x333333" -frames:v 1 out/$name.png
