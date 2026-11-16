// ─────────────────────────────────────────────────────────────────────────────
//  MYRIA optics. Every highlight is derived from a light; every colour from a
//  thickness; every edge from a field. No painted dots, no plastic.
// ─────────────────────────────────────────────────────────────────────────────

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;

export const FULL_VS = HEAD + `
layout(location=0) in vec2 aP;
out vec2 vUV;
void main(){ vUV = aP*0.5+0.5; gl_Position = vec4(aP,0.,1.); }
`;

// shared camera helpers
const CAM = `
uniform vec2 uCam;   // world centre
uniform vec2 uView;  // world units visible (w,h)
vec2 worldAt(vec2 uv){ return uCam + (uv-0.5)*uView*vec2(1.,-1.); }
vec2 uvAt(vec2 w){ return (w-uCam)/uView*vec2(1.,-1.)+0.5; }
`;

const NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
// smooth cellular distance (organic pores, caustic webs)
float cells(vec2 p){ vec2 i=floor(p), f=fract(p); float d=8.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=hash22(i+g); vec2 r=g+o-f; d=min(d,dot(r,r)); }
  return sqrt(d); }
`;

// ── particle splat → density/colour fields (MRT) ─────────────────────────────
export const SPLAT_VS = HEAD + CAM + `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aA;   // x, y, radius, channel
layout(location=2) in vec4 aB;   // absorb rgb, glow
layout(location=3) in vec4 aC;   // emit rgb, metal
out vec2 vQ; flat out vec4 vB; flat out vec4 vC; flat out float vCh;
void main(){
  vec2 w = aA.xy + aQ*aA.z;
  vec2 ndc = (w-uCam)/(uView*0.5); ndc.y = -ndc.y;
  gl_Position = vec4(ndc,0.,1.);
  vQ = aQ; vB = aB; vC = aC; vCh = aA.w;
}`;
export const SPLAT_FS = HEAD + `
in vec2 vQ; flat in vec4 vB; flat in vec4 vC; flat in float vCh;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
layout(location=2) out vec4 o2; layout(location=3) out vec4 o3;
void main(){
  float q = dot(vQ,vQ); if(q>=1.) discard;
  float a = 1.-q; float w = a*a*a;
  vec4 A = vec4(w, w*vB.rgb);
  vec4 E = vec4(w*vC.rgb*vB.a, w*vC.a);
  if(vCh<0.5){ o0=A; o1=vec4(0); o2=E; o3=vec4(0); }
  else { o0=vec4(0); o1=A; o2=vec4(0); o3=E; }
}`;

// ── multi-scale dome heights from field mip pyramid ─────────────────────────
export const HEIGHT_FS = HEAD + `
in vec2 vUV; out vec4 o;
uniform sampler2D uF0; uniform sampler2D uF1;
uniform float uT; uniform float uBias;
float lod(sampler2D s, vec2 uv, float k){ return textureLod(s, uv, max(0., k+uBias)).r; }
const float FI = 2.9;   // interior field of a resting gel
float H(sampler2D s, vec2 uv){
  float f0 = textureLod(s, uv, 0.).r;
  if(f0 < uT*0.3) return 0.;
  float h = smoothstep(uT*0.7, FI, f0)*0.55;
  h += smoothstep(0.08, 0.95, lod(s,uv,1.)/FI)*0.55;
  h += smoothstep(0.06, 0.95, lod(s,uv,2.)/FI)*0.65;
  h += smoothstep(0.05, 0.95, lod(s,uv,3.)/FI)*0.8;
  h += smoothstep(0.04, 0.95, lod(s,uv,4.)/FI)*1.0;
  h += smoothstep(0.03, 0.95, lod(s,uv,5.)/FI)*1.15;
  h += smoothstep(0.02, 0.95, lod(s,uv,6.)/FI)*1.1;
  return h * smoothstep(uT*0.3, uT*1.3, f0);
}
// lens focus: large-scale difference of Gaussians (positive at droplet centres)
float focus(sampler2D s, vec2 uv){
  float a = lod(s,uv,2.5)/FI, b = lod(s,uv,4.5)/FI;
  return max(0., a-b*1.05);
}
void main(){ o = vec4(H(uF0, vUV), H(uF1, vUV), focus(uF0, vUV), focus(uF1, vUV)); }
`;

// ── world: deep background, etched glass, walls, machines ──────────────────
export const SCENE_FS = HEAD + CAM + NOISE + `
in vec2 vUV; out vec4 o;
uniform sampler2D uSDF; uniform sampler2D uMatT; uniform sampler2D uMatW;
uniform vec4 uSDFRect;   // x0,y0, 1/worldW, 1/worldH
uniform vec2 uSDFTexel;
uniform float uTime, uZoom;
uniform vec3 uPal0, uPal1, uPal2, uPal3, uPal4; // deep, mid, wall, rim, accent
uniform vec4 uLights[16]; uniform vec4 uLightC[16]; uniform int uNL;
uniform vec4 uShA[24]; uniform vec4 uShB[24]; uniform vec4 uShC[24]; uniform int uNS;
uniform float uGridK; uniform float uBright; uniform vec2 uGrav;

