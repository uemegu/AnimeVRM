# Canvas for continuing the panorama: 1536x1024, grey where unpainted, the pasted edges keep their transparent sky.
#   uv run --with pillow python draft.py out.png src:x0:x1:dx [src:x0:x1:dx ...]
#   e.g. draft.py draft-R2.png pano-R1.png:1024:1536:0  (the right third of R1 as the left third of R2)
import sys
from PIL import Image
out=sys.argv[1]
c=Image.new('RGBA',(1536,1024),(128,128,128,255))
for spec in sys.argv[2:]:
    src,x0,x1,dx=spec.split(':'); x0,x1,dx=int(x0),int(x1),int(dx)
    im=Image.open(src).convert('RGBA').crop((x0,0,x1,1024))
    # clear the canvas there first so transparent sky stays transparent
    c.paste(Image.new('RGBA',im.size,(0,0,0,0)),(dx,0))
    c.alpha_composite(im,(dx,0))
c.save(out)
