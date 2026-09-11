/* Texture previews are a reading overlay. Shader downloads remain untouched. */
(() => {
  'use strict';
  const base='/assets/hski-study/maps/';
  const aliases={Ramp:'RampMap',Highlight:'HighlightMap',Shade:'ShadeMap',Def:'DefMap',VLSpecCube:'Cubemap',ReflectionSphereMap:'MatCap'};
  const pattern=/\b_?(?:ReflectionSphereMap|HighlightMap|RampAddMap|ShadeMap|LayerMap|RampMap|BaseMap|DefMap|VLSpecCube|Cubemap|MatCap|Ramp|Highlight|Shade|Def)\b/g;
  let catalog,anchor,openTimer,closeTimer,pinned=false,currentKey='',currentVariant,channel='RGB',restoringFocus=false;
  const remembered={};
  const panel=document.createElement('aside');
  panel.id='map-preview';panel.className='map-preview';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','贴图预览');
  panel.innerHTML='<div class="map-preview-head"><div><small>TEXTURE PREVIEW</small><strong id="map-preview-title"></strong></div><button type="button" id="map-preview-close" aria-label="关闭贴图预览">×</button></div><label class="map-material-label">材质<select id="map-material" aria-label="预览哪个材质的贴图"></select></label><div id="map-channels" class="map-channels" role="group" aria-label="查看贴图通道"></div><figure class="map-preview-figure"><img id="map-preview-image" alt=""><figcaption id="map-preview-size"></figcaption></figure><p id="map-preview-file" class="map-preview-file"></p><p id="map-preview-note"></p><small class="map-preview-hint">原始贴图缩略预览 · 悬停查看 / 点击停留 · Esc 关闭</small>';
  document.body.append(panel);
  const $=id=>document.getElementById(id);

  function decorate(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      return node.parentElement.closest('.map-term,script,style,select,textarea,a,.ln')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      pattern.lastIndex=0;const matches=[...node.textContent.matchAll(pattern)];if(!matches.length)continue;
      const fragment=document.createDocumentFragment();let from=0;
      for(const m of matches){
        const key=aliases[m[0].replace(/^_/,'')]||m[0].replace(/^_/,'');if(!catalog[key])continue;
        fragment.append(document.createTextNode(node.textContent.slice(from,m.index)));
        const term=document.createElement('span');term.className='map-term';term.dataset.map=key;term.textContent=m[0];
        // Existing lesson buttons keep their own keyboard action; their terms still support hover/touch.
        if(!node.parentElement.closest('button')){term.tabIndex=0;term.setAttribute('role','button');term.setAttribute('aria-haspopup','dialog');term.setAttribute('aria-controls',panel.id);term.setAttribute('aria-expanded','false');term.setAttribute('aria-label',m[0]+'：查看贴图');}
        fragment.append(term);from=m.index+m[0].length;
      }
      fragment.append(document.createTextNode(node.textContent.slice(from)));node.replaceWith(fragment);
    }
  }
  function decorateAll(){
    ['engineering','painting-intro','code','lead','explain','note','step-reason-text'].forEach(id=>decorate($(id)));
  }
  function close(restoreFocus=false){
    clearTimeout(openTimer);clearTimeout(closeTimer);panel.hidden=true;pinned=false;
    const previous=anchor;anchor=null;
    if(previous){previous.setAttribute('aria-expanded','false');if(restoreFocus&&previous.isConnected&&previous.tabIndex>=0){restoringFocus=true;previous.focus({preventScroll:true});restoringFocus=false;}}
  }
  function position(){
    if(panel.hidden||!anchor?.isConnected)return;
    const r=anchor.getBoundingClientRect(), gap=10, margin=12, box=panel.getBoundingClientRect();
    let left=Math.max(margin,Math.min(r.left,innerWidth-box.width-margin));
    let top=r.bottom+gap;
    if(top+box.height>innerHeight-margin){
      top=r.top-box.height-gap;
      if(top<margin){
        if(r.right+gap+box.width<=innerWidth-margin)left=r.right+gap;
        else if(r.left-gap-box.width>=margin)left=r.left-gap-box.width;
        top=r.top-60;
      }
    }
    top=Math.max(margin,Math.min(top,innerHeight-box.height-margin));
    panel.style.left=left+'px';panel.style.top=top+'px';
  }
  function defaultMaterial(term,key){
    const nearby=term.closest('p,.annotation,.dependency-flow')?.textContent||'';
    if(/眼睛亮点|亮点贴花|_ShaderType == 5/.test(nearby)&&key==='BaseMap')return 'ehl';
    if(/头发|HairSpecular/.test(nearby))return 'hir';
    const stage=Number(($('progress')?.textContent||'1').split('/')[0]);
    if(!$('engineering')?.hidden)return key==='HighlightMap'?'hir':'bdy';
    return stage===3?'hir':stage===6?'ehl':stage===2?'fce':'bdy';
  }
  function renderImage(){
    const v=currentVariant;
    const img=$('map-preview-image');
    if(!v){img.removeAttribute('src');return;}
    img.src=base+v.channels[channel];img.alt=`${currentKey} · ${v.label} · ${channel} 通道`;
    panel.dataset.strip=String(v.strip);
    $('map-preview-size').textContent=`${v.size[0]} × ${v.size[1]} · ${channel==='RGB'?'RGB 原始颜色（不叠 Alpha）':channel+' 通道灰度'}${v.strip?' · 纵向放大':''}`;
    $('map-channels').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));
    position();
  }
  function renderVariant(){
    currentVariant=catalog[currentKey].variants.find(v=>v.id===$('map-material').value);
    const v=currentVariant;
    $('map-channels').replaceChildren();
    if(!v)return;
    for(const name of Object.keys(v.channels)){
      const b=document.createElement('button');b.type='button';b.dataset.channel=name;b.textContent=name==='A'?'Alpha':name;b.setAttribute('aria-label','查看 '+name+' 通道');
      b.onclick=()=>{channel=name;renderImage();};$('map-channels').append(b);
    }
    if(!v.channels[channel])channel='RGB';
    $('map-preview-file').textContent=v.file;
    $('map-preview-note').textContent=catalog[currentKey].note+(v.enabled===false?' 此材质当前未启用这项开关。':'');
    renderImage();
  }
  function show(term,pin=false){
    clearTimeout(openTimer);clearTimeout(closeTimer);
    if(pinned&&!pin)return;
    if(anchor)anchor.setAttribute('aria-expanded','false');
    anchor=term;pinned=pin;currentKey=term.dataset.map;channel='RGB';
    const entry=catalog[currentKey];
    $('map-preview-title').textContent=currentKey+' · '+entry.title;
    $('map-material').replaceChildren();
    for(const v of entry.variants){const opt=document.createElement('option');opt.value=v.id;opt.textContent=v.label;$('map-material').append(opt);}
    const preferred=remembered[currentKey]||defaultMaterial(term,currentKey);
    if(entry.variants.some(v=>v.id===preferred))$('map-material').value=preferred;
    panel.querySelector('.map-material-label').hidden=!entry.variants.length;
    panel.querySelector('.map-preview-figure').hidden=!entry.variants.length;
    $('map-preview-file').hidden=!entry.variants.length;
    $('map-preview-note').textContent=entry.note;
    panel.hidden=false;anchor.setAttribute('aria-expanded','true');renderVariant();position();
  }
  function scheduleClose(){clearTimeout(openTimer);if(!pinned){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!panel.contains(document.activeElement))close();},200);}}
  $('map-preview-close').onclick=()=>close(true);
  $('map-material').onchange=()=>{remembered[currentKey]=$('map-material').value;renderVariant();};
  $('map-preview-image').onload=position;
  $('map-preview-image').onerror=()=>{$('map-preview-size').textContent='图片暂时未加载，请移开后重试。';};
  panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));
  panel.addEventListener('pointerleave',scheduleClose);
  document.addEventListener('pointerover',e=>{const term=e.target.closest('.map-term');if(!term||term.contains(e.relatedTarget)||!catalog||e.pointerType==='touch')return;clearTimeout(closeTimer);clearTimeout(openTimer);openTimer=setTimeout(()=>show(term),160);});
  document.addEventListener('pointerout',e=>{const term=e.target.closest('.map-term');if(term&&!term.contains(e.relatedTarget)&&!panel.contains(e.relatedTarget))scheduleClose();});
  document.addEventListener('focusin',e=>{if(restoringFocus)return;if(e.target.matches('.map-term'))show(e.target);else if(!panel.contains(e.target)&&!pinned)close();});
  document.addEventListener('focusout',e=>{if((e.target.closest('.map-term')||panel.contains(e.target))&&!panel.contains(e.relatedTarget)&&!e.relatedTarget?.closest('.map-term'))scheduleClose();});
  document.addEventListener('click',e=>{const term=e.target.closest('.map-term');if(term&&catalog){e.preventDefault();e.stopPropagation();if(anchor===term&&pinned)close();else show(term,true);}else if(!panel.contains(e.target))close();},true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();close(true);}
    else if(e.target.matches('.map-term')&&['Enter',' '].includes(e.key)){e.preventDefault();show(e.target,true);$('map-preview-close').focus({preventScroll:true});}
  },true);
  document.addEventListener('scroll',e=>{if(e.target instanceof Element&&panel.contains(e.target))return;close();},true);
  window.addEventListener('resize',()=>close());
  window.addEventListener('hashchange',()=>close());
  document.addEventListener('study:render',()=>{close();if(catalog)decorateAll();});
  fetch(base+'index.json').then(r=>{if(!r.ok)throw Error('previews');return r.json();}).then(data=>{catalog=data;decorateAll();}).catch(()=>{/* Keep the article readable if optional previews are unavailable. */});
})();
