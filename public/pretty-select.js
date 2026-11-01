/* Custom dropdown presentation; original select stays the source of truth. */
(() => {
 let active=null, scheduled=false;
 const root=document.createElement('div');
 root.id='prettySelectLayer';
 document.addEventListener('DOMContentLoaded',()=>document.body.append(root));
 function close(restore=false){
  if(!active)return;
  const {button,popup}=active;popup.remove();button.setAttribute('aria-expanded','false');
  active=null;if(restore&&button.isConnected)button.focus();
 }
 function updateButton(select){
  const b=select.parentElement?.querySelector(':scope > .pretty-select-button');
  if(!b)return;
  const opt=select.selectedOptions[0];
  const text=opt?.textContent?.trim()||select.getAttribute('placeholder')||'Pilih opsi';
  const label=b.querySelector('.pretty-select-value');if(label)label.textContent=text;
  b.disabled=select.disabled;
  b.classList.toggle('is-placeholder',!select.value);
 }
 function open(select,button){
  if(active?.button===button){close(true);return}
  close();
  const options=[...select.options];
  const popup=document.createElement('div');
  popup.className='pretty-select-popover';popup.setAttribute('role','listbox');
  popup.setAttribute('aria-label',select.getAttribute('aria-label')||select.closest('label')?.textContent?.trim().slice(0,70)||'Pilih opsi');
  const heading=document.createElement('div');heading.className='pretty-select-heading';heading.textContent='✦ Pilih salah satu';popup.append(heading);
  const list=document.createElement('div');list.className='pretty-select-options';popup.append(list);
  const render=(query='')=>{
   list.replaceChildren();let count=0;
   options.forEach((opt,i)=>{
    if(opt.hidden||query&&!opt.textContent.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')))return;
    count++;
    const item=document.createElement('button');item.type='button';item.className='pretty-select-option';
    item.setAttribute('role','option');item.setAttribute('aria-selected',String(select.selectedIndex===i));
    if(select.selectedIndex===i)item.classList.add('selected');
    item.disabled=opt.disabled;
    const label=document.createElement('span');label.className='pretty-option-text';label.textContent=opt.textContent;
    const check=document.createElement('span');check.className='pretty-option-check';check.textContent=select.selectedIndex===i?'✓':'';
    item.append(label,check);
    item.addEventListener('click',()=>{
     select.selectedIndex=i;select.dispatchEvent(new Event('input',{bubbles:true}));
     select.dispatchEvent(new Event('change',{bubbles:true}));updateButton(select);close(true);
    });
    list.append(item);
   });
   if(!count){const empty=document.createElement('div');empty.className='pretty-select-empty';empty.textContent='Tidak ada pilihan yang cocok';list.append(empty)}
  };
  if(options.length>9){
   const search=document.createElement('input');search.className='pretty-select-search';search.type='search';search.placeholder='⌕ Cari pilihan...';search.setAttribute('aria-label','Cari pilihan dropdown');popup.append(search);
   popup.insertBefore(search,list);search.addEventListener('input',()=>render(search.value));
  }
  render();
  const host=select.closest('dialog[open]')||document.body;host.append(popup);
  const rect=button.getBoundingClientRect(),width=Math.max(210,rect.width);
  const left=Math.max(10,Math.min(rect.left,innerWidth-width-10));
  const roomBelow=innerHeight-rect.bottom;
  const above=roomBelow<250&&rect.top>roomBelow;
  popup.style.width=Math.min(width,innerWidth-20)+'px';popup.style.left=left+'px';
  popup.style.maxHeight=Math.max(140,above?rect.top-20:innerHeight-rect.bottom-20)+'px';
  popup.style.top=(above?'auto':rect.bottom+7+'px');popup.style.bottom=above?(innerHeight-rect.top+7+'px'):'auto';
  button.setAttribute('aria-expanded','true');active={button,popup};
  if(options.length>9 && !window.matchMedia('(pointer: coarse)').matches)popup.querySelector('input')?.focus();
 }
 function enhance(){
  document.querySelectorAll('select:not([multiple]):not([data-pretty-ready])').forEach(select=>{
   if(select.closest('.pretty-select-shell'))return;
   select.dataset.prettyReady='1';
   const shell=document.createElement('span');shell.className='pretty-select-shell';
   select.parentNode.insertBefore(shell,select);shell.append(select);
   const button=document.createElement('button');button.type='button';button.className='pretty-select-button';
   button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
   const label=document.createElement('span');label.className='pretty-select-value';
   const arrow=document.createElement('span');arrow.className='pretty-select-arrow';arrow.setAttribute('aria-hidden','true');
   arrow.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg>';
   button.append(label,arrow);shell.append(button);updateButton(select);
   button.addEventListener('click',()=>open(select,button));
   select.addEventListener('change',()=>updateButton(select));
   select.addEventListener('input',()=>updateButton(select));
  });
  document.querySelectorAll('select[data-pretty-ready]').forEach(updateButton);
  if(active&&!active.button.isConnected)close();
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}
 const observer=new MutationObserver(records=>{
  if(records.some(r=>r.type==='childList'&&(r.target.matches?.('select')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('select:not([data-pretty-ready]),option,optgroup')||n.querySelector?.('select:not([data-pretty-ready])'))))))schedule();
  if(active&&!active.button.isConnected)close();
 });
 document.addEventListener('DOMContentLoaded',()=>{
  enhance();observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(active&&!active.popup.contains(e.target)&&!active.button.contains(e.target))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();close(true)}});
  window.addEventListener('resize',()=>close());window.addEventListener('scroll',e=>{if(active&&!active.popup.contains(e.target))close()},{capture:true,passive:true});
 });
})();
