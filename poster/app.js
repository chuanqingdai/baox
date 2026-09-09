/* Progressive enhancement: all posters remain visible without JavaScript. */
const hero=document.querySelector('.hero'),stage=document.querySelector('.poster-stage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches;
const motionButton=document.querySelector('#motion-toggle');
function updateMotion(){document.body.classList.toggle('paused',paused);motionButton.setAttribute('aria-pressed',String(paused));motionButton.textContent=paused?'开启动效':'暂停动效'}
updateMotion();motionButton.addEventListener('click',()=>{paused=!paused;updateMotion()});
hero.addEventListener('pointermove',e=>{if(paused||reduced.matches||e.pointerType!=='mouse'||innerWidth<600)return;const r=hero.getBoundingClientRect();stage.style.setProperty('--mx',`${(e.clientX/r.width-.5)*25}px`);stage.style.setProperty('--my',`${((e.clientY-r.top)/r.height-.5)*16}px`)});
hero.addEventListener('pointerleave',()=>{stage.style.setProperty('--mx','0px');stage.style.setProperty('--my','0px')});
new IntersectionObserver(([entry])=>{stage.querySelectorAll('.floating').forEach(el=>el.style.animationPlayState=entry.isIntersecting?'':'paused')}).observe(hero);
document.addEventListener('visibilitychange',()=>{hero.style.visibility=document.hidden?'hidden':''});
const menu=document.querySelector('#mobile-nav'),menuButton=document.querySelector('.menu-toggle');
menuButton.addEventListener('click',()=>{menu.showModal();menuButton.setAttribute('aria-expanded','true')});
document.querySelector('.menu-close').addEventListener('click',()=>menu.close());menu.addEventListener('close',()=>menuButton.setAttribute('aria-expanded','false'));
[menu].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}}));