float sdStatic(vec2 w){
  vec2 uv = (w-uSDFRect.xy)*uSDFRect.zw;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) return -72.;
  return texture(uSDF, uv).r;
}
int matAt(vec2 w){ vec2 uv=(w-uSDFRect.xy)*uSDFRect.zw; return int(texture(uMatT, uv).r*255.+0.5); }
vec4 matW(vec2 w){ vec2 uv=(w-uSDFRect.xy)*uSDFRect.zw; return texture(uMatW, uv); }

// dynamic shapes, mirrored from physics.js shapeSDF
float sdShape(int k, vec2 w){
  vec4 A = uShA[k], B = uShB[k];
  vec2 d = w-A.yz; float ca=cos(A.w), sa=sin(A.w);
  vec2 l = vec2(d.x*ca+d.y*sa, -d.x*sa+d.y*ca);
  int t = int(A.x+0.5);
  if(t==0) return length(l)-B.x;
  if(t==1){ float cx=clamp(l.x,-B.y,B.y); return length(vec2(l.x-cx,l.y))-B.x; }
  if(t==2){ vec2 q=abs(l)-vec2(B.y,B.z)+B.x; return length(max(q,0.))+min(max(q.x,q.y),0.)-B.x; }
  if(t==3){
    float ang = atan(l.y,l.x);
    if(B.w>0. && abs(ang)<B.w){ vec2 e=vec2(cos(B.w),sin(B.w)*sign(l.y+1e-4))*B.y; return length(l-e)-B.x; }
    return abs(length(l)-B.y)-B.x;
  }
  if(t==4){ // gear: circle with rounded teeth
    float r = length(l); float a = atan(l.y,l.x);
    float teeth = B.z; float tooth = smoothstep(0.15,0.55, abs(fract(a*teeth/6.28318)-0.5)*2.)*B.w;
    return r-(B.y+tooth);
  }
  return 1e5;
}

