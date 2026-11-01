const $=s=>document.querySelector(s),clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v,ss=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x)};
const BASIC=[['exposure',-2,2],['contrast',-1,1],['highlights',-1,1],['shadows',-1,1],['whites',-1,1],['blacks',-1,1],['brightness',-1,1],['brilliance',-1,1],['temp',-1,1],['tint',-1,1],['saturation',-1,1],['vibrance',-1,1],['sharpness',0,1],['vignette',0,1],['blur',0,10]];
const BANDS=[['red',0],['orange',30],['yellow',60],['green',120],['aqua',180],['blue',220],['purple',275],['magenta',310],['pink',345]];
const LINE=()=>[[0,0],[1,1]],def=()=>({b:{},c:{m:LINE(),r:LINE(),g:LINE(),b:LINE()},w:{lift:[0,0],gamma:[0,0],gain:[0,0],offset:[0,0]},h:{}});
let S=JSON.parse(localStorage.getItem('mg')||'null')||def(),cur='Media',ch='m',hb='red',mode='luma',src,prev,pc,full;
let H=[JSON.stringify(S)],hi=0;const cv=$('#cv');
/* ---------- state ---------- */
const save=()=>localStorage.setItem('mg',JSON.stringify(S));
function update(){save();draw()}
function commit(){const s=JSON.stringify(S);if(s==H[hi])return;H=H.slice(0,hi+1);H.push(s);if(H.length>80)H.shift();hi=H.length-1;save()}
function hist(d){const n=hi+d;if(n<0||n>=H.length)return;hi=n;S=JSON.parse(H[hi]);go(cur);update()}
$('#undo').onclick=()=>hist(-1);$('#redo').onclick=()=>hist(1);$('#split').oninput=draw;
const idb=()=>new Promise(r=>{const q=indexedDB.open('mg',1);q.onupgradeneeded=()=>q.result.createObjectStore('f');q.onsuccess=()=>r(q.result)});
const idbSet=async(k,v)=>(await idb()).transaction('f','readwrite').objectStore('f').put(v,k);
const idbGet=async k=>{const d=await idb();return new Promise(r=>{const q=d.transaction('f').objectStore('f').get(k);q.onsuccess=()=>r(q.result)})};
/* ---------- image ---------- */
async function openImg(f,name){full=await createImageBitmap(f);const s=Math.min(1,1280/Math.max(full.width,full.height)),w=Math.round(full.width*s),h=Math.round(full.height*s);
 prev=document.createElement('canvas');pc=document.createElement('canvas');prev.width=pc.width=cv.width=w;prev.height=pc.height=cv.height=h;
 const g=prev.getContext('2d');g.drawImage(full,0,0,w,h);src=g.getImageData(0,0,w,h);$('#empty').hidden=true;$('#fname').textContent=name||f.name;draw()}
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;await idbSet('img',f);localStorage.setItem('mgn',f.name);openImg(f)};
idbGet('img').then(f=>f&&openImg(f,localStorage.getItem('mgn')));
/* ---------- grading maths ---------- */
function lut(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]),n=p.length,x=p.map(a=>a[0]),y=p.map(a=>a[1]),d=[],m=[];
 for(let i=0;i<n-1;i++)d[i]=(y[i+1]-y[i])/(x[i+1]-x[i]||1e-6);
 m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
 for(let i=0;i<n-1;i++){if(d[i]==0)m[i]=m[i+1]=0;else{const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i]}}}
 const L=new Float32Array(256);let k=0;
 for(let i=0;i<256;i++){const t=i/255;while(k<n-2&&t>x[k+1])k++;const h=x[k+1]-x[k]||1e-6,u=clamp((t-x[k])/h),u2=u*u,u3=u2*u;
  L[i]=clamp((2*u3-3*u2+1)*y[k]+(u3-2*u2+u)*h*m[k]+(-2*u3+3*u2)*y[k+1]+(u3-u2)*h*m[k+1])}return L}
