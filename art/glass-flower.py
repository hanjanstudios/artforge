# Generates glass-flower.svg: python3 art/glass-flower.py art/glass-flower.svg
import math, sys

W, H = 800, 1000
CX, CY = 400, 400
out = []
p = out.append

def f(x): return f"{x:.1f}"

def petal_halves(L, Wd, shoulder=0.42, tipw=0.55, tip=0.82):
    """Angular deco petal pointing up from origin; returns (left, right) facet paths."""
    left = f"M0,0 L{f(-Wd)},{f(-L*shoulder)} L{f(-Wd*tipw)},{f(-L*tip)} L0,{f(-L)} Z"
    right = f"M0,0 L{f(Wd)},{f(-L*shoulder)} L{f(Wd*tipw)},{f(-L*tip)} L0,{f(-L)} Z"
    outline = (f"M0,0 L{f(-Wd)},{f(-L*shoulder)} L{f(-Wd*tipw)},{f(-L*tip)} L0,{f(-L)} "
               f"L{f(Wd*tipw)},{f(-L*tip)} L{f(Wd)},{f(-L*shoulder)} Z")
    return left, right, outline

def petal(L, Wd, light, dark, rot, extra_ribs=True, shoulder=0.42):
    l, r, o = petal_halves(L, Wd, shoulder)
    g = [f'<g transform="translate({CX},{CY}) rotate({rot})">']
    g.append(f'<path d="{l}" fill="url(#{light})"/>')
    g.append(f'<path d="{r}" fill="url(#{dark})"/>')
    # inner bevel: a smaller nested petal outline catching light
    li, ri, oi = petal_halves(L*0.78, Wd*0.62, shoulder)
    g.append(f'<path d="{oi}" transform="translate(0,{f(-L*0.1)})" fill="url(#bevel)" stroke="#f3e6ff" stroke-opacity=".35" stroke-width="1"/>')
    if extra_ribs:
        for t in (0.35, 0.6):
            g.append(f'<line x1="0" y1="{f(-L*0.12)}" x2="{f(-Wd*t)}" y2="{f(-L*(0.42+0.3*t))}" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>')
    # specular streak on the lit facet
    g.append(f'<path d="M{f(-Wd*0.25)},{f(-L*0.22)} L{f(-Wd*0.62)},{f(-L*0.44)} L{f(-Wd*0.5)},{f(-L*0.5)} Z" fill="#fff" opacity=".55" filter="url(#soft)"/>')
    g.append(f'<line x1="0" y1="0" x2="0" y2="{f(-L)}" stroke="url(#gold)" stroke-width="1.6"/>')
    g.append(f'<path d="{o}" fill="none" stroke="url(#gold)" stroke-width="3" stroke-linejoin="miter"/>')
    g.append('</g>')
    return "\n".join(g)

