/* Independent silk geometry and particles; the metal wordmark never deforms. */
(() => {
  'use strict';
  const canvas = document.querySelector('#flow');
  const ctx = canvas.getContext('2d', {alpha:true});
  const home = document.querySelector('.home');
  const visual = document.querySelector('.visual');
  const menu = document.querySelector('#mobile-nav');
  const toggle = document.querySelector('.menu-toggle');
  const motion = document.querySelector('.motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, visible = true, raf = 0, last = 0, time = 0;
  let w = 1, h = 1, dpr = 1;
  const pointer = {x:.5,y:.7,tx:.5,ty:.7,force:0,target:0};
  const paths = Array.from({length:144},(_,i)=>({band:i%3,offset:(Math.floor(i/3)-23.5)/47,phase:i*2.39996}));
  const contours = [
    [.88,.86,.82,.74,.71,.59,.42,.38,.35,.27,.20],
    [.88,.85,.83,.75,.72,.71,.59,.55,.55,.54,.43],
    [.93,.90,.87,.85,.83,.80,.74,.70,.70,.65,.58]
  ];
  function sample(x, strand) {
    const t=Math.max(0,Math.min(1,x))*10,k=Math.min(9,Math.floor(t)),f=t-k;
    const v=contours[strand.band],p0=v[Math.max(0,k-1)],p1=v[k],p2=v[k+1],p3=v[Math.min(10,k+2)];
    const y=.5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f);
    const d=(x-pointer.x)*1.5,influence=Math.exp(-(d*d+(y-pointer.y)**2)*28)*pointer.force;
    return (y+strand.offset*.055+Math.sin(x*15+strand.phase+time*.22)*.0025+Math.sin(x*8-time*.3)*influence*.004)*h;
  }
  let renderLayers=null;
  const photo=document.querySelector("#scene");
  function initializeLayers(){renderLayers=window.createWaveLayers(photo,document.querySelector("#wave-layers"));draw()}
  if(photo.complete&&photo.naturalWidth)initializeLayers();else photo.addEventListener("load",initializeLayers,{once:true});
  function draw() {
    if(renderLayers)renderLayers(time,canvas.width,canvas.height);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    const scale=Math.max(canvas.width/1536,canvas.height/1024);
    ctx.setTransform(scale,0,0,scale,(canvas.width-1536*scale)/2,(canvas.height-1024*scale)/2);
    ctx.save();ctx.beginPath();ctx.rect(0,0,1536,1024);ctx.rect(710,405,707,165);ctx.clip('evenodd');
    const glow=ctx.createRadialGradient(w*.71,h*.65,0,w*.71,h*.65,w*.62);
    glow.addColorStop(0,'rgba(121,80,24,.055)');glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='lighter';
    const steps=w<761?80:130;
    paths.forEach((s,i)=>{
      ctx.beginPath();
      for(let j=0;j<=steps;j++){
        const x=-.06+j/steps*1.12,y=sample(x,s);
        j?ctx.lineTo(x*w,y):ctx.moveTo(x*w,y);
      }
      const lit=(Math.sin(s.phase+time*.24)+1)*.5;
      ctx.lineWidth=i%11===0?1:.45;
      ctx.strokeStyle=`rgba(${190+Math.round(lit*50)},${130+Math.round(lit*65)},${50+Math.round(lit*58)},${i%11===0?.22:.045+lit*.05})`;
      ctx.stroke();
      // A short highlight travels along each selected strand, rather than warping a texture.
      if(i%3===0){
        const pos=((time*.035+i*.137)%1.2)-.1;
        const trail=.055;
        const g=ctx.createLinearGradient((pos-trail)*w,0,pos*w,0);
        g.addColorStop(0,'rgba(245,184,81,0)');g.addColorStop(.8,'rgba(255,211,127,.52)');g.addColorStop(1,'rgba(255,238,192,.6)');
        ctx.strokeStyle=g;ctx.lineWidth=1.1;ctx.beginPath();
        for(let k=0;k<=10;k++){const x=pos-trail+k/10*trail;const y=sample(x,s);k?ctx.lineTo(x*w,y):ctx.moveTo(x*w,y)}ctx.stroke();
        const py=sample(pos,s);ctx.fillStyle='rgba(255,220,149,.8)';ctx.beginPath();ctx.arc(pos*w,py,1.1,0,Math.PI*2);ctx.fill();
      }
    });
    // Sparse, flowing motes belong to the same field as the filaments.
    for(let i=0;i<65;i++){
      const x=(i*.618034+time*.013)%1,s=paths[i%paths.length];
      const y=sample(x,s)+Math.sin(i*7.1+time*.2)*h*.03;
      const a=.1+.23*(.5+.5*Math.sin(time*.6+i));
      ctx.fillStyle=`rgba(231,177,86,${a})`;ctx.beginPath();ctx.arc(x*w,y,i%9===0?1.2:.6,0,Math.PI*2);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';ctx.restore();
  }
  function tick(now){
    const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;
    const ease=1-Math.exp(-dt*4);
    pointer.x+=(pointer.tx-pointer.x)*ease;pointer.y+=(pointer.ty-pointer.y)*ease;pointer.force+=(pointer.target-pointer.force)*ease;
    draw();raf=requestAnimationFrame(tick);
  }
  function playback(){
    cancelAnimationFrame(raf);raf=0;
    motion.hidden=false;motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'开启动效':'暂停背景动效');
    if(!paused && visible && !document.hidden && !menu.open){last=performance.now();raf=requestAnimationFrame(tick)}else draw();
  }
  function resize(){w=1536;h=1024;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(visual.clientWidth*dpr);canvas.height=Math.round(visual.clientHeight*dpr);draw()}
  toggle.addEventListener('click',()=>{menu.showModal();toggle.setAttribute('aria-expanded','true');playback()});
  document.querySelector('.menu-close').addEventListener('click',()=>menu.close());
  menu.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');playback()});
  motion.addEventListener('click',()=>{paused=!paused;playback()});
  reduced.addEventListener('change',()=>{paused=reduced.matches;playback()});
  document.addEventListener('visibilitychange',playback);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;playback()}).observe(home);
  home.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||paused)return;const r=visual.getBoundingClientRect(),scale=Math.max(r.width/1536,r.height/1024);pointer.tx=((e.clientX-r.left)-(r.width-1536*scale)/2)/(1536*scale);pointer.ty=((e.clientY-r.top)-(r.height-1024*scale)/2)/(1024*scale);pointer.target=1});
  home.addEventListener('pointerleave',()=>pointer.target=0);
  new ResizeObserver(resize).observe(home);resize();playback();
})();
