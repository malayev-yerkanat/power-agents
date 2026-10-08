from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
B=Path(__file__).resolve().parent
ART=B.parent
NN=Image.Resampling.NEAREST
F='/System/Library/Fonts/Helvetica.ttc'
class UI:
 def __init__(self,light=False):
  self.light=light; self.bg='#edf0f5' if light else '#0c1220'; self.panel='#ffffff' if light else '#151f31'; self.line='#dbe1eb' if light else '#29374c'; self.ink='#192338' if light else '#edf2fb'; self.mute='#66758b' if light else '#94a6c2'; self.accent='#5754d8' if light else '#b6acff'; self.im=Image.new('RGB',(1600,1040),self.bg); self.d=ImageDraw.Draw(self.im)
 def rect(self,box,fill=None,outline=None): self.d.rectangle(box,fill=fill or self.panel,outline=outline)
 def text(self,x,y,s,n=16,c=None): self.d.text((x,y),s,font=ImageFont.truetype(F,n),fill=c or self.ink)
 def card(self,x,y,w,h): self.rect((x,y,x+w,y+h),outline=self.line)
 def btn(self,x,y,w,s,primary=False):
  self.rect((x,y,x+w,y+38),self.accent if primary else self.panel,self.line);self.text(x+13,y+10,s,15,self.bg if primary else self.ink)
 def bar(self,x,y,w):
  self.rect((x,y,x+w,y+5),self.line);self.rect((x,y,x+w/4,y+5),'#69c7a6')
 def scene(self,x,y,w,h):
  # Exact existing composite; only integer nearest-neighbor enlargement or crop.
  src=Image.open(ART/'v4-weapon-exploration/scene-logical.png').convert('RGB')
  scale=2 if w>=1200 else 1
  src=src.resize((768*scale,512*scale),NN)
  # Fit the full scene on a flat frame without fractional resampling.
  self.rect((x,y,x+w,y+h),'#101b2c')
  if src.width>w or src.height>h:
   # compact panels use a tailored city stage with unchanged 1x sprite frames
   bg=Image.open(ART/'v2-ai-rangers-city/city-background.png').convert('RGB').resize((768,512),NN)
   src=bg.crop((0,512-h,min(w,768),512))
   actors=[('l1-rigid-staff',int(w*.18),h-99),('c1-straight-saber',int(w*.35),h-53),('gemini',int(w*.15),h-12),('villain-foot-soldier',int(w*.65),h-58),('villain-monster',int(w*.83),h-14)]
   for name,px,py in sorted(actors,key=lambda a:a[2]):
    sp=Image.open(ART/'v4-weapon-exploration/preview-frames'/f'{name}.png')
    src.paste(sp,(px-80,py-144),sp)
  self.im.paste(src,(x+(w-src.width)//2,y+(h-src.height)//2))
 def shell(self,name):
  self.rect((0,0,1600,62),self.panel);self.text(25,20,'P / A',23,self.accent);self.text(105,23,'POWER AGENTS',18);self.text(350,24,'Workspace  /  Product research',15,self.mute);self.text(1290,24,'3 connections online',15,'#56a889');self.rect((0,1010,1600,1040),self.panel);self.text(24,1018,name+'   /   DESIGN STUDY · SAMPLE DATA',12,self.mute);self.text(1170,1018,'C1 saber + L1 staff · approved sprites',12,self.mute)
 def nav(self):
  self.rect((0,63,206,1009),self.panel);self.btn(18,85,169,'+  New task',True);self.text(20,157,'WORKSPACE',12,self.mute)
  for yy,ss in [(194,'All tasks'),(232,'Run history'),(294,'RECENT RUNS'),(334,'Product research'),(385,'Launch brief'),(431,'Research digest')]:
   if yy==334:self.rect((10,324,195,370),self.bg)
   self.text(22,yy,ss,13 if yy==294 else 15,self.mute if yy==294 else None)
  self.text(22,920,'Connections',15);self.text(22,957,'Local workspace',12,self.mute)
 def heading(self,x,y):
  self.text(x,y,'TEAM TASK   /   RUNNING',12,self.accent);self.text(x,y+27,'Research our next product',29);self.text(x,y+68,'Plan approved · Execution · 1 of 4 tasks complete',14,self.mute)
 def tasks(self,x,y,w,compact=False):
  self.text(x,y,'TASKS',12,self.mute)
  rows=[('01','Audience research','Gemini','Complete','#61b69a'),('02','Compare existing solutions','Codex','Working',self.accent),('03','Review assumptions','Claude','Waiting','#dba869'),('04','Prepare recommendation','Gemini','Queued',self.mute)]
  hh=64 if compact else 76
  for i,(num,title,agent,status,color) in enumerate(rows):
   yy=y+29+i*hh;self.d.line((x,yy+hh-6,x+w,yy+hh-6),fill=self.line);self.text(x,yy+9,num,13,self.mute);self.text(x+34,yy+5,title,16);self.text(x+34,yy+30,agent,13,self.mute);self.text(x+w-92,yy+17,status,13,color)
 def chat(self,x,y,w):
  self.text(x,y,'TEAM DISCUSSION',12,self.mute)
  items=[('Gemini  >  Team','Audience summary is ready.','Use the three segments in the review.','#69a9e5'),('Codex  >  Claude','Can you challenge the comparison','criteria before I finalize the table?',self.accent),('Claude  >  Codex','Yes. I will check the evidence','and flag unsupported assumptions.','#df9a6d')]
  for i,(who,a,b,c) in enumerate(items):
   yy=y+37+i*97;self.text(x,yy,who,14,c);self.text(x,yy+25,a,14);self.text(x,yy+47,b,14,self.mute)
 def team(self,x,y,w):
  self.text(x,y,'SQUAD / ROLES FOR THIS RUN',12,self.mute)
  for i,(a,r,c) in enumerate([('Gemini','Coordinator','#69a9e5'),('Codex','Comparison research',self.accent),('Claude','Independent review','#df9a6d')]):
   xx=x+i*(w//3);self.rect((xx,y+31,xx+5,y+72),c);self.text(xx+17,y+29,a,16);self.text(xx+17,y+54,r,12,self.mute)
 def steer(self,x,y,w):
  self.card(x,y,w,55);self.text(x+17,y+19,'Add context or steer the team…',15,self.mute);self.btn(x+w-88,y+8,78,'Send',True)
 def save(self,name):self.im.save(B/name)
# A: arena-first, narrow operational rail
u=UI();u.shell('A / ARENA');u.heading(30,84);u.btn(1300,103,114,'Pause run');u.btn(1426,103,144,'Stop task');u.card(24,197,1126,659)
u.text(42,214,'CITY ENCOUNTER',13,u.accent);u.text(836,215,'Task states drive the scene',13,u.mute)
u.scene(39,248,1096,512);u.team(48,779,1050)
u.card(1170,197,405,659);u.tasks(1190,218,365,True);u.d.line((1190,541,1550,541),fill=u.line);u.text(1190,559,'LATEST EXCHANGE',12,u.mute);u.text(1190,595,'Codex > Claude',15,u.accent);u.text(1190,625,'Please challenge the comparison',14);u.text(1190,647,'criteria before I finalize the table.',14,u.mute);u.btn(1190,694,185,'Open discussion');u.text(1190,767,'Results  1     /     Event log',15,u.mute)
u.text(30,881,'Tasks  /  Discussion  /  Results  /  Events',15,u.mute);u.steer(30,926,1538);u.save('a-arena.png')
# B: split productive workspace, light panels, dark pixel viewport
u=UI(True);u.shell('B / COMMAND DESK');u.nav();u.heading(234,87);u.btn(1310,106,117,'Pause run');u.btn(1437,106,136,'Stop task')
u.card(232,201,854,449);u.text(252,218,'SQUAD ENCOUNTER',12,u.mute);u.text(829,218,'1 / 4 tasks complete',13,u.mute);u.scene(248,252,820,300);u.team(257,566,795)
u.card(1104,201,470,692);u.chat(1125,224,425);u.text(1125,589,'LATEST RESULT',12,u.mute);u.card(1125,620,425,99);u.text(1143,639,'Audience summary.md',16);u.text(1143,669,'Gemini · Member document',13,u.mute);u.btn(1125,746,174,'Open all results');u.text(1125,838,'Roles can change with each plan.',13,u.mute)
u.card(232,668,854,225);u.text(252,686,'Tasks      Discussion      Results      Events',15,u.mute)
for yy,title,status in [(730,'01   Audience research · Gemini','Complete'),(785,'02   Compare solutions · Codex','Working'),(840,'03   Review assumptions · Claude','Waiting')]:
 u.text(254,yy,title,16);u.text(961,yy,status,13,u.accent)
u.steer(232,921,1342);u.save('b-command-desk.png')
# C: information-first console, compact city + separate task/detail columns
u=UI();u.shell('C / MISSION CONTROL');u.nav();u.heading(232,87);u.btn(1307,106,120,'Pause run');u.btn(1438,106,136,'Stop task');u.card(232,201,634,325);u.scene(242,211,614,265);u.text(252,492,'SQUAD ACTIVE    /    1 of 4 tasks complete',13,u.accent)
u.card(884,201,690,325);u.text(906,225,'RUN OVERVIEW',12,u.mute);u.text(906,261,'Plan approved. Team is executing.',24);u.bar(906,310,638);u.team(909,344,635);u.text(909,456,'Current phase: task execution',15);u.text(909,484,'3 agents   ·   1 document   ·   Independent review pending',13,u.mute)
u.card(232,544,740,348);u.tasks(254,564,692,True);u.card(990,544,584,348);u.text(1012,564,'SELECTED TASK / 02',12,u.accent);u.text(1012,599,'Compare existing solutions',24);u.text(1012,643,'Codex · Working',15,u.accent);u.text(1012,684,'Compare approaches, pricing models and limitations.',15);u.text(1012,711,'Distinguish verified evidence from assumptions.',15,u.mute);u.text(1012,757,'Depends on: Audience research',14,u.mute);u.btn(1012,802,190,'Open discussion');u.btn(1218,802,149,'View results');u.steer(232,921,1342);u.save('c-mission-control.png')

# B companion: approval remains explicit before agents begin execution.
u=UI(True);u.shell('B / COMMAND DESK / PLAN APPROVAL');u.nav()
u.text(234,87,'TEAM TASK / AWAITING YOUR APPROVAL',12,u.accent);u.text(234,116,'Review the plan. Then launch the squad.',29);u.text(234,157,'The team starts execution only after you approve.',15,u.mute)
u.card(232,201,854,691);u.text(257,229,'PROPOSED APPROACH',12,u.accent);u.text(257,266,'Research our next product',28);u.text(257,317,'Identify the audience, compare existing solutions, challenge',17);u.text(257,345,'the assumptions and prepare an evidence-backed recommendation.',17)
u.text(257,403,'SUCCESS CRITERIA',12,u.mute)
for i,ss in enumerate(['01   Three audience segments with clear needs','02   A comparison with sources and known limitations','03   Independent review before the final recommendation']):u.text(257,438+i*37,ss,16)
u.text(257,580,'PROPOSED TASKS / 4 TOTAL',12,u.mute)
for i,ss in enumerate(['Audience research · Gemini','Compare existing solutions · Codex','Review assumptions · Claude','Prepare recommendation · Gemini']):
 yy=614+i*33;u.text(257,yy,f'0{i+1}   '+ss,15);u.text(996,yy,'In plan',13,u.mute)
# mask final rows with approval footer, keeping two preview tasks
u.rect((248,753,1069,880),u.panel);u.d.line((257,769,1059,769),fill=u.line);u.text(257,795,'Review the proposed roles and task order.',15,u.mute);u.btn(790,817,269,'Approve plan & launch',True)
u.card(1104,201,470,691);u.text(1127,230,'PROPOSED TEAM',12,u.mute)
for i,(name,role,c) in enumerate([('Gemini','Coordinator','#3981ba'),('Codex','Comparison research',u.accent),('Claude','Independent review','#b7653c')]):
 yy=276+i*117;u.text(1127,yy,name,21,c);u.text(1127,yy+35,role,16);u.text(1127,yy+62,'Role for this run',13,u.mute)
u.text(1127,672,'Want to change the approach?',19);u.text(1127,711,'Send feedback below. The leader will',15,u.mute);u.text(1127,736,'revise the plan before you approve it.',15,u.mute);u.text(1127,823,'Squad remains idle until approval.',14,u.accent)
u.steer(232,921,1342);u.save('b-plan-approval.png')
