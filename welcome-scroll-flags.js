import * as THREE from './assets/lamp3d/vendor/three.module.js';

/** Two matching printed cloth scrolls, revealed only on the welcome finale. */
export async function createWelcomeScrollFlags() {
  const images = await Promise.all(['assets/nsbm-logo.png', 'assets/compuvate-logo.png'].map(async src => {
    const image = new Image(); image.src = src; await image.decode(); return image;
  }));
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const silk = ctx.createLinearGradient(0, 0, 512, 0);
  [[0,'#071726'],[.08,'#12384b'],[.25,'#254f64'],[.5,'#102e43'],[.8,'#245064'],[1,'#071b2c']].forEach(([at,color])=>silk.addColorStop(at,color));
  ctx.fillStyle = silk; ctx.fillRect(0,0,512,1024);
  ctx.strokeStyle='#2188b7';ctx.lineWidth=13;ctx.strokeRect(15,9,482,1006);
  ctx.strokeStyle='#9be7ff';ctx.lineWidth=3;ctx.strokeRect(27,17,458,990);
  for(let y=32;y<1000;y+=24){ctx.fillStyle='#77c7e7';for(const x of [15,497]){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-3,-3,6,6);ctx.restore();}}
  const lotus=(x,y,size,opacity=1)=>{
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.globalAlpha=opacity;
    ctx.strokeStyle='#a8d7e6';ctx.lineWidth=1.1/size;
    for(const angle of [-.85,-.43,0,.43,.85]){
      ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,7);ctx.bezierCurveTo(-9,-2,-6,-15,0,-22);ctx.bezierCurveTo(6,-15,9,-2,0,7);ctx.stroke();ctx.restore();
    }
    ctx.beginPath();ctx.moveTo(-21,9);ctx.quadraticCurveTo(0,18,21,9);ctx.stroke();ctx.restore();
  };
  const paisley=(x,y,flip=1)=>{
    ctx.save();ctx.translate(x,y);ctx.scale(flip,1);ctx.strokeStyle='#8cbdcf';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,-18);ctx.bezierCurveTo(21,-8,19,16,1,19);ctx.bezierCurveTo(-16,21,-18,1,-7,-8);ctx.bezierCurveTo(0,-14,5,-4,0,0);ctx.stroke();
    ctx.beginPath();ctx.ellipse(1,8,5,7,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  };
  // Woven lotus and paisley motifs frame the artwork without crossing the logos.
  for(let y=68;y<900;y+=76){lotus(38,y,.48,.7);lotus(474,y,.48,.7);paisley(38,y+34);paisley(474,y+34,-1);}
  lotus(256,83,1.6,.9);lotus(256,425,.8,.75);lotus(256,910,.8,.75);
  for(const x of [113,175,337,399])paisley(x,80,x<256?1:-1);
  const logoPanel=(x,y,width,height)=>{
    const pearl=ctx.createLinearGradient(x,y,x+width,y);
    [[0,'#9dbbcb'],[.25,'#dbe9ef'],[.55,'#bcd4df'],[.85,'#e0edf2'],[1,'#a2c2d1']].forEach(([at,color])=>pearl.addColorStop(at,color));
    ctx.fillStyle=pearl;ctx.beginPath();ctx.roundRect(x,y,width,height,22);ctx.fill();
    ctx.strokeStyle='#a6d8e8';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#3f7b98';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x+7,y+7,width-14,height-14,16);ctx.stroke();
  };
  logoPanel(59,140,394,225);logoPanel(59,463,394,414);
  const nsbm=images[0], association=images[1];
  const printedLogo = (image, removeChecker = false) => {
    const artwork=document.createElement('canvas');artwork.width=image.width;artwork.height=image.height;
    const context=artwork.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,artwork.width,artwork.height);
    for(let i=0;i<pixels.data.length;i+=4){
      const low=Math.min(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);
      const high=Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);
      if(removeChecker && low>210 && high-low<12) pixels.data[i+3]=0;
      else if(low>239) pixels.data[i+3]*=Math.max(0,(255-low)/16);
    }
    context.putImageData(pixels,0,0);return artwork;
  };
  const logoWidth=348, logoHeight=logoWidth*nsbm.height/nsbm.width;
  ctx.drawImage(printedLogo(nsbm,true),82,164,logoWidth,logoHeight);
  ctx.strokeStyle='#87afc2';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(102,421);ctx.lineTo(225,421);ctx.moveTo(287,421);ctx.lineTo(410,421);ctx.stroke();
  // Crop the outside frame while retaining the official emblem and wordmark.
  ctx.drawImage(printedLogo(association),association.width*.115,association.height*.079,association.width*.77,association.height*.81,82,485,348,366);
  // Two interwoven cords and small satin stitches finish the lower textile edge.
  for(const [phase,color] of [[0,'#318aa3'],[Math.PI,'#d4eef5']]){
    ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();
    for(let x=35;x<=477;x++){const y=947+Math.sin((x-35)*Math.PI/18+phase)*3;x===35?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.stroke();
  }
  ctx.strokeStyle='#70acc0';ctx.lineWidth=1.5;
  for(let x=42;x<474;x+=12){ctx.beginPath();ctx.moveTo(x,934);ctx.lineTo(x+4,939);ctx.moveTo(x,956);ctx.lineTo(x+4,961);ctx.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const group=new THREE.Group();group.name='WelcomeTwinScrollFlags';group.visible=false;
  group.userData.logoOrder=['NSBM','CompuVate'];group.userData.identicalArtwork=true;
  const fabric=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
  fabric.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSilkNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vSilkNormal = normalize(normalMatrix * normal);\n#include <begin_vertex>');
    shader.fragmentShader='varying vec3 vSilkNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec3 silkNormal=normalize(vSilkNormal);\ndiffuseColor.rgb *= clamp(.97 + silkNormal.x*.34 + silkNormal.y*.26 + (silkNormal.z-1.)*.12, .62, 1.12);');
  };
  fabric.customProgramCacheKey=()=> 'welcome-silk-folds-v2';
  const metal=new THREE.MeshPhysicalMaterial({color:0x478eb5,metalness:.9,roughness:.16,clearcoat:1,clearcoatRoughness:.12});
  const silver=new THREE.MeshPhysicalMaterial({color:0xc9e5f2,metalness:.92,roughness:.14,clearcoat:1});
  const insetMetal=new THREE.MeshStandardMaterial({color:0x16486d,metalness:.85,roughness:.22});
  const hemMaterial=new THREE.MeshStandardMaterial({color:0x366b83,metalness:.25,roughness:.42});
  const flags=[];
  for(const side of [-1,1]){
    const root=new THREE.Group();group.add(root);
    const geometry=new THREE.PlaneGeometry(1,1,32,48);
    const cloth=new THREE.Mesh(geometry,fabric);cloth.frustumCulled=false;root.add(cloth);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,20),metal);rod.rotation.z=Math.PI/2;root.add(rod);
    const roll=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,20,48,true),hemMaterial);roll.frustumCulled=false;root.add(roll);
    const caps=[-1,1].map(sign=>{
      const finialProfile=[new THREE.Vector2(0,-1),new THREE.Vector2(.3,-.55),new THREE.Vector2(.78,-.2),new THREE.Vector2(1,0),new THREE.Vector2(.62,.24),new THREE.Vector2(.27,.48),new THREE.Vector2(0,1)];
      const cap=new THREE.Mesh(new THREE.LatheGeometry(finialProfile,8),metal);cap.rotation.z=Math.PI/2;root.add(cap);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.18,10,32),silver);ring.rotation.y=Math.PI/2;root.add(ring);
      const collars=[.505,.535,.558].map((offset,index)=>{
        const collar=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,32),index===1?insetMetal:silver);
        collar.rotation.z=Math.PI/2;root.add(collar);return{collar,offset,index};
      });
      const hemCap=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),metal);root.add(hemCap);
      return{cap,ring,hemCap,sign,collars};
    });
    const rollBase=roll.geometry.attributes.position.array.slice();
    const fringeGeometry=new THREE.BufferGeometry();
    fringeGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(144*4*2*3),3));
    const colors=new Float32Array(144*4*2*3);
    for(let strand=0;strand<144;strand++){
      const color=new THREE.Color(strand%4===0?0x4795b1:0xa5d2df);
      for(let i=0;i<8;i++)color.toArray(colors,(strand*8+i)*3);
    }
    fringeGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const fringe=new THREE.LineSegments(fringeGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,toneMapped:false}));
    fringe.name='SatinThreadFringe';fringe.frustumCulled=false;root.add(fringe);
    flags.push({root,cloth,rod,roll,caps,side,rollBase,fringe});
  }
  let start=null;
  const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
  function update(time,width,height,visible){
    group.visible=visible;
    if(!visible){start=null;return;}
    if(start===null)start=time;
    const reveal=smooth((time-start)/2.8);
    const w=Math.min(width*.17,height*.32,290),h=w*2;
    const top=height*.09;
    for(const flag of flags){
      flag.root.position.set(width*(flag.side<0?.13:.87),height-top,100);
      const positions=flag.cloth.geometry.attributes.position,uv=flag.cloth.geometry.attributes.uv;
      const exposed=Math.max(.012,reveal)*h;
      const clothPoint=(u,y)=>{
        const v=y/h,free=Math.min(1,v*4),center=Math.sin(u*Math.PI);
        const wind=time*1.35+flag.side*.4;
        const fold=Math.sin(u*9-v*3.5-wind)*.65+Math.sin(u*17+v*4-wind*.7)*.28;
        const gathered=Math.sin(u*11)*Math.exp(-v*6);
        const edgeCurl=Math.pow(Math.abs(u-.5)*2,6)*smooth((v-.65)/.35);
        const sag=center*(h*.028+Math.sin(wind*.55)*h*.004)*Math.min(1,v*8);
        return[(u-.5)*w+free*fold*w*.016,-y-sag+edgeCurl*w*.067,
          6+center*free*fold*w*.11+gathered*w*.025+edgeCurl*w*.09];
      };
      for(let i=0;i<positions.count;i++){
        const u=uv.getX(i),v=1-uv.getY(i),y=Math.min(v*h,exposed);
        positions.setXYZ(i,...clothPoint(u,y));
      }
      flag.cloth.geometry.setDrawRange(0,Math.ceil(reveal*48)*32*6);
      positions.needsUpdate=true;flag.cloth.geometry.computeVertexNormals();
      flag.rod.scale.set(w*.020,w*1.19,w*.020);flag.rod.position.set(0,0,12);
      const radius=w*(.025+.024*(1-reveal));
      const rollPositions=flag.roll.geometry.attributes.position;
      for(let i=0;i<rollPositions.count;i++){
        const u=flag.rollBase[i*3+1]+.5,point=clothPoint(u,exposed);
        rollPositions.setXYZ(i,point[0],point[1]+flag.rollBase[i*3]*radius,point[2]+radius+flag.rollBase[i*3+2]*radius);
      }
      rollPositions.needsUpdate=true;flag.roll.geometry.computeVertexNormals();
      for(const {cap,ring,hemCap,sign,collars} of flag.caps){
        cap.position.set(sign*w*.625,0,12);cap.scale.set(w*.04,w*.055,w*.04);
        ring.position.set(sign*w*.57,0,12);ring.scale.setScalar(w*.027);
        for(const {collar,offset,index} of collars){
          collar.position.set(sign*w*offset,0,12);
          collar.scale.set(w*(index===1?.026:.028),w*(index===1?.022:.009),w*(index===1?.026:.028));
        }
        const hem=clothPoint(sign<0?0:1,exposed);hemCap.position.set(hem[0],hem[1],hem[2]+radius);hemCap.scale.set(w*.015,radius*1.07,radius*1.07);
      }
      // Each fine thread follows the moving hem and swings softly in the wind.
      flag.fringe.visible=reveal>.96;
      flag.fringe.material.opacity=smooth((reveal-.96)/.04);
      const threads=flag.fringe.geometry.attributes.position;
      for(let strand=0;strand<144;strand++){
        const u=.015+.97*strand/143,anchor=clothPoint(u,exposed);
        const length=w*(.075+.018*Math.sin(Math.floor(strand/3)*1.7));
        const point=t=>[anchor[0]+Math.sin(time*1.6+u*8+strand*.12)*w*.012*t*t,
          anchor[1]-radius*.7-length*t,anchor[2]+radius*1.8+Math.sin(time*1.3+u*7)*w*.018*t];
        for(let segment=0;segment<4;segment++){
          threads.setXYZ((strand*4+segment)*2,...point(segment/4));
          threads.setXYZ((strand*4+segment)*2+1,...point((segment+1)/4));
        }
      }
      threads.needsUpdate=true;
    }
    group.userData.reveal=reveal;
  }
  return{group,flags,texture,update};
}