p(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
p('<title>Art Deco Glass Flower</title>')
p('''<defs>
  <radialGradient id="bg" cx="50%" cy="40%" r="75%">
    <stop offset="0" stop-color="#2a1340"/><stop offset=".55" stop-color="#150a22"/><stop offset="1" stop-color="#07040c"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff1c1"/><stop offset=".35" stop-color="#d9a640"/>
    <stop offset=".6" stop-color="#8a5a12"/><stop offset=".85" stop-color="#f2cf6e"/><stop offset="1" stop-color="#a8761f"/>
  </linearGradient>
  <linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#b98327"/><stop offset="1" stop-color="#f0c766"/>
  </linearGradient>
  <linearGradient id="vLight1" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#5b1f8f" stop-opacity=".95"/><stop offset=".6" stop-color="#b57cf0" stop-opacity=".75"/><stop offset="1" stop-color="#ead7ff" stop-opacity=".85"/>
  </linearGradient>
  <linearGradient id="vDark1" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#2a0a4a" stop-opacity=".95"/><stop offset=".6" stop-color="#6a2fb0" stop-opacity=".8"/><stop offset="1" stop-color="#a874e6" stop-opacity=".8"/>
  </linearGradient>
  <linearGradient id="vLight2" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#7a1fa8" stop-opacity=".95"/><stop offset=".6" stop-color="#d48cf5" stop-opacity=".8"/><stop offset="1" stop-color="#fbe4ff" stop-opacity=".9"/>
  </linearGradient>
  <linearGradient id="vDark2" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#3b0858" stop-opacity=".95"/><stop offset=".6" stop-color="#8f36c2" stop-opacity=".85"/><stop offset="1" stop-color="#c47ae8" stop-opacity=".85"/>
  </linearGradient>
  <linearGradient id="vLight3" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#9d2fc9"/><stop offset="1" stop-color="#ffe8ff"/>
  </linearGradient>
  <linearGradient id="vDark3" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#4c0f70"/><stop offset="1" stop-color="#c26be6"/>
  </linearGradient>
  <linearGradient id="bevel" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".22"/>
  </linearGradient>
  <linearGradient id="leafL" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#c9a6f2" stop-opacity=".85"/><stop offset="1" stop-color="#4a2380" stop-opacity=".9"/>
  </linearGradient>
  <linearGradient id="leafD" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6d43a8" stop-opacity=".9"/><stop offset="1" stop-color="#1e0b3a" stop-opacity=".95"/>
  </linearGradient>
  <linearGradient id="stem" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3a1764"/><stop offset=".35" stop-color="#d9b8ff"/><stop offset=".5" stop-color="#8e5cc8"/><stop offset="1" stop-color="#241040"/>
  </linearGradient>
  <radialGradient id="gem" cx="40%" cy="35%" r="70%">
    <stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#f1c9ff"/><stop offset=".6" stop-color="#a23fd6"/><stop offset="1" stop-color="#3b0a5c"/>
  </radialGradient>
  <radialGradient id="halo" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#c77dff" stop-opacity=".55"/><stop offset=".5" stop-color="#7b2cbf" stop-opacity=".18"/><stop offset="1" stop-color="#7b2cbf" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="plinth" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3b2157"/><stop offset="1" stop-color="#140a22"/>
  </linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>''')

# background
p(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')

# sunburst rays fanning from flower centre
rays = []
for i in range(-9, 10):
    a = math.radians(-90 + i * 9.5)
    r1, r2 = 300, 520
    x1, y1 = CX + r1*math.cos(a), CY + r1*math.sin(a)
    x2, y2 = CX + r2*math.cos(a), CY + r2*math.sin(a)
    w = 1.6 if i % 2 == 0 else 0.8
    rays.append(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="url(#goldV)" stroke-width="{w}" opacity="{.55 if i%2==0 else .3}"/>')
p('<clipPath id="inner"><rect x="40" y="40" width="720" height="920"/></clipPath>')
p('<g clip-path="url(#inner)">' + "".join(rays) + '</g>')

# concentric stepped arcs (deco fan)
for r, o in ((250, .5), (268, .3), (290, .18)):
    p(f'<circle cx="{CX}" cy="{CY}" r="{r}" fill="none" stroke="url(#gold)" stroke-width="1.2" opacity="{o}"/>')

p(f'<circle cx="{CX}" cy="{CY}" r="260" fill="url(#halo)"/>')

# stem — faceted glass rod with gold lead
p(f'<rect x="{CX-9}" y="{CY+40}" width="18" height="{820-(CY+40)}" fill="url(#stem)" opacity=".92"/>')
p(f'<rect x="{CX-9}" y="{CY+40}" width="18" height="{820-(CY+40)}" fill="none" stroke="url(#goldV)" stroke-width="2"/>')
for y in range(CY+90, 820, 70):
    p(f'<line x1="{CX-9}" y1="{y}" x2="{CX+9}" y2="{y}" stroke="url(#gold)" stroke-width="2"/>')

# chevron leaves (stepped, mirrored)
def leaf(y, side, size):
    s = side
    L, Wd = size, size*0.36
    tipx = CX + s*L
    tipy = y - L*0.55
    top = f"M{CX+s*9},{y} L{f(CX+s*L*0.45)},{f(y - L*0.48 - Wd*0.3)} L{f(tipx)},{f(tipy)} Z"
    bot = f"M{CX+s*9},{y} L{f(tipx)},{f(tipy)} L{f(CX+s*L*0.62)},{f(y - L*0.12)} Z"
    g = [f'<path d="{top}" fill="url(#leafL)"/>', f'<path d="{bot}" fill="url(#leafD)"/>']
    g.append(f'<path d="M{CX+s*9},{y} L{f(CX+s*L*0.45)},{f(y - L*0.48 - Wd*0.3)} L{f(tipx)},{f(tipy)} L{f(CX+s*L*0.62)},{f(y - L*0.12)} Z" fill="none" stroke="url(#gold)" stroke-width="2.5" stroke-linejoin="miter"/>')
    g.append(f'<line x1="{CX+s*9}" y1="{y}" x2="{f(tipx)}" y2="{f(tipy)}" stroke="url(#gold)" stroke-width="1.4"/>')
    g.append(f'<path d="M{f(CX+s*L*0.25)},{f(y-L*0.24)} L{f(CX+s*L*0.45)},{f(y-L*0.42)} L{f(CX+s*L*0.5)},{f(y-L*0.36)} Z" fill="#fff" opacity=".45" filter="url(#soft)"/>')
    return "\n".join(g)

p(leaf(812, -1, 200)); p(leaf(812, 1, 200))

# plinth — stepped ziggurat
steps = [(820, 300, 22), (842, 360, 22), (864, 420, 24), (888, 500, 30)]
for y, w, h in steps:
    p(f'<rect x="{CX-w/2}" y="{y}" width="{w}" height="{h}" fill="url(#plinth)" stroke="url(#gold)" stroke-width="2"/>')
for i in range(-4, 5):
    p(f'<line x1="{CX+i*40}" y1="891" x2="{CX+i*40}" y2="915" stroke="url(#goldV)" stroke-width="1" opacity=".55"/>')

# petals: back ring, mid ring, inner ring
p('<g filter="url(#glow)">')
for k in range(8):
    p(petal(250, 70, "vLight1", "vDark1", k*45 + 22.5))
for k in range(8):
    p(petal(205, 62, "vLight2", "vDark2", k*45, shoulder=0.45))
for k in range(8):
    p(petal(120, 40, "vLight3", "vDark3", k*45 + 22.5, extra_ribs=False, shoulder=0.5))
p('</g>')

# centre — stepped gold rings + octagonal faceted gem
p(f'<circle cx="{CX}" cy="{CY}" r="54" fill="#1a0b2b" stroke="url(#gold)" stroke-width="4"/>')
p(f'<circle cx="{CX}" cy="{CY}" r="45" fill="none" stroke="url(#gold)" stroke-width="1.5"/>')
for k in range(16):
    a = math.radians(k*22.5)
    p(f'<circle cx="{f(CX+49.5*math.cos(a))}" cy="{f(CY+49.5*math.sin(a))}" r="2.3" fill="#f6d77a"/>')
oct_pts = [(CX + 38*math.cos(math.radians(22.5+45*k)), CY + 38*math.sin(math.radians(22.5+45*k))) for k in range(8)]
p('<polygon points="' + " ".join(f"{f(x)},{f(y)}" for x, y in oct_pts) + '" fill="url(#gem)" stroke="url(#gold)" stroke-width="2.5"/>')
inner = [(CX + 19*math.cos(math.radians(22.5+45*k)), CY + 19*math.sin(math.radians(22.5+45*k))) for k in range(8)]
p('<polygon points="' + " ".join(f"{f(x)},{f(y)}" for x, y in inner) + '" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".6" stroke-width="1"/>')
for (x1, y1), (x2, y2) in zip(oct_pts, inner):
    p(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="#fff" stroke-opacity=".45" stroke-width="1"/>')
p(f'<ellipse cx="{CX-11}" cy="{CY-13}" rx="9" ry="5" transform="rotate(-35 {CX-11} {CY-13})" fill="#fff" opacity=".9" filter="url(#soft)"/>')

# sparkle glints on glass
for x, y, s in ((282, 205, 9), (560, 300, 7), (330, 560, 6), (505, 182, 5)):
    p(f'<path d="M{x},{y-s} L{x+s*0.18},{y-s*0.18} L{x+s},{y} L{x+s*0.18},{y+s*0.18} L{x},{y+s} L{x-s*0.18},{y+s*0.18} L{x-s},{y} L{x-s*0.18},{y-s*0.18} Z" fill="#fff" opacity=".9"/>')

# deco frame: double border with stepped corners
def frame(m, sw, o):
    c = 26
    d = (f"M{m+c},{m} H{W-m-c} V{m+c/2} H{W-m-c/2} V{m+c} H{W-m} V{H-m-c} H{W-m-c/2} V{H-m-c/2} H{W-m-c} V{H-m} "
         f"H{m+c} V{H-m-c/2} H{m+c/2} V{H-m-c} H{m} V{m+c} H{m+c/2} V{m+c/2} H{m+c} Z")
    return f'<path d="{d}" fill="none" stroke="url(#gold)" stroke-width="{sw}" opacity="{o}"/>'
p(frame(24, 3, 1)); p(frame(36, 1.2, .7))

p('</svg>')
open(sys.argv[1], "w").write("\n".join(out) + "\n")
