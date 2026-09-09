/* BAOX masterclass: content is server-rendered HTML; motion is an enhancement. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const hero = document.querySelector('.hero');
  const book = document.querySelector('#book');
  const canvas = document.querySelector('#silk');
  const ctx = canvas.getContext('2d', { alpha: true });
  const toggle = document.querySelector('#motion-toggle');
  const screenshot = new URLSearchParams(location.search).has('static');
  let paused = screenshot || reduce.matches, inView = true, raf = 0, last = 0, time = 0;
  let width = 0, height = 0, px = 0, py = 0, tx = 0, ty = 0;
  let visibleImages = new Set();
  const photos = [...document.querySelectorAll('.day-image img')];
  if (screenshot) root.dataset.static = '';
  const size = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = r.width; height = r.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (ctx) ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  };
  // All filaments share continuous curves, with individual depth and small phase offsets.
  const curve = (u, i, t) => {
    const layer = i / 72;
    return height * (.48 + .18 * Math.sin(u * 6.5 + t * .28) + .055 * Math.sin(u * 14 - t * .2 + layer)
      + (layer - .5) * (.16 + .08 * Math.cos(u * 8 + t * .13)))
      + py * 24 * Math.exp(-Math.pow((u - (.5 + px * .25))*3,2));
  };
  function draw() {
    if (!ctx || !width) return;
    ctx.clearRect(0,0,width,height);
    ctx.globalCompositeOperation = 'lighter';
    const count = width < 700 ? 40 : 72;
    for (let j=0;j<count;j++) {
      const i = j*72/count;
      const bright = j%9===0;
      ctx.beginPath();
      for(let x=-12;x<=width+12;x+=12) {
        const y=curve(x/width,i,time);
        x===-12 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.strokeStyle = bright ? 'rgba(236,189,104,.6)' : `rgba(185,132,56,${.16+(j%5)*.027})`;
      ctx.lineWidth = bright ? 1.2 : .55;
      ctx.shadowColor = '#dca448';ctx.shadowBlur = bright ? 8 : 0;ctx.stroke();
    }
    ctx.shadowBlur=0;
    for(let i=0;i<52;i++) {
      const u=((i*.618033+time*.009*(1+i%3))%1);
      const y=curve(u,(i*13)%72,time)+Math.sin(i*8.7)*14;
      ctx.globalAlpha=.2+.45*(.5+.5*Math.sin(time*.7+i));
      ctx.fillStyle='#e8c07f';ctx.fillRect(u*width,y,i%8===0?2:1,1);
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  function frame(now) {
    raf=0;
    if (paused || reduce.matches || document.hidden || root.hasAttribute("data-printing")) return;
    const delta=Math.min((now-(last||now))/1000,.05);last=now;time+=delta;
    px+=(tx-px)*Math.min(delta*3.5,1);py+=(ty-py)*Math.min(delta*3.5,1);
    if(inView) {
      book.style.transform=`perspective(1200px) rotateY(${px*3}deg) rotateX(${-py*2}deg) translate3d(${px*8}px,${py*5}px,0)`;
      draw();
    }
    for(const photo of visibleImages) {
      const rect=photo.parentElement.getBoundingClientRect();
      const progress=Math.max(-1,Math.min(1,(innerHeight/2-rect.top-rect.height/2)/innerHeight));
      // Keep the whole illustration visible while adding a subtle floating motion.
      photo.style.transform=`translateY(${progress*3}px)`;
    }
    if(inView || visibleImages.size) raf=requestAnimationFrame(frame);
  }
  function start(){if(!raf&&!paused&&!reduce.matches&&!document.hidden&&(inView||visibleImages.size)){last=0;raf=requestAnimationFrame(frame);}}
  function sync(){
    if(raf) cancelAnimationFrame(raf);raf=0;
    const still=paused||reduce.matches;
    document.body.classList.toggle('motion-active',!still);
    toggle.setAttribute('aria-pressed',String(still));toggle.textContent=still?'开启动效':'暂停动效';
    if(still){book.style.transform='none';photos.forEach(i=>i.style.transform='none');px=py=0;draw();}else start();
  }
  hero.addEventListener('pointermove',e=>{if(!fine.matches)return;const r=hero.getBoundingClientRect();tx=(e.clientX-r.left)/r.width*2-1;ty=(e.clientY-r.top)/r.height*2-1;},{passive:true});
  hero.addEventListener('pointerleave',()=>{tx=ty=0;},{passive:true});
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;start();}).observe(hero);
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)entry.isIntersecting?visibleImages.add(entry.target):visibleImages.delete(entry.target);start();});
  photos.forEach(p=>observer.observe(p));
  toggle.hidden=false;
  toggle.addEventListener('click',()=>{paused=!paused;if(!paused&&reduce.matches){paused=true;toggle.textContent='系统已减少动态效果';return;}sync();});
  reduce.addEventListener('change',()=>{paused=reduce.matches||screenshot;sync();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else start();});
  new ResizeObserver(size).observe(canvas);
  window.addEventListener('beforeprint',()=>{root.dataset.printing='';cancelAnimationFrame(raf);raf=0;});
  window.addEventListener('afterprint',()=>{delete root.dataset.printing;start();});
  size();sync();
  // A modal dialog supplies native focus trapping and Escape handling on phones.
  const menu=document.querySelector('#mobile-menu');
  const menuButton=document.querySelector('.menu-toggle');
  const close=()=>menu.close();
  menuButton.addEventListener('click',()=>{menu.showModal();menuButton.setAttribute('aria-expanded','true');document.body.classList.add('menu-open');});
  document.querySelector('.menu-close').addEventListener('click',close);
  menu.addEventListener('close',()=>{menuButton.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');menuButton.focus();});
  menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
})();