const rgbOf=([x,y])=>{const m=Math.hypot(x,y),a=Math.atan2(x,-y);return[Math.cos(a)*m,Math.cos(a-2.094)*m,Math.cos(a+2.094)*m]};
const toHsl=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;if(d>1e-6){s=d/(1-Math.abs(2*l-1)+1e-6);h=mx==r?((g-b)/d+6)%6:mx==g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s,l]};
const fromHsl=(h,s,l)=>{const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const q=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return[q[0]+m,q[1]+m,q[2]+m]};
function prep(){const B=Object.fromEntries(BASIC.map(a=>[a[0],S.b[a[0]]||0])),Lm=lut(S.c.m),Lc=[lut(S.c.r),lut(S.c.g),lut(S.c.b)],
 ex=Math.pow(2,B.exposure),tp=B.temp*.25,tn=B.tint*.15,k=1+B.contrast,lf=rgbOf(S.w.lift),gm=rgbOf(S.w.gamma),gn=rgbOf(S.w.gain),of=rgbOf(S.w.offset),
 hs=BANDS.map(([n,c])=>[c,S.h[n]||[0,0,0]]),hOn=hs.some(a=>a[1].some(v=>v));
 const f=c=>{let r=c[0]*ex*(1+tp),g=c[1]*ex*(1-tn),b=c[2]*ex*(1-tp);const br=B.brightness*.3;r+=br;g+=br;b+=br;
  let l=clamp(.2126*r+.7152*g+.0722*b);
  const ad=B.shadows*(1-l)*(1-l)*.4+B.highlights*l*l*.4+B.whites*ss(.55,1,l)*.3+B.blacks*(1-ss(0,.45,l))*.3+B.brilliance*l*(1-l)*1.2;
  c[0]=(r+ad-.5)*k+.5;c[1]=(g+ad-.5)*k+.5;c[2]=(b+ad-.5)*k+.5;
  for(let i=0;i<3;i++){let v=(c[i]+lf[i]*(1-c[i])*.5)*(1+gn[i]*.5)+of[i]*.2;v=v<0?0:v;c[i]=Math.pow(v,1/(1+gm[i]*.5))}
  l=.2126*c[0]+.7152*c[1]+.0722*c[2];const sa=Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]),sv=1+B.saturation+B.vibrance*(1-clamp(sa));
  for(let i=0;i<3;i++)c[i]=clamp(l+(c[i]-l)*sv);
  if(hOn){let[h,s,li]=toHsl(c[0],c[1],c[2]),dh=0,ds=0,dl=0;for(const[ce,v]of hs){let d=Math.abs(h-ce);d=Math.min(d,360-d);const w=Math.max(0,1-d/40)*Math.min(1,s*3);dh+=w*v[0]*30;ds+=w*v[1];dl+=w*v[2]*.25}
   const o=fromHsl((h+dh+360)%360,clamp(s*(1+ds)),clamp(li+dl));c[0]=o[0];c[1]=o[1];c[2]=o[2]}
  for(let i=0;i<3;i++){const v=Lm[(clamp(c[i])*255+.5)|0];c[i]=Lc[i][(v*255+.5)|0]}};
 return{f,B}}
function process(img,{f,B}){const d=img.data,w=img.width,h=img.height,c=[0,0,0],v=B.vignette;
 for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i+=4){c[0]=d[i]/255;c[1]=d[i+1]/255;c[2]=d[i+2]/255;f(c);
  let q=1;if(v)q=1-v*ss(.35,1,Math.hypot(x/w-.5,y/h-.5)*1.414);d[i]=c[0]*q*255;d[i+1]=c[1]*q*255;d[i+2]=c[2]*q*255}
 if(B.sharpness){const s=new Uint8ClampedArray(d),a=B.sharpness*1.5;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;for(let k=0;k<3;k++){const j=i+k;d[j]=s[j]+a*(s[j]-(s[j-4]+s[j+4]+s[j-w*4]+s[j+w*4])/4)}}}}
