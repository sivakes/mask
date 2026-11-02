/* pages/library.js : image/video delete, project export/import, extra buttons on existing pages (no existing code is replaced) */
const idbDel=async k=>(await idb()).transaction('f','readwrite').objectStore('f').delete(k);
function clearView(){if(vid){vid.pause();vid=null}src=prev=pc=full=null;cv.getContext('2d').clearRect(0,0,cv.width,cv.height);$('#empty').hidden=false;$('#fname').textContent='no image';window.drawOv&&drawOv()}
async function delImage(){if(!confirm('Saved image-a delete pannalaama? (grade / masks appadiye irukkum)'))return;await idbDel('img');localStorage.removeItem('mgn');if(!vid)clearView();go(cur)}
async function delVideo(){if(!confirm('Saved video-va delete pannalaama? (grade / masks / tracking appadiye irukkum)'))return;await idbDel('vid');localStorage.removeItem('mgn2');
 if(vid)clearView();localStorage.setItem('mgt','image');const f=await idbGet('img');if(f)openImg(f,localStorage.getItem('mgn'));go(cur)}
const expProj=()=>dl(new Blob([JSON.stringify(S)],{type:'application/json'}),'mask-grade-project.json');
const pfi=document.createElement('input');pfi.type='file';pfi.accept='.json';pfi.hidden=true;document.body.append(pfi);
pfi.onchange=async()=>{try{const o=JSON.parse(await pfi.files[0].text());if(!o.b||!o.c)throw 0;S=o;S.m=S.m||[];commit();go(cur);update()}catch(e){alert('Idhu valid project file illa')}};
const col=p=>{const c=el('div');c.className='col';p.append(c);return c};
const _pm=PAGES.Media;PAGES.Media=p=>{_pm(p);const c=col(p);
 el('button','Import video',()=>vfi.click(),c);el('button','Delete image',delImage,c);el('button','Delete video',delVideo,c);
 el('button','Export project (.json)',expProj,c);el('button','Import project (.json)',()=>pfi.click(),c)};
const _pv=PAGES.Video;PAGES.Video=p=>{_pv(p);const c=col(p);
 el('button','Delete video',delVideo,c);el('button','Export frame JPG',()=>exportImg('jpg'),c);el('button','Export frame PNG',()=>exportImg('png'),c);el('button','Export project (.json)',expProj,c)};
['Masks','Windows'].forEach(n=>{const f=PAGES[n];PAGES[n]=p=>{f(p);const c=col(p);el('button','Export project (.json)',expProj,c);el('button','Export frame JPG',()=>exportImg('jpg'),c)}});
go(cur);
/* ---------- layout: viewer perusa. panel drag-la resize (gap bar), Hide panel (H key), Fullscreen ---------- */
const gap=document.createElement('div');gap.id='gap';$('#panel').before(gap);
const setPH=h=>{const v=clamp(h,60,innerHeight*.75);document.documentElement.style.setProperty('--ph',v+'px');localStorage.setItem('mgph',v);window.drawOv&&drawOv()};
{const h=+localStorage.getItem('mgph');if(h)setPH(h)}
gap.onpointerdown=e=>{gap.setPointerCapture(e.pointerId);gap.onpointermove=ev=>setPH(innerHeight-ev.clientY-$('#tabs').offsetHeight)};gap.onpointerup=()=>gap.onpointermove=null;
const hp=el('button','Hide panel',()=>{const h=!$('#panel').hidden;$('#panel').hidden=gap.hidden=h;hp.textContent=h?'Show panel':'Hide panel';setTimeout(()=>window.drawOv&&drawOv(),60)});
const fsb=el('button','Fullscreen',()=>document.fullscreenElement?document.exitFullscreen():$('#viewer').requestFullscreen());
$('header').insertBefore(hp,$('#undo'));$('header').insertBefore(fsb,$('#undo'));
addEventListener('keydown',e=>{if(e.key=='h'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))hp.click()});
document.addEventListener('fullscreenchange',()=>setTimeout(()=>window.drawOv&&drawOv(),100));