vec3 wallMaterial(int m, vec2 w, float depth, vec3 N, out float gloss){
  gloss = 0.25;
  float n1 = fbm(w*0.02);
  if(m==1){ // GLASS — cold mirror slick
    gloss = 1.0;
    float streak = smoothstep(0.92,1.,sin((w.x+w.y)*0.035+n1*2.)*.5+.5);
    float band = exp(-depth/14.);
    return mix(vec3(0.03,0.06,0.08), vec3(0.22,0.38,0.5), band*0.8+0.1) + vec3(0.5,0.7,0.9)*streak*0.08;
  }
  if(m==2){ // RESIN — amber with clinging filaments
    gloss = 0.7;
    float fil = smoothstep(0.75,1., sin(w.x*0.25 + sin(w.y*0.07)*3. + n1*6.))*0.6;
    return vec3(0.42,0.20,0.04)*(0.8+0.6*n1) + vec3(1.,0.6,0.15)*fil*0.25;
  }
  if(m==3){ // GRIT — abrasive teeth
    gloss = 0.15;
    float g = cells(w*0.18); float sp = step(0.93, hash12(floor(w*0.5)));
    return vec3(0.16,0.13,0.12)*(0.6+0.8*g) + vec3(1.,0.55,0.25)*sp*0.25*(0.5+0.5*sin(uTime*9.+w.x));
  }
  if(m==4){ // BOUNCE — elastic membrane
    gloss = 0.8;
    return vec3(0.05,0.35,0.42)*(0.7+0.3*sin(w.x*0.08-uTime*3.));
  }
  if(m==6){ // METAL — machine
    gloss = 0.65;
    float brush = vnoise(vec2(w.x*0.6, w.y*0.02));
    return vec3(0.20,0.23,0.27)*(0.75+0.35*brush);
  }
  if(m==8){ // ICE
    gloss = 0.9;
    float cr = smoothstep(0.03,0.0, abs(cells(w*0.03)-0.55));
    return vec3(0.45,0.65,0.8)*(0.6+0.3*n1) + vec3(0.8,0.95,1.)*cr*0.3;
  }
  if(m==9){ // WARM
    gloss = 0.3;
    float vein = smoothstep(0.08,0., abs(fbm(w*0.03+uTime*0.05)-0.5));
    return vec3(0.18,0.07,0.05) + vec3(1.,0.35,0.08)*vein*(0.6+0.4*sin(uTime*2.));
  }
  // STONE — dark wet glass-stone: luminous near the skin, abyssal at the core
  float slow = fbm(w*0.006);
  float strata = 0.5+0.5*sin(depth*0.21 + slow*7.);
  float band = exp(-depth/18.);
  vec3 core = uPal2*0.2*(0.7+0.6*slow);
  vec3 skin = uPal2*(0.7+0.3*slow) + uPal3*0.006;
  vec3 c = mix(core, skin, band);
  c += uPal3*0.018*smoothstep(0.85,1.,strata)*exp(-depth/70.);
  return c;
}
void main(){
  vec2 w = worldAt(vUV);
  float pw = 1./uZoom;           // world size of a pixel
  // ── backdrop: deep water + etched petri glass, with parallax ──────────
  vec3 col = mix(uPal0, uPal1, smoothstep(-0.3, 1.25, vUV.y + 0.15*sin(w.x*0.0012)));
  vec2 gp = uCam + (w-uCam)*0.62;
  float gpw = pw/0.62;
  vec2 gg = abs(fract(gp/48.-0.5)-0.5)*48.;
  float minor = 1.-smoothstep(0., 1.1*gpw, min(gg.x,gg.y));
  vec2 gm = abs(fract(gp/192.-0.5)-0.5)*192.;
  float major = 1.-smoothstep(0., 1.6*gpw, min(gm.x,gm.y));
  col += uPal3*(minor*0.010 + major*0.026)*uGridK;
  // drifting caustic web from a far-off surface
  vec2 cp = gp*0.006 + vec2(uTime*0.04, uTime*0.025);
  float cw = cells(cp) ; float cw2 = cells(cp*1.7+vec2(4.1,uTime*0.05));
  float caus = pow(1.-min(cw,cw2)*1.2, 6.);
  col += uPal3*caus*0.028;
  // far parallax silhouettes (depth haze)
  vec2 fp = uCam + (w-uCam)*0.3;
  float far = fbm(fp*0.0025 + 3.1);
  col = mix(col, uPal1*1.25, smoothstep(0.55,0.8,far)*0.25);
  // light pools on the back plane
  for(int i=0;i<16;i++){ if(i>=uNL) break;
    vec4 L=uLights[i]; vec4 C=uLightC[i];
    vec2 dl = w-L.xy; float r2 = dot(dl,dl)/(L.w*L.w);
    col += C.rgb*abs(C.a)*exp(-r2*2.6)*0.06;
  }
  // plankton dust (two parallax layers)
  for(int k=0;k<2;k++){
    float par = k==0?0.45:0.8; float sc = k==0?0.02:0.012;
    vec2 dp = (uCam+(w-uCam)*par)*sc + vec2(0., uTime*0.015*(1.+float(k)));
    vec2 ci = floor(dp); vec2 cf = fract(dp);
    vec2 o2 = hash22(ci)*0.8+0.1; float rr = length(cf-o2);
    float tw = 0.5+0.5*sin(uTime*(1.+hash12(ci)*2.)+hash12(ci+3.)*6.28);
    float s = hash12(ci+7.) > 0.72 ? 1. : 0.;
    col += uPal3*s*smoothstep(0.05,0.,rr)*(0.03+0.07*tw)*(k==0?0.5:1.);
  }
  // ── walls ───────────────────────────────────────────────────────────────
  float d = sdStatic(w);
  int m = matAt(w);
  int dynK = -1;
  for(int k=0;k<24;k++){ if(k>=uNS) break; float ds = sdShape(k,w); if(ds<d){ d=ds; dynK=k; } }
  if(dynK>=0) m = int(uShC[dynK].x+0.5);
  // ambient occlusion & wet sheen in open water
  float ao = 1.-0.55*exp(-max(d,0.)/26.);
  col *= ao;
  if(d < 3.*pw + 14.){
    // gradient normal (finite differences in world space)
    float e = 1.5;
    float dx, dy;
    if(dynK>=0){ dx = sdShape(dynK,w+vec2(e,0.))-sdShape(dynK,w-vec2(e,0.)); dy = sdShape(dynK,w+vec2(0.,e))-sdShape(dynK,w-vec2(0.,e)); }
    else { dx = sdStatic(w+vec2(e,0.))-sdStatic(w-vec2(e,0.)); dy = sdStatic(w+vec2(0.,e))-sdStatic(w-vec2(0.,e)); }
    vec2 n2 = normalize(vec2(dx,dy)+1e-5);
    // bevel profile: raised plateau with rounded lip
    float bev = 9.;
    float t = clamp(-d/bev, 0., 1.);
    float slope = (1.-t)*(1.-t)*1.6;
    vec3 N = normalize(vec3(n2*slope, 1.));
    float gloss;
    vec3 base;
    if(dynK>=0) base = wallMaterial(m, w, -d, N, gloss);
    else {
      // smooth blend between neighbouring materials (no staircase seams)
      vec4 mw = matW(w);
      float g0; vec3 stone = wallMaterial(0, w, -d, N, g0);
      base = stone; gloss = g0;
      float tot = mw.r+mw.g+mw.b+mw.a;
      if(tot > 0.004){
        float gl1, gl2, gl3, gl4;
        vec3 acc = stone*max(0.,1.-tot); float gacc = g0*max(0.,1.-tot);
        if(mw.r>0.){ vec3 c1 = wallMaterial(m==8?8:1, w, -d, N, gl1); acc += c1*mw.r; gacc += gl1*mw.r; }
        if(mw.g>0.){ vec3 c2 = wallMaterial(2, w, -d, N, gl2); acc += c2*mw.g; gacc += gl2*mw.g; }
        if(mw.b>0.){ vec3 c3 = wallMaterial(6, w, -d, N, gl3); acc += c3*mw.b; gacc += gl3*mw.b; }
        if(mw.a>0.){ int ma = (m==3||m==4||m==5||m==9)?m:3; vec3 c4 = wallMaterial(ma, w, -d, N, gl4); acc += c4*mw.a; gacc += gl4*mw.a; }
        float nrm = max(1., tot);
        base = acc/nrm; gloss = gacc/nrm;
      }
    }
    // deep interior darkening gives thickness
    base *= 0.75 + 0.25*exp(-max(-d,0.)/40.);
    vec3 lit = base*0.35;
    vec3 V = vec3(0,0,1);
    // key light (from upper-left, far)
    vec3 K = normalize(vec3(-0.45,-0.7,0.55));
    lit += base*max(dot(N,K),0.)*0.55;
    lit += uPal3*pow(max(dot(N,normalize(K+V)),0.), 24.)*gloss*0.35;
    for(int i=0;i<16;i++){ if(i>=uNL) break;
      vec4 L=uLights[i]; vec4 C=uLightC[i];
      vec3 lv = vec3(L.xy-w, L.z); float dist = length(lv); vec3 ld = lv/dist;
      float att = abs(C.a)/(1.+ (dist*dist)/(L.w*L.w));
      lit += base*C.rgb*max(dot(N,ld),0.)*att*0.9;
      lit += C.rgb*pow(max(dot(N,normalize(ld+V)),0.), 40.)*gloss*att*0.8;
    }
    // rim: moisture-rich lip catching light
    float lip = smoothstep(bev*0.9, 0., -d)*smoothstep(-0.5*pw-1.,0., -d+0.);
    lit += uPal3*lip*0.035*(0.6+0.4*gloss);
    if(m==4){ lit += vec3(0.2,0.9,1.0)*exp(-abs(d)/3.)*0.8*(0.7+0.3*sin(uTime*5.)); }
    if(m==9){ lit += vec3(1.,0.4,0.1)*exp(-abs(d)/6.)*0.25; }
    if(m==3){ lit += vec3(1.,0.5,0.2)*exp(-abs(d)/2.)*0.12; }
    // edge glow just outside (wet film)
    vec3 outside = col + uPal3*exp(-max(d,0.)/2.0)*0.018*(m==1?3.:1.);
    float cov = smoothstep(pw, -pw, d);
    col = mix(outside, lit, cov);
  }
  o = vec4(col*uBright, 1.);
}
`;

// ── entity sprites drawn into the scene (refracted by the fluid) ───────────
export const ENT_VS = HEAD + CAM + `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aA;   // x, y, size, type
layout(location=2) in vec4 aB;   // rgb, alpha
layout(location=3) in vec4 aC;   // p0..p3 (type params)
out vec2 vQ; flat out vec4 vB; flat out vec4 vC; flat out float vT; flat out float vS;
void main(){
  // basins (type 11/12) are anisotropic: half-extents ride in aC.zw
  vec2 ext = (aA.w > 10.5 && aA.w < 12.5) ? aC.zw : vec2(aA.z);
  vec2 w = aA.xy + aQ*ext;
  vQ = aQ; vS = min(ext.x, ext.y);
  if (aA.w > 12.5 && aA.w < 13.5) {
    // beam slice: an oriented quad hugging the wedge (no wasted fragments)
    vec2 ax = vec2(cos(aC.x), sin(aC.x)), ay = vec2(-ax.y, ax.x);
    float hl = aC.z*0.5 + 16., hw = aC.z*aC.y*1.3 + 12.;
    vec2 off = ax*aQ.x*hl + ay*aQ.y*hw;
    w = aA.xy + off; vQ = off; vS = 1.;
  }
  vec2 ndc = (w-uCam)/(uView*0.5); ndc.y=-ndc.y;
  gl_Position = vec4(ndc,0.,1.);
  vB = aB; vC = aC; vT = aA.w;
}`;
export const ENT_FS = HEAD + NOISE + `
in vec2 vQ; flat in vec4 vB; flat in vec4 vC; flat in float vT; flat in float vS;
uniform float uTime; uniform float uZoom;
out vec4 o;
void main(){
  float r = length(vQ);
  float px = 1.5/(vS*uZoom);
  int t = int(vT+0.5);
  vec3 c = vB.rgb; float a = vB.a;
  vec3 col = vec3(0.); float alpha = 0.;
  if(t==0){ // mote: a dew of light with soft diffraction spikes
    float core = smoothstep(0.22, 0.0, r);
    float halo = exp(-r*r*14.)*0.7;
    float tw = 0.8+0.2*sin(uTime*4.+vC.x*6.28);
    float ang = uTime*0.35 + vC.x*6.28;
    vec2 q = mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*vQ;
    float spikes = (exp(-abs(q.x)*40.)*exp(-abs(q.y)*3.5) + exp(-abs(q.y)*40.)*exp(-abs(q.x)*3.5))*0.55;
    col = c*(core*2.0+halo+spikes*tw)*tw; alpha = 0.;
  } else if(t==1){ // prism: faceted crystal
    float ang = atan(vQ.y,vQ.x)+uTime*0.6+vC.x;
    float hex = cos(3.14159/6.)/cos(mod(ang,1.0472)-0.5236);
    float d = r - 0.42*hex;
    float body = smoothstep(px,-px,d);
    float facet = 0.5+0.5*sin(ang*3.+uTime*2.);
    vec3 rainbow = 0.5+0.5*cos(6.28*(vec3(0.,0.33,0.67)+ang*0.3+uTime*0.2));
    col = (rainbow*0.9+0.4)*body*(0.6+0.8*facet) + c*exp(-r*r*5.)*0.8 + vec3(1.)*smoothstep(0.06,0.,abs(d))*1.2;
  } else if(t==2){ // ring / portal iris
    float R = vC.x, th = vC.y;
    float d = abs(r-R)-th;
    float ring = smoothstep(px,-px,d);
    float glow = exp(-max(d,0.)*vC.z);
    float spin = 0.5+0.5*sin(atan(vQ.y,vQ.x)*vC.w - uTime*3.);
    col = c*(ring*(1.2+spin) + glow*0.5);
    float inner = smoothstep(R, 0., r);
    col += c*inner*0.12*(0.5+0.5*sin(uTime*2.-r*20.));
  } else if(t==3){ // soft disc / pool
    float d = r-0.9;
    col = c*smoothstep(px*2.,-px*2.,d)*(0.55+0.45*smoothstep(0.9,0.,r)) + c*exp(-max(d,0.)*10.)*0.3;
    col *= 0.8+0.2*sin(uTime*2.+r*12.-vC.x);
  } else if(t==4){ // pressure plate
    float d = max(abs(vQ.x)-0.92, abs(vQ.y)-0.32);
    float plate = smoothstep(px,-px,d);
    float fill = vC.x;
    float bar = step(vQ.x*0.5+0.5, fill)*smoothstep(0.22,0.18,abs(vQ.y));
    col = c*plate*(0.25+0.9*bar) + c*exp(-max(d,0.)*14.)*0.4*(0.3+fill);
  } else if(t==5){ // lantern: a glass anemone — dormant grey bud → blooming living light
    float bloom = vC.x;
    float ang = atan(vQ.y, vQ.x);
    float sway = sin(uTime*1.3 + r*5.)*0.09*bloom;
    float petal = abs(cos((ang + sway + 1.5708)*3.5));
    float R = mix(0.34, 0.9, bloom) * (0.5 + 0.5*pow(petal, 0.7)) + 0.03*sin(uTime*2.)*bloom;
    float d = r - R;
    float body = smoothstep(px*2., -px*2., d);
    float rim = exp(-abs(d)*30.);
    vec3 dim = vec3(0.10,0.15,0.19);
    vec3 cc = mix(dim, c, bloom);
    float inner = smoothstep(R, 0., r);
    col = cc*body*(0.10 + 0.32*inner*(0.3+bloom)) + cc*rim*(0.22+0.7*bloom);
    col += cc*body*smoothstep(0.94,1.,petal)*0.22*bloom;                 // veins
    col += mix(cc, vec3(1.), 0.35)*exp(-r*r*40.)*(0.25+1.6*bloom);       // hot core
    col *= 0.9 + 0.1*sin(uTime*3. + vC.y);
  } else if(t==6){ // arrow-less flow hint: soft chevron streak (currents)
    float s = smoothstep(0.5,0.,abs(vQ.y))*smoothstep(1.,0.2,abs(vQ.x));
    col = c*s*0.4;
  } else if(t==7){ // black hole: lensing ring + event horizon
    float R = 0.32;
    float hor = smoothstep(R+px, R-px, r);
    float ring = exp(-pow((r-R*1.35)*9.,2.))*1.5;
    float swirl = 0.5+0.5*sin(atan(vQ.y,vQ.x)*3.-uTime*4.+r*14.);
    col = c*ring*(0.6+0.6*swirl) + c*exp(-r*3.)*0.25;
    o = vec4(col*(1.-hor), max(hor, 0.)); return;
  } else if(t==8){ // magnet node
    float d = r-0.5;
    float body = smoothstep(px,-px,d);
    float field = 0.5+0.5*sin(r*30.-uTime*6.);
    col = c*body*0.8 + c*exp(-max(d,0.)*6.)*field*0.5;
  } else if(t==9){ // geyser vent / white hole
    float plume = exp(-vQ.x*vQ.x*10.)*smoothstep(1.,-1.,vQ.y);
    col = c*plume*(0.5+0.5*vnoise(vec2(vQ.x*6., vQ.y*4.+uTime*6.)));
  } else if(t==10){ // generic glyph dot (switch link lights)
    col = c*smoothstep(0.5,0.,r)*1.5;
  } else if(t==11){ // basin: luminous liquid with a living meniscus
    vec2 ext = vC.zw; vec2 pw = vQ*ext;                 // world-space offsets
    float wave = sin(pw.x*0.06+uTime*2.)*2.5 + sin(pw.x*0.11-uTime*1.3)*1.5;
    float top = -ext.y + 6. + wave;
    float inside = smoothstep(-1.5, 1.5, pw.y-top) * smoothstep(ext.x, ext.x-6., abs(pw.x));
    float meniscus = exp(-pow((pw.y-top)/2.2, 2.))*smoothstep(ext.x, ext.x-10., abs(pw.x));
    float depth = clamp((pw.y-top)/(2.*ext.y), 0., 1.);
    float caus = pow(1.-abs(sin(pw.x*0.05+uTime*1.1+sin(pw.y*0.04+uTime)*2.)), 6.);
    col = c*inside*(0.22+0.25*(1.-depth)+0.25*caus*(1.-depth)) + c*meniscus*1.4;
    o = vec4(col*a, inside*a*0.55); return;
  } else if(t==13){ // sentinel beam slice (occlusion-correct: one slice per raycast)
    float bang = vC.x, bhw = vC.y, L = vC.z;
    vec2 dir = vec2(cos(bang), sin(bang));
    vec2 p = vQ*vS + dir*(L*0.5);
    float dd = length(p); float da = atan(p.y, p.x) - bang; da = atan(sin(da), cos(da));
    float edge = smoothstep(bhw*1.15, bhw*0.55, abs(da));
    float fall = smoothstep(L, L-14., dd) * (1. - dd/L*0.55) * smoothstep(0., 30., dd);
    float motes = pow(vnoise(p*0.05 + vec2(uTime*0.4, uTime*0.25)), 4.)*1.4;
    col = c*edge*fall*(0.10 + 0.08*motes);
    o = vec4(col*vC.w, 0.); return;
  } else if(t==14){ // sentinel eye: a glass orb with a pupil that follows its gaze
    float d = r-0.62;
    float body = smoothstep(px*2.,-px*2.,d);
    vec2 g = vec2(cos(vC.x), sin(vC.x))*0.28;
    float pupil = exp(-dot(vQ-g, vQ-g)*28.);
    float rim = exp(-abs(d)*24.);
    col = vec3(0.04,0.05,0.07)*body + c*pupil*(1.2+vC.y*1.5) + c*rim*0.5;
    o = vec4(col, body*0.9); return;
  } else if(t==12){ // water volume: depth-darkened, a soft caustic web near the surface
    vec2 ext = vC.zw; vec2 pw = vQ*ext;
    float wave = sin(pw.x*0.02+uTime*1.2)*4. + sin(pw.x*0.047-uTime*0.8)*2.;
    float top = -ext.y + wave;
    float inside = smoothstep(-1.5, 1.5, pw.y-top);
    float depth = clamp((pw.y-top)/420., 0., 1.);
    float surf = exp(-pow((pw.y-top)/1.8, 2.));
    vec2 cp = pw*0.011 + vec2(uTime*0.05, uTime*0.032);
    float caus = pow(1.-min(cells(cp), cells(cp*1.7+vec2(3.1,1.7)))*1.15, 5.);
    col = c*(inside*(0.03 + 0.06*caus*(1.-depth)*(1.-depth)) + surf*0.65);
    o = vec4(col*a, inside*a*(0.1+0.22*depth)); return;
  }
  o = vec4(col*a, alpha*a);
}`;

// ── the composite: fluid optics over the world ──────────────────────────────
export const COMP_FS = HEAD + CAM + NOISE + `
in vec2 vUV; out vec4 o;
uniform sampler2D uScene, uF0, uF1, uE0, uE1, uH;
uniform vec2 uHPx;       // 1/size of the half-res fields
uniform float uT, uTime, uZoom;
uniform vec4 uLights[16]; uniform vec4 uLightC[16]; uniform int uNL;
uniform vec3 uSky;       // environment tint for reflections
uniform float uQual;
uniform vec4 uDanger;    // player danger rim: rgb, amount
uniform float uCaust;

