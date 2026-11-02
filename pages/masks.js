/* pages/masks.js : Masks (brush, pen, luma, color range) + Windows (circle, rectangle, linear) + colour mixing + locked "graded objects" */
const MG={Masks:['brush','pen','luma','color'],Windows:['radial','rect','linear']},MW=384,MAXM=20,RT={};
let vid=null;const tNow=()=>vid?vid.currentTime:0,ML=()=>S.m||(S.m=[]);
let selM=0,dbg=false,erase=false;const ov=document.createElement('canvas');ov.id='ov';$('#viewer').append(ov);
const NEWM=type=>({id:Date.now()+Math.random(),type,on:true,done:false,inv:false,op:1,fe:.3,cx:.5,cy:.5,w:.25,h:.2,ang:0,size:.04,strokes:[],pts:[],lo:.55,hi:1,hue:0,hr:20,ad:{},pa:0,pc:'#ff8800',pc2:'#3a7bd5',pg:'none',pm:0,bm:'color',track:null,dx:0,dy:0});
const editable=()=>{const L=ML()[selM];return L&&!L.done&&MG[cur]&&MG[cur].includes(L.type)?L:null};
function trackAt(L,t){let x=L.dx,y=L.dy,v=1;const k=L.track;if(k&&k.length){let i=0;while(i<k.length-1&&k[i+1][0]<=t)i++;const a=k[i],b=k[Math.min(i+1,k.length-1)],u=b[0]>a[0]?clamp((t-a[0])/(b[0]-a[0])):0;x+=a[1]+(b[1]-a[1])*u;y+=a[2]+(b[2]-a[2])*u;v=(a[3]??1)+((b[3]??1)-(a[3]??1))*u}return[x,y,v]}
/* brush + pen are rasterised into a small alpha map, feather = blur */
function ras(L,mw,mh){const k=[L.type,L.size,L.fe,L.strokes.length,(L.strokes.at(-1)||{p:[]}).p.length,L.pts.length,mw,mh].join(),r=RT[L.id];if(r&&r.k==k)return r;
 const a=document.createElement('canvas');a.width=mw;a.height=mh;const g=a.getContext('2d');g.fillStyle=g.strokeStyle='#fff';g.lineCap=g.lineJoin='round';
 if(L.type=='pen'&&L.pts.length>2){g.beginPath();L.pts.forEach(([x,y],i)=>g[i?'lineTo':'moveTo'](x*mw,y*mh));g.fill()}
 if(L.type=='brush')for(const s of L.strokes){g.globalCompositeOperation=s.e?'destination-out':'source-over';g.lineWidth=L.size*mh*2;g.beginPath();s.p.forEach(([x,y],i)=>g[i?'lineTo':'moveTo'](x*mw,y*mh));if(s.p.length==1)g.lineTo(s.p[0][0]*mw+.1,s.p[0][1]*mh);g.stroke()}
 const b=document.createElement('canvas');b.width=mw;b.height=mh;const q=b.getContext('2d');q.filter=`blur(${L.fe*mh*.06}px)`;q.drawImage(a,0,0);
 const d=q.getImageData(0,0,mw,mh).data,A=new Uint8Array(mw*mh);for(let i=0;i<A.length;i++)A[i]=d[i*4+3];return RT[L.id]={k,A,mw,mh}}
