const GEOTIFF_CDN="https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js";
let geotiffModule=null;
function loadGeoTIFF(){
 if(window.GeoTIFF)return Promise.resolve(window.GeoTIFF);
 return new Promise((res,rej)=>{const t=document.createElement("script");t.src=GEOTIFF_CDN;t.async=true;
  t.onload=()=>window.GeoTIFF?res(window.GeoTIFF):rej(new Error("GeoTIFF library did not initialise."));
  t.onerror=()=>rej(new Error("Could not load the GeoTIFF library (offline or blocked). Use CSV, JSON or PDS IMG instead."));
  document.head.appendChild(t)})
}
const W=160,H=110,S=5,CELL0=300,N=W*H;
const $=id=>document.getElementById(id),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
function noise(x,y){let n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
function vn(x,y){let i=Math.floor(x),j=Math.floor(y),fx=smooth(x-i),fy=smooth(y-j),a=noise(i,j),b=noise(i+1,j),c=noise(i,j+1),d=noise(i+1,j+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
function elevation(x,y){
 let r=Math.hypot(x-29.3,y-14.1),z=-2600+1400*smooth(cl((r-19)/5,0,1));
 let dx=(x-18.2)/2.6,dy=(y-8.6)/3.4,f=1-dx*dx-dy*dy;if(f>0)z+=210*Math.pow(f,.35);
 z+=Math.exp(-((x-24.6)**2/6+(y-13)**2/3))*(30+22*Math.sin(x*3.1+y*1.7)*Math.sin(y*2.3-x));
 let bc=((x-26.5)**2+(y-4.5)**2)/.8;if(bc<1)z-=40*(1-bc*bc);
 return z+28*(vn(x*.5,y*.5)-.5)+5*(vn(x*3,y*3)-.5)
}
let Z=new Float32Array(N),SL=new Float32Array(N),BL=new Float32Array(N),CELL=CELL0;
let demProvenance={kind:"synthetic",name:"Synthetic terrain model",nativeW:W,nativeH:H,cell:CELL0};
function buildDerived(){
 const g=(i,j)=>Z[cl(j,0,H-1)*W+cl(i,0,W-1)];
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){
  let a=(g(i+1,j)-g(i-1,j))/(2*CELL),b=(g(i,j+1)-g(i,j-1))/(2*CELL);
  SL[j*W+i]=Math.atan(Math.hypot(a,b))*180/Math.PI;
  let s=0;
  for(let d=0;d<8;d++){let ux=Math.cos(d*Math.PI/4),uy=Math.sin(d*Math.PI/4),m=0;
   for(let k=1;k<30;k++){let x=Math.round(i+ux*k*1.5),y=Math.round(j+uy*k*1.5);if(x<0||y<0||x>=W||y>=H)break;m=Math.max(m,Math.atan2(Z[y*W+x]-Z[j*W+i],k*1.5*CELL))}
   s+=Math.sin(m)**2}
  BL[j*W+i]=s/8
 }
}
for(let j=0;j<H;j++)for(let i=0;i<W;i++)Z[j*W+i]=elevation(i*CELL/1000,j*CELL/1000);
buildDerived();

let sep=false, layer=0, mode=0, selected=0;
const dose=i=>(0.64+0.025*((Z[i]+4400)/1000))*(1-BL[i])*(sep?1.24:1);
const JEZERO_LON=77.44; // degrees east
function liveLs(){const d=Date.now()/86400000+2440587.5-2451545.0+0.00080,r=Math.PI/180,M=(19.3871+0.52402073*d)%360,a=270.3863+0.5240384*d;
 const e=10.691*Math.sin(M*r)+.623*Math.sin(2*M*r)+.05*Math.sin(3*M*r)+.005*Math.sin(4*M*r);return((a+e)%360+360)%360}
$('ls').value=Math.round(liveLs())%360; // start at the current Martian season
function getMarsClock(){
 const now=Date.now();
 const jd=now/86400000+2440587.5;
 const msd=(jd-2405522.0028779)/1.0274912517;
 const mtc=((msd%1)+1)%1*24;
 const lmst=(mtc+JEZERO_LON/15+24)%24;
 return{msd,sol:Math.floor(msd),hour:lmst};
}
function getSimulationMarsClock(){
 const live=getMarsClock();
 const manual=$('timeManual')?.classList.contains('active');
 if(!manual)return{...live,mode:'AUTO'};
 const offset=Math.max(0,Math.floor(+$('futureSol').value||0));
 const hour=cl(+$('futureHour').value||0,0,24);
 return{msd:live.msd+offset,sol:live.sol+offset,hour,mode:'MANUAL'};
}
function fmtMarsHour(hour){
 const total=Math.floor((((hour%24)+24)%24)*3600);
 const hh=Math.floor(total/3600),mm=Math.floor(total%3600/60),ss=total%60;
 return`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function updateMarsClock(){
 const c=getSimulationMarsClock();
 $('marsTime').textContent=fmtMarsHour(c.hour);
 $('marsSol').textContent=`JEZERO · MARS SOL DATE ${c.sol} · LMST · ${c.mode}`;
 if($('futureHourValue'))$('futureHourValue').textContent=fmtMarsHour(+$('futureHour').value||0);
}
function setTimeMode(mode){
 const auto=mode==='AUTO';
 $('timeAuto').classList.toggle('active',auto);
 $('timeManual').classList.toggle('active',!auto);
 $('manualTimePanel').hidden=auto;
 updateMarsClock();
 plan();
}
function conditions(){
 let Ls=+$('ls').value,clock=getSimulationMarsClock(),h=clock.hour,sc=+$('storm').value;
 let tau=.5+(Ls>180&&Ls<330?.35*Math.sin((Ls-180)/150*Math.PI):0);if(sc==1)tau=1.6;if(sc==2)tau=3.2;
 let amp=28*(1-.4*Math.min(tau/3,1)),T=-55+8*Math.sin((Ls-90)*Math.PI/180)+amp*Math.cos(2*Math.PI*(h-14)/24.66);
 let P=718*(1+.05*Math.sin((Ls-60)*Math.PI/180)),dd=1.3+2.1*cl(Ls/182,0,1),wind=4*(1+tau*.8);
 return{Ls,h,tau,T,P,dd,wind,sol:clock.sol,timeMode:clock.mode}
}
const targets=[
 {n:"Octavia E. Butler landing site",x:22,y:10.6,m:"Mars 2020",d:"Reference landing/habitat area from the source planner."},
 {n:"Kodiak delta butte",x:19.9,y:7.4,m:"MRO CRISM + Mars 2020",d:"Delta-front layers; the source map associates the area with ancient-lake history and clay minerals."},
 {n:"Séítah ridges",x:24.6,y:13,m:"MRO CRISM + Mars 2020",d:"Olivine-rich crater-floor terrain in the source map."},
 {n:"Margin carbonates",x:9,y:12.4,m:"MRO CRISM",d:"Carbonate-bearing inner-rim margin unit in the source map."}
];
const sources=[
 ["MOLA","Mars Global Surveyor","Global elevation / topographic reference"],
 ["CTX","Mars Reconnaissance Orbiter","Wide-area imagery / geological context"],
 ["HiRISE","Mars Reconnaissance Orbiter","High-resolution imagery / stereo DTM"],
 ["CRISM","Mars Reconnaissance Orbiter","Mineralogical context: clay, olivine, carbonate"],
 ["RAD","Curiosity / MSL","Radiation measurement reference"],
 ["MEDA","Perseverance","Weather and dust measurement reference"],
 ["REMS","Curiosity / MSL","Atmospheric / weather measurement reference"],
 ["THEMIS","Mars Odyssey","Thermal infrared / surface thermal context"],
 ["GRS","Mars Odyssey","Elemental composition / hydrogen context"]
];

const idx=(x,y)=>cl(Math.round(y/(CELL/1000)),0,H-1)*W+cl(Math.round(x/(CELL/1000)),0,W-1);
let start=idx(22,10.6), target=idx(9,12.4), routes=[];
function speed(s){return 2.6*Math.exp(-((s/16)**2))}
let nearT=new Float32Array(N).fill(1);
function buildNear(){for(let j=0;j<H;j++)for(let i=0;i<W;i++){let m=1e9;for(const t of targets.slice(1))m=Math.min(m,Math.hypot(i*CELL/1000-t.x,j*CELL/1000-t.y));nearT[j*W+i]=1/(1+4*Math.exp(-((m/1.2)**2)))}}
function pathfind(a,b,mode){
 const D=new Float32Array(N).fill(1e9),P=new Int32Array(N).fill(-1),heap=[[0,a]];D[a]=0;
 function push(q){heap.push(q);let i=heap.length-1;while(i){let p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}}
 function pop(){let t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[i][0]<=heap[c][0])break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c}}return t}
 while(heap.length){
  let [d,u]=pop();if(u===b)break;if(d>D[u])continue;let ux=u%W,uy=(u/W)|0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let x=ux+dx,y=uy+dy;if(x<0||y<0||x>=W||y>=H)continue;
   let v=y*W+x,s=SL[v];if(s>25&&v!==b)continue;let dist=CELL*Math.hypot(dx,dy)/1000,c=dist/speed(s);
   if(mode===1)c*=1+(s/8)**2+8*(dose(v)-.5);if(mode===2)c*=(1+(s/12)**2)*nearT[v];
   if(d+c<D[v]){D[v]=d+c;P[v]=u;push([D[v],v])}
  }
 }
 let p=[];for(let v=b;v!==-1;v=P[v])p.push(v);return p.reverse()
}
function stats(p,name){
 let L=0,t=0,d=0,dz=0,mx=0,steep=0,prof=[];
 for(let k=0;k<p.length;k++){if(k){let a=p[k-1],b=p[k],dx=b%W-a%W,dy=((b/W)|0)-((a/W)|0),ds=CELL*Math.hypot(dx,dy)/1000;L+=ds;t+=ds/speed(SL[b]);d+=dose(b)*ds/speed(SL[b])/24.66;dz+=Math.max(0,Z[b]-Z[a]);if(SL[b]>18)steep+=ds;mx=Math.max(mx,SL[b])}prof.push([L,Z[p[k]],SL[p[k]],p[k]])}
 let sci=[];for(const tg of targets.slice(1)){let best=1e9,at=0;for(const q of prof){let dd=Math.hypot((q[3]%W)*(CELL/1000)-tg.x,((q[3]/W)|0)*(CELL/1000)-tg.y);if(dd<best){best=dd;at=q[0]}}if(best<.7)sci.push({tg,km:at})}
 return {name,p,L,t,d,dz,mx,steep,prof,sci}
}

const locInfo={
 "Jezero Crater":"MISSION AREA · 18.4°N, 77.4°E · HiRISE tactical DEM available",
 "Gale Crater":"REFERENCE SITE · 5.4°S, 137.7°E · Curiosity mission area",
 "Arcadia Planitia":"REGIONAL CONTEXT · ~47°N, ~192°E · northern plains",
 "Valles Marineris":"MAJOR FEATURE · ~14°S, ~276–326°E · vast canyon system",
 "Hellas Planitia":"MAJOR BASIN · ~43°S, ~70°E · southern hemisphere",
 "Olympus Mons":"MAJOR VOLCANO · 18.7°N, 226°E · Tharsis province"
};
document.querySelectorAll('[data-loc]').forEach(el=>el.addEventListener('click',()=>{const n=el.dataset.loc;$('globalFocus').innerHTML=`<b>${n.toUpperCase()}:</b> ${locInfo[n]}`;document.querySelectorAll('[data-loc]').forEach(x=>x.style.opacity=x===el?'1':'.55');setTimeout(()=>document.querySelectorAll('[data-loc]').forEach(x=>x.style.opacity='1'),1800)}));
$('focusJezero').onclick=()=>document.querySelector('.grid').scrollIntoView({behavior:'smooth',block:'start'});

function plan(){
 buildNear();
 let A=pathfind(start,target,0),B=pathfind(start,target,1),C=pathfind(start,target,2);
 routes=[stats(A,"Direct"),stats(B,"Safest"),stats(C,"Science")];
 let fastest=Math.min(...routes.map(r=>r.t)),mD=Math.max(...routes.map(r=>r.d))||1,mS=Math.max(...routes.map(r=>r.steep))||1,safest=(routes.forEach(r=>r.risk=r.d/mD+r.steep/mS),Math.min(...routes.map(r=>r.risk))),bestSci=Math.max(...routes.map(r=>r.sci.length));
 routes.forEach(r=>r.tags=[]),routes.forEach(r=>{if(r.t===fastest)r.tags.push("FASTEST");if(r.risk===safest)r.tags.push("SAFEST");if(r.sci.length===bestSci&&bestSci)r.tags.push("BEST SCIENCE")});
 draw();render();
}

const map=$('map'),ctx=map.getContext('2d'),prof=$('profile'),pc=prof.getContext('2d');
function value(i,c){return layer===0?Z[i]:layer===1?SL[i]:layer===2?dose(i):(1-BL[i]*3)*c.dd*cl(1-SL[i]/10,0,1)}
function color(t,l){
 let stops=l===0?[[24,28,43],[54,55,76],[104,72,75],[157,91,67],[207,137,91],[239,194,145]]:
  l===1?[[30,70,50],[143,203,122],[242,163,58],[240,84,79]]:
  l===2?[[20,40,60],[92,200,214],[242,163,58],[240,84,79]]:
  [[25,20,18],[90,60,40],[242,163,58],[250,220,150]];
 t=cl(t,0,1)*(stops.length-1);let i=Math.min(stops.length-2,Math.floor(t)),f=t-i,a=stops[i],b=stops[i+1];
 return a.map((v,k)=>v+(b[k]-v)*f)
}
function sampleGrid(arr,x,y){
 x=cl(x,0,W-1);y=cl(y,0,H-1);
 let x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(W-1,x0+1),y1=Math.min(H-1,y0+1),fx=x-x0,fy=y-y0;
 let a=arr[y0*W+x0],b=arr[y0*W+x1],c=arr[y1*W+x0],d=arr[y1*W+x1];
 return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy
}
function renderMap(){
 const c=conditions(),im=ctx.createImageData(map.width,map.height),vals=[];
 for(let i=0;i<N;i++)vals[i]=value(i,c);
 let lo=layer===1?0:Math.min(...vals),hi=layer===1?25:Math.max(...vals),range=hi-lo||1;
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  const gx=x/(map.width-1)*(W-1),gy=y/(map.height-1)*(H-1),v=sampleGrid(vals,gx,gy);
  let col=color(cl((v-lo)/range,0,1),layer);
  if(layer===0){
   const dx=sampleGrid(Z,gx+1,gy)-sampleGrid(Z,gx-1,gy),dy=sampleGrid(Z,gx,gy+1)-sampleGrid(Z,gx,gy-1);
   const shade=cl(.88+(dx-dy)*.0018,.62,1.18),contour=Math.abs(((v-lo)/range*18)%1),contourMix=contour<.055?.88:1;
   col=col.map(q=>cl(q*shade*contourMix,0,255));
  }
  const o=(y*map.width+x)*4;im.data[o]=col[0];im.data[o+1]=col[1];im.data[o+2]=col[2];im.data[o+3]=255;
 }
 ctx.putImageData(im,0,0);
 ctx.save();ctx.strokeStyle="rgba(210,220,255,.075)";ctx.lineWidth=1;
 for(let x=map.width/6;x<map.width;x+=map.width/6){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,map.height);ctx.stroke()}
 for(let y=map.height/5;y<map.height;y+=map.height/5){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(map.width,y);ctx.stroke()}
 const vg=ctx.createRadialGradient(map.width*.5,map.height*.48,map.height*.12,map.width*.5,map.height*.48,map.height*.72);
 vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(2,5,14,.28)");ctx.fillStyle=vg;ctx.fillRect(0,0,map.width,map.height);ctx.restore();
}
function xy(i){return[(i%W+.5)*(map.width/W),(((i/W)|0)+.5)*(map.height/H)]}
function draw(){
 renderMap();
 routes.forEach((r,n)=>{ctx.beginPath();r.p.forEach((v,k)=>{let [x,y]=xy(v);k?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=n===selected?"#fff":"#e8743b";ctx.globalAlpha=n===selected?1:.35;ctx.lineWidth=n===selected?4:2;ctx.stroke()});
 ctx.globalAlpha=1;
 targets.forEach((t,i)=>{let x=t.x/(CELL/1000)/W*map.width,y=t.y/(CELL/1000)/H*map.height;ctx.beginPath();ctx.arc(x,y,i===0?8:5,0,7);ctx.fillStyle=i===0?"#5cc8d6":"#f2a33a";ctx.fill();ctx.fillStyle="#fff";ctx.font="11px system-ui";const label=i===0?"HAB":t.n,tw=ctx.measureText(label).width,lx=x+tw+14>map.width?x-tw-10:x+9,ly=cl(y+4,14,map.height-7);ctx.fillText(label,lx,ly)});
 [[start,"START","#5cc8d6"],[target,"TARGET","#fff"]].forEach(([v,l,c])=>{let[x,y]=xy(v);ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10,0,7);ctx.moveTo(x-15,y);ctx.lineTo(x+15,y);ctx.moveTo(x,y-15);ctx.lineTo(x,y+15);ctx.stroke();ctx.fillStyle=c;ctx.fillText(l,x+12,y-10)});
 drawProfile()
}
function drawProfile(){
 pc.clearRect(0,0,900,230);let r=routes[selected];if(!r)return;let lo=Math.min(...r.prof.map(x=>x[1]))-20,hi=Math.max(...r.prof.map(x=>x[1]))+20;
 const X=x=>40+x/(r.L||1)*820,Y=z=>195-(z-lo)/(hi-lo)*165;pc.fillStyle="#a99589";pc.font="11px system-ui";pc.fillText(Math.round(hi)+" m",3,28);pc.fillText(Math.round(lo)+" m",3,195);
 pc.beginPath();r.prof.forEach((p,k)=>k?pc.lineTo(X(p[0]),Y(p[1])):pc.moveTo(X(p[0]),Y(p[1])));pc.strokeStyle="#f4ece7";pc.lineWidth=2;pc.stroke();
 r.sci.forEach(s=>{pc.fillStyle="#f2a33a";pc.beginPath();pc.arc(X(s.km),Y(r.prof.find(p=>p[0]>=s.km)?.[1]||lo)-7,5,0,7);pc.fill()});
 $('profileMeta').textContent=`${r.L.toFixed(1)} km · max slope ${r.mx.toFixed(0)}° · ${r.sci.length} science stops`
}
function render(){
 let c=conditions(),r=routes[selected],round=2*r.t;
 $('dose').textContent=dose(start).toFixed(2)+" mSv/d";$('temp').textContent=Math.round(c.T)+" °C";
 let lvl=c.tau>2?2:c.tau>1?1:0;$('stormK').textContent=["CLEAR","WATCH","WARNING"][lvl];$('stormK').style.color=["var(--green)","var(--amber)","var(--red)"][lvl];
 $('routeK').textContent=r.name+" · "+r.L.toFixed(1)+" km";
 const power=+$('power').value,o2=+$('o2').value,water=+$('water').value;
 let margin=Math.min(power,o2,water)-round*4.5;$('returnK').textContent=(margin>0?"GO ":"NO-GO ")+Math.round(margin)+"%";$('returnK').style.color=margin>0?"var(--green)":"var(--red)";
 $('routes').innerHTML=routes.map((x,i)=>`<div class="alert ${i===selected?'ok':''}" data-route="${i}" style="cursor:pointer"><div class="row between"><b>${x.name}</b><span>${x.tags.join(" · ")}</span></div><small>${x.L.toFixed(1)} km · ${Math.round(x.t)} h ${Math.round((x.t%1)*60)} min · max ${x.mx.toFixed(0)}° · ${(x.d*1000).toFixed(0)} µSv · ${x.sci.length} science</small></div>`).join("");
 document.querySelectorAll("[data-route]").forEach(e=>e.onclick=()=>{selected=+e.dataset.route;draw();render()});
 let seq=[`Depart START after suit, power and storm check.`,...r.sci.map(s=>`Science stop: <b>${s.tg.n}</b> at ${s.km.toFixed(1)} km.`)];
 if(r.mx>10)seq.push(`Steepest terrain reaches ${r.mx.toFixed(0)}°. Reduce pace; sections above 18° are highlighted.`);
 seq.push(`TARGET at ${r.L.toFixed(1)} km. Begin return while consumables remain above half.`);
 $('steps').innerHTML=seq.map((s,i)=>`<div class="step"><div class="num">${i+1}</div><div>${s}</div></div>`).join("");
 let w=[];if(r.mx>18)w.push(["danger",`Steep section up to ${r.mx.toFixed(0)}°; source planner treats >25° as not walkable.`]);else if(r.mx>10)w.push(["warn",`Moderate slopes up to ${r.mx.toFixed(0)}°; reduce pace on loose regolith.`]);else w.push(["ok","Slopes remain under 10° along this route."]);
 w.push([c.tau>2?"danger":c.tau>1?"warn":"ok",`Dust opacity τ≈${c.tau.toFixed(1)}. Expected dust-devil rate ≈${c.dd.toFixed(1)} /km²/sol.`]);
 if(sep)w.push(["danger","SEP event active: source planner applies a ×1.24 radiation multiplier."]);
 $('warnings').innerHTML=w.map(x=>`<div class="alert ${x[0]}">${x[1]}</div>`).join("");
 $('conditions').innerHTML=[
  ["Air temperature",Math.round(c.T)+" °C","MODELED · MEDA context"],
  ["Pressure",Math.round(c.P)+" Pa","MODELED · mission reference"],
  ["Dust opacity",c.tau.toFixed(1),"MODELED · MEDA / REMS context"],
  ["Wind gust estimate",Math.round(c.wind)+" m/s","MODELED · scaled with dust load"],
  ["Dust devils",c.dd.toFixed(1)+" /km²/sol","MODELED · MEDA context"],
  ["Start dose",dose(start).toFixed(2)+" mSv/day","MODELED · RAD context"],
  ["Round-trip dose",(r.d*1000*2).toFixed(0)+" µSv","Route-integrated estimate"]
 ].map(x=>`<tr><td>${x[0]}</td><td><b>${x[1]}</b></td><td class="muted">${x[2]}</td></tr>`).join("");
 $('targets').innerHTML=targets.map(t=>`<div class="alert ${t.n===targets[0].n?'ok':'warn'}"><b>${t.n}</b><br><small>${t.m}</small><br>${t.d}</div>`).join("");
 $('sources').innerHTML="<tr><th>Dataset</th><th>Mission</th><th>Role</th></tr>"+sources.map(s=>`<tr><td>${s[0]}</td><td>${s[1]}</td><td class="muted">${s[2]}</td></tr>`).join("");
 renderReserves()
}
function renderReserves(){
 for(const id of ["power","o2","water"]){let v=+$(`${id}`).value;$(`${id}V`).textContent=v+"%";$(`${id}Bar`).style.width=v+"%"}
 let r=routes[selected],c=conditions(),need=2*r.t*4.5,mins=Math.min(+$("power").value,+$("o2").value,+$("water").value);
 let reasons=[];if(mins<need)reasons.push(`Consumable reserve is below the modeled ${Math.round(need)}% round-trip requirement.`);
 if(c.tau>2)reasons.push("Regional dust-storm condition is active.");if(sep)reasons.push("SEP event is active.");
 if(r.mx>25)reasons.push("Route contains terrain beyond the walkability threshold.");
 $('gono').innerHTML=reasons.length?`<div class="alert danger"><b>NO-GO</b><br>${reasons.join("<br>")}</div>`:`<div class="alert ok"><b>PROVISIONAL GO</b><br>Reserves exceed the modeled route requirement. Keep a sheltered return option available.</div>`;
}
map.addEventListener("click",e=>{let b=map.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*W,y=(e.clientY-b.top)/b.height*H,v=cl(Math.floor(y),0,H-1)*W+cl(Math.floor(x),0,W-1);if(SL[v]>25){$("tip").textContent="Rejected: slope above 25° is not walkable in the source planner.";return}if(mode===0)start=v;else target=v;plan()});
map.addEventListener("pointermove",e=>{let b=map.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*W,y=(e.clientY-b.top)/b.height*H,v=cl(Math.floor(y),0,H-1)*W+cl(Math.floor(x),0,W-1);$("tip").textContent=`Elevation ${Z[v].toFixed(0)} m · slope ${SL[v].toFixed(1)}° · dose ${dose(v).toFixed(2)} mSv/day · shielding ${(BL[v]*100).toFixed(0)}%`});
document.querySelectorAll(".layer").forEach(b=>b.onclick=()=>{layer=+b.dataset.layer;document.querySelectorAll(".layer").forEach(x=>x.classList.toggle("active",x===b));draw()});
$("startMode").onclick=()=>{mode=0;$("startMode").classList.add("active");$("targetMode").classList.remove("active")};
$("targetMode").onclick=()=>{mode=1;$("targetMode").classList.add("active");$("startMode").classList.remove("active")};
$("sep").onclick=()=>{sep=!sep;$("sep").textContent=sep?"☀ SEP event ON":"☀ SEP event OFF";plan()};
["ls","storm"].forEach(id=>$(id).oninput=()=>{plan();updateMarsClock()});
$('timeAuto').onclick=()=>setTimeMode('AUTO');
$('timeManual').onclick=()=>setTimeMode('MANUAL');
$('futureSol').oninput=()=>{updateMarsClock();plan()};
$('futureHour').oninput=()=>{updateMarsClock();plan()};
let lastMarsMinute=-1;
function tickMarsClock(){
 updateMarsClock();
 const c=getSimulationMarsClock(),minute=Math.floor(c.hour*60);
 if($('timeAuto').classList.contains('active')&&minute!==lastMarsMinute){lastMarsMinute=minute;plan()}
}
tickMarsClock();
setInterval(()=>{if(!document.hidden)tickMarsClock()},1000);
["power","o2","water"].forEach(id=>$(id).oninput=()=>render());
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("show",x.id===b.dataset.view))});
function setDEMStatus(kind,text){const b=$("demStatus");b.textContent=text;b.className="dem-badge "+kind}
function setDEMProgress(v,show=true){const p=$("demProgress");p.classList.toggle("show",show);p.querySelector("i").style.width=cl(v,0,100)+"%"}
function resetDEM(){
 for(let j=0;j<H;j++)for(let i=0;i<W;i++)Z[j*W+i]=elevation(i*CELL0/1000,j*CELL0/1000);
 CELL=CELL0;demProvenance={kind:"synthetic",name:"Synthetic terrain model",nativeW:W,nativeH:H,cell:CELL0};
 buildDerived();setDEMStatus("synthetic","SYNTHETIC MODEL");
 $("provTerrain").className="prov model";$("provTerrain").innerHTML="<b>TERRAIN</b>MODELED / SYNTHETIC";
 $("demMeta").textContent=`Terrain source: MODELED / SYNTHETIC · planner grid ${W} × ${H}`;
 setDEMProgress(0,false);plan()
}
function finiteNumber(v){return Number.isFinite(v)?v:null}
function normalizeRaster(values,w,h,cellMeters=150,nodata=null){
 let min=Infinity,max=-Infinity,count=0;for(const v of values){if(Number.isFinite(v)&&v!==nodata){min=Math.min(min,v);max=Math.max(max,v);count++}}
 if(!count)throw new Error("No valid elevation samples found.");
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){
  const sx=(i+.5)*w/W-.5,sy=(j+.5)*h/H-.5,x0=Math.max(0,Math.floor(sx)),y0=Math.max(0,Math.floor(sy)),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=cl(sx-x0,0,1),fy=cl(sy-y0,0,1);
  const pick=(x,y)=>{const v=Number(values[y*w+x]);return Number.isFinite(v)&&v!==nodata?v:null};
  const q=[pick(x0,y0),pick(x1,y0),pick(x0,y1),pick(x1,y1)];let vv=q.filter(v=>v!==null);if(!vv.length)vv=[min];
  const a=q[0]??vv[0],b=q[1]??vv[0],c=q[2]??vv[0],d=q[3]??vv[0];Z[j*W+i]=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
 }
 CELL=cellMeters||CELL0;buildDerived();return {min,max,w,h,cell:cellMeters||CELL0}
}
function parseLabel(txt){
 const clean=v=>v?String(v).replace(/\/\*.*?\*\//g,"").replace(/\s*<.*?>\s*$/,"").trim():null;
 const g=k=>{const m=txt.match(new RegExp("^\\s*"+k+"\\s*=\\s*(.+)$","mi"));return m?clean(m[1]):null};
 const num=v=>{const n=parseFloat(String(v||"").replace(/[^\d.+-].*$/,""));return Number.isFinite(n)?n:null};
 const ptr=g("\\^IMAGE");
 let imagePtr=1;
 if(ptr){const m=ptr.match(/(\d+)/);if(m)imagePtr=+m[1]}
 return {
  lines:num(g("LINES")),
  samples:num(g("LINE_SAMPLES")),
  bits:num(g("SAMPLE_BITS"))||32,
  type:(g("SAMPLE_TYPE")||"PC_REAL").replace(/[<>]/g,""),
  recordBytes:num(g("RECORD_BYTES"))||0,
  imagePtr,
  scaling:num(g("SCALING_FACTOR"))||1,
  offset:num(g("OFFSET"))||0
 };
}
async function readPDS(imgFile,lblFile=null){
 let labelText="";
 if(lblFile) labelText=await lblFile.text();
 else{
  const head=new Uint8Array(await imgFile.slice(0,1048576).arrayBuffer());
  labelText=new TextDecoder("ascii").decode(head);
 }
 const endPos=labelText.indexOf("END");
 if(endPos<0)throw new Error("PDS label END not found. Select the matching .LBL file with the .IMG.");
 const meta=parseLabel(labelText.slice(0,endPos+3));
 if(!meta.lines||!meta.samples)throw new Error("PDS label is missing raster dimensions.");
 if(meta.bits!==32)throw new Error(`Unsupported PDS sample size: ${meta.bits} bits. This loader expects 32-bit HiRISE elevation samples.`);
 const offset=lblFile ? 0 : meta.recordBytes*(meta.imagePtr-1);
 const bytes=await imgFile.slice(offset).arrayBuffer();
 const count=meta.lines*meta.samples;
 if(bytes.byteLength<count*4)throw new Error("IMG file is shorter than the raster described by its label.");
 const out=new Float32Array(count),dv=new DataView(bytes),little=/^(PC_|LSB_)/i.test(meta.type);
 for(let i=0;i<count;i++)out[i]=dv.getFloat32(i*4,little)*meta.scaling+meta.offset;
 return normalizeRaster(out,meta.samples,meta.lines,1);
}
async function readGeoTIFF(file){
 if(!geotiffModule)geotiffModule=await loadGeoTIFF();
 const tif=await geotiffModule.fromArrayBuffer(await file.arrayBuffer());
 const image=await tif.getImage();
 const rasters=await image.readRasters({interleave:true,samples:[0]});
 return normalizeRaster(rasters,image.getWidth(),image.getHeight(),Math.abs(image.getResolution?.()[0]||CELL0),image.getGDALNoData?.()??null);
}
async function readCSV(file){
 const text=await file.text(),rows=text.trim().split(/\r?\n/).map(r=>r.split(/[,;\t]/).map(Number));
 const h=rows.length,w=rows[0]?.length||0;
 if(!w||rows.some(r=>r.length!==w||r.some(v=>!Number.isFinite(v))))throw new Error("CSV must be a rectangular elevation grid.");
 return normalizeRaster(Float32Array.from(rows.flat()),w,h,CELL0);
}
async function readJSON(file){
 const d=JSON.parse(await file.text());
 if(!Array.isArray(d.z)||!d.w||!d.h)throw new Error("JSON must contain w, h and z[].");
 if(d.z.length!==d.w*d.h)throw new Error("JSON z[] length does not match w × h.");
 return normalizeRaster(Float32Array.from(d.z),d.w,d.h,+d.cell_m||CELL0);
}
async function loadDEMFiles(fileList,provenanceKind="uploaded"){
 const files=[...fileList||[]];if(!files.length)return;
 setDEMStatus("loading","LOADING");setDEMProgress(5,true);
 $("demMeta").textContent=`Reading ${files.map(f=>f.name).join(" + ")}…`;
 try{
  const img=files.find(f=>/\.img$/i.test(f.name));
  const lbl=files.find(f=>/\.lbl$/i.test(f.name));
  const other=files.find(f=>!/\.(lbl|img)$/i.test(f.name));
  let m,sourceName;
  if(img){
   m=await readPDS(img,lbl||null);
   if(!lbl && /DTEEC_/i.test(img.name))throw new Error("This HiRISE DTM uses a detached PDS label. Select both the matching .IMG and .LBL files.");
   sourceName=provenanceKind==="nasa-hirise"?"NASA HiRISE DTM":img.name;
  }else if(other){
   const ext=other.name.toLowerCase().split(".").pop();
   if(ext==="json")m=await readJSON(other);
   else if(ext==="csv")m=await readCSV(other);
   else if(ext==="tif"||ext==="tiff")m=await readGeoTIFF(other);
   else throw new Error("Unsupported DEM format. Use GeoTIFF, PDS IMG + LBL, CSV, or JSON.");
   sourceName=other.name;
  }else throw new Error("No supported DEM file was selected.");
  demProvenance={kind:provenanceKind,name:sourceName,nativeW:m.w,nativeH:m.h,cell:m.cell};
  setDEMProgress(100,true);
  setDEMStatus("real",provenanceKind==="nasa-hirise"?"REAL · NASA HiRISE":"REAL DEM");
  $("provTerrain").className="prov real";
  $("provTerrain").innerHTML=`<b>TERRAIN</b>${provenanceKind==="nasa-hirise"?"REAL / NASA HiRISE":"REAL / UPLOADED DEM"}`;
  $("demMeta").textContent=`Terrain source: ${sourceName} · native ${m.w} × ${m.h} · cell ≈ ${m.cell.toFixed(1)} m · elevation ${m.min.toFixed(0)} to ${m.max.toFixed(0)} m · planner resampled to ${W} × ${H}`;
  plan();setTimeout(()=>setDEMProgress(0,false),600);
 }catch(err){
  setDEMStatus("synthetic","LOAD ERROR");
  $("demMeta").textContent=err.message||"Could not read DEM.";
  setDEMProgress(0,false);$("tip").textContent=err.message||"Could not read DEM.";
 }
}
$("dem").onchange=e=>loadDEMFiles(e.target.files,"uploaded");
$("resetDEM").onclick=resetDEM;
$("loadJezero").onclick=async()=>{
 const base="https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01";
 const imgUrl=base+".IMG",lblUrl=base+".LBL";
 setDEMStatus("loading","DOWNLOADING");setDEMProgress(3,true);
 $("demMeta").textContent="Fetching NASA/HiRISE Jezero DTM (~381 MB) and its detached PDS label…";
 try{
  const [ri,rl]=await Promise.all([fetch(imgUrl),fetch(lblUrl)]);
  if(!ri.ok)throw new Error(`NASA DTM IMG request failed (${ri.status}).`);
  if(!rl.ok)throw new Error(`NASA DTM LBL request failed (${rl.status}).`);
  const [ib,lt]=await Promise.all([ri.arrayBuffer(),rl.text()]);
  const imgFile=new File([ib],"DTEEC_045994_1985_046060_1985_U01.IMG");
  const lblFile=new File([lt],"DTEEC_045994_1985_046060_1985_U01.LBL");
  await loadDEMFiles([imgFile,lblFile],"nasa-hirise");
 }catch(err){
  setDEMStatus("synthetic","DOWNLOAD ERROR");setDEMProgress(0,false);
  $("demMeta").textContent="Automatic NASA download was blocked or unavailable. Download the official matching .IMG + .LBL files and select both here.";
  window.open("https://www.uahirise.org/dtm/dtm.php?ID=ESP_045994_1985","_blank","noopener,noreferrer");
 }
};
updateMarsClock();
plan();