vec3 refrSample(vec2 uv, vec2 off){
  float r = texture(uScene, uv+off*0.92).r;
  float g = texture(uScene, uv+off*1.00).g;
  float b = texture(uScene, uv+off*1.10).b;
  return vec3(r,g,b);
}

vec3 shade(vec2 uv, vec2 w, vec4 F, vec4 E, int ch, vec3 bg, out float cov){
  // pristine contour: fold in the next mip (wide, smooth isosurface filtering)
  float f1 = ch==0 ? textureLod(uF0, uv, 1.).r : textureLod(uF1, uv, 1.).r;
  float f = mix(F.r, f1, 0.45);
  float fw = max(fwidth(f), 1e-4);
  cov = smoothstep(uT-fw*0.8, uT+fw*0.8, f);
  if(cov<=0.) return bg;
  float inv = 1./max(f,1e-4);
  vec3 absorb = F.gba*inv;
  vec3 emit = E.rgb*inv;
  float metal = clamp(E.a*inv, 0., 1.);
  // dome height & normal from multi-scale field
  vec2 hp = uHPx;
  float hc, hl, hr, hd, hu;
  if(ch==0){ hc=texture(uH,uv).r; hl=texture(uH,uv-vec2(hp.x,0)).r; hr=texture(uH,uv+vec2(hp.x,0)).r; hd=texture(uH,uv-vec2(0,hp.y)).r; hu=texture(uH,uv+vec2(0,hp.y)).r; }
  else { hc=texture(uH,uv).g; hl=texture(uH,uv-vec2(hp.x,0)).g; hr=texture(uH,uv+vec2(hp.x,0)).g; hd=texture(uH,uv-vec2(0,hp.y)).g; hu=texture(uH,uv+vec2(0,hp.y)).g; }
  vec2 g = vec2(hr-hl, hu-hd)*0.5;
  // screen-space normal (y up); slope grows at the rim → jewel Fresnel
  vec3 n = normalize(vec3(-g*2.2, 1.)); n.z = max(n.z, 0.22); n = normalize(n);
  float thick = hc*0.45;                  // optical depth (dome sum ≈ 0..6 → 0..2.6)
  // refraction with chromatic dispersion
  vec2 off = n.xy*(0.012 + 0.010*thick)*vec2(uView.y/uView.x,1.);
  vec3 tr = refrSample(uv, off);
  // Beer–Lambert: thick → saturated jewel, thin → crystal clear
  vec3 transm = exp(-absorb*thick*1.6);
  vec3 body = tr*transm*2.6;              // the gel lenses & concentrates light
  // volumetric bioluminescence: accumulates with depth, self-filtered on the way out
  float acc = 1.-exp(-thick*1.6);
  vec3 emi = emit*acc*exp(-absorb*thick*0.75)*0.38;
  // world-space normal for lighting (flip y)
  vec3 nw = vec3(n.x, -n.y, n.z);
  float cosT = clamp(n.z, 0., 1.);
  float F0 = mix(0.035, 0.75, metal);
  float Fr = F0 + (1.-F0)*pow(1.-cosT, 5.);
  // environment reflection: mirrored surroundings + skylight from above only
  vec3 env = texture(uScene, uv - n.xy*0.06).rgb*0.9 + uSky*0.35*pow(clamp(-nw.y*0.9+0.1,0.,1.),2.);
  vec3 metalTint = mix(vec3(1.), normalize(emit+1e-3)*0.9+0.25, metal);
  // specular from real lights (moves with the surface; never painted)
  vec3 spec = vec3(0.);
  vec3 V = vec3(0,0,1);
  {
    vec3 K = normalize(vec3(-0.45,-0.7,0.6));
    vec3 hv = normalize(K+V);
    float nh = max(dot(nw,hv),0.);
    spec += uSky*1.6*pow(nh, 140.)*(0.3+Fr);
    spec += uSky*0.10*pow(nh, 16.)*(1.+metal*2.);
  }
  for(int i=0;i<16;i++){ if(i>=uNL) break;
    vec4 L=uLights[i]; vec4 C=uLightC[i];
    if(C.a<=0.) continue;                 // interior / environment-only lights
    vec3 lv = vec3(L.xy-w, L.z); float dist=length(lv); vec3 ld=lv/dist;
    float att = C.a/(1.+dist*dist/(L.w*L.w));
    vec3 hv = normalize(ld+V);
    spec += C.rgb*att*pow(max(dot(nw,hv),0.), 70.)*1.4*(0.3+Fr);
  }
  // chromatic rim dispersion: faint rainbow fringe on steep edges
  float rim = pow(1.-cosT, 3.);
  vec3 iris = 0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + rim*1.3 + thick*0.15));
  vec3 col = body*(1.-Fr)*(1.-metal*0.85) + env*Fr*metalTint + spec*metalTint + emi;
  col += iris*rim*0.035*(1.+metal*2.);
  // thin gossamer: when barely-there, betray only by warping
  float gossamer = smoothstep(0.0, 0.35, thick);
  col = mix(tr*(1.-Fr*0.5) + spec*0.6, col, 0.4+0.6*gossamer);
  if(ch==0 && uDanger.a>0.){ col += uDanger.rgb*uDanger.a*rim*1.8; }
  return mix(bg, col, cov);
}