/* alpha (0..1) of a mask at normalised x,y for pixel colour r,g,b */
function maskFn(L,asp,t){const[dx,dy,vs]=trackAt(L,t),ca=Math.cos(-L.ang),sa=Math.sin(-L.ang),fe=L.fe,W=Math.max(.01,L.w),Hh=Math.max(.01,L.h);let f;
 if(L.type=='radial'||L.type=='rect'||L.type=='linear')f=(x,y)=>{const u=(x-L.cx-dx)*asp,v=y-L.cy-dy,p=u*ca-v*sa,q=u*sa+v*ca;
  if(L.type=='linear'){const e=fe*.5+.001;return 1-ss(-e,e,q)}
  const d=L.type=='radial'?Math.hypot(p/W,q/Hh):Math.max(Math.abs(p)/W,Math.abs(q)/Hh);return 1-ss(1-fe-.001,1,d)};
 else if(L.type=='luma')f=(x,y,r,g,b)=>{const l=.2126*r+.7152*g+.0722*b,e=fe*.3+.001;return ss(L.lo-e,L.lo,l)*(1-ss(L.hi,L.hi+e,l))};
 else if(L.type=='color')f=(x,y,r,g,b)=>{const[h,s]=toHsl(r,g,b);let d=Math.abs(h-L.hue);d=Math.min(d,360-d);return(1-ss(L.hr,L.hr+fe*60+1,d))*ss(.05,.2,s)};
 else{const R=ras(L,MW,Math.round(MW/asp));f=(x,y)=>R.A[Math.min(R.mh-1,Math.max(0,((y-dy)*(R.mh-1)+.5)|0))*R.mw+Math.min(R.mw-1,Math.max(0,((x-dx)*(R.mw-1)+.5)|0))]/255}
 return(x,y,r,g,b)=>{let a=f(x,y,r,g,b);if(L.inv)a=1-a;return a*L.op*vs}}
/* per-mask grade + painter colour mixing (2 colours, 6 blend modes, 4 mix styles) */
const hex=s=>{const n=parseInt(s.slice(1),16);return[(n>>16)/255,((n>>8)&255)/255,(n&255)/255]},lum=a=>.2126*a[0]+.7152*a[1]+.0722*a[2];
const BL={normal:(c,p)=>p,multiply:(c,p)=>c*p,screen:(c,p)=>1-(1-c)*(1-p),overlay:(c,p)=>c<.5?2*c*p:1-2*(1-c)*(1-p),soft:(c,p)=>(1-2*p)*c*c+2*p*c};
function maskGrade(L,dx,dy){const A=L.ad,ex=Math.pow(2,A.exposure||0),k=1+(A.contrast||0),sv=1+(A.sat||0),tp=(A.temp||0)*.25,tn=(A.tint||0)*.15,hu=(A.hue||0)*60,pa=L.pa,
 P1=hex(L.pc),P2=hex(L.pc2||'#3a7bd5'),pg=L.pg||'none',bm=L.bm||'color',pm=L.pm||0,P=[0,0,0];
 return(c,x,y)=>{const r=(c[0]*ex*(1+tp)-.5)*k+.5,g=(c[1]*ex*(1-tn)-.5)*k+.5,b=(c[2]*ex*(1-tp)-.5)*k+.5,l=.2126*r+.7152*g+.0722*b;
  c[0]=l+(r-l)*sv;c[1]=l+(g-l)*sv;c[2]=l+(b-l)*sv;
  if(hu){const[h,s,li]=toHsl(clamp(c[0]),clamp(c[1]),clamp(c[2])),o=fromHsl((h+hu+360)%360,s,li);c[0]=o[0];c[1]=o[1];c[2]=o[2]}
  if(pa){const q=pg=='h'?clamp(x-dx):pg=='v'?clamp(y-dy):pg=='luma'?clamp(lum(c)):pm;for(let i=0;i<3;i++)P[i]=P1[i]+(P2[i]-P1[i])*q;
   if(bm=='color'){const s=Math.min(4,lum(c)/(lum(P)+1e-4));for(let i=0;i<3;i++)c[i]+=(P[i]*s-c[i])*pa}
   else for(let i=0;i<3;i++)c[i]+=(BL[bm](clamp(c[i]),P[i])-c[i])*pa}}}
