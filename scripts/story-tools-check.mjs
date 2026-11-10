import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.connectOverCDP(process.env.BROWSER_CDP_URL ?? execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim());
const page=await b.contexts()[0].newPage();const checks=[];let ids=[];let artifactIds=[];
try{
  await page.goto('http://localhost:8080/story');await page.locator('canvas').waitFor();await page.bringToFront();
  ids=await page.evaluate(async()=>{const {newProject}=await import('/src/studio/stick/project.ts'),db=await import('/src/studio/stick/project-db.ts');const ids=[];for(let i=1;i<=2;i++){const p=newProject('صحنه: پارک\nعلی: سلام!',`قسمت آزمون ${i}`);await db.saveProject(p);ids.push(p.id);}return ids;});
  await page.reload();await page.locator('canvas').waitFor();
  await page.locator('details').filter({has:page.locator('summary',{hasText:'خروجی دسته‌ای قسمت‌ها'})}).locator('summary').click();
  for(const name of ['قسمت آزمون 1','قسمت آزمون 2'])await page.getByLabel(name,{exact:true}).check();
  await page.getByRole('button',{name:'ساخت قسمت‌های انتخاب‌شده',exact:true}).click();
  await page.getByRole('button',{name:'لغو صف',exact:true}).waitFor({state:'hidden',timeout:120000});
  const files=await page.evaluate(async()=>{const db=await import('/src/studio/stick/project-db.ts');return (await db.listArtifacts()).filter(a=>a.name.startsWith('قسمت آزمون')).map(a=>({id:a.id,name:a.name,size:a.blob.size}));});
  artifactIds=files.map(f=>f.id);assert.equal(files.length,8);assert.ok(files.every(f=>f.size>0));checks.push('two real episode exports with video, SRT, text and PNG');
  await page.locator('details[aria-label="پروژه‌ها"] > summary').click();
  const before=await page.getByLabel('داستان',{exact:true}).inputValue();
  await page.locator('input[type=file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await page.getByRole('alert').filter({hasText:'فایل JSON معتبر نیست'}).waitFor();assert.equal(await page.getByLabel('داستان',{exact:true}).inputValue(),before);checks.push('invalid JSON is rejected without replacing story');
  const originalId=await page.getByLabel('داستان‌های ذخیره‌شده').inputValue();
  const json=await page.evaluate(async id=>{const db=await import('/src/studio/stick/project-db.ts');return JSON.stringify((await db.listProjects()).find(p=>p.id===id));},originalId);
  await page.locator('input[type=file]').setInputFiles({name:'valid.behix.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await page.waitForFunction(id=>document.querySelector('select').value!==id,originalId);
  const importedId=await page.getByLabel('داستان‌های ذخیره‌شده').inputValue();ids.push(importedId);assert.notEqual(importedId,originalId);checks.push('valid project imports as a separate project');
  const canvas=page.locator('canvas');await canvas.scrollIntoViewIfNeeded();const rect=await canvas.boundingBox();
  await page.mouse.move(rect.x+rect.width*0.5,rect.y+rect.height*0.55);await page.mouse.down();await page.mouse.move(rect.x+rect.width*0.75,rect.y+rect.height*0.55,{steps:10});await page.mouse.up();
  await page.waitForFunction(async id=>{const db=await import('/src/studio/stick/project-db.ts');return (await db.listProjects()).find(p=>p.id===id)?.edits.some(e=>e.x>0.6);},importedId);
  checks.push('pointer drag persists an actual actor position edit');
  await page.getByRole('button',{name:'برگردان',exact:true}).first().click();
  await page.waitForFunction(async id=>{const db=await import('/src/studio/stick/project-db.ts');return !(await db.listProjects()).find(p=>p.id===id)?.edits.some(e=>e.x>0.6);},importedId);
  checks.push('one undo reverses the whole drag');
  console.log(checks.join('\n'));
}finally{
  await page.close();const cleanup=await b.contexts()[0].newPage();await cleanup.goto('http://localhost:8080/story');
  await cleanup.evaluate(async({ids,artifactIds})=>{const db=await import('/src/studio/stick/project-db.ts');for(const id of ids)await db.deleteProject(id);for(const id of artifactIds)await db.removeArtifact(id);},{ids,artifactIds});await cleanup.close();
  writeFileSync(resolve(process.env.WORKSPACE_ROOT??'/home/vercel-sandbox/workspace','output/behix/tools-report.json'),JSON.stringify({checks},null,2));await b.close();
}