void main(){
  vec2 uv = vUV;
  vec2 w = worldAt(uv);
  vec3 bg = texture(uScene, uv).rgb;
  // light → droplets → floor: soft shadows and focused caustics
  vec2 so = vec2(0.010, -0.016)*vec2(uView.y/uView.x,1.);
  vec4 hs = texture(uH, uv + so);
  float shadow = 1.-0.38*smoothstep(0.,2.5,hs.r+hs.g);
  bg *= shadow;
  if(uCaust>0.){
    vec2 co = vec2(0.010,-0.016)*vec2(uView.y/uView.x,1.);
    vec2 cuv = uv + co*0.6;
    vec4 hc = texture(uH, cuv);
    vec4 fP = texture(uF0, cuv), fO = texture(uF1, cuv);
    vec3 tP = exp(-(fP.gba/max(fP.r,1e-3))*0.9), tO = exp(-(fO.gba/max(fO.r,1e-3))*0.9);
    bg += (tP*hc.b + tO*hc.a)*uCaust*0.9;
  }
  vec4 F1 = texture(uF1, uv), E1 = texture(uE1, uv);
  float cov1 = 0., cov0 = 0.;
  vec3 col = bg;
  if(F1.r > uT*0.3) col = shade(uv, w, F1, E1, 1, col, cov1);
  vec4 F0 = texture(uF0, uv), E0 = texture(uE0, uv);
  if(F0.r > uT*0.3) col = shade(uv, w, F0, E0, 0, col, cov0);
  // soft outer aura from emission (pre-bloom glow in water)
  o = vec4(col, 1.);
}
`;

// ── additive FX sprites (inner life, sparks, anchors) ───────────────────────
export const FX_VS = ENT_VS;
export const FX_FS = HEAD + `
in vec2 vQ; flat in vec4 vB; flat in vec4 vC; flat in float vT; flat in float vS;
uniform sampler2D uF0; uniform sampler2D uF1; uniform vec2 uScreen; uniform float uT; uniform float uTime; uniform float uZoom;
out vec4 o;
void main(){
  float r = length(vQ);
  int t = int(vT+0.5);
  vec3 c = vB.rgb; float a = vB.a;
  float v = 0.;
  if(t==0){ v = exp(-r*r*7.)*(r<1.?1.:0.); }                                   // soft dot
  else if(t==1){ v = smoothstep(0.12,0.,abs(r-0.7))*0.9 + exp(-pow((r-0.45)*6.,2.))*0.15; } // bubble ring
  else if(t==2){ float s = smoothstep(1.,0.,abs(vQ.x))*smoothstep(0.35,0.,abs(vQ.y)); v = s; } // streak (pre-stretched)
  else if(t==3){ float st = max(smoothstep(0.08,0.,abs(vQ.x))*smoothstep(1.,0.,abs(vQ.y)), smoothstep(0.08,0.,abs(vQ.y))*smoothstep(1.,0.,abs(vQ.x))); v = st + exp(-r*r*12.); } // sparkle
  else if(t==4){ float q = (r-0.78)*6.5; v = exp(-q*q)*0.75 + exp(-r*r*3.)*0.05; } // soft ripple / anchor ring
  else if(t==5){ v = exp(-r*r*3.)*0.5; } // broad glow
  else if(t==6){ float d = abs(r-0.8); v = smoothstep(0.2,0.,d)*(0.5+0.5*sin(atan(vQ.y,vQ.x)*8.+uTime*4.)); } // charge ring
  if(r>1.) v = 0.;
  // mask: 1 → only inside player gel, 2 → inside others, 3 → outside any gel
  float m = vC.x;
  if(m>0.5){
    vec2 suv = gl_FragCoord.xy/uScreen;
    float f = m<1.5 ? texture(uF0,suv).r : m<2.5 ? texture(uF1,suv).r : 1.;
    if(m<2.5) v *= smoothstep(uT*0.9, uT*1.6, f);
  }
  o = vec4(c*v*a, 0.);
}`;

// ── bloom ───────────────────────────────────────────────────────────────────
export const BRIGHT_FS = HEAD + `
in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPx; uniform float uThresh;
void main(){
  vec3 c = vec3(0.);
  c += texture(uSrc, vUV+vec2(-uPx.x,-uPx.y)).rgb; c += texture(uSrc, vUV+vec2(uPx.x,-uPx.y)).rgb;
  c += texture(uSrc, vUV+vec2(-uPx.x,uPx.y)).rgb;  c += texture(uSrc, vUV+vec2(uPx.x,uPx.y)).rgb;
  c *= 0.25;
  float l = max(max(c.r,c.g),c.b);
  float k = smoothstep(uThresh, uThresh*2.2, l);
  o = vec4(c*k, 1.);
}`;
export const DOWN_FS = HEAD + `
in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPx;
void main(){
  vec3 c = texture(uSrc, vUV).rgb*0.25;
  c += texture(uSrc, vUV+vec2(-uPx.x,-uPx.y)).rgb*0.1875; c += texture(uSrc, vUV+vec2(uPx.x,-uPx.y)).rgb*0.1875;
  c += texture(uSrc, vUV+vec2(-uPx.x,uPx.y)).rgb*0.1875;  c += texture(uSrc, vUV+vec2(uPx.x,uPx.y)).rgb*0.1875;
  o = vec4(c,1.);
}`;
export const UP_FS = HEAD + `
in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPx; uniform float uK;
void main(){
  // 3×3 tent (1-2-1) — round, artefact-free glow at every scale
  vec2 d = uPx;
  vec3 c = texture(uSrc, vUV).rgb*4.;
  c += (texture(uSrc, vUV+vec2(-d.x,0.)).rgb + texture(uSrc, vUV+vec2(d.x,0.)).rgb + texture(uSrc, vUV+vec2(0.,-d.y)).rgb + texture(uSrc, vUV+vec2(0.,d.y)).rgb)*2.;
  c += texture(uSrc, vUV+vec2(-d.x,-d.y)).rgb + texture(uSrc, vUV+vec2(d.x,-d.y)).rgb + texture(uSrc, vUV+vec2(-d.x,d.y)).rgb + texture(uSrc, vUV+vec2(d.x,d.y)).rgb;
  o = vec4(c/16.*uK, 1.);
}`;

export const FINAL_FS = HEAD + NOISE + `
in vec2 vUV; out vec4 o;
uniform sampler2D uHDR; uniform sampler2D uBloom; uniform float uBloomK; uniform float uExpo; uniform float uTime;
uniform float uVig; uniform vec4 uFlash; uniform float uFade; uniform float uSat;
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
void main(){
  vec2 uv = vUV;
  // gentle lens aberration toward the corners
  vec2 dc = uv-0.5; float r2 = dot(dc,dc);
  vec3 c;
  c.r = texture(uHDR, uv - dc*r2*0.006).r;
  c.g = texture(uHDR, uv).g;
  c.b = texture(uHDR, uv + dc*r2*0.006).b;
  c += texture(uBloom, uv).rgb*uBloomK;
  c += uFlash.rgb*uFlash.a;
  c *= uExpo;
  c *= mix(1., smoothstep(1.05, 0.2, sqrt(r2)*1.25), uVig);
  c = aces(c);
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(l), c, uSat);
  c = pow(c, vec3(1./2.2));
  c += (hash12(gl_FragCoord.xy + fract(uTime)*91.) - 0.5)/255.;
  c *= uFade;
  o = vec4(c, 1.);
}`;
