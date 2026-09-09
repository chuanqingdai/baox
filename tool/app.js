const menu=document.querySelector('#mobile-nav'),trigger=document.querySelector('.menu-toggle');
trigger.addEventListener('click',()=>{menu.showModal();trigger.setAttribute('aria-expanded','true')});
document.querySelector('.menu-close').addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));
const motion=document.querySelector('#motion-toggle');let paused=matchMedia('(prefers-reduced-motion:reduce)').matches;
function sync(){document.body.classList.toggle('paused',paused);motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'开启动效':'暂停动效'}
motion.addEventListener('click',()=>{paused=!paused;sync()});sync();
const hero=document.querySelector('.tool-hero'),engine=document.querySelector('.engine-stage');
hero.addEventListener('pointermove',e=>{if(paused||matchMedia('(prefers-reduced-motion:reduce)').matches||e.pointerType!=='mouse')return;const r=hero.getBoundingClientRect();engine.style.setProperty('--ry',`${(e.clientX/r.width-.5)*6}deg`);engine.style.setProperty('--rx',`${-((e.clientY-r.top)/r.height-.5)*4}deg`)});
hero.addEventListener('pointerleave',()=>{engine.style.setProperty('--ry','0deg');engine.style.setProperty('--rx','0deg')});
new IntersectionObserver(([e])=>{document.querySelector('.engine-float').style.animationPlayState=e.isIntersecting?'':'paused'}).observe(hero);
