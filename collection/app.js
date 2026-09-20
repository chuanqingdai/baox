const menu=document.querySelector('#mobile-nav');
const trigger=document.querySelector('.menu-toggle');
trigger.addEventListener('click',()=>{menu.showModal();trigger.setAttribute('aria-expanded','true')});
document.querySelector('.menu-close').addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));

const motion=document.querySelector('#motion-toggle');
let paused=matchMedia('(prefers-reduced-motion:reduce)').matches;
function syncMotion(){
  document.body.classList.toggle('paused',paused);
  motion.setAttribute('aria-pressed',String(paused));
  motion.textContent=paused?'开启动效':'暂停动效';
}
motion.addEventListener('click',()=>{paused=!paused;syncMotion()});
syncMotion();

const hero=document.querySelector('.collection-hero');
const stage=document.querySelector('.collection-stage');
hero.addEventListener('pointermove',event=>{
  if(paused||event.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const rect=hero.getBoundingClientRect();
  stage.style.setProperty('--ry',`${(event.clientX/rect.width-.5)*5}deg`);
  stage.style.setProperty('--rx',`${-((event.clientY-rect.top)/rect.height-.5)*3.5}deg`);
});
hero.addEventListener('pointerleave',()=>{
  stage.style.setProperty('--ry','0deg');
  stage.style.setProperty('--rx','0deg');
});