const buildMasks=asp=>ML().filter(L=>L.on).map(L=>{const[dx,dy]=trackAt(L,tNow());return{a:maskFn(L,asp,tNow()),g:maskGrade(L,dx,dy)}});
const dbgFn=asp=>{const L=dbg&&editable();return L?maskFn(L,asp,tNow()):null};
/* ---------- viewer overlay: all active masks outlined, selected one editable ---------- */
function mp(e){const r=ov.getBoundingClientRect(),iw=cv.width,ih=cv.height,s=Math.min(r.width/iw,r.height/ih);return{x:(e.clientX-r.left-(r.width-iw*s)/2)/(iw*s),y:(e.clientY-r.top-(r.height-ih*s)/2)/(ih*s)}}
function shape(g,L,sel,s,ox,oy,ih){const[dx,dy]=trackAt(L,tNow()),X=x=>ox+x*cv.width*s,Y=y=>oy+y*ih;g.save();g.strokeStyle=g.fillStyle=sel?'#fff':'#ffffff70';g.lineWidth=sel?1.8:1;
 if(L.type=='pen'){g.beginPath();L.pts.forEach(([x,y],i)=>g[i?'lineTo':'moveTo'](X(x+dx),Y(y+dy)));g.closePath();g.stroke();if(sel)L.pts.forEach(([x,y])=>g.fillRect(X(x+dx)-3,Y(y+dy)-3,6,6))}
 else if(MG.Windows.includes(L.type)){const rx=L.w*ih,ry=L.h*ih;g.translate(X(L.cx+dx),Y(L.cy+dy));g.rotate(L.ang);
  if(L.type=='radial'){g.beginPath();g.ellipse(0,0,rx,ry,0,0,7);g.stroke()}else if(L.type=='rect')g.strokeRect(-rx,-ry,2*rx,2*ry);else{g.beginPath();g.moveTo(-ov.width,0);g.lineTo(ov.width,0);g.stroke()}
  if(sel&&L.type!='linear')g.fillRect(rx-4,ry-4,8,8)}
 g.restore()}
function drawOv(){const L=editable();ov.width=ov.clientWidth;ov.height=ov.clientHeight;ov.style.pointerEvents=L?'auto':'none';if(!MG[cur]||!src)return;
 const g=ov.getContext('2d'),s=Math.min(ov.width/cv.width,ov.height/cv.height),ox=(ov.width-cv.width*s)/2,oy=(ov.height-cv.height*s)/2,ih=cv.height*s;
 ML().forEach(l=>{if(l.on&&!l.done)shape(g,l,l==L,s,ox,oy,ih)})}
addEventListener('resize',drawOv);let od=null;
ov.onpointerdown=e=>{const L=editable();if(!L)return;ov.setPointerCapture(e.pointerId);const m=mp(e),T=L.type;
 if(T=='pen'){L.pts.push([m.x,m.y]);update();commit();return}
 if(T=='brush'){L.strokes.push({e:erase,p:[[m.x,m.y]]});od='paint';update();return}
 if(T=='color'){od='pick';ov.onpointermove(e);return}
 const asp=cv.width/cv.height,[dx,dy]=trackAt(L,tNow()),u=(m.x-L.cx-dx)*asp,v=m.y-L.cy-dy,p=u*Math.cos(L.ang)+v*Math.sin(L.ang),q=-u*Math.sin(L.ang)+v*Math.cos(L.ang);
 od=T!='linear'&&Math.abs(p-L.w)<.04&&Math.abs(q-L.h)<.04?'size':'move'};
ov.onpointermove=e=>{const L=editable();if(!L||!od)return;const m=mp(e),asp=cv.width/cv.height,[dx,dy]=trackAt(L,tNow());
 if(od=='paint')L.strokes.at(-1).p.push([m.x,m.y]);
 else if(od=='pick'){const i=((clamp(m.y)*(src.height-1)|0)*src.width+(clamp(m.x)*(src.width-1)|0))*4;L.hue=toHsl(src.data[i]/255,src.data[i+1]/255,src.data[i+2]/255)[0]}
 else if(od=='move'){L.cx=m.x-dx;L.cy=m.y-dy}
 else{const u=(m.x-L.cx-dx)*asp,v=m.y-L.cy-dy;L.w=Math.max(.02,Math.abs(u*Math.cos(L.ang)+v*Math.sin(L.ang)));L.h=Math.max(.02,Math.abs(-u*Math.sin(L.ang)+v*Math.cos(L.ang)))}
 update()};
