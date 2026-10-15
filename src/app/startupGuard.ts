/** Inline, independent of Next chunks: a usable escape hatch even if JS fails to load. */
export const STARTUP_GUARD = `
(function(){
  function record(error){try{sessionStorage.setItem('zv_last_failure',JSON.stringify({at:new Date().toISOString(),message:String(error).slice(0,3000)}));}catch(e){}}
  window.addEventListener('error',function(e){if(e.message)record(e.error&&e.error.stack||e.message);else if(e.target&&e.target.tagName==='SCRIPT')record('Не загружен скрипт: '+e.target.src);},true);
  window.addEventListener('unhandledrejection',function(e){record(e.reason&&e.reason.stack||e.reason);});
  var started=Date.now();
  var timer=setInterval(function(){
    var panel=document.getElementById('zv-startup-help');
    if(document.querySelector('[data-zv-ready="true"]')){if(panel)panel.remove();clearInterval(timer);return;}
    if(Date.now()-started<15000||panel||!document.body)return;
    panel=document.createElement('aside');panel.id='zv-startup-help';panel.setAttribute('role','alert');
    panel.style.cssText='position:fixed;z-index:2147483647;left:16px;right:16px;bottom:24px;max-width:480px;margin:auto;padding:22px;background:#102631;color:#eee7d7;border:1px solid #bfa777;border-radius:10px;font:15px/1.6 system-ui;box-shadow:0 8px 80px #000';
    var text=document.createElement('p');text.textContent='Запуск занимает слишком долго. Не очищайте данные сайта: можно восстановить загрузку без удаления прогресса.';
    var link=document.createElement('a');link.href='/recover.html';link.textContent='Открыть восстановление запуска';link.style.cssText='display:block;padding:12px;background:#d5bd89;color:#091722;border-radius:5px;text-align:center;font-weight:600';
    panel.append(text,link);document.body.appendChild(panel);
  },1000);
})();`;
