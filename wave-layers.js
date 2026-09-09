/* Three localized wave fields; the wordmark and empty background stay anchored. */
window.createWaveLayers = function(image,canvas) {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  if(!gl)return null;
  const vertex='attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  const fragment=`precision highp float;
  varying vec2 uv;uniform sampler2D photo;uniform vec2 crop;uniform float clock;
  float band(float y,float c,float width){float d=(y-c)/width;return exp(-d*d*2.);}
  void main(){
    vec2 q=(uv-.5)*crop+.5;
    float x=q.x;
    // Diagonal ridges follow the original image's three gold streams.
    float rear=.89-.67*pow(x,1.48);
    float middle=.89-.44*pow(x,1.55);
    float front=.97-.32*x;
    float a=band(q.y,rear,.085),b=band(q.y,middle,.072),c=band(q.y,front,.09);
    // Soft protection extends around the entire physical wordmark.
    float logoX=smoothstep(.43,.466,q.x)*(1.-smoothstep(.921,.95,q.x));
    float logoY=smoothstep(.365,.398,q.y)*(1.-smoothstep(.565,.601,q.y));
    float free=1.-logoX*logoY;
    float dy=a*(.014*sin(x*8.-clock*.38)+.005*sin(x*15.+clock*.2))
            +b*(.023*sin(x*7.+clock*.32+1.7)+.007*sin(x*13.-clock*.24))
            +c*(.030*sin(x*6.-clock*.27+3.2)+.008*sin(x*11.+clock*.18));
    float dx=a*.003*sin(clock*.22+x*7.)-b*.005*sin(clock*.28+x*6.)+c*.006*sin(clock*.2+x*5.);
    float edge=smoothstep(0.,.045,q.y)*(1.-smoothstep(.96,1.,q.y));
    vec2 moved=q+vec2(dx,dy)*free*edge;
    gl_FragColor=vec4(texture2D(photo,clamp(moved,.001,.999)).rgb,1.);
  }`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
  try{
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    const clock=gl.getUniformLocation(program,'clock'),crop=gl.getUniformLocation(program,'crop');
    canvas.style.opacity='1';
    return (time,width,height)=>{
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}
      const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
      gl.uniform2f(crop,width/(image.naturalWidth*scale),height/(image.naturalHeight*scale));gl.uniform1f(clock,time);gl.drawArrays(gl.TRIANGLES,0,6);
    };
  }catch(error){console.info('Static wave fallback',error.message);return null}
};
