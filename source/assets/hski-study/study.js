/* HSKI reading desk: annotations are a display layer; downloads stay byte-identical. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = '/assets/hski-study/';
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, stage = 1, file = '', selected = 0, hits = [], hitIndex = -1, compare = false, toastTimer, intro = true, engineering = false;
  const shortTitles = ['铺底色','阴影肤色','头发高光','局部补色','材质反光','眼睛亮点','环境补光','轮廓光','描边','原版完整态'];
  const footnotes = [
    '先看轮廓和固有色。底图已经包含美术画好的细节，所以“铺色”并不意味着一张没有细节的纯色图。',
    '这里把阴影与肤色作为同一轮塑形：它们共用 Ramp 明暗结果。面部继续保留原版的阴影修正。',
    '头发亮色块有自己独立的 HighlightMap 混合路径，不能简单地当成扣子的金属高光。',
    '补色的 Alpha 不只是透明度：它还会参与后续镜面反光的染色。',
    '扣子的 BRDF 反光已出现，眼睛亮点贴花仍关闭。虹膜自身的材质反射属于本步骤。',
    '眼睛亮点走独立的提前返回分支，以 Blend One One 叠加。此步只改变眼睛区域的 568 个像素，扣子不变。',
    '这一层没有肉眼变化是正常的。源工程当前夜间参数把环境 SH 和额外光贡献设为零；这里保留真实参数。',
    '轮廓光在已有明暗上提亮边缘。它与外扩几何产生的描边是不同的计算，下一步再画线。',
    '这是教学代码的完整效果。下一步切回原材质与原 Shader，以验证逐层拆解没有改变最终结果。',
    '这一帧与第 09 步教学完整态逐像素一致。可从左侧文件菜单查看原版 GakumasCommon.hlsl 和 Shader 文件。'
  ];
  const stepReasons = [
    '铺色是观察起点，但教学代码在末尾覆盖输出，前面仍写有贴图与光照准备。它不等于专门编译的极简 Unlit，也不能直接作为最低 GPU 成本的基线。',
    'Ramp 需要底色、阴影色、方向和蒙版，所以先准备输入再塑形。源码中的头发亮块会先修改 BaseMap，随后才进入这段 Ramp；教学编号不改变它们的数据依赖。',
    '头发亮块先 lerp 到 BaseMap，再参与明暗计算。若挪到阴影后直接提亮，暗部里的亮块会变得不同。教学用 step 把贡献乘零，并不保证省掉 HighlightMap 采样。',
    'RampAdd 同时修改底色与阴影色，它的 Alpha 还会给后面的镜面反光染色。先采样、再把这些数据交给不同路径，是因为一个输入有多个消费者。',
    'BRDF 要先得到光滑度、金属度、法线和方向，再算材质反射。DefMap 用不同通道打包参数；这能减少独立参数纹理的需求，但采样、压缩与带宽仍有代价。',
    '眼睛亮点是独立材质：片元提前返回自己的颜色，再按 One / One 混合叠加。它不走扣子的 BRDF。Queue 2204、模板 Equal / Ref 68 与关闭深度写入也决定了它能否正确出现。',
    '环境贡献在当前夜间参数下为零，不代表相关计算必然消失。SH 和额外灯路径仍写在合成开关之前；性能判断要结合所用变体和编译结果。',
    '轮廓光利用法线与视角等数据在片元内部提亮边缘，通常不因这一项单独增加人物 draw。它与下一步的外扩几何描边有不同的执行方式和成本。',
    '描边需要外扩顶点与独立 Pass。本 Renderer 在事件 500（AfterRenderingTransparents）筛选 UniversalForwardOutline，之后事件 550 再做调色；真正时机由管线配置决定。',
    '原版完整态用于校验拆解是否保持效果。固定镜头的像素差异为零能支持视觉一致，不能证明性能一致或所有场景都一致；优化应另建实验版本并在目标设备上测量。'
  ];
  function notify(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600); }
  function colorize(text) {
    // Tokenize the original string first; never apply token regexes to generated HTML.
    const pattern = /(\/\/.*|"(?:[^"\\]|\\.)*"|#[A-Za-z_]+|\b(?:float[1-4]?|half[1-4]?|int|bool|void|Material|Renderer|BRDFData|Texture2D|sampler2D)\b|\b(?:if|else|return|for|public|private|class|static|new|true|false|using|out|inout|const|struct)\b|\b\d+(?:\.\d+)?[fF]?\b|\b[A-Za-z_]\w*(?=\s*\())/g;
    let result = '', from = 0;
    for (const m of text.matchAll(pattern)) {
      result += escape(text.slice(from, m.index));
      const t=m[0]; let type='call';
      if(t.startsWith('//'))type='comment'; else if(t[0]==='"')type='string'; else if(/^\d/.test(t))type='number';
      else if(/^(float|half|int\b|bool\b|void\b|Material|Renderer|BRDFData|Texture2D|sampler2D)/.test(t))type='type';
      else if(t.startsWith('#')||/^(if|else|return|for|public|private|class|static|new|true|false|using|out|inout|const|struct)$/.test(t))type='keyword';
      result += `<span class="tok-${type}">${escape(t)}</span>`; from=m.index+t.length;
    }
    return result+escape(text.slice(from));
  }
  function activeSnippet() { return data.steps[stage-1].snippets[selected]; }
  function updateUrl(push=false) {
    const snippet=activeSnippet();
    const hash=`#step=${stage}&file=${encodeURIComponent(file)}&line=${file===snippet.file?snippet.start:1}`;
    if(location.hash!==hash)history[push?'pushState':'replaceState'](null,'',hash);
    try{localStorage.setItem('avalon-hski-step',String(stage));}catch{}
  }
  function showIntro(push=false){
    engineering=false;$('engineering').hidden=true;document.querySelectorAll('[data-open-engineering]').forEach(b=>b.setAttribute('aria-pressed','false'));
    intro=true;$('painting-intro').hidden=false;document.querySelector('.workspace').hidden=true;document.querySelector('.mobile-switch').hidden=true;
    document.querySelectorAll('#steps button').forEach(el=>el.setAttribute('aria-current',el.hasAttribute('data-intro')?'step':'false'));
    $('share').textContent='分享文章 ↗';
    if(location.hash!=='#intro')history[push?'pushState':'replaceState'](null,'','#intro');
    $('painting-intro').scrollTop=0;
    try{const last=Number(localStorage.getItem('avalon-hski-step'));if(last>=1&&last<=10){$('resume-study').hidden=false;$('resume-study').textContent=`继续上次 · 第 ${String(last).padStart(2,'0')} 步 →`;$('resume-study').onclick=()=>setStep(last);}}catch{}
    document.querySelector('#steps button[data-intro]').scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function showEngineering(push=false){
    engineering=true;intro=false;$('engineering').hidden=false;$('painting-intro').hidden=true;document.querySelector('.workspace').hidden=true;document.querySelector('.mobile-switch').hidden=true;
    document.querySelectorAll('#steps button').forEach(b=>b.setAttribute('aria-current','false'));
    document.querySelectorAll('[data-open-engineering]').forEach(b=>b.setAttribute('aria-pressed','true'));
    $('share').textContent='分享原理 ↗';
    if(location.hash!=='#engineering')history[push?'pushState':'replaceState'](null,'','#engineering');
    $('engineering').scrollTop=0;
  }
  function applyShade(value){
    const percent=Math.max(0,Math.min(100,value)), s=percent/100;
    $('shade-demo').value=String(percent);$('shade-value').textContent=s.toFixed(2);
    const first=.7*s, second=.2*s+.5;
    $('mix-first-value').textContent=first.toFixed(2);$('shade-first-value').textContent=second.toFixed(2);
    for(const [id,v] of [['mix-first',first],['shade-first',second]]){const gray=Math.round(255*v);$(id).style.backgroundColor=`rgb(${gray},${gray},${gray})`;}
  }
  function mobileView(view) {
    document.querySelector('.workspace').dataset.view=view;
    document.querySelectorAll('[data-view]').forEach(el=>{if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(el.dataset.view===view));});
  }
  function renderCode(scroll=true) {
    $('file').value=file; $('download').href=base+'code/'+file; $('download').download=file;
    const snippet=activeSnippet(); const lines=data.files[file].code.split(/\r?\n/);
    const ranges=[];
    data.steps.forEach(s=>s.snippets.forEach((r,j)=>{if(r.file===file)ranges.push({...r,stage:s.id,snippet:j});}));
    let html='';
    lines.forEach((line,i)=>{
      const n=i+1;
      ranges.filter(r=>r.start===n).forEach(r=>{html+=`<div class="annotation"><a href="#step=${r.stage}" data-step="${r.stage}" data-snippet="${r.snippet}">STEP ${String(r.stage).padStart(2,'0')} · ${escape(r.label)} ↗</a><strong>// ${escape(r.note)}</strong></div>`;});
      const related=ranges.find(r=>n>=r.start&&n<=r.end);
      const active=file===snippet.file&&n>=snippet.start&&n<=snippet.end;
      html+=`<div class="code-line${related?' related':''}${active?' active':''}" id="line-${n}"${related?` data-step="${related.stage}" data-snippet="${related.snippet}"`:''}><span class="ln">${n}</span><code>${colorize(line)||' '}</code></div>`;
    });
    $('code').innerHTML=html;
    $('language').textContent=file.endsWith('.cs')?'C#':file.endsWith('.shader')?'ShaderLab':'HLSL';
    $('line-status').textContent=`${lines.length} 行 · UTF-8`;
    $('code-context').textContent=data.files[file].original?'大世界原版 · 下载文件保持原始内容':`教学派生版 · ${file===snippet.file?snippet.label:'完整源文件'}`;
    $('copy-code').textContent=file===snippet.file?'复制选段':'复制全文';
    find(false);
    if(scroll&&file===snippet.file)requestAnimationFrame(()=>locateLine(snippet.start));
    document.dispatchEvent(new Event('study:render'));
  }
  function locateLine(n) { const row=$('line-'+n); if(!row)return; const top=row.offsetTop-$('code').offsetTop; $('code').scrollTo({top:Math.max(0,top-90),behavior:'auto'}); }
  function renderLesson() {
    const s=data.steps[stage-1];
    $('progress').textContent=String(stage).padStart(2,'0')+' / 10';
    $('step-title').textContent=s.title;
    $('step-tag').textContent=stage===10?'原版校验':stage===1?'从这里开始':'累积绘制';
    $('lead').textContent=s.description;
    $('render').src=base+String(stage).padStart(2,'0')+'.png'; $('render').alt=`第 ${stage} 步：${s.title}，HSKI 角色效果`;
    $('before').src=base+String(Math.max(1,stage-1)).padStart(2,'0')+'.png'; $('before').alt=`第 ${Math.max(1,stage-1)} 步角色效果`;
    $('image-label').textContent='UNITY CAMERA / '+String(stage).padStart(2,'0');
    $('caption').textContent=stage===7?'环境贡献为 0，此步与上一步一致':stage===10?'教学完整态 ↔ 原版完整态 · 像素差异 0':'同一相机 · 同一光照 · 只改变这一层';
    $('explain').innerHTML=s.snippets.map((r,j)=>`<button class="code-link${j===selected?' selected':''}" data-snippet="${j}" aria-pressed="${j===selected}"><span class="chip-num">${String(j+1).padStart(2,'0')}</span><span><strong>${escape(r.label)}</strong><p>${escape(r.note)}</p><small>${escape(r.file)} : ${r.start}–${r.end}</small></span><span class="arrow">↙</span></button>`).join('');
    $('note').textContent=footnotes[stage-1];
    $('step-reason-text').textContent=stepReasons[stage-1];
    $('prev').disabled=stage===1;$('next').disabled=stage===10;
    $('compare-view').disabled=stage===1;
    document.querySelectorAll('#steps button').forEach(el=>{const n=Number(el.dataset.step);el.setAttribute('aria-current',n===stage?'step':'false');el.classList.toggle('done',n>0&&n<stage);});
    setCompare(compare&&stage>1);
  }
  function setStep(n,{snippet=0,push=true,scroll=true,focusCode=false}={}) {
    if(!Number.isInteger(n)||n<1||n>10)return;
    engineering=false;$('engineering').hidden=true;document.querySelectorAll('[data-open-engineering]').forEach(b=>b.setAttribute('aria-pressed','false'));document.querySelector('.step-reason').open=false;
    intro=false;$('painting-intro').hidden=true;document.querySelector('.workspace').hidden=false;document.querySelector('.mobile-switch').hidden=false;$('share').textContent='分享此步 ↗';
    stage=n;selected=Math.max(0,Math.min(snippet,data.steps[n-1].snippets.length-1));file=activeSnippet().file;
    renderLesson();renderCode();updateUrl(push);
    if(scroll)$('lesson').scrollTop=0;
    document.querySelector(`#steps button[data-step="${stage}"]`).scrollIntoView({block:'nearest',inline:'nearest'});
    if(focusCode&&matchMedia('(max-width:760px)').matches)mobileView('code');
  }
  function selectSnippet(j) { selected=j;file=activeSnippet().file;renderLesson();renderCode();updateUrl(true);if(matchMedia('(max-width:760px)').matches)mobileView('code'); }
  function setCompare(on) {compare=on;document.querySelector('.render-figure').classList.toggle('comparing',on);$('current-view').setAttribute('aria-pressed',String(!on));$('compare-view').setAttribute('aria-pressed',String(on));}
  function find(scroll=true) {
    const query=$('search').value.toLowerCase(); hits=[];hitIndex=-1;
    $('code').querySelectorAll('.code-line').forEach(el=>{const yes=query&&el.querySelector('code').textContent.toLowerCase().includes(query);el.classList.toggle('hit',!!yes);el.classList.remove('hit-current');if(yes)hits.push(el);});
    $('matches').textContent=query?`${hits.length} 处`:'';
    if(scroll&&hits.length)nextMatch();
  }
  function nextMatch() {if(!hits.length)return;hits.forEach(el=>el.classList.remove('hit-current'));hitIndex=(hitIndex+1)%hits.length;hits[hitIndex].classList.add('hit-current');locateLine(Number(hits[hitIndex].id.slice(5)));$('matches').textContent=`${hitIndex+1}/${hits.length}`;}
  async function copy(text,label) {try{await navigator.clipboard.writeText(text);notify(label);}catch{notify('浏览器未允许复制，请选中文本后手动复制');}}
  function loadLocation() {
    if(location.hash==='#lesson')return;
    if(location.hash==='#engineering'){showEngineering(false);return;}
    const chapter=document.querySelector('[data-engineering-anchor="'+CSS.escape(location.hash.slice(1))+'"]');
    if(chapter){const hash=location.hash;showEngineering(false);history.replaceState(null,'',hash);$(chapter.dataset.engineeringAnchor).scrollIntoView({block:'start'});return;}
    if(!location.hash||location.hash==='#intro'){showIntro(false);return;}
    const p=new URLSearchParams(location.hash.slice(1));let n=Number(p.get('step'));
    if(!Number.isInteger(n)||n<1||n>10){try{n=Number(localStorage.getItem('avalon-hski-step'))||1;}catch{n=1;}}
    n=Math.max(1,Math.min(10,n));const requested=p.get('file');const line=Number(p.get('line'));
    const j=data.steps[n-1].snippets.findIndex(r=>r.file===requested&&r.start===line);
    setStep(n,{snippet:Math.max(0,j),push:false});
    if(requested&&Object.hasOwn(data.files,requested)&&requested!==file){file=requested;renderCode(false);updateUrl();}
  }
  async function init() {
    const response=await fetch(base+'study.json');if(!response.ok)throw Error('data');data=await response.json();
    $('steps').innerHTML='<button data-intro aria-label="开篇 个人绘画"><span class="num">序</span><span>个人绘画</span></button>'+shortTitles.map((t,i)=>`<button data-step="${i+1}" aria-label="第 ${i+1} 步 ${t}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${t}</span></button>`).join('');
    $('file').innerHTML=Object.entries(data.files).map(([name,f])=>`<option value="${name}">${f.original?'原版 · ':''}${name}</option>`).join('');
    $('steps').addEventListener('click',e=>{if(e.target.closest('[data-intro]')){showIntro(true);return;}const b=e.target.closest('[data-step]');if(b)setStep(Number(b.dataset.step));});
    $('begin-study').onclick=()=>setStep(1);
    document.querySelectorAll('[data-open-engineering]').forEach(b=>b.onclick=()=>showEngineering(true));
    document.querySelectorAll('[data-return-study]').forEach(b=>b.onclick=()=>setStep(stage,{snippet:selected}));
    document.querySelectorAll('[data-engineering-step]').forEach(b=>b.onclick=()=>setStep(Number(b.dataset.engineeringStep),{snippet:Number(b.dataset.engineeringSnippet)||0}));
    document.querySelectorAll('[data-engineering-anchor]').forEach(a=>a.onclick=e=>{e.preventDefault();history.pushState(null,'','#'+a.dataset.engineeringAnchor);$(a.dataset.engineeringAnchor).scrollIntoView({block:'start',behavior:'smooth'});});
    const shade=$('shade-demo');
    shade.addEventListener('input',()=>applyShade(Number(shade.value)));
    function pointerShade(e){const r=shade.getBoundingClientRect();applyShade(Math.round((e.clientX-r.left)/r.width*100));}
    shade.addEventListener('pointerdown',e=>{e.preventDefault();shade.focus();shade.setPointerCapture(e.pointerId);pointerShade(e);});
    shade.addEventListener('pointermove',e=>{if(shade.hasPointerCapture(e.pointerId))pointerShade(e);});
    shade.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();applyShade(e.key==='Home'?0:e.key==='End'?100:Number(shade.value)+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1));}});
    applyShade(50);
    document.querySelectorAll('[data-painting-step]').forEach(a=>a.onclick=e=>{e.preventDefault();setStep(Number(a.dataset.paintingStep));});
    document.querySelectorAll('[data-painting]').forEach(b=>b.onclick=()=>{$('large-image').src=base+'paintings/'+b.dataset.painting;$('large-image').alt=b.querySelector('img').alt;$('large-caption').textContent=b.dataset.caption;$('image-dialog').showModal();});
    $('explain').addEventListener('click',e=>{const b=e.target.closest('[data-snippet]');if(b)selectSnippet(Number(b.dataset.snippet));});
    $('code').addEventListener('click',e=>{if(window.getSelection().toString())return;const b=e.target.closest('[data-step]');if(b){e.preventDefault();setStep(Number(b.dataset.step),{snippet:Number(b.dataset.snippet),scroll:true});if(matchMedia('(max-width:760px)').matches)mobileView('doc');}});
    $('file').addEventListener('change',()=>{file=$('file').value;renderCode();updateUrl(true);});
    $('search').addEventListener('input',()=>find());$('search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nextMatch();}});$('find-next').onclick=nextMatch;
    $('locate').onclick=()=>{file=activeSnippet().file;renderCode();updateUrl(true);};
    $('copy-code').onclick=()=>{const s=activeSnippet();const text=file===s.file?data.files[file].code.split(/\r?\n/).slice(s.start-1,s.end).join('\n'):data.files[file].code;copy(text,'已复制代码（不含展示旁注）');};
    $('share').onclick=()=>copy(location.href,engineering?'已复制顺序与性能链接':intro?'已复制文章开篇链接':'已复制当前步骤链接');
    $('wrap').onclick=()=>{const on=$('code').classList.toggle('wrap-code');$('wrap').setAttribute('aria-pressed',String(on));};
    $('prev').onclick=()=>setStep(stage-1);$('next').onclick=()=>setStep(stage+1);
    $('current-view').onclick=()=>setCompare(false);$('compare-view').onclick=()=>setCompare(stage>1);
    const wipe=$('wipe');
    function applyWipe(value){value=Math.max(0,Math.min(100,value));wipe.value=String(value);wipe.setAttribute('aria-valuenow',String(value));document.querySelector('.render-figure').style.setProperty('--wipe',value+'%');}
    wipe.addEventListener('input',()=>applyWipe(Number(wipe.value)));
    function pointerWipe(e){const r=wipe.getBoundingClientRect();applyWipe(Math.round((e.clientX-r.left)/r.width*100));}
    wipe.addEventListener('pointerdown',e=>{e.preventDefault();wipe.focus();wipe.setPointerCapture(e.pointerId);pointerWipe(e);});
    wipe.addEventListener('pointermove',e=>{if(wipe.hasPointerCapture(e.pointerId))pointerWipe(e);});
    wipe.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();applyWipe(e.key==='Home'?0:e.key==='End'?100:Number(wipe.value)+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1));}});
    $('zoom').onclick=()=>{$('large-image').src=$('render').src;$('large-image').alt=$('render').alt;$('large-caption').textContent=`${String(stage).padStart(2,'0')} · ${data.steps[stage-1].title}`;$('image-dialog').showModal();};
    $('close-image').onclick=()=>$('image-dialog').close();$('image-dialog').onclick=e=>{if(e.target===$('image-dialog'))$('image-dialog').close();};
    $('present').onclick=()=>{const on=document.body.classList.toggle('present');$('present').textContent=on?'退出展示 ⛶':'展示模式 ⛶';notify(on?'展示模式 · 按 Esc 退出':'已返回阅读模式');};
    document.querySelectorAll('.mobile-switch button').forEach(b=>b.onclick=()=>mobileView(b.dataset.view));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('present');$('present').textContent='展示模式 ⛶';}if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();if(intro){if(e.key==='ArrowRight')setStep(1);}else if(stage===1&&e.key==='ArrowLeft'){showIntro(true);}else setStep(stage+(e.key==='ArrowLeft'?-1:1));}});
    window.addEventListener('popstate',loadLocation);window.addEventListener('hashchange',loadLocation);
    const divider=document.querySelector('.splitter');const area=document.querySelector('.workspace');
    function width(value){const w=Math.max(30,Math.min(65,value));document.documentElement.style.setProperty('--code-width',w+'%');divider.setAttribute('aria-valuenow',String(Math.round(w)));}
    divider.onpointerdown=e=>{divider.setPointerCapture(e.pointerId);};divider.onpointermove=e=>{if(divider.hasPointerCapture(e.pointerId)){width((e.clientX-area.getBoundingClientRect().left)/area.clientWidth*100);}};
    divider.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();width(Number(divider.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?2:-2));}};
    loadLocation();
  }
  init().catch(()=>{$('step-title').textContent='教程暂时未能加载';$('lead').textContent='请刷新页面重试。也可以先从下方下载完整教学源码。';$('explain').innerHTML='<a href="/assets/hski-study/code/CampusPaintingLayers.hlsl">下载教学 HLSL →</a>';});
})();