/* ---------- render + scope ---------- */
let raf;function draw(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
function render(){if(!src)return;const P=prep(),img=new ImageData(new Uint8ClampedArray(src.data),src.width,src.height);process(img,P);pc.getContext('2d').putImageData(img,0,0);
 const g=cv.getContext('2d'),w=cv.width,h=cv.height;g.clearRect(0,0,w,h);g.filter=P.B.blur?`blur(${P.B.blur}px)`:'none';g.drawImage(pc,0,0);g.filter='none';
 const sp=+$('#split').value;if(sp){const x=w*sp/100;g.drawImage(prev,0,0,x,h,0,0,x,h);g.fillStyle='#fff';g.fillRect(x-1,0,2,h)}
 if(cur=='Scopes')scope(img)}
function scope(img){const c=$('#sc');if(!c)return;const g=c.getContext('2d'),W=c.width,Hh=c.height,o=g.createImageData(W,Hh),od=o.data,d=img.data,w=img.width,h=img.height;
 for(let i=3;i<od.length;i+=4)od[i]=255;
 for(let y=0;y<h;y+=5)for(let x=0;x<w;x+=2){const i=(y*w+x)*4,X=(x*W/w)|0;
  if(mode=='luma'){const Y=Hh-1-(((.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255)*(Hh-1)|0),j=(Y*W+X)*4;od[j]+=40;od[j+1]+=40;od[j+2]+=40}
  else for(let k=0;k<3;k++){const j=((Hh-1-((d[i+k]/255)*(Hh-1)|0))*W+X)*4;od[j+k]+=60}}
 g.putImageData(o,0,0);g.strokeStyle='#ffffff30';for(let i=0;i<=4;i++){g.beginPath();g.moveTo(0,i*(Hh-1)/4+.5);g.lineTo(W,i*(Hh-1)/4+.5);g.stroke()}}
/* ---------- export ---------- */
const dl=(b,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click()};
function exportImg(type){if(!full)return;const o=document.createElement('canvas');o.width=full.width;o.height=full.height;const g=o.getContext('2d');g.drawImage(full,0,0);
 const img=g.getImageData(0,0,o.width,o.height),P=prep();process(img,P);g.putImageData(img,0,0);
 let out=o;if(P.B.blur){out=document.createElement('canvas');out.width=o.width;out.height=o.height;const q=out.getContext('2d');q.filter=`blur(${P.B.blur*full.width/prev.width}px)`;q.drawImage(o,0,0)}
 out.toBlob(b=>dl(b,'graded.'+(type=='png'?'png':'jpg')),'image/'+(type=='png'?'png':'jpeg'),.95)}
function exportCube(){const{f}=prep(),N=33,out=['TITLE "MaskGrade"','LUT_3D_SIZE '+N],c=[0,0,0];
 for(let b=0;b<N;b++)for(let g=0;g<N;g++)for(let r=0;r<N;r++){c[0]=r/(N-1);c[1]=g/(N-1);c[2]=b/(N-1);f(c);out.push(c.map(v=>clamp(v).toFixed(5)).join(' '))}
 dl(new Blob([out.join('\n')]),'grade.cube')}
/* ---------- UI helpers ---------- */
const el=(t,txt,fn,p)=>{const e=document.createElement(t);if(txt)e.textContent=txt;if(fn)e.onclick=fn;p&&p.append(e);return e};
function sl(p,label,min,max,get,set){const d=document.createElement('label');d.className='sl';d.innerHTML=`<span>${label}</span><input type=range min=${min} max=${max} step=.01><output></output>`;
 const i=d.querySelector('input'),o=d.querySelector('output'),sync=()=>{i.value=get();o.textContent=(+get()).toFixed(2)};sync();
 i.oninput=()=>{set(+i.value);o.textContent=(+i.value).toFixed(2);update()};i.onchange=commit;i.ondblclick=()=>{set(0);sync();update();commit()};p.append(d)}
function resetAll(){if(confirm('Ella grading-um reset aagum. Sure-a?')){S=def();commit();go(cur);update()}}
/* ---------- pages ---------- */
const PAGES={
Media(p){const c=el('div');c.className='col';p.append(c);
 el('button','Import image',()=>$('#file').click(),c);el('button','Export JPG',()=>exportImg('jpg'),c);el('button','Export PNG',()=>exportImg('png'),c);el('button','Reset all grading',resetAll,c);
 el('p','Grade auto-save aagum. Page close panni thirumba open pannalum image + grade appadiye irukkum. Reset button click pannum varai maaraadhu.',null,p).style.cssText='max-width:320px;color:var(--dim)'},
Basic(p){BASIC.forEach(([n,a,b])=>sl(p,n,a,b,()=>S.b[n]||0,v=>S.b[n]=v));
 const c=el('div');c.className='col';p.append(c);
 el('button','Auto',()=>{if(!src)return;const d=src.data,hs=new Uint32Array(256);let m=0,n=0;for(let i=0;i<d.length;i+=16){const l=(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])|0;hs[l]++;m+=l;n++}
  m/=n*255;let a=0,lo=0,hi2=255,t=n*.01;for(let i=0;i<256;i++){a+=hs[i];if(a>t){lo=i;break}}a=0;for(let i=255;i>=0;i--){a+=hs[i];if(a>t){hi2=i;break}}
  S.b.exposure=clamp(Math.log2(.45/Math.max(m,.02)),-1.5,1.5);S.b.contrast=clamp((.9-(hi2-lo)/255)*.8,0,.4);go('Basic');update();commit()},c);
 el('button','Reset this page',()=>{S.b={};go('Basic');update();commit()},c)},
Curves(p){const cvs=el('canvas');cvs.width=cvs.height=220;cvs.className='cur';p.append(cvs);const bar=el('div');bar.className='chs';p.append(bar);
 ['Master','Red','Green','Blue'].forEach(n=>el('button',n,()=>{ch=n[0].toLowerCase();paint()},bar));
 el('button','Reset curve',()=>{S.c[ch]=LINE();paint();update();commit()},bar);
 const g=cvs.getContext('2d'),Z=220,P=()=>S.c[ch];let di=-1;
 const paint=()=>{g.clearRect(0,0,Z,Z);g.strokeStyle='#333';for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*Z/4,0);g.lineTo(i*Z/4,Z);g.moveTo(0,i*Z/4);g.lineTo(Z,i*Z/4);g.stroke()}
  g.strokeStyle={m:'#ddd',r:'#f55',g:'#5f5',b:'#58f'}[ch];g.beginPath();lut(P()).forEach((v,i)=>g[i?'lineTo':'moveTo'](i/255*Z,(1-v)*Z));g.stroke();
  g.fillStyle='#fff';P().forEach(q=>{g.beginPath();g.arc(q[0]*Z,(1-q[1])*Z,4,0,7);g.fill()});[...bar.children].forEach(b=>b.classList.toggle('on',b.textContent[0].toLowerCase()==ch))};
 const pt=e=>{const r=cvs.getBoundingClientRect();return[(e.clientX-r.left)/r.width,1-(e.clientY-r.top)/r.height]},near=(a,x,y)=>a.findIndex(q=>Math.hypot(q[0]-x,q[1]-y)<.05);
 cvs.onpointerdown=e=>{cvs.setPointerCapture(e.pointerId);const[x,y]=pt(e),a=P();di=near(a,x,y);if(di<0){a.push([x,y]);a.sort((u,v)=>u[0]-v[0]);di=a.findIndex(q=>q[0]==x)}};
 cvs.onpointermove=e=>{if(di<0)return;const a=P(),[x,y]=pt(e),q=a[di];q[1]=clamp(y);if(di>0&&di<a.length-1)q[0]=clamp(x,a[di-1][0]+.02,a[di+1][0]-.02);paint();update()};
 cvs.onpointerup=()=>{di=-1;commit()};
 cvs.ondblclick=e=>{const a=P(),i=near(a,...pt(e));if(i>0&&i<a.length-1){a.splice(i,1);paint();update();commit()}};paint()},
