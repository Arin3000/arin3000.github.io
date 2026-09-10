/* HSKI reading desk: annotations are a display layer; downloads stay byte-identical. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = '/assets/hski-study/';
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, stage = 1, file = '', selected = 0, hits = [], hitIndex = -1, compare = false, toastTimer;
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
    $('prev').disabled=stage===1;$('next').disabled=stage===10;
    $('compare-view').disabled=stage===1;
    document.querySelectorAll('#steps button').forEach((el,i)=>{el.setAttribute('aria-current',i+1===stage?'step':'false');el.classList.toggle('done',i+1<stage);});
    setCompare(compare&&stage>1);
  }
  function setStep(n,{snippet=0,push=true,scroll=true,focusCode=false}={}) {
    if(!Number.isInteger(n)||n<1||n>10)return;
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
    const p=new URLSearchParams(location.hash.slice(1));let n=Number(p.get('step'));
    if(!Number.isInteger(n)||n<1||n>10){try{n=Number(localStorage.getItem('avalon-hski-step'))||1;}catch{n=1;}}
    n=Math.max(1,Math.min(10,n));const requested=p.get('file');const line=Number(p.get('line'));
    const j=data.steps[n-1].snippets.findIndex(r=>r.file===requested&&r.start===line);
    setStep(n,{snippet:Math.max(0,j),push:false});
    if(requested&&Object.hasOwn(data.files,requested)&&requested!==file){file=requested;renderCode(false);updateUrl();}
  }
  async function init() {
    const response=await fetch(base+'study.json');if(!response.ok)throw Error('data');data=await response.json();
    $('steps').innerHTML=shortTitles.map((t,i)=>`<button data-step="${i+1}" aria-label="第 ${i+1} 步 ${t}"><span class="num">${String(i+1).padStart(2,'0')}</span><span>${t}</span></button>`).join('');
    $('file').innerHTML=Object.entries(data.files).map(([name,f])=>`<option value="${name}">${f.original?'原版 · ':''}${name}</option>`).join('');
    $('steps').addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b)setStep(Number(b.dataset.step));});
    $('explain').addEventListener('click',e=>{const b=e.target.closest('[data-snippet]');if(b)selectSnippet(Number(b.dataset.snippet));});
    $('code').addEventListener('click',e=>{if(window.getSelection().toString())return;const b=e.target.closest('[data-step]');if(b){e.preventDefault();setStep(Number(b.dataset.step),{snippet:Number(b.dataset.snippet),scroll:true});if(matchMedia('(max-width:760px)').matches)mobileView('doc');}});
    $('file').addEventListener('change',()=>{file=$('file').value;renderCode();updateUrl(true);});
    $('search').addEventListener('input',()=>find());$('search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nextMatch();}});$('find-next').onclick=nextMatch;
    $('locate').onclick=()=>{file=activeSnippet().file;renderCode();updateUrl(true);};
    $('copy-code').onclick=()=>{const s=activeSnippet();const text=file===s.file?data.files[file].code.split(/\r?\n/).slice(s.start-1,s.end).join('\n'):data.files[file].code;copy(text,'已复制代码（不含展示旁注）');};
    $('share').onclick=()=>copy(location.href,'已复制当前步骤链接');
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
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('present');$('present').textContent='展示模式 ⛶';}if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();setStep(stage+(e.key==='ArrowLeft'?-1:1));}});
    window.addEventListener('popstate',loadLocation);window.addEventListener('hashchange',loadLocation);
    const divider=document.querySelector('.splitter');const area=document.querySelector('.workspace');
    function width(value){const w=Math.max(30,Math.min(65,value));document.documentElement.style.setProperty('--code-width',w+'%');divider.setAttribute('aria-valuenow',String(Math.round(w)));}
    divider.onpointerdown=e=>{divider.setPointerCapture(e.pointerId);};divider.onpointermove=e=>{if(divider.hasPointerCapture(e.pointerId)){width((e.clientX-area.getBoundingClientRect().left)/area.clientWidth*100);}};
    divider.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();width(Number(divider.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?2:-2));}};
    loadLocation();
  }
  init().catch(()=>{$('step-title').textContent='教程暂时未能加载';$('lead').textContent='请刷新页面重试。也可以先从下方下载完整教学源码。';$('explain').innerHTML='<a href="/assets/hski-study/code/CampusPaintingLayers.hlsl">下载教学 HLSL →</a>';});
})();
