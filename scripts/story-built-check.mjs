import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.connectOverCDP(execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim());
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const p=await c.newPage();p.setDefaultTimeout(15000);const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
try{
  await p.goto('http://127.0.0.1:8081/projects');
  await p.getByRole('button',{name:'داستان تازه',exact:false}).click();
  await p.getByLabel('داستان',{exact:true}).fill('صحنه: پارک\nعلی: آزمایش نسخهٔ ساخته‌شده');
  await p.getByRole('button',{name:'ویرایش بخش',exact:true}).click();
  await p.getByLabel('حرکت دست و بدن').selectOption('cheer');
  await p.getByLabel('مکان صحنه').selectOption('yard');
  await p.getByRole('link',{name:'پروژه‌ها',exact:true}).click();
  await p.getByRole('link',{name:'باز کردن',exact:true}).first().click();
  await p.getByRole('button',{name:'ویرایش بخش',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('.studio-time select')?.options.length>0);
  assert.equal(await p.getByLabel('حرکت دست و بدن').inputValue(),'cheer');
  assert.equal(await p.getByLabel('مکان صحنه').inputValue(),'yard');
  await p.locator('canvas[data-render-ready=true]').waitFor();
  await p.screenshot({path:`${process.env.WORKSPACE_ROOT}/output/studio-shell/built-mobile.png`,fullPage:true});
  checks.push('built dashboard -> story -> actual edits -> saved navigation -> reopened edits');
  for(const route of ['/','/projects','/story','/scenario','/cast','/world','/board','/stage','/sound','/deliver']){
    const res=await p.goto(`http://127.0.0.1:8081${route}`);assert.equal(res.status(),200);
    await p.locator('main, .studio').first().waitFor();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route);
    checks.push(`${route}: HTTP200, mounted, 390px no overflow`);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify(checks,null,2));
}finally{writeFileSync(`${process.env.WORKSPACE_ROOT}/output/studio-shell/built-report.json`,JSON.stringify({checks,errors},null,2));await c.close();await b.close();}
