/* pages/video.js : video import, playback, tracking, export */
const VW=640; // preview width for video (keeps 4GB / no-GPU laptops usable)
async function openVideo(f,name){const v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=URL.createObjectURL(f);await new Promise(r=>v.onloadedmetadata=r);
 if(vid)vid.pause();vid=v;const s=Math.min(1,VW/v.videoWidth),w=Math.round(v.videoWidth*s),h=Math.round(v.videoHeight*s);
 prev=document.createElement('canvas');pc=document.createElement('canvas');prev.width=pc.width=cv.width=w;prev.height=pc.height=cv.height=h;full=prev;
 $('#empty').hidden=true;$('#fname').textContent=name||f.name;v.onseeked=frame;v.onplay=loop;frame()}
function frame(){if(!vid)return;const g=prev.getContext('2d');g.drawImage(vid,0,0,prev.width,prev.height);src=g.getImageData(0,0,prev.width,prev.height);render()}
function loop(){if(!vid||vid.paused)return;frame();vid.requestVideoFrameCallback?vid.requestVideoFrameCallback(loop):requestAnimationFrame(loop)}
function exportVideo(){if(!vid)return;const rec=new MediaRecorder(cv.captureStream(30),{mimeType:'video/webm'}),ch=[];
 rec.ondataavailable=e=>ch.push(e.data);rec.onstop=()=>dl(new Blob(ch,{type:'video/webm'}),'graded.webm');
 vid.currentTime=0;vid.onended=()=>{rec.stop();vid.onended=null};rec.start();vid.play()}
/* template-matching tracker: follows the area under the mask centre, forward from the current frame (max 60s) */
async function trackLayer(L){if(!vid)return alert('Munnadi Video page-la video import pannunga');
 const W=320,H=Math.round(W*vid.videoHeight/vid.videoWidth),c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});
 const gray=()=>{g.drawImage(vid,0,0,W,H);const d=g.getImageData(0,0,W,H).data,o=new Float32Array(W*H);for(let i=0;i<o.length;i++)o[i]=d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11;return o};
 const wait=t=>new Promise(r=>{vid.onseeked=r;vid.currentTime=t});vid.pause();
 const t0=vid.currentTime,T=18,[ox,oy]=trackAt(L,t0);let px=clamp(Math.round((L.cx+ox)*W),T,W-T-1),py=clamp(Math.round((L.cy+oy)*H),T,H-T-1);const x0=px,y0=py;
 let G=gray();const tpl=new Float32Array(4*T*T);for(let j=0;j<2*T;j++)for(let i=0;i<2*T;i++)tpl[j*2*T+i]=G[(py-T+j)*W+px-T+i];
 const sad=(x,y)=>{if(x<T||y<T||x>W-T-1||y>H-T-1)return 1e18;let s=0;for(let j=0;j<2*T;j+=2)for(let i=0;i<2*T;i+=2)s+=Math.abs(G[(y-T+j)*W+x-T+i]-tpl[j*2*T+i]);return s};
 const out=[[t0,0,0]],end=Math.min(vid.duration,t0+60);
 for(let t=t0+1/12;t<end;t+=1/12){await wait(t);G=gray();let best=1e18,bx=px,by=py;
  for(let dy=-12;dy<=12;dy+=2)for(let dx=-12;dx<=12;dx+=2){const s=sad(px+dx,py+dy)+(dx*dx+dy*dy)*3;if(s<best){best=s;bx=px+dx;by=py+dy}}
  const cx=bx,cy=by;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const s=sad(cx+dx,cy+dy)+((cx+dx-px)**2+(cy+dy-py)**2)*3;if(s<best){best=s;bx=cx+dx;by=cy+dy}}
  px=bx;py=by;out.push([t,(px-x0)/W,(py-y0)/H]);$('#fname').textContent='Tracking '+Math.round((t-t0)/(end-t0)*100)+'%'}
 L.track=out;vid.onseeked=frame;vid.currentTime=t0;$('#fname').textContent=localStorage.getItem('mgn2')||'video';update();commit()}
const vfi=document.createElement('input');vfi.type='file';vfi.accept='video/*';vfi.hidden=true;document.body.append(vfi);
vfi.onchange=async()=>{const f=vfi.files[0];if(!f)return;await idbSet('vid',f);localStorage.setItem('mgn2',f.name);localStorage.setItem('mgt','video');await openVideo(f);if(cur=='Video')go('Video')};
PAGES.Video=p=>{const c=el('div');c.className='col';p.append(c);
 el('button','Import video',()=>vfi.click(),c);el('button','Play / Pause',()=>{if(vid)vid.paused?vid.play():vid.pause()},c);
 const r=el('input');r.type='range';r.min=0;r.max=vid?vid.duration:0;r.step=.04;r.style.width='320px';r.value=vid?vid.currentTime:0;
 r.oninput=()=>{if(vid){vid.pause();vid.currentTime=+r.value}};if(vid)vid.ontimeupdate=()=>{r.value=vid.currentTime};c.append(r);
 el('button','Export graded video (.webm)',exportVideo,c);
 el('p','Export real-time-la record aagum. Masks / Windows page-la "Track (video)" click panna mask object-a follow pannum.',null,p).className='hint'};
$('header').insertBefore(el('button','Import video',()=>vfi.click()),$('#undo'));
el('button','Video',()=>go('Video'),$('#tabs'));
if(localStorage.getItem('mgt')=='video')idbGet('vid').then(f=>f&&openVideo(f,localStorage.getItem('mgn2')));