ov.onpointerup=()=>{if(od)commit();od=null};
/* ---------- pages ---------- */
const HINT={radial:'Viewer-la drag = move. Corner square drag = size.',rect:'Viewer-la drag = move. Corner square drag = size.',linear:'Drag = line move. Angle slider = rotate.',brush:'Viewer-la paint pannunga. Eraser = alichu edukka.',pen:'Viewer-la click panni points podunga. 3+ points = shape.',luma:'Low / high = edha brightness range grade aagum.',color:'Viewer-la color mela click pannunga = aadha color select aagum.'};
const PAL=['#ff3b30','#ff9500','#ffd60a','#34c759','#00c7be','#0a84ff','#bf5af2','#ff2d92','#8e5a3c','#ffffff'];
const dd=(box,opts,get,set)=>{const s=el('select');opts.forEach(([v,t])=>s.add(new Option(t,v)));s.value=get();s.onchange=()=>{set(s.value);update();commit()};box.append(s)};
function maskPage(name){return p=>{const kinds=MG[name],all=ML().map((l,i)=>[l,i]),lay=all.filter(([l])=>!l.done&&kinds.includes(l.type)),fin=all.filter(([l])=>l.done);
 if(!lay.some(([,i])=>i==selM))selM=lay.length?lay[0][1]:-1;const L=ML()[selM],re=()=>go(name);
 const c1=el('div');c1.className='col';p.append(c1);const add=el('div');add.className='row';c1.append(add);
 kinds.forEach(k=>el('button','+ '+k,()=>{if(ML().length>=MAXM)return alert('Max '+MAXM+' masks / windows oru nerathula. Onnu Delete pannunga.');ML().push(NEWM(k));selM=ML().length-1;update();commit();re()},add));
 el('small',ML().length+' / '+MAXM+' masks used',null,c1);
 lay.forEach(([l,i])=>el('button',(l.on?'':'(off) ')+l.type+' '+(i+1),()=>{selM=i;re()},c1).classList.toggle('on',i==selM));
 if(fin.length){el('small','Graded objects (mask hidden, grade stays):',null,c1);
  fin.forEach(([l,i])=>{const r=el('div');r.className='row';c1.append(r);
   el('button','Edit '+l.type+' '+(i+1),()=>{l.done=false;selM=i;update();commit();go(MG.Masks.includes(l.type)?'Masks':'Windows')},r);
   el('button',l.on?'On':'Off',()=>{l.on=!l.on;update();commit();re()},r);
   el('button','Track',()=>trackLayer(l),r);
   el('button','Delete',()=>{ML().splice(i,1);selM=0;update();commit();re()},r)})}
 el('button','Track all',()=>trackLayers(ML().filter(l=>l.on)),c1);
 if(!L)return;const T=L.type;
 const tg=(box,t,get,fn)=>el('button',t,()=>{fn();update();commit();re()},box).classList.toggle('on',!!get());
 el('p',HINT[T],null,c1).className='hint';
 const c2=el('div');c2.className='sl-box';p.append(c2);
 if(T=='radial'||T=='rect'){sl(c2,'width',.02,1,()=>L.w,v=>L.w=v);sl(c2,'height',.02,1,()=>L.h,v=>L.h=v)}
 if(MG.Windows.includes(T)){sl(c2,'angle',-3.14,3.14,()=>L.ang,v=>L.ang=v);sl(c2,'x',0,1,()=>L.cx,v=>L.cx=v);sl(c2,'y',0,1,()=>L.cy,v=>L.cy=v)}
 if(T=='luma'){sl(c2,'low',0,1,()=>L.lo,v=>L.lo=v);sl(c2,'high',0,1,()=>L.hi,v=>L.hi=v)}
 if(T=='color'){sl(c2,'hue',0,360,()=>L.hue,v=>L.hue=v);sl(c2,'range',2,90,()=>L.hr,v=>L.hr=v)}
 if(T=='brush')sl(c2,'size',.005,.2,()=>L.size,v=>L.size=v);
 sl(c2,'feather',0,1,()=>L.fe,v=>L.fe=v);sl(c2,'opacity',0,1,()=>L.op,v=>L.op=v);
 const b2=el('div');b2.className='row';c2.append(b2);
 tg(b2,'Invert',()=>L.inv,()=>L.inv=!L.inv);tg(b2,'Enabled',()=>L.on,()=>L.on=!L.on);tg(b2,'Show mask',()=>dbg,()=>dbg=!dbg);
 if(T=='brush')tg(b2,'Eraser',()=>erase,()=>erase=!erase);
 if(T=='brush')el('button','Clear',()=>{L.strokes=[];update();commit()},b2);
 if(T=='pen'){el('button','Undo point',()=>{L.pts.pop();update();commit()},b2);el('button','Clear',()=>{L.pts=[];update();commit()},b2)}
 el('button','Track (video)',()=>trackLayer(L),b2);el('button','Clear track',()=>{L.track=null;update();commit()},b2);
 el('button','Done: hide mask, grade stays',()=>{L.done=true;update();commit();re()},b2);
 el('button','Delete (grade-um pogum)',()=>{ML().splice(selM,1);selM=0;update();commit();re()},b2);
 const c3=el('div');c3.className='sl-box';p.append(c3);
 [['exposure',-2,2],['contrast',-1,1],['sat',-1,1],['temp',-1,1],['tint',-1,1],['hue',-1,1]].forEach(([k,a,b])=>sl(c3,k,a,b,()=>L.ad[k]||0,v=>L.ad[k]=v));
 el('small','Paint / color mixing',null,c3);
 const cr=el('div');cr.className='row';c3.append(cr);
 ['pc','pc2'].forEach(k=>{const i=el('input');i.type='color';i.value=L[k]||'#3a7bd5';i.oninput=()=>{L[k]=i.value;update()};i.onchange=commit;cr.append(i)});
 el('button','Swap A/B',()=>{const a=L.pc;L.pc=L.pc2||'#3a7bd5';L.pc2=a;update();commit();re()},cr);
 const pr=el('div');pr.className='row';c3.append(pr);
 PAL.forEach(c=>{const b=el('button','',()=>{L.pc=c;update();commit();re()},pr);b.style.cssText='width:22px;height:22px;padding:0;background:'+c});
 dd(c3,[['color','Blend: Color (brightness safe)'],['normal','Blend: Normal'],['multiply','Blend: Multiply'],['screen','Blend: Screen'],['overlay','Blend: Overlay'],['soft','Blend: Soft light']],()=>L.bm||'color',v=>L.bm=v);
 dd(c3,[['none','Mix A to B: manual'],['h','Mix: left to right'],['v','Mix: top to bottom'],['luma','Mix: shadows to highlights']],()=>L.pg||'none',v=>L.pg=v);
 sl(c3,'strength',0,1,()=>L.pa,v=>L.pa=v);sl(c3,'mix A to B',0,1,()=>L.pm||0,v=>L.pm=v)}}
