/* pages/video.js : video import, playback, FAST multi-mask tracker (object maraindha grade off, thirumba vandha on), export */
let VW=+localStorage.getItem('mgvw')||640; // preview width (480 / 640 / 960 / 1280)
const seekTo=(v,t)=>new Promise(r=>{v.onseeked=r;v.currentTime=t}); // seek = first frame properly decode aagum (illa-na black)
async function openVideo(f,name,t){const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';
 const ld=new Promise(r=>{v.onloadeddata=r;v.onerror=r});v.src=URL.createObjectURL(f);await ld;
 if(!v.videoWidth)return alert('Indha video browser-la play aagala (codec). MP4 H.264 / WebM try pannunga.');
 if(vid)vid.pause();vid=v;const s=Math.min(1,VW/v.videoWidth),w=Math.round(v.videoWidth*s),h=Math.round(v.videoHeight*s);
 prev=document.createElement('canvas');pc=document.createElement('canvas');prev.width=pc.width=cv.width=w;prev.height=pc.height=cv.height=h;full=prev;
 $('#empty').hidden=true;$('#fname').textContent=name||f.name;await seekTo(v,t||.001);v.onseeked=frame;v.onplay=loop;frame()}
function frame(){if(!vid)return;const g=prev.getContext('2d');g.drawImage(vid,0,0,prev.width,prev.height);src=g.getImageData(0,0,prev.width,prev.height);render()}
function loop(){if(!vid||vid.paused)return;frame();vid.requestVideoFrameCallback?vid.requestVideoFrameCallback(loop):requestAnimationFrame(loop)}
function exportVideo(){if(!vid)return;const rec=new MediaRecorder(cv.captureStream(30),{mimeType:'video/webm'}),ch=[];
 rec.ondataavailable=e=>ch.push(e.data);rec.onstop=()=>dl(new Blob(ch,{type:'video/webm'}),'graded.webm');
 vid.currentTime=0;vid.onended=()=>{rec.stop();vid.onended=null};rec.start();vid.play()}
/* ---------- tracker ----------
   mask-oda object area-va template-a eduthukum, video-va hidden player-la 1x-16x speed-la odi frames edukkum (seek illa = vegam).
   Match illa-na (object frame-la illa) mask fade out, thirumba object vandha frame-lerundhu mask on. Ella masks oru pass-la. Esc = stop. */
let trackStop=false,trackBusy=false;addEventListener('keydown',e=>{if(e.key=='Escape')trackStop=true});
function bbox(L,asp){if(L.type=='brush'||L.type=='pen'){const R=ras(L,MW,Math.round(MW/asp));let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<R.mh;y++)for(let x=0;x<R.mw;x++)if(R.A[y*R.mw+x]>100){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  return x1<0?null:{x0:x0/R.mw,x1:(x1+1)/R.mw,y0:y0/R.mh,y1:(y1+1)/R.mh}}
 const c=Math.abs(Math.cos(L.ang)),s=Math.abs(Math.sin(L.ang)),hx=(L.w*c+L.h*s)/asp,hy=L.w*s+L.h*c;return{x0:L.cx-hx,x1:L.cx+hx,y0:L.cy-hy,y1:L.cy+hy}}
