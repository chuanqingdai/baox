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

// Pause the decorative objects while the hero is outside the viewport.
const stage=document.querySelector('.collection-stage');
new IntersectionObserver(([entry])=>{
  stage.classList.toggle('paused',!entry.isIntersecting);
}).observe(document.querySelector('.collection-hero'));