PAGES.Masks=maskPage('Masks');PAGES.Windows=maskPage('Windows');
/* ---------- hook into the existing app WITHOUT editing app.js ---------- */
const _proc=process;
process=function(img,P){const D=dbgFn(img.width/img.height);if(!ML().some(L=>L.on)&&!D)return _proc(img,P);
 const o=new Uint8ClampedArray(img.data);_proc(img,P);const d=img.data,w=img.width,h=img.height,M=buildMasks(w/h),c=[0,0,0],t=[0,0,0];
 for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i+=4){const r0=o[i]/255,g0=o[i+1]/255,b0=o[i+2]/255;c[0]=d[i]/255;c[1]=d[i+1]/255;c[2]=d[i+2]/255;
  for(const m of M){const a=m.a(x/w,y/h,r0,g0,b0);if(a>.002){t[0]=c[0];t[1]=c[1];t[2]=c[2];m.g(t,x/w,y/h);c[0]+=(t[0]-c[0])*a;c[1]+=(t[1]-c[1])*a;c[2]+=(t[2]-c[2])*a}}
  if(D){const a=D(x/w,y/h,r0,g0,b0)*.6;c[0]=c[0]*(1-a)+a;c[1]*=1-a;c[2]*=1-a}
  d[i]=c[0]*255;d[i+1]=c[1]*255;d[i+2]=c[2]*255}};
const _rd=render;render=function(){_rd();drawOv()};
const _go=go;go=function(n){_go(n);drawOv()};
let userImg=false;$('#file').addEventListener('click',()=>userImg=true,true);
const _oi=openImg;openImg=async function(f,n){if(localStorage.getItem('mgt')=='video'&&!userImg)return;userImg=false;if(vid){vid.pause();vid=null}localStorage.setItem('mgt','image');return _oi(f,n)};
['Masks','Windows'].forEach(n=>el('button',n,()=>go(n),$('#tabs')));