Wheels(p){['lift','gamma','gain','offset'].forEach(n=>{const d=el('div');d.className='wc';d.innerHTML='<div class=wheel><i></i></div><span>'+n+'</span>';p.append(d);const w=d.firstChild,pk=w.firstChild;
 const pos=()=>{pk.style.left=50+S.w[n][0]*50+'%';pk.style.top=50+S.w[n][1]*50+'%'};pos();
 const mv=e=>{const r=w.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*2-1,y=(e.clientY-r.top)/r.height*2-1;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m}S.w[n]=[x,y];pos();update()};
 w.onpointerdown=e=>{w.setPointerCapture(e.pointerId);mv(e);w.onpointermove=mv};w.onpointerup=()=>{w.onpointermove=null;commit()};
 w.ondblclick=()=>{S.w[n]=[0,0];pos();update();commit()}})},
HSL(p){const bar=el('div'),box=el('div');bar.className='row';box.className='sl-box';p.append(bar,box);
 const show=()=>{box.innerHTML='';[...bar.children].forEach((b,i)=>b.classList.toggle('on',BANDS[i][0]==hb));
  ['hue','sat','lum'].forEach((l,k)=>sl(box,l,-1,1,()=>(S.h[hb]||[0,0,0])[k],v=>{S.h[hb]=S.h[hb]||[0,0,0];S.h[hb][k]=v}))};
 BANDS.forEach(([n,hue])=>{const b=el('button',n,()=>{hb=n;show()},bar);b.style.borderBottom=`3px solid hsl(${hue} 80% 55%)`});show()},
Scopes(p){const c=el('canvas');c.id='sc';c.width=512;c.height=256;p.append(c);const b=el('div');b.className='chs';p.append(b);
 el('button','Luma waveform',()=>{mode='luma';draw()},b);el('button','RGB waveform',()=>{mode='rgb';draw()},b);draw()},
Utility(p){const P=()=>JSON.parse(localStorage.getItem('mgp')||'{}'),c=el('div');c.className='col';p.append(c);
 const nm=el('input');nm.type='text';nm.placeholder='preset name';c.append(nm);const sel=el('select');
 const fill=()=>{sel.innerHTML='';Object.keys(P()).forEach(k=>sel.add(new Option(k)))};fill();
 el('button','Save preset',()=>{if(!nm.value)return;const x=P();x[nm.value]=S;localStorage.setItem('mgp',JSON.stringify(x));fill()},c);c.append(sel);
 el('button','Apply preset',()=>{const x=P()[sel.value];if(x){S=JSON.parse(JSON.stringify(x));commit();go('Utility');update()}},c);
 el('button','Delete preset',()=>{const x=P();delete x[sel.value];localStorage.setItem('mgp',JSON.stringify(x));fill()},c);
 const d=el('div');d.className='col';p.append(d);el('button','Export LUT (.cube)',exportCube,d)}};
function go(n){cur=n;const p=$('#panel');p.innerHTML='';PAGES[n](p);[...$('#tabs').children].forEach(b=>b.classList.toggle('on',b.textContent==n));if(n=='Scopes')draw()}
Object.keys(PAGES).forEach(n=>el('button',n,()=>go(n),$('#tabs')));go('Media');