const trackLayer=L=>trackLayers([L]);
async function trackLayers(Ls){if(!vid)return alert('Munnadi video import pannunga');if(trackBusy)return;
 Ls=Ls.filter(l=>['radial','rect','brush','pen'].includes(l.type));
 if(!Ls.length)return alert('Tracking-ku circle / rectangle / brush / pen mask venum. (Luma / color mask content-a thaane follow pannum, linear-ku venaam)');
 trackBusy=true;trackStop=false;vid.pause();
 const t0=vid.currentTime,end=Math.min(vid.duration,t0+180),W=192,H=Math.max(8,Math.round(W*vid.videoHeight/vid.videoWidth)),asp=vid.videoWidth/vid.videoHeight;
 const cn=document.createElement('canvas');cn.width=W;cn.height=H;const c2=cn.getContext('2d',{willReadFrequently:true});
 const tv=document.createElement('video');tv.muted=true;tv.playsInline=true;const ld=new Promise(r=>tv.onloadeddata=r);tv.src=vid.src;await ld;
 await seekTo(tv,Math.max(t0,.001));
 const grab=()=>{c2.drawImage(tv,0,0,W,H);return c2.getImageData(0,0,W,H).data};
 const patch=(s,G,cx,cy,o)=>{let k=0;for(let j=0;j<s.ny;j++){const y=clamp(Math.round(cy-s.th/2+(j+.5)*s.th/s.ny),0,H-1)*W;for(let i=0;i<s.nx;i++){const x=(clamp(Math.round(cx-s.tw/2+(i+.5)*s.tw/s.nx),0,W-1)+y)*4;o[k++]=G[x];o[k++]=G[x+1];o[k++]=G[x+2]}}return o};
 const mad=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length};
 const best=(s,G,px,py,R,st,T)=>{let b=1e9,bx=px,by=py;for(let dy=-R;dy<=R;dy+=st)for(let dx=-R;dx<=R;dx+=st){const m=mad(patch(s,G,px+dx,py+dy,s.buf),T);if(m<b){b=m;bx=px+dx;by=py+dy}}return[b,bx,by]};
 const gbest=(s,G,T)=>{let b=1e9,bx=0,by=0;for(let y=0;y<H;y+=3)for(let x=0;x<W;x+=3){const m=mad(patch(s,G,x,y,s.buf),T);if(m<b){b=m;bx=x;by=y}}return[b,bx,by]};
 let G=grab();
 const ST=Ls.map(L=>{const bb=bbox(L,asp);if(!bb)return null;const[bx,by]=trackAt(L,t0),X0=clamp(bb.x0+bx),X1=clamp(bb.x1+bx),Y0=clamp(bb.y0+by),Y1=clamp(bb.y1+by),
  tw=Math.max(10,(X1-X0)*W),th=Math.max(10,(Y1-Y0)*H),s={L,tw,th,nx:Math.min(32,Math.round(tw)),ny:Math.min(32,Math.round(th)),cx:(X0+X1)/2*W,cy:(Y0+Y1)/2*H,vx:0,vy:0,lost:0,last:t0};
  s.cx0=s.cx;s.cy0=s.cy;s.ox=bx-L.dx;s.oy=by-L.dy;s.buf=new Float32Array(s.nx*s.ny*3);s.b2=new Float32Array(s.nx*s.ny*3);
  s.T=patch(s,G,s.cx,s.cy,new Float32Array(s.nx*s.ny*3));s.T0=Float32Array.from(s.T);s.thr=30;
  s.out=[[t0,s.ox,s.oy,1]];return s}).filter(Boolean);
 const upd=t=>{G=grab();for(const s of ST){const dt=Math.max(.02,t-s.last);s.last=t;
   const px=s.cx+s.vx*dt,py=s.cy+s.vy*dt,R=Math.min(30,Math.ceil(8+Math.hypot(s.vx,s.vy)*dt*.5));
   let r=best(s,G,px,py,R,2,s.T);const r2=best(s,G,r[1],r[2],1,1,s.T);if(r2[0]<r[0])r=r2;
   if(r[0]<s.thr){s.vx=.5*s.vx+.5*(r[1]-s.cx)/dt;s.vy=.5*s.vy+.5*(r[2]-s.cy)/dt;s.cx=r[1];s.cy=r[2];s.lost=0;
    if(r[0]<s.thr*.6){patch(s,G,s.cx,s.cy,s.b2);for(let i=0;i<s.T.length;i++)s.T[i]=.9*s.T[i]+.1*s.b2[i]}}
   else{s.lost++;s.vx*=.5;s.vy*=.5;
    if(s.lost%2==1){let g=gbest(s,G,s.T0);const g2=best(s,G,g[1],g[2],2,1,s.T0);if(g2[0]<g[0])g=g2;
     if(g[0]<s.thr*.75){s.cx=g[1];s.cy=g[2];s.lost=0;s.vx=s.vy=0}}}
   s.out.push([t,s.ox+(s.cx-s.cx0)/W,s.oy+(s.cy-s.cy0)/H,s.lost<2?1:0])}};
 const rate=clamp(Math.ceil((end-t0)/6),1,16);tv.playbackRate=rate;let nextT=t0+1/12;
 await new Promise(done=>{let fin=false;const stop=()=>{if(!fin){fin=true;done()}};
  const step=(now,meta)=>{if(fin)return;const t=meta?meta.mediaTime:tv.currentTime;
   if(trackStop||tv.ended||t>=end-.03)return stop();
   if(t>=nextT){upd(t);nextT=t+1/12;$('#fname').textContent='Tracking '+Math.round((t-t0)/(end-t0)*100)+'%  (Esc = stop)'}
   tv.requestVideoFrameCallback?tv.requestVideoFrameCallback(step):requestAnimationFrame(step)};
  tv.onended=stop;tv.onerror=stop;tv.play().then(()=>step(0,null)).catch(stop)});
 tv.pause();tv.removeAttribute('src');tv.load();
 for(const s of ST)s.L.track=(s.L.track||[]).filter(x=>x[0]<t0).concat(s.out);
 trackBusy=false;$('#fname').textContent=localStorage.getItem('mgn2')||'video';frame();update();commit()}
/* ---------- import + page ---------- */
const vfi=document.createElement('input');vfi.type='file';vfi.accept='video/*';vfi.hidden=true;document.body.append(vfi);
vfi.onchange=async()=>{const f=vfi.files[0];if(!f)return;await idbSet('vid',f);localStorage.setItem('mgn2',f.name);localStorage.setItem('mgt','video');await openVideo(f);if(cur=='Video')go('Video')};
PAGES.Video=p=>{const c=el('div');c.className='col';p.append(c);
 el('button','Import video',()=>vfi.click(),c);el('button','Play / Pause',()=>{if(vid)vid.paused?vid.play():vid.pause()},c);
 const r=el('input');r.type='range';r.min=0;r.max=vid?vid.duration:0;r.step=.04;r.style.width='320px';r.value=vid?vid.currentTime:0;
 r.oninput=()=>{if(vid){vid.pause();vid.currentTime=+r.value}};if(vid)vid.ontimeupdate=()=>{r.value=vid.currentTime};c.append(r);
 const q=el('select');[[480,'Preview 480 (fast)'],[640,'Preview 640 (default)'],[960,'Preview 960 (sharper)'],[1280,'Preview 1280 (slowest)']].forEach(([v,t])=>q.add(new Option(t,v)));q.value=VW;
 q.onchange=async()=>{VW=+q.value;localStorage.setItem('mgvw',VW);const f=await idbGet('vid');if(f)openVideo(f,localStorage.getItem('mgn2'),vid?vid.currentTime:0)};c.append(q);
 el('button','Export graded video (.webm)',exportVideo,c);
 el('p','Tracking: Masks / Windows page-la mask podunga, object theriyura frame-la nillunga, Track click pannunga. Object frame-la illaadha bodhu grade off, thirumba vandha bodhu on. Esc = tracking stop.',null,p).className='hint'};
$('header').insertBefore(el('button','Import video',()=>vfi.click()),$('#undo'));
el('button','Video',()=>go('Video'),$('#tabs'));
if(localStorage.getItem('mgt')=='video')idbGet('vid').then(f=>f&&openVideo(f,localStorage.getItem('mgn2')));
