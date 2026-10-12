"""Fetch user-specified rank artwork; flood-remove flat corner-connected background.
The user-provided source URLs may expire. Existing fallback emblems remain on failure.
Run: pip install pillow requests && python scripts/fetch_ranks.py
"""
import json, pathlib, re, urllib.request, io
from collections import deque
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
raw=(ROOT/'data.js').read_text(encoding='utf-8').strip()
info=json.loads(raw.removeprefix('window.MISSION_DATA=').rstrip(';').strip())
dest=ROOT/'assets'/'ranks';dest.mkdir(parents=True,exist_ok=True)
for rank in info['ranks']:
 try:
  req=urllib.request.Request(rank['image'],headers={'User-Agent':'Mozilla/5.0 (compatible; CourtRR/1.0)'})
  with urllib.request.urlopen(req,timeout=12) as f:payload=f.read()
  if len(payload)>2_000_000:raise ValueError('Image unusually large')
  im=Image.open(io.BytesIO(payload)).convert('RGBA')
  if im.width<20 or im.height<20:raise ValueError('Image too small')
  w,h=im.size;p=im.load();corners=[p[0,0],p[w-1,0],p[0,h-1],p[w-1,h-1]]
  # Remove only background pixels connected to the border, not similarly coloured pixels inside the emblem.
  bg=max(set(corners),key=corners.count)
  if bg[3]>=250:
   seen=set();q=deque()
   for x in range(w):q.extend(((x,0),(x,h-1)))
   for y in range(h):q.extend(((0,y),(w-1,y)))
   while q:
    x,y=q.popleft()
    if (x,y) in seen or not(0<=x<w and 0<=y<h):continue
    rgba=p[x,y]
    if max(abs(rgba[i]-bg[i]) for i in range(3))>23:continue
    seen.add((x,y));p[x,y]=(rgba[0],rgba[1],rgba[2],0)
    q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
  im.save(dest/rank['file'])
  print('OK',rank['name'],im.size)
 except Exception as exc:print('KEEP FALLBACK',rank['name'],str(exc))
