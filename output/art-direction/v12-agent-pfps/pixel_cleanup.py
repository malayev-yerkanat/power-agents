"""Categorical stripe continuation. Copies palette pixels, never blurs RGB."""

def category(c,name):
    r,g,b=c[:3]
    if name=='codex':return int(r>90)
    if name=='claude':return int(g>205)
    return 2 if r>100 and g>200 else 1 if g>190 else 0

def clean(image,mask,foreground,name):
    step=4;n=256;pix=image.load();m=mask.load();f=foreground.load()
    labels=[[category(pix[x*step+2,y*step+2],name) for x in range(n)] for y in range(n)]
    original=[row[:] for row in labels]
    valid=[[not f[x*step+2,y*step+2] for x in range(n)] for y in range(n)]
    cells=[(x,y) for y in range(1,n-1) for x in range(1,n-1) if any(m[x*step+dx,y*step+dy] for dx,dy in [(0,0),(3,0),(0,3),(3,3)])]
    for turn in range(45):
        changes=0
        for parity in range(2):
            for x,y in cells:
                if (x+y)%2!=parity:continue
                votes=[0,0,0]
                for dx,dy,w in [(-1,1,12),(1,-1,12),(-1,0,1),(1,0,1),(0,-1,1),(0,1,1)]:
                    if valid[y+dy][x+dx]:votes[labels[y+dy][x+dx]]+=w
                votes[labels[y][x]]+=2
                best=max(range(3),key=lambda k:votes[k])
                if best!=labels[y][x]:labels[y][x]=best;changes+=1
        if not changes:break
    out=image.copy();op=out.load()
    for x,y in cells:
        want=labels[y][x]
        if all(category(pix[x*step+dx,y*step+dy],name)==want for dy in range(step) for dx in range(step)):continue
        donors=[]
        for rad in range(1,25):
            for dx,dy in [(rad,0),(-rad,0),(0,rad),(0,-rad),(rad,-rad),(-rad,rad)]:
                xx=x+dx;yy=y+dy
                if 0<=xx<n and 0<=yy<n and valid[yy][xx] and original[yy][xx]==want:donors.append((xx,yy))
            if donors:break
        if not donors:continue
        sx,sy=donors[0]
        for dy in range(step):
            for dx in range(step):
                xx,yy=x*step+dx,y*step+dy
                if m[xx,yy] and category(pix[xx,yy],name)!=want:
                    color=pix[sx*step+dx,sy*step+dy]
                    if category(color,name)!=want:color=pix[sx*step+2,sy*step+2]
                    op[xx,yy]=color
    return out
