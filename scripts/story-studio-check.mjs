/** Real browser integration, isolated storage, real Canvas/IndexedDB/MediaRecorder. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const out = `${process.env.WORKSPACE_ROOT}/output/studio-shell`;
mkdirSync(out, {recursive:true});
const browser = await chromium.connectOverCDP(execFileSync('coderabbit-agent-browser', ['get','cdp-url'], {encoding:'utf8'}).trim());
const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
const origin='http://localhost:8080';
const text='صحنه: پارک\nعلی: سلام، امروز هوا خوب است.\nسارا: بله، به خانه برگردیم.';
const until = async (predicate, arg) => {
  const deadline = Date.now() + 20000;
  while (!(await page.evaluate(predicate, arg))) {
    if (Date.now() > deadline) throw new Error('Async state did not settle within 20 seconds');
    await page.waitForTimeout(50);
  }
};
const saved = () => until(async () => {
  const db=await import('/src/studio/stick/project-db.ts');
  return (await db.listProjects()).some(p=>p.text.includes('امروز هوا'));
});
try {
  if (!process.env.STUDIO_PHOTO_ONLY) {
  await page.goto(`${origin}/projects`); await page.bringToFront();
  await page.getByRole('button',{name:'داستان تازه',exact:false}).click();
  await page.getByLabel('داستان',{exact:true}).fill(text);
  await saved();
  await page.locator('canvas[data-render-ready=true]').waitFor();
  const id = new URL(page.url()).searchParams.get('project'); assert.ok(id);
  await page.getByRole('button',{name:'ویرایش بخش',exact:true}).click();
  await page.getByLabel('مدت بخش (ثانیه)').fill('7'); await page.getByLabel('مدت بخش (ثانیه)').blur();
  await page.getByLabel('حرکت دست و بدن').selectOption('cheer');
  await page.getByLabel('شیء در دست').selectOption('flowers');
  await page.getByLabel('مکان صحنه').selectOption('yard');
  await until(async id=>{
    const db=await import('/src/studio/stick/project-db.ts');
    const p=(await db.listProjects()).find(p=>p.id===id);
    return p?.edits.some(e=>e.gesture==='cheer') && p?.edits.some(e=>e.place==='yard') && p?.edits.some(e=>e.duration===7);
  },id);
  checks.push('story created via dashboard; gesture/prop/place/duration saved to real IndexedDB');
  await page.reload(); await page.locator('canvas[data-render-ready=true]').waitFor();
  await page.getByRole('button',{name:'ویرایش بخش',exact:true}).click();
  assert.equal(await page.getByLabel('حرکت دست و بدن').inputValue(),'cheer');
  assert.equal(await page.getByLabel('شیء در دست').inputValue(),'flowers');
  assert.equal(await page.getByLabel('مکان صحنه').inputValue(),'yard');
  assert.equal(Number(await page.getByLabel('مدت بخش (ثانیه)').inputValue()),7);
  await page.getByLabel('حرکت دست و بدن').selectOption('wave');
  await page.locator('.studio-actions').getByRole('button',{name:'برگردان',exact:true}).click();
  assert.equal(await page.getByLabel('حرکت دست و بدن').inputValue(),'cheer');
  await page.locator('.studio-actions').getByRole('button',{name:'از نو',exact:true}).click();
  assert.equal(await page.getByLabel('حرکت دست و بدن').inputValue(),'wave');
  for (const panel of ['متن و پروژه','صحنه‌ها','ویرایش بخش']) {
    await page.getByRole('button',{name:panel,exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.screenshot({path:`${out}/mobile-editor.png`,fullPage:true});
  checks.push('reload/undo/redo and all three RTL mobile panels at 390px without page overflow');
  // Export compiled edited document, with actual decoder metadata.
  const story = await page.evaluate(async id=>{
    const db=await import('/src/studio/stick/project-db.ts');
    const {compileProject}=await import('/src/studio/stick/project.ts');
    const {exportStoryFilm}=await import('/src/studio/stick/story-export.ts');
    const {inspectVideo}=await import('/tests/story/browser-utils.ts');
    const p=(await db.listProjects()).find(p=>p.id===id);
    const d=compileProject(p); const f=await exportStoryFilm(d.timeline,{fps:30,captions:true,format:'square'});
    return {size:f.blob.size,ext:f.ext,expected:d.timeline.duration,...await inspectVideo(f.blob)};
  },id);
  assert.ok(story.size>1000); assert.equal(story.width,1080); assert.equal(story.height,1080); assert.ok(Math.abs(story.duration-story.expected)<1); assert.equal(story.audio,0);
  checks.push({storyExport:story});
  await page.getByRole('link',{name:'پروژه‌ها',exact:true}).click();
  await page.getByRole('button',{name:'کپی',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  await page.getByRole('button',{name:'تغییر نام',exact:true}).first().click();
  await page.getByLabel('نام تازه').fill('داستان ویرایش‌شده');
  await page.getByRole('button',{name:'ذخیرهٔ نام',exact:true}).click();
  await page.getByLabel('جست‌وجوی پروژه').fill('ویرایش‌شده');
  await page.waitForFunction(()=>document.querySelectorAll('article').length===1);
  await page.getByRole('button',{name:'حذف',exact:true}).click();
  await page.getByRole('button',{name:'انصراف',exact:true}).click(); assert.equal(await page.locator('article').count(),1);
  checks.push('dashboard duplicate/rename/search and cancellation of deletion');
  await page.screenshot({path:`${out}/mobile-projects.png`,fullPage:true});
  // Real quota rejection. Failed switching must retain the current document.
  const failureContext=await browser.newContext({viewport:{width:390,height:844}});
  const failure=await failureContext.newPage();
  failure.setDefaultTimeout(20000);
  try {
    const cdp=await failureContext.newCDPSession(failure);
    await cdp.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:1});
    await failure.goto(`${origin}/story`);
    await failure.getByLabel('داستان',{exact:true}).fill('علی: متن نباید گم شود');
    await failure.locator('details[aria-label="پروژه‌ها"] > summary').click();
    await failure.getByRole('button',{name:'داستان تازه',exact:true}).click();
    await failure.waitForFunction(()=>document.body.textContent.includes('پروژه باز می‌ماند'));
    assert.equal(await failure.getByLabel('داستان',{exact:true}).inputValue(),'علی: متن نباید گم شود');
    await cdp.send('Storage.overrideQuotaForOrigin',{origin});
    checks.push('actual quota failure preserves unsaved story when opening another project');
  } finally { await failureContext.close(); }
  }
  await page.goto(`${origin}/stage`);
  await page.bringToFront();
  await until(async()=>!(await import('/src/studio/store.ts')).useStudio.getState().booting);
  // Test fixture: a hand-drawn PNG head and WAV tone; no detector or TTS/model is invoked.
  await page.evaluate(async()=>{
    const {useStudio}=await import('/src/studio/store.ts');
    const {CAST}=await import('/src/studio/characters.ts');
    const c=document.createElement('canvas');c.width=160;c.height=160;
    const g=c.getContext('2d');g.fillStyle='#e0b07a';g.beginPath();g.arc(80,80,65,0,Math.PI*2);g.fill();g.fillStyle='#222';g.fillRect(50,60,8,8);g.fillRect(102,60,8,8);
    const character={...CAST[0],id:'u-testhead',name:'تصویر آزمون',head:{src:c.toDataURL(),aspect:1,mouth:{x:.5,y:.7},eyes:{l:{x:.34,y:.4},r:{x:.66,y:.4}},size:110,patch:'#e0b07a'}};
    useStudio.getState().addCharacter(character);
    const s=useStudio.getState(); const shot={...s.shots[0],id:'test-shot',duration:2,dialogue:'سلام',camera:'wide',sfx:'none',speaker:'a',actorA:{...s.shots[0].actorA,charId:character.id,emotion:'cry',action:'idle'}};
    s.replaceShots([shot]);
  });
  await page.getByLabel('جای چپ قاب',{exact:true}).fill('42');
  await page.getByLabel('اندازه چپ قاب',{exact:true}).fill('80');
  await until(async()=>{
    const {idbKV,IDB_KEY}=await import('/src/studio/persist.ts');const p=await idbKV(indexedDB).get(IDB_KEY);
    return p?.shots?.[0]?.actorA.x===.42 && p?.shots?.[0]?.actorA.scale===.8;
  });
  await page.reload(); await page.getByLabel('جای چپ قاب',{exact:true}).waitFor();
  await until(async()=>!(await import('/src/studio/store.ts')).useStudio.getState().booting);
  await page.waitForFunction(() => document.querySelector('[aria-label="جای چپ قاب"]')?.value === '42');
  assert.equal(await page.getByLabel('جای چپ قاب',{exact:true}).inputValue(),'42');
  assert.equal(await page.getByLabel('اندازه چپ قاب',{exact:true}).inputValue(),'80');
  checks.push('custom PNG photo character, position and size persist through reload');
  const photo = await page.evaluate(async()=>{
    const {useStudio}=await import('/src/studio/store.ts');
    const {renderFrame,canvasSize}=await import('/src/studio/frame.ts');
    const {preloadHeads}=await import('/src/studio/draw-actor.ts');
    const {renderFilm}=await import('/src/studio/export-film.ts');
    const {inspectVideo}=await import('/tests/story/browser-utils.ts');
    const s=useStudio.getState();await preloadHeads(s.characters);
    const c=document.createElement('canvas');const size=canvasSize(s.aspect);c.width=size.w;c.height=size.h;const g=c.getContext('2d');
    const render=t=>renderFrame(g,s.shots[0],{now:t*1000,local:t,dt:1/30,aspect:s.aspect,showRig:false,pulses:{a:0,b:0},speakingLive:false});
    render(1.3);const first=c.toDataURL();render(.2);render(1.3);const same=first===c.toDataURL();
    const costs=[];for(let i=0;i<180;i++){const start=performance.now();render(i/60);costs.push(performance.now()-start);}costs.sort((a,b)=>a-b);
    // Actual WAV (tone fixture) decoded by WebAudio and included in recorder output.
    const rate=24000,n=rate;const wav=new ArrayBuffer(44+n*2),v=new DataView(wav);
    const str=(at,t)=>{for(let i=0;i<t.length;i++)v.setUint8(at+i,t.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.sin(i/rate*440*Math.PI*2)*5000,true);
    const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));s.setAudio(s.shots[0].id,url);
    const canvas=document.querySelector('canvas');const streams=[];const native=canvas.captureStream.bind(canvas);canvas.captureStream=fps=>{const stream=native(fps);streams.push(stream);return stream;};
    const abort=new AbortController();setTimeout(()=>abort.abort(),350);let cancelled=false;
    try {await renderFilm(canvas,{forceFallback:true,signal:abort.signal});}catch(e){cancelled=e.name==='AbortError';}
    const released=streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'));
    const film=await renderFilm(canvas,{forceFallback:true});
    const decoded = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await film.blob.arrayBuffer());
    let audioPeak = 0; for (const sample of decoded.getChannelData(0)) audioPeak = Math.max(audioPeak, Math.abs(sample));
    const video = document.createElement('video'); video.muted = true;
    const movieUrl = URL.createObjectURL(film.blob);
    try {
      await new Promise((resolve,reject) => { video.onloadeddata=resolve; video.onerror=()=>reject(new Error('Video decode failed')); video.src=movieUrl; });
    } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(movieUrl); }
    return {audioPeak,decodedVideo:true,same,p95:costs[Math.floor(costs.length*.95)],cancelled,released,size:film.blob.size,method:film.method,ext:film.ext,...await inspectVideo(film.blob)};
  });
  console.log(JSON.stringify({photo},null,2));
  checks.push({photoRenderAndExport:photo});
  assert.equal(photo.same,true);assert.equal(photo.cancelled,true);assert.equal(photo.released,true);assert.ok(photo.size>1000);assert.equal(photo.audio,1);assert.ok(photo.audioPeak>0.01);assert.equal(photo.decodedVideo,true);assert.ok(Math.abs(photo.duration-2)<1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/mobile-photo.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  checks.push('no uncaught page errors');
  console.log(JSON.stringify(checks,null,2));
} catch(error) {
  console.log('Failure diagnostics', await page.evaluate(async()=>{
    const {useStudio}=await import('/src/studio/store.ts');const {idbKV,IDB_KEY}=await import('/src/studio/persist.ts');const s=useStudio.getState();const raw=await idbKV(indexedDB).get(IDB_KEY);
    return {url:location.href,actor:s.shots[0].actorA,duration:s.shots[0].duration,booting:s.booting,notice:s.storageNotice,stored:raw,inputs:[...document.querySelectorAll('input[type=number]')].map(e=>[e.getAttribute('aria-label'),e.value])};
  }));
  throw error;
} finally {
  writeFileSync(`${out}/${process.env.STUDIO_PHOTO_ONLY ? "photo-report" : "browser-report"}.json`,JSON.stringify({checks,errors},null,2));
  await context.close();await browser.close();
}
