import {URL,KEY} from './config.js';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'Rp'+Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:0}),date=s=>s?new Date(s).toLocaleString('id-ID',{timeZone:'Asia/Makassar'}):'—',day=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Makassar'}).format(new Date(s)),sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0);
let permissionRecords=[],myPermissions=null;let productTab='barang',services=[],cashierCredits=[],cashierTab='transaksi',cashierWeekOffset=0,paymentEvidence=[],opnameOrders=[],financeEntries=[],financeTab='laba',purchaseDocs=[];let session=null,data=null,page='dashboard',cart=[],busy=false,saveHandler=null,rangeFrom='',rangeTo='',method='Tunai';try{session=JSON.parse(localStorage.getItem('larisindo.session')||'null')}catch{};
const featurePermissions=[['Kasir','kasir.transaksi','Transaksi penjualan'],['Kasir','kasir.piutang','Bayar piutang'],['Kasir','kasir.nota','Lihat / cetak nota'],['Kasir','kasir.shift','Buka & tutup shift'],['Barang & Jasa','produk.barang','Daftar barang'],['Barang & Jasa','produk.jasa','Daftar jasa'],['Persediaan','produk.opname','Stock opname'],['Persediaan','produk.transfer','Transfer gudang / rak'],['Pembelian','pembelian.nota','Nota pembelian'],['Laporan','laporan.penjualan','Laporan penjualan'],['Keuangan','keuangan.laba','Laba rugi'],['Keuangan','keuangan.neraca','Neraca & arus kas'],['Keuangan','keuangan.piutang','Kelola piutang'],['Pengguna','akses.pengguna','Kelola pengguna']];
const permissionDefaults={ 'Super Admin':featurePermissions.map(x=>x[1]),'Kasir':['kasir.transaksi','kasir.piutang','kasir.nota','kasir.shift'],'Supervisor':['produk.barang','produk.jasa','produk.opname','produk.transfer','pembelian.nota','laporan.penjualan'],'Finance':['laporan.penjualan','keuangan.laba','keuangan.neraca','keuangan.piutang','kasir.nota']};
function effectivePermission(role,stored,key){return stored&&Object.prototype.hasOwnProperty.call(stored,key)?stored[key]===true:permissionDefaults[role]?.includes(key)||false}
function permissionEditor(u){const saved=permissionRecords.find(x=>x.user_id===u.id)?.permissions||{};const sections=[...new Set(featurePermissions.map(x=>x[0]))];return '<div style="max-height:45vh;overflow:auto"><table style="width:100%"><thead><tr><th>Kelompok</th><th>Fitur</th><th>Akses</th></tr></thead><tbody>'+sections.map(group=>featurePermissions.filter(x=>x[0]===group).map(([g,key,label],i)=>'<tr><td>'+(i===0?esc(g):'')+'</td><td>'+esc(label)+'</td><td><input type="checkbox" class="feature-access" data-permission="'+esc(key)+'" '+(effectivePermission(u.role,saved,key)?'checked':'')+'></td></tr>').join('')).join('')+'</tbody></table></div><p class="small">Checklist mengatur tampilan fitur. Pembatasan transaksi pada server masih mengikuti role sampai kebijakan akses per fitur diaktifkan sepenuhnya.</p>'}
const menus=[['dashboard','◫','Dashboard'],['kasir','▣','Kasir'],['produk','▤','Barang & Jasa'],['pembelian','🛒','Pembelian'],['akses','♙','Pengguna'],['panduan','?','Panduan']];
const roles={dashboard:['Super Admin','Finance','Supervisor','Kasir'],kasir:['Super Admin','Kasir'],produk:['Super Admin','Supervisor'],pembelian:['Super Admin','Supervisor'],operasional:['Super Admin','Finance'],keuangan:['Super Admin','Finance'],laporan:['Super Admin','Finance','Supervisor'],akses:['Super Admin'],panduan:['Super Admin','Finance','Supervisor']};
const activeOpname=()=>opnameOrders.find(o=>o.status==='ACTIVE');const can=p=>data&&roles[p]?.includes(data.me.role), finance=()=>['Super Admin','Finance'].includes(data.me.role),ownShift=()=>data.shifts.find(s=>!s.closed_at&&s.cashier_id===data.me.id),currentShift=()=>data.shifts.find(s=>!s.closed_at),expected=s=>Number(s.opening_cash)+sum(data.sales.filter(t=>t.shift_id===s.id&&t.method==='Tunai'),t=>t.total)+sum(data.cash_moves.filter(m=>m.shift_id===s.id),m=>m.amount);
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,5000)}
function setSession(s){session=s;if(s)localStorage.setItem('larisindo.session',JSON.stringify(s));else localStorage.removeItem('larisindo.session')}
async function request(path,body,auth=true,retry=true){let res=await fetch(URL+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});let result=await res.json().catch(()=>null);if(res.status===401&&auth&&retry&&session?.refresh_token){await refresh();return request(path,body,auth,false)}if(!res.ok){let e=Error(result?.msg||result?.message||result?.error_description||'Permintaan gagal ('+res.status+')');e.status=res.status;e.code=result?.code;throw e;}return result}
async function refresh(){const s=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},false,false);setSession(s)}
const rpc=(name,args={})=>request('/rest/v1/rpc/'+name,args);
async function sync(){if(!session){$('#auth').hidden=false;$('#shell').hidden=true;return}try{data=await rpc('pos_snapshot');purchaseDocs=can('pembelian')||finance()?await rpc('pos_purchase_list'):[];financeEntries=finance()?await rpc('pos_finance_list'):[];opnameOrders=await rpc('pos_opname_list');services=await rpc('pos_service_list');myPermissions=await rpc('pos_my_permissions');permissionRecords=data.me.role==='Super Admin'?await rpc('pos_permission_list'):[];stockTransfers=can('produk')?await rpc('pos_stock_transfer_list'):[];paymentEvidence=await rpc('pos_payment_evidence_list');cashierCredits=can('kasir')?await rpc('pos_cashier_credit_list'):[];$('#auth').hidden=true;$('#shell').hidden=false;render()}catch(e){$('#auth').hidden=false;$('#shell').hidden=true;$('#authError').hidden=false;$('#authError').textContent=e.message+' — Jika baru mendaftar, minta Super Admin mengaktifkan akun.'}}
async function auth(){const email=$('#email').value.trim(),password=$('#password').value;$('#authError').hidden=true;if(!$('#authForm').reportValidity())return;const buttons=[...$('#authForm').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{const s=await request('/auth/v1/token?grant_type=password',{email,password},false);setSession(s);await sync()}catch(e){$('#authError').textContent=e.message;$('#authError').hidden=false}finally{buttons.forEach(b=>b.disabled=false)}}
$('#authForm').onsubmit=e=>{e.preventDefault();auth()};
$('#showRegister').onclick=()=>{$('#authForm').hidden=true;$('#registerForm').hidden=false;$('#showRegister').hidden=true;$('#showLogin').hidden=false;$('#authError').hidden=true;$('#authSuccess').hidden=true};
$('#showLogin').onclick=()=>{$('#authForm').hidden=false;$('#registerForm').hidden=true;$('#showRegister').hidden=false;$('#showLogin').hidden=true;$('#authError').hidden=true};
$('#registerForm').onsubmit=async e=>{e.preventDefault();const f=$('#registerForm');if(!f.reportValidity())return;const name=$('#registerName').value.trim(),email=$('#registerEmail').value.trim(),password=$('#registerPassword').value;if(name.length<2)return notify('Isi nama lengkap');if(password!==$('#registerConfirm').value)return notify('Konfirmasi kata sandi tidak sama');const button=f.querySelector('button[type=submit]');button.disabled=true;$('#authError').hidden=true;$('#authSuccess').hidden=true;try{const res=await fetch(URL+'/auth/v1/signup',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password,data:{name},email_redirect_to:location.origin+'/'})});const result=await res.json().catch(()=>({}));if(!res.ok)throw Error(result.msg||result.error_description||result.message||'Pendaftaran gagal');f.reset();$('#authSuccess').textContent='Pendaftaran diterima. Periksa email untuk verifikasi, lalu tunggu Super Admin mengaktifkan akun sebelum masuk.';$('#authSuccess').hidden=false;$('#registerForm').hidden=true;$('#authForm').hidden=false;$('#showLogin').hidden=true;$('#showRegister').hidden=false}catch(err){$('#authError').textContent=err.message;$('#authError').hidden=false}finally{button.disabled=false}};
$('#logout').onclick=async()=>{try{await request('/auth/v1/logout',{})}catch{}setSession(null);data=null;cart=[];sync()};$('#refresh').onclick=()=>sync();$('#cancel').onclick=()=>$('#dialog').close();
function head(title,desc,buttons=''){return `<div class="top"><div><h1>${title}</h1><p>${desc}</p></div><div class="actions">${buttons}</div></div>`}const btn=(a,label,secondary=false,id='')=>`<button type="button" class="btn ${secondary?'secondary':''}" data-action="${a}" data-id="${esc(id)}">${label}</button>`;
const field=(name,label,value='',type='text',attrs='')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`,select=(name,label,options)=>`<label class="field">${label}<select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
function table(headers,rows){return `<div style="overflow:auto"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}">Belum ada data.</td></tr>`}</tbody></table></div>`}function cards(entries){return '<div class="cards">'+entries.map(([l,v])=>`<div class="card"><div class="muted">${l}</div><div class="metric">${v}</div></div>`).join('')+'</div>'}
function saleTable(sales){return table(['Nota / Waktu','Kasir','Pembayaran','Total','Aksi'],sales.map(s=>['LRS-'+s.receipt_no+'<div class="muted">'+date(s.created_at)+'</div>',esc(data.users.find(u=>u.id===s.cashier_id)?.name||s.cashier_id.slice(0,8)),esc(s.method)+(s.method!=='Tunai'?`<div class="badge">${s.method==='Piutang'?(Number(cashierCredits.find(x=>x.id===s.id)?.remaining??s.total)<=0?'Terverifikasi / Lunas':'Menunggu pelunasan'):s.verified_at?'Terverifikasi':'Menunggu verifikasi'}</div>`:''),money(s.total),btn('receipt','Lihat / Cetak',true,s.id)+(paymentEvidence.some(e=>e.sale_id===s.id)?btn('payment-evidence','Bukti foto',true,s.id):'')+(finance()&&s.method!=='Tunai'&&s.method!=='Piutang'&&!s.verified_at?btn('verify-sale','Verifikasi',false,s.id):'')]))}

const financeCategories=['Beban Operasional','Aset Tetap','Setoran Modal','Prive','Pinjaman Masuk','Angsuran Pokok','Piutang Timbul','Piutang Dibayar','Utang Timbul','Utang Dibayar','Saldo Awal','Penyesuaian'];
function financeWithin(x){return (!rangeFrom||x.occurred_on>=rangeFrom)&&(!rangeTo||x.occurred_on<=rangeTo)}
function financeSales(){return data.sales.filter(x=>(!rangeFrom||day(x.created_at)>=rangeFrom)&&(!rangeTo||day(x.created_at)<=rangeTo))}
function finRow(label,value){return '<div class="row" style="justify-content:space-between;padding:9px 0;border-bottom:1px solid #ddd"><span>'+esc(label)+'</span><strong>'+money(value)+'</strong></div>'}
function financeReport(){
 const sales=financeSales(),entries=financeEntries.filter(financeWithin),all=financeEntries;
 const turnover=sum(sales,s=>s.total),cogs=sum(sales,s=>sum(s.items,i=>i.cost*i.qty)),expenses=entries.filter(e=>e.category==='Beban Operasional');
 const expenseTotal=sum(expenses,e=>e.amount),profit=turnover-cogs-expenseTotal;
 const inv=sum(data.products,p=>p.stock*p.cost);
 const tabs={laba:'Laba Rugi',neraca:'Neraca',arus:'Arus Kas',calk:'CALK',aging:'Umur Piutang/Utang',rekon:'Kasir & Rekonsiliasi'};
 let html='<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">'+Object.entries(tabs).map(([k,v])=>btn('finance-tab',v,financeTab!==k,k)).join('')+'</div>';
 const period='<p class="small">Periode: '+esc(rangeFrom||'awal pencatatan')+' s.d. '+esc(rangeTo||'hari ini')+'. Angka bersumber dari transaksi yang tercatat, belum diaudit.</p>';
 if(financeTab==='laba'){
  html+='<section class="panel"><h2>Laporan Laba Rugi</h2>'+period+finRow('Omzet penjualan',turnover)+finRow('Harga pokok penjualan (HPP)',-cogs)+finRow('Laba kotor',turnover-cogs)+finRow('Biaya operasional',-expenseTotal)+finRow('Laba bersih sementara',profit)+'<h3>Rincian biaya operasional</h3>'+table(['Tanggal','Jenis / keterangan','Sumber','Jumlah'],expenses.map(e=>[esc(e.occurred_on),esc(e.description),esc(e.account),money(e.amount)]))+'<p class="small">Penyusutan aset, pajak penghasilan, retur, penyesuaian stok, dan biaya yang belum dicatat belum termasuk. Nilai ini belum merupakan laba bersih final.</p></section>';
 }else if(financeTab==='neraca'){
  const opening=all.filter(e=>e.category==='Saldo Awal');
  const cashOpening=sum(opening.filter(e=>e.account==='Kas'),e=>e.amount);
  const bankOpening=sum(opening.filter(e=>e.account==='Bank'),e=>e.amount);
  const cashSales=sum(data.sales.filter(s=>s.method==='Tunai'),s=>s.total);
  const bankSales=sum(data.sales.filter(s=>['Transfer','QRIS'].includes(s.method)),s=>s.total);
  const cashMoves=sum(data.cash_moves,e=>e.amount);
  const bankEntries=all.filter(e=>e.account==='Bank'&&e.category!=='Saldo Awal');
  const cashEntries=all.filter(e=>e.account==='Kas'&&e.category!=='Saldo Awal');
  const flow=e=>['Setoran Modal','Pinjaman Masuk','Piutang Dibayar'].includes(e.category)?Number(e.amount):['Beban Operasional','Aset Tetap','Prive','Angsuran Pokok','Utang Dibayar'].includes(e.category)?-Number(e.amount):0;
  const cash=cashOpening+cashSales+cashMoves+sum(cashEntries,flow),bank=bankOpening+bankSales+sum(bankEntries,flow);
  const rec=sum(all.filter(e=>e.category==='Piutang Timbul'),e=>e.amount)-sum(all.filter(e=>e.category==='Piutang Dibayar'),e=>e.amount);
  const payable=sum(all.filter(e=>e.category==='Utang Timbul'),e=>e.amount)-sum(all.filter(e=>e.category==='Utang Dibayar'),e=>e.amount);
  const fixed=sum(all.filter(e=>e.category==='Aset Tetap'),e=>e.amount)+sum(opening.filter(e=>e.account==='Aset Tetap'),e=>e.amount);
  const asset=cash+bank+rec+inv+fixed,capital=sum(all.filter(e=>e.category==='Setoran Modal'),e=>e.amount)+sum(opening.filter(e=>e.account==='Modal'),e=>e.amount)-sum(all.filter(e=>e.category==='Prive'),e=>e.amount);
  html+='<section class="panel"><h2>Posisi Keuangan / Neraca (rekonstruksi sementara)</h2>'+finRow('Kas terhitung',cash)+finRow('Bank terhitung',bank)+finRow('Piutang tercatat',rec)+finRow('Persediaan (average berjalan)',inv)+finRow('Aset tetap tercatat (bruto)',fixed)+finRow('Total aset terhitung',asset)+'<h3>Liabilitas dan Ekuitas</h3>'+finRow('Utang dagang tercatat',payable)+finRow('Modal / setoran bersih tercatat',capital)+finRow('Selisih belum direkonsiliasi',asset-payable-capital)+'<p class="notice">Belum menjadi neraca final: saldo awal, transaksi bank eksternal, kewajiban lain, akumulasi penyusutan, laba ditahan, dan pembelian di luar sistem belum lengkap. Angka kas/bank merupakan estimasi pergerakan, bukan saldo rekening terverifikasi. Jangan gunakan sebagai neraca resmi sebelum saldo awal dan rekonsiliasi diisi.</p></section>';
 }else if(financeTab==='arus'){
  const operatingSales=sum(sales.filter(s=>s.method!=='Piutang'),s=>s.total),paidOps=sum(entries.filter(e=>e.category==='Beban Operasional'),e=>e.amount);
  const collected=sum(entries.filter(e=>e.category==='Piutang Dibayar'),e=>e.amount);
  const paidDebt=sum(entries.filter(e=>e.category==='Utang Dibayar'),e=>e.amount);
  const invCash=sum(entries.filter(e=>e.category==='Aset Tetap'),e=>e.amount);
  const capital=sum(entries.filter(e=>e.category==='Setoran Modal'),e=>e.amount),loan=sum(entries.filter(e=>e.category==='Pinjaman Masuk'),e=>e.amount);
  const drawings=sum(entries.filter(e=>e.category==='Prive'),e=>e.amount),repay=sum(entries.filter(e=>e.category==='Angsuran Pokok'),e=>e.amount);
  html+='<section class="panel"><h2>Laporan Arus Kas (sementara)</h2>'+period+finRow('Penerimaan penjualan tercatat',operatingSales)+finRow('Penagihan piutang',collected)+finRow('Biaya operasional dibayar',-paidOps)+finRow('Pembayaran utang tercatat',-paidDebt)+finRow('Arus operasi sebelum pembelian stok',operatingSales+collected-paidOps-paidDebt)+finRow('Pembelian aset tetap',-invCash)+finRow('Arus investasi',-invCash)+finRow('Setoran modal',capital)+finRow('Penerimaan pinjaman',loan)+finRow('Prive / penarikan',-drawings)+finRow('Angsuran pokok',-repay)+finRow('Arus pendanaan',capital+loan-drawings-repay)+'<p class="notice">Arus kas belum lengkap: pembayaran pembelian stok dari kas/bank di luar laci dan mutasi antar-rekening belum semuanya teridentifikasi. Penjualan non-tunai belum diverifikasi sebagai dana diterima. Jangan gunakan jumlah ini sebagai saldo kas final.</p></section>';
 }else if(financeTab==='calk'){
  html+='<section class="panel"><h2>Catatan atas Laporan Keuangan (CALK)</h2><p><strong>Entitas:</strong> Larisindo Mart. Mata uang Rupiah (IDR), waktu transaksi WITA.</p><p><strong>Pengakuan penjualan:</strong> berdasarkan transaksi POS yang tercatat. HPP penjualan menggunakan biaya historis yang tersimpan pada baris penjualan.</p><p><strong>Persediaan:</strong> aplikasi saat ini menghitung biaya rata-rata tertimbang bergerak (moving weighted average) ketika menerima barang. Bukan FIFO. Nilai stok dihitung dari stok × HPP berjalan.</p><p><strong>Pembelian:</strong> ongkir, diskon dan pajak yang diinput ke nota dialokasikan pada HPP persediaan. Pembelian stok bukan beban langsung laba rugi.</p><p><strong>Biaya operasional:</strong> diakui dari pencatatan biaya pada Kas & Audit; biaya belum dibayar atau penyusutan belum otomatis dihitung.</p><p><strong>Kas dan bank:</strong> perlu saldo awal, pencocokan bukti bank, dan tutup shift. Mutasi antar akun harus dipisahkan dari pendapatan dan beban.</p><p><strong>Piutang dan utang:</strong> berasal dari jurnal manual; penjualan kredit dan pembelian tempo belum otomatis membuat aging.</p><p><strong>Keterbatasan:</strong> laporan belum mencakup seluruh penyesuaian akrual, depresiasi, pajak, kewajiban, dan rekonsiliasi eksternal. Diperlukan penutupan periode dan pemeriksaan Finance.</p></section>';
 }else if(financeTab==='aging'){
  const now=new Date();const rows=type=>{
   const map=new Map();
   all.filter(e=>e.category===type+' Timbul').forEach(e=>{const key=e.counterparty||'';if(!map.has(key))map.set(key,[]);map.get(key).push({...e,remaining:Number(e.amount)})});
   all.filter(e=>e.category===type+' Dibayar').forEach(e=>{let amount=Number(e.amount);for(const item of map.get(e.counterparty||'')||[]){const used=Math.min(amount,item.remaining);item.remaining-=used;amount-=used;if(amount<=0)break}});
   return [...map.values()].flat().filter(e=>e.remaining>0).map(e=>{const overdue=e.due_date?Math.max(0,Math.floor((Date.now()-new Date(e.due_date+'T23:59:59+08:00').getTime())/86400000)):0;return [esc(e.counterparty),esc(e.reference||e.description),esc(e.due_date||'—'),overdue+' hari',money(e.remaining)]});
  };
  html+='<section class="panel"><h2>Umur Piutang</h2>'+table(['Pelanggan','Referensi','Jatuh tempo','Terlambat','Sisa'],rows('Piutang'))+'</section><section class="panel"><h2>Umur Utang Dagang</h2>'+table(['Supplier','Referensi','Jatuh tempo','Terlambat','Sisa'],rows('Utang'))+'<p class="small">Alokasi pembayaran dilakukan berdasarkan urutan pencatatan pihak yang sama (FIFO tagihan), belum berdasarkan invoice spesifik. Data kredit di luar jurnal belum tercakup.</p></section>';
 }else if(financeTab==='rekon'){
  html+='<section class="panel"><h2>Rekonsiliasi Kasir</h2>'+table(['Kasir / Waktu','Modal awal','Kas sistem','Kas fisik','Selisih','Status'],data.shifts.map(x=>[esc(data.users.find(u=>u.id===x.cashier_id)?.name||'Kasir')+' · '+date(x.opened_at),money(x.opening_cash),money(x.closed_at?x.expected_cash:expected(x)),x.closed_at?money(x.counted_cash):'Belum tutup',x.closed_at?money(x.difference):'—',x.closed_at?(x.verified_at?'Terverifikasi':'Belum diverifikasi'):'Aktif']))+'</section>';
  html+='<section class="panel"><h2>Rekonsiliasi Bank / QRIS</h2>'+table(['Tanggal','Nota','Metode','Jumlah','Referensi','Status'],data.sales.filter(x=>['Transfer','QRIS'].includes(x.method)).map(x=>[date(x.created_at),esc(x.receipt_no),esc(x.method),money(x.total),esc(x.reference||'—'),x.verified_at?'Terverifikasi':'Menunggu Finance']))+'<p class="notice">Verifikasi bukti transfer belum sama dengan rekonsiliasi mutasi rekening. Untuk rekonsiliasi bank penuh masih diperlukan impor rekening koran, saldo bank awal/akhir, biaya admin, dan pencocokan per transaksi.</p></section>';
  html+='<section class="panel"><h2>Mutasi kas laci</h2>'+table(['Waktu','Jenis','Jumlah','Catatan'],data.cash_moves.map(m=>[date(m.created_at),esc(m.kind),money(m.amount),esc(m.note)]))+'</section>';
 }
 return html;
}

let stockTransfers=[];

const opnameColumns=['product_id','sku','barcode','nama_barang','lokasi_barang','stok_sistem','stok_fisik','barcode_verifikasi'];
function opnameTemplateRows(id){
 const o=opnameOrders.find(x=>x.id===id);
 const lines=o?.lines||data.products.map(p=>({product_id:p.id,name_snapshot:p.name,expected:p.stock,counted:null}));
 return [opnameColumns,...lines.map(l=>{const p=data.products.find(x=>x.id===l.product_id)||{};return [l.product_id,p.sku||'',p.barcode||'',l.name_snapshot,l.counted_location||p.storage_location||'Belum ditentukan',l.expected,l.counted??'',l.counted_barcode||'']})];
}
function downloadCSVRows(rows,filename){
 const csv='\ufeff'+rows.map(row=>row.map(csvQuote).join(';')).join('\r\n');
 const url=globalThis.URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>globalThis.URL.revokeObjectURL(url),1500);
}
let excelLoader;
function loadExcel(){
 if(window.XLSX)return Promise.resolve(window.XLSX);
 if(excelLoader)return excelLoader;
 excelLoader=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('Excel tidak tersedia'));s.onerror=()=>reject(Error('Gagal memuat pembaca Excel. Gunakan CSV atau periksa internet.'));document.head.appendChild(s)}).catch(e=>{excelLoader=null;throw e});
 return excelLoader;
}
function buildExcelFile(rows){
 const enc=new TextEncoder(),escapeXML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>{let n=j+1,col='';while(n){n--;col=String.fromCharCode(65+n%26)+col;n=Math.floor(n/26)}const ref=col+(i+1);return typeof v==='number'&&Number.isFinite(v)?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+escapeXML(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>';
 const files={
 '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Stock Opname" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':'<?xml version="1.0"?>'+sheet
 };
 const crc=bytes=>{let c=-1;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^-1)>>>0};
 const u16=(a,n)=>{a.push(n&255,(n>>>8)&255)},u32=(a,n)=>{u16(a,n);u16(a,n>>>16)};
 let parts=[],directory=[],offset=0,count=0;
 for(const [name,content] of Object.entries(files)){const filename=enc.encode(name),bytes=enc.encode(content),checksum=crc(bytes);let h=[];u32(h,0x04034b50);u16(h,20);u16(h,0x800);u16(h,0);u16(h,0);u16(h,0);u32(h,checksum);u32(h,bytes.length);u32(h,bytes.length);u16(h,filename.length);u16(h,0);parts.push(new Uint8Array(h),filename,bytes);let d=[];u32(d,0x02014b50);u16(d,20);u16(d,20);u16(d,0x800);u16(d,0);u16(d,0);u16(d,0);u32(d,checksum);u32(d,bytes.length);u32(d,bytes.length);u16(d,filename.length);u16(d,0);u16(d,0);u16(d,0);u16(d,0);u32(d,0);u32(d,offset);directory.push(new Uint8Array(d),filename);offset+=h.length+filename.length+bytes.length;count++}
 const dirSize=directory.reduce((n,x)=>n+x.length,0),end=[];u32(end,0x06054b50);u16(end,0);u16(end,0);u16(end,count);u16(end,count);u32(end,dirSize);u32(end,offset);u16(end,0);
 return new Blob([...parts,...directory,new Uint8Array(end)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function downloadOpnameTemplate(id,excel=false){
 const rows=opnameTemplateRows(id),filename='Template-Stock-Opname-Larisindo';
 if(!excel)return downloadCSVRows(rows,filename+'.csv');
 const url=globalThis.URL.createObjectURL(buildExcelFile(rows)),link=document.createElement('a');link.href=url;link.download=filename+'.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>globalThis.URL.revokeObjectURL(url),10000);
}

async function shareOpnameTemplate(id){
 if(!session)return notify('Silakan login kembali');
 editModal('Kirim Template Stock Opname via Email',
 field('email','Email penerima','','email','required autocomplete="email"')+
 '<p class="small">File CSV berisi barang, barcode, lokasi gudang/rak, stok sistem, dan kolom stok fisik akan dikirim langsung sebagai lampiran. Tidak perlu membuka Gmail.</p>',
 async f=>{
  const email=String(f.email||'').trim();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))throw Error('Email tidak valid');
  const result=await request('/functions/v1/send-opname-template',{email,order_id:id||null});
  if(!result?.ok)throw Error(result?.error||'Email gagal dikirim');
  notify('Template berhasil dikirim ke '+email);
 });
}
function cancelOpnameOrder(id){
 const o=opnameOrders.find(x=>x.id===id);
 if(!o||o.status!=='ACTIVE')return notify('Perintah tidak aktif');
 editModal('Batalkan Perintah Stock Opname','<p>Batalkan <strong>'+esc(o.number)+'</strong>? Draft tetap tersimpan, stok tidak berubah, dan kunci transaksi dilepas.</p>'+field('reason','Alasan pembatalan','','text','required minlength="5"'),async f=>{
  if(!confirm('Yakin batalkan '+o.number+'?'))return;
  await rpc('pos_opname_cancel',{p_id:id,p_reason:f.reason});
 });
}
function openOpnameImport(id){
 const o=opnameOrders.find(x=>x.id===id)||activeOpname();
 if(!o||o.status!=='ACTIVE')return notify('Buat Perintah Stock Opname dahulu sebelum mengimpor hasil.');
 editModal('Impor Hasil Stock Opname', '<p>Unduh template, isi kolom <strong>stok_fisik</strong>, lalu unggah file .xlsx, .xls, atau .csv. Produk dicocokkan dengan ID, bukan hanya nama. File tidak otomatis memproses final.</p><label class="field">File Excel / CSV<input type="file" id="opname-file" accept=".xlsx,.xls,.csv,text/csv" required></label><p id="opname-import-status" class="notice">Belum ada file dipilih.</p>',async()=>{
 const f=document.querySelector('#opname-file').files[0];if(!f)throw Error('Pilih file terlebih dahulu');
 if(f.size>5*1024*1024)throw Error('File maksimal 5 MB');
 let rows;if(/\.csv$/i.test(f.name))rows=parseCSV(await f.text());else{const XLSX=await loadExcel();const book=XLSX.read(await f.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false})}
 const headers=rows.shift()?.map(x=>String(x).trim().toLowerCase())||[];
 const ix=headers.indexOf('product_id'),qty=headers.indexOf('stok_fisik'),bi=headers.indexOf('barcode_verifikasi'),li=headers.indexOf('lokasi_barang');
 if(ix<0||qty<0)throw Error('Kolom product_id dan stok_fisik wajib tersedia');
 const allowed=new Set(o.lines.map(l=>l.product_id)),counts={},barcodes={},locations={};
 for(let n=0;n<rows.length;n++){const row=rows[n],pid=String(row[ix]||'').trim(),val=String(row[qty]??'').trim();if(!pid&&!val)continue;if(!allowed.has(pid))throw Error('Baris '+(n+2)+': ID barang tidak ada dalam opname');if(val==='')continue;if(!/^(0|[1-9][0-9]*)$/.test(val)||Number(val)>999999999)throw Error('Baris '+(n+2)+': stok fisik tidak valid');if(Object.hasOwn(counts,pid))throw Error('ID barang ganda di baris '+(n+2));counts[pid]=Number(val);const p=data.products.find(x=>x.id===pid)||{};const barcode=String(bi>=0?row[bi]||'':'').trim(),expected=String(p.barcode||'').trim();if(barcode&&barcode!==expected)throw Error('Baris '+(n+2)+': barcode verifikasi tidak cocok');if(expected&&!barcode)throw Error('Baris '+(n+2)+': barcode verifikasi wajib diisi');if(barcode)barcodes[pid]=barcode;if(li>=0&&String(row[li]||'').trim())locations[pid]=String(row[li]).trim()}
 if(!Object.keys(counts).length)throw Error('Tidak ada stok fisik yang diisi');
 await rpc('pos_opname_save_details',{p_id:o.id,p_counts:counts,p_barcodes:barcodes,p_locations:locations});notify(Object.keys(counts).length+' hasil opname tersimpan sebagai draft.');await sync();
 });
}
function openStockTransfer(){
 if(activeOpname())return notify('Tidak bisa pindah lokasi saat opname aktif');
 if(!data.products.length)return notify('Belum ada barang');
 return editModal('Pindah Gudang / Rak',select('product','Barang',data.products.map(p=>[p.id,p.name+' · '+(p.storage_location||'Belum ditentukan')+' · stok '+p.stock]))+field('to','Lokasi tujuan','','text','required maxlength="100" placeholder="Gudang 2 / Rak B1"')+field('note','Alasan / berita acara','','text','required minlength="3"')+'<p class="small">Memindahkan <strong>seluruh stok barang</strong> ke lokasi tujuan. Total stok tidak berubah. Pemindahan sebagian stok belum didukung.</p>',f=>rpc('pos_stock_transfer',{p_product:f.product,p_to:f.to,p_note:f.note}));
}
function openStockReason(){
 if(activeOpname())return notify('Penyesuaian stok terkunci saat opname');
 if(!data.products.length)return notify('Belum ada barang');
 return editModal('Penyesuaian Stok',select('product','Barang',data.products.map(p=>[p.id,p.name+' · stok '+p.stock]))+select('kind','Jenis',[['Rusak','Barang rusak'],['Kedaluwarsa','Barang kedaluwarsa'],['Selisih Penjualan','Salah hitung saat penjualan'],['Bonus','Bonus barang sejenis yang sudah terdaftar'],['Koreksi Lain','Koreksi lainnya']])+field('qty','Perubahan stok (+/- pcs)','','number','required step="1"')+field('note','Keterangan / berita acara','','text','required minlength="5"')+'<p class="small">Gunakan angka negatif untuk stok keluar (contoh -2). Bonus barang jenis baru dimasukkan melalui Nota Pembelian dengan harga Rp0 dan keterangan pemasok. Penyesuaian tidak mengubah HPP rata-rata.</p>',f=>rpc('pos_stock_adjust_reason',{p_product:f.product,p_quantity:Number(f.qty),p_kind:f.kind,p_note:f.note}));
}
function renderOpnamePage(){
 const active=activeOpname();
 let h=head('Stok & Opname','Perintah opname, simpan draft, proses hasil, dan laporan selisih.',(active?'':btn('opname-start','+ Perintah Stock Opname'))+btn('opname-import','Impor Excel / CSV',true,active?.id||'')+btn('opname-transfer','Pindah Gudang / Rak',true)+btn('opname-adjust-reason','Penyesuaian Stok',true));
 if(active)h+='<div class="notice"><strong>SEDANG STOCK OPNAME · '+esc(active.number)+'</strong><p>Penjualan, pembelian, dan perubahan barang terkunci pada database sampai hasil diproses.</p>'+btn('opname-count','Isi / Simpan Hasil',false,active.id)+btn('opname-cancel','Batalkan Perintah',true,active.id)+'</div>';
 h+='<section class="panel"><h2>Perintah dan Hasil Opname</h2>'+table(['Nomor','Tanggal','Lokasi','Status','Hasil'],opnameOrders.map(o=>[esc(o.number),date(o.started_at),esc(o.location),o.status==='ACTIVE'?'Sedang dihitung':o.status==='CANCELLED'?'Dibatalkan':'Selesai',btn('opname-report','Lihat laporan',true,o.id)+(o.status==='ACTIVE'?btn('opname-cancel','Batalkan',true,o.id):'')]))+'</section>';
 h+='<section class="panel"><h2>Riwayat Pindah Gudang / Rak</h2>'+table(['Waktu','Barang','Asal','Tujuan','Jumlah','Catatan'],stockTransfers.map(t=>[date(t.created_at),esc(t.product_name),esc(t.from_location),esc(t.to_location),t.qty,esc(t.note)]))+'</section>';
 h+='<section class="panel"><h2>Riwayat Pergerakan Stok</h2>'+table(['Waktu','Barang','Jenis','Delta','Alasan'],data.stock_moves.slice(0,200).map(m=>[date(m.created_at),esc(data.products.find(p=>p.id===m.product_id)?.name||m.product_id),esc(m.kind),m.delta,esc(m.kind==='Pembelian'&&!String(m.reason).startsWith('Pembelian di ')?'Pembelian di '+m.reason.replace(' / ',' · Nota '):m.reason)]))+'</section>';return h;
}
function opnameReport(o){
 const rows=o.lines.map(l=>{let d=l.counted===null?null:l.counted-l.expected;return [esc(l.name_snapshot),esc(l.counted_location||data.products.find(p=>p.id===l.product_id)?.storage_location||'Belum ditentukan'),l.expected,l.counted===null?'Belum dihitung':l.counted,d===null?'—':d,money(l.cost_snapshot),d===null?'—':money(d*l.cost_snapshot)]});
 const known=o.lines.filter(l=>l.counted!==null);
 return '<p>Nomor '+esc(o.number)+' · '+esc(o.status)+'</p>'+table(['Barang','Lokasi barang','Sistem','Fisik','Selisih qty','HPP','Selisih nilai'],rows)+
 '<p><strong>Selisih nilai bersih: '+money(sum(known,l=>(l.counted-l.expected)*l.cost_snapshot))+'</strong></p><p>Kekurangan: '+money(sum(known.filter(l=>l.counted<l.expected),l=>(l.expected-l.counted)*l.cost_snapshot))+' · Kelebihan: '+money(sum(known.filter(l=>l.counted>l.expected),l=>(l.counted-l.expected)*l.cost_snapshot))+'</p><p class="small">HPP adalah nilai snapshot saat perintah opname dibuat.</p>';
}
function showOpnameReport(id){const o=opnameOrders.find(x=>x.id===id);if(!o)return;$('#save').hidden=true;$('#cancel').textContent='Tutup';modal('Laporan Selisih Stock Opname',opnameReport(o),()=>{})}
function opnameLocationOptions(current){
 const locations=[...new Set([...(data.products||[]).map(p=>String(p.storage_location||'').trim()),...(stockTransfers||[]).flatMap(t=>[String(t.from_location||'').trim(),String(t.to_location||'').trim()]),...(opnameOrders||[]).flatMap(o=>[String(o.location||'').trim(),...(o.lines||[]).map(l=>String(l.counted_location||'').trim())])].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
 const selected=String(current||'').trim();
 if(selected&&!locations.includes(selected))locations.unshift(selected);
 return '<option value="">Pilih lokasi</option>'+locations.map(loc=>'<option value="'+esc(loc)+'"'+(loc===selected?' selected':'')+'>'+esc(loc)+'</option>').join('');
}
function openOpnameCount(id){
 const o=opnameOrders.find(x=>x.id===id);if(!o||o.status!=='ACTIVE')return;
 const body='<p><strong>'+esc(o.number)+'</strong> · Cocokkan barcode, isi lokasi dan stok fisik, lalu simpan draft.</p>'+btn('opname-template','Unduh CSV',true,id)+btn('opname-template-xlsx','Unduh Excel',true,id)+btn('opname-email','Kirim via Email',true,id)+btn('opname-import','Impor Excel / CSV',true,id)+'<div style="max-height:55vh;overflow:auto">'+table(['Barang','Barcode sistem','Barcode verifikasi','Lokasi barang (isi)','Stok sistem','Stok fisik','HPP/unit'],o.lines.map(l=>{const p=data.products.find(x=>x.id===l.product_id)||{},code=String(p.barcode||'');return [esc(l.name_snapshot),esc(code||'—'),'<input class="opname-barcode" data-id="'+esc(l.product_id)+'" data-expected="'+esc(code)+'" type="text" inputmode="numeric" autocomplete="off" placeholder="'+(code?'Scan / ketik barcode':'Tanpa barcode')+'" value="'+esc(l.counted_barcode||'')+'" style="min-width:145px">','<select class="opname-location" data-id="'+esc(l.product_id)+'" style="min-width:155px">'+opnameLocationOptions(l.counted_location||p.storage_location||'')+'</select>',l.expected,'<input class="opname-count" data-id="'+esc(l.product_id)+'" type="number" min="0" step="1" placeholder="Belum" value="'+(l.counted===null?'':l.counted)+'" style="width:100px">',money(l.cost_snapshot)]}))+'</div><p class="notice" id="opname-summary"></p>'+btn('opname-process','Proses Hasil (Final)',true,id);
 editModal('Hasil Stock Opname · Simpan Draft',body,()=>saveOpnameDetails(id));
 const summary=()=>{let n=0,total=0,wrong=0;document.querySelectorAll('.opname-count').forEach(el=>{if(el.value==='')return;const l=o.lines.find(x=>x.product_id===el.dataset.id);n++;total+=(Number(el.value)-l.expected)*l.cost_snapshot});document.querySelectorAll('.opname-barcode').forEach(el=>{const matched=!el.value.trim()||el.value.trim()===el.dataset.expected;el.style.borderColor=matched?'':'#d33';if(!matched)wrong++});$('#opname-summary').textContent=n+'/'+o.lines.length+' barang · Barcode tidak cocok: '+wrong+' · Selisih nilai sementara '+money(total)};
 document.querySelectorAll('.opname-count,.opname-barcode').forEach(el=>el.addEventListener('input',summary));summary();
}
function readOpnameDetails(){
 const counts={},barcodes={},locations={};
 document.querySelectorAll('.opname-count').forEach(el=>{if(el.value!==''){if(!/^(0|[1-9][0-9]*)$/.test(el.value)||Number(el.value)>999999999)throw Error('Stok fisik tidak valid');counts[el.dataset.id]=Number(el.value)}});
 document.querySelectorAll('.opname-barcode').forEach(el=>{const code=el.value.trim();if(code&&code!==el.dataset.expected)throw Error('Barcode tidak cocok dengan barang sistem. Periksa baris yang ditandai merah.');if(code)barcodes[el.dataset.id]=code;if(el.dataset.expected&&Object.hasOwn(counts,el.dataset.id)&&!code)throw Error('Barcode verifikasi wajib diisi untuk barang yang dihitung: '+el.dataset.expected)});
 document.querySelectorAll('.opname-location').forEach(el=>{const location=el.value.trim();if(location)locations[el.dataset.id]=location});
 return {p_counts:counts,p_barcodes:barcodes,p_locations:locations};
}
async function saveOpnameDetails(id){return rpc('pos_opname_save_details',{p_id:id,...readOpnameDetails()})}
function readOpnameCounts(){return readOpnameDetails().p_counts}
async function processOpname(id){
 const o=opnameOrders.find(x=>x.id===id);if(!o||o.status!=='ACTIVE')return;
 const fields=document.querySelectorAll('.opname-count');
 if(fields.length){if([...fields].some(el=>el.value===''))return notify('Semua barang wajib dihitung sebelum proses');await saveOpnameDetails(id)}
 else if(o.lines.some(l=>l.counted===null))return notify('Masih ada barang belum dihitung');
 if(!confirm('Proses final akan menyesuaikan stok dan membuka kembali transaksi. Lanjutkan?'))return;
 await rpc('pos_opname_process',{p_id:id});$('#dialog').close();await sync();notify('Stok berhasil disesuaikan, transaksi dibuka');
}
function openCreditPayment(selectedSaleId=null){
 const credits=cashierCredits.filter(s=>Number(s.remaining)>0).filter(s=>data.me.role!=='Kasir'||s.cashier_id===data.me.id);
 if(!credits.length)return notify('Tidak ada piutang yang belum lunas');
 const id=crypto.randomUUID();
 editModal('Pembayaran Piutang',select('sale','Nota piutang',credits.map(s=>[s.id,'LRS-'+s.receipt_no+' · '+(s.customer||'Pelanggan')+' · '+money(s.remaining)]).filter(x=>!selectedSaleId||x[0]===selectedSaleId))+field('amount','Nominal diterima','','number','min="1" required')+select('account','Diterima melalui',[['Bank','Bank / transfer'],['Kas','Kas laci']])+field('evidence','Bukti pembayaran (nomor bukti)','','text','required minlength="3"'),async f=>{
 const s=credits.find(x=>x.id===f.sale);if(!s||Number(f.amount)>s.remaining)throw Error('Pembayaran melebihi sisa piutang');
 if(f.account==='Kas'&&!currentShift())throw Error('Shift kas tidak aktif');
 await rpc('pos_credit_payment',{p_id:id,p_sale:f.sale,p_amount:Number(f.amount),p_account:f.account,p_shift:f.account==='Kas'?currentShift().id:null,p_reference:f.evidence});
 });
}

function renderOperationalPage(s){
 let html=head('Keuangan Operasional','Catat biaya, modal, pembayaran, utang/piutang, serta serah terima kasir. Semua tercatat otomatis di Kas & Audit.',(finance()?btn('finance-add','+ Transaksi keuangan')+btn('credit-payment','+ Bayar Piutang',true):'')+(currentShift()?btn('cash','+ Mutasi laci',true):'')+(s?btn('close','Tutup shift',true):''));
 if(finance())html+='<section class="panel"><h2>Transaksi keuangan</h2><p class="small">Masukkan gaji, listrik, sewa, investasi, modal, dan pembayaran melalui formulir ini. Penjualan melalui Kasir, pembelian barang melalui Pembelian. Jangan catat pengeluaran yang sama dua kali.</p>'+table(['Tanggal','Kategori','Sumber','Pihak','Keterangan','Jumlah'],financeEntries.slice(0,200).map(e=>[esc(e.occurred_on),esc(e.category),esc(e.account),esc(e.counterparty||'—'),esc(e.description),money(e.amount)]))+'</section>';
 html+='<section class="panel"><h2>Shift kasir & verifikasi</h2>'+table(['Petugas / buka','Modal','Kas sistem','Kas fisik / selisih','Verifikasi'],data.shifts.map(x=>[esc(data.users.find(u=>u.id===x.cashier_id)?.name||'Kasir')+' / '+date(x.opened_at),money(x.opening_cash),money(x.closed_at?x.expected_cash:expected(x)),x.closed_at?money(x.counted_cash)+' / '+money(x.difference):'Aktif',x.closed_at?(x.verified_at?'Terverifikasi':finance()?btn('verify-shift','Verifikasi',false,x.id):'Menunggu Finance'):'—']))+'</section>';
 if(finance())html+='<section class="panel"><h2>Verifikasi transfer / QRIS</h2>'+table(['Waktu','Nota','Metode','Jumlah','Status'],data.sales.filter(x=>['Transfer','QRIS'].includes(x.method)).map(x=>[date(x.created_at),esc(x.receipt_no),esc(x.method),money(x.total),x.verified_at?'Terverifikasi':btn('verify-sale','Verifikasi bukti',false,x.id)]))+'</section>';
 return html;
}
function renderFinancePage(s){
 const buttons='';
 let html=head('Kas, Audit & Akuntansi','Hanya laporan dan pemeriksaan dari transaksi operasional; tanpa input keuangan di halaman ini.',buttons);
 html+='<section class="panel noprint"><div class="row">'+field('from','Dari tanggal',rangeFrom,'date')+field('to','Sampai tanggal',rangeTo,'date')+btn('filter','Terapkan')+btn('print','Cetak / PDF',true)+'</div></section>';
 if(finance())html+=financeReport();
 else html+='<section class="panel"><h2>Kasir</h2>'+table(['Waktu','Modal','Kas seharusnya','Selisih'],data.shifts.map(x=>[date(x.opened_at),money(x.opening_cash),money(x.closed_at?x.expected_cash:expected(x)),x.closed_at?money(x.difference):'Belum tutup']))+'</section>';
 if(finance())html+='<section class="panel"><h2>Jurnal keuangan tambahan</h2>'+table(['Tanggal','Kategori','Akun','Pihak','Keterangan','Jumlah'],financeEntries.slice(0,120).map(e=>[esc(e.occurred_on),esc(e.category),esc(e.account),esc(e.counterparty||'—'),esc(e.description),money(e.amount)]))+'</section><section class="panel"><h2>Jejak audit terbaru</h2>'+table(['Waktu','Aktivitas','Petugas','Detail'],data.audit.map(x=>[date(x.created_at),esc(x.action),esc(x.actor_id?.slice(0,8)),esc(JSON.stringify(x.detail))]))+'</section>';
 return html;
}
function openFinanceEntry(){
 if(!finance())return;
 const id=crypto.randomUUID(),today=day(new Date());
 return editModal('Catat jurnal keuangan',field('occurred','Tanggal',today,'date','required')+
 select('category','Jenis transaksi',financeCategories.map(x=>[x,x]))+
 select('account','Akun / sumber dana',['Kas','Bank','Piutang','Utang','Modal','Aset Tetap','Beban'].map(x=>[x,x]))+
 field('counterparty','Pelanggan / supplier (untuk utang/piutang)')+
 field('description','Keterangan / jenis beban (mis. gaji, listrik, sewa, susut alat)','','text','required minlength="3" maxlength="300"')+
 field('amount','Nominal (Rp)','','number','min="0.01" step="0.01" required')+
 field('due','Jatuh tempo (untuk piutang/utang)','','date')+
 field('reference','Nomor bukti / invoice'),f=>rpc('pos_finance_record',{p_id:id,p_date:f.occurred,p_category:f.category,p_account:f.account,p_counterparty:f.counterparty,p_description:f.description,p_amount:Number(f.amount),p_due:f.due||null,p_reference:f.reference}));
}


function cashierWeekBounds(){
 const d=new Date();d.setHours(0,0,0,0);
 const monday=(d.getDay()+6)%7;d.setDate(d.getDate()-monday+cashierWeekOffset*7);
 const start=new Date(d),end=new Date(d);end.setDate(end.getDate()+6);
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
function cashierWeekShifts(){
 const {start,end}=cashierWeekBounds();
 return data.shifts.filter(x=>{const d=day(x.opened_at);return d>=start&&d<=end&&(data.me.role!=='Kasir'||x.cashier_id===data.me.id)});
}
function renderCashierWorkspace(s){
 const cashier=data.me.role==='Kasir',sales=cashier?data.sales.filter(x=>x.cashier_id===data.me.id):data.sales;
 const tabs=[['transaksi','Transaksi'],['nota','Nota Penjualan'],['piutang','Daftar Piutang'],['hadir','Kedatangan Kasir'],['laci','Kas Laci / Shift']];
 let html=head('Dashboard Kasir',cashier?'Ruang kerja khusus akun kasir · data transaksi dan shift pribadi':'Transaksi, nota, piutang, kehadiran dan laporan shift');
 html+='<div class="row noprint" style="gap:8px;flex-wrap:wrap;margin-bottom:16px">'+tabs.map(([id,label])=>btn('cashier-tab',label,cashierTab!==id,id)).join('')+'</div>';
 if(cashierTab==='transaksi'){
 const pending=localStorage.getItem('larisindo.pending.'+data.me.id);
 html+=(s?'<div class="notice">Shift aktif sejak '+date(s.opened_at)+' · Kas seharusnya '+money(expected(s))+'</div>':'<div class="notice">Belum ada shift aktif atas nama akun ini. Buka shift sebelum melayani.</div>')+
 (pending?'<div class="notice">Pembayaran tertunda. '+btn('retry','Periksa pembayaran')+'</div>':'')+
 '<div class="pos pos-modern"><section class="panel pos-catalog"><div class="pos-banner"><div><span class="pos-eyebrow">LARISINDO MART · POINT OF SALE</span><h2>Belanja lebih mudah,<br>pelayanan lebih cepat.</h2><p>Pilih barang atau jasa, lalu selesaikan pembayaran.</p></div><div class="pos-banner-art">🛒</div></div><div class="pos-catalog-title"><div><h2>Katalog Produk</h2><p class="small">Ketuk produk untuk menambahkannya ke keranjang</p></div><span class="pos-count" id="catalogCount"></span></div><input id="search" placeholder="⌕ Cari nama produk, SKU, atau scan barcode" autocomplete="off"><div id="posCategories" class="pos-categories"></div><div id="productGrid" class="products"></div></section><section class="panel pos-cart"><div class="pos-cart-head"><span class="pos-cart-icon">🛍️</span><div><h2>Keranjang belanja</h2><p class="small">Ringkasan transaksi pelanggan</p></div></div><div id="cartArea"></div></section></div>';
 }else if(cashierTab==='nota'){
 html+='<section class="panel"><h2>Nota Penjualan</h2><p class="small">Klik Lihat / Cetak untuk membuka faktur lengkap.</p>'+saleTable(sales)+'</section>';
 }else if(cashierTab==='piutang'){
 const credits=cashier?cashierCredits.filter(x=>x.cashier_id===data.me.id):cashierCredits;
 html+='<section class="panel"><h2>Daftar Piutang & Faktur Penjualan</h2>'+
 table(['Faktur','Pelanggan','Tanggal','Jatuh Tempo','Total','Dibayar','Sisa','Status / Aksi'],credits.map(x=>[
 'LRS-'+x.receipt_no,esc(x.customer||'—'),date(x.created_at),esc(x.due_date||'—'),money(x.total),money(x.paid),money(x.remaining),
 (Number(x.remaining)<=0?'Lunas':'Belum lunas')+' '+btn('receipt','Lihat Faktur',true,x.id)
 ]))+'<p class="small">Kasir dapat menerima pembayaran faktur sendiri. Finance dapat memantau pencatatan pelunasan.</p></section>';
 }else if(cashierTab==='hadir'){
 const shifts=cashierWeekShifts(),bounds=cashierWeekBounds();
 html+='<section class="panel"><h2>Laporan Kedatangan Kasir · Pekanan</h2><div class="row">'+btn('cashier-week-prev','← Pekan sebelumnya',true)+'<strong>'+bounds.start+' s.d. '+bounds.end+'</strong>'+btn('cashier-week-next','Pekan berikutnya →',true)+'</div>'+
 table(['Tanggal','Kasir','Waktu datang / buka shift','Waktu selesai','Durasi','Status'],shifts.map(x=>{
 const mins=x.closed_at?Math.round((new Date(x.closed_at)-new Date(x.opened_at))/60000):null;
 return [day(x.opened_at),esc(data.users.find(u=>u.id===x.cashier_id)?.name||'Kasir'),date(x.opened_at),x.closed_at?date(x.closed_at):'Masih bertugas',mins===null?'—':Math.floor(mins/60)+'j '+mins%60+'m',x.closed_at?'Selesai':'Aktif'];
 }))+'<p class="small">Kedatangan diambil dari waktu buka shift, bukan absensi biometrik. Belum menghitung terlambat karena jadwal kerja belum dimasukkan.</p></section>';
 }else if(cashierTab==='laci'){
 const shifts=cashierWeekShifts(),bounds=cashierWeekBounds();
 html+='<section class="panel"><h2>Kas Laci · Buka / Tutup / Ganti Shift</h2><div class="row">'+(s?btn('close','Tutup & Serah Terima Shift'):!currentShift()?btn('open','Buka Kas Laci'): '<p class="notice">Laci sedang digunakan shift lain. Tunggu penutupan shift sebelumnya.</p>')+'</div>'+
 (s?'<p>Modal awal '+money(s.opening_cash)+' · Kas sistem '+money(expected(s))+'</p>':'<p>Modal kas awal standar Rp500.000; hitung dan konfirmasi kas fisik saat membuka.</p>')+'</section>';
 html+='<section class="panel"><h2>Laporan Kas Laci per Pekan</h2><div class="row">'+btn('cashier-week-prev','← Pekan sebelumnya',true)+'<strong>'+bounds.start+' s.d. '+bounds.end+'</strong>'+btn('cashier-week-next','Pekan berikutnya →',true)+'</div>'+
 table(['Tanggal','Kasir','Buka','Tutup','Kas Sistem','Kas Fisik','Selisih','Status'],shifts.map(x=>[
 day(x.opened_at),esc(data.users.find(u=>u.id===x.cashier_id)?.name||'Kasir'),date(x.opened_at),x.closed_at?date(x.closed_at):'—',money(x.closed_at?x.expected_cash:expected(x)),x.closed_at?money(x.counted_cash):'—',x.closed_at?money(x.difference):'—',x.closed_at?(x.verified_at?'Terverifikasi':'Belum diverifikasi'):'Aktif'
 ]))+'</section>';
 }
 return html;
}
function renderServiceList(){
 return head('Daftar Jasa','Kelola jenis jasa dan tarif. Jasa tidak memiliki stok gudang.',btn('service-new','+ Tambah Jasa'))+
 '<section class="panel">'+table(['Kode / SKU','Nama jasa','Tarif','Keterangan','Status','Aksi'],services.map(s=>[esc(s.sku||'—'),esc(s.name),money(s.price),esc(s.description||'—'),s.active?'Aktif':'Nonaktif',btn('service-edit','Edit',true,s.id)]))+'</section>';
}
function openServiceForm(id){
 const s=services.find(x=>x.id===id)||{};
 editModal(id?'Edit Jasa':'Tambah Jasa',field('name','Nama jasa',s.name||'','text','required minlength="2"')+field('sku','Kode / SKU (opsional)',s.sku||'')+field('price','Harga jasa (Rp)',s.price??0,'number','required min="0" step="1"')+field('description','Keterangan',s.description||'')+select('active','Status',[['true','Aktif'],['false','Nonaktif']]),async f=>{
 await rpc('pos_service_save',{p_id:id||null,p_name:f.name,p_sku:f.sku,p_price:Number(f.price),p_description:f.description,p_active:f.active==='true'});
 });
 const status=document.querySelector('#dialog [name=active]');if(status)status.value=String(s.active??true);
}
function render(){if(data.me.role==='Kasir')page='kasir';else if(!can(page))page='dashboard';$('#identity').textContent=data.me.name+' · '+data.me.role+' · WITA';$('#side').innerHTML=menus.filter(([k])=>can(k)&&(data.me.role!=='Kasir'||k==='kasir')).map(([k,i,l])=>`<button class="nav ${page===k?'active':''}" data-page="${k}">${i} ${l}</button>`).join('');let html='';let s=ownShift();if(activeOpname())html='<div class="notice"><strong>SEDANG PROSES STOCK OPNAME</strong> · Penjualan, pembelian, dan perubahan barang dikunci sampai hasil diproses.</div>';
if(page==='dashboard'){let today=data.sales.filter(t=>day(t.created_at)===day(new Date()));html=head('Dashboard Larisindo','Ringkasan hari ini · waktu Mataram (WITA)')+cards([['Omzet hari ini',money(sum(today,t=>t.total))],['Transaksi hari ini',today.length],['Stok minimum',data.products.filter(p=>p.stock<=p.minimum).length],['Pembayaran belum diverifikasi',data.sales.filter(t=>t.method!=='Tunai'&&!t.verified_at).length]])+`<section class="panel"><h2>Transaksi terbaru</h2>${saleTable(data.sales.slice(0,8))}</section><div class="notice">${s?'Shift kamu aktif. Kas seharusnya '+money(expected(s))+'.':'Buka shift pada menu Kasir untuk mulai melayani.'} ${data.me.role==='Kasir'?'Ringkasan transaksi hanya milik akunmu.':''}</div>`;}
if(page==='kasir')html=renderCashierWorkspace(s);
if(page==='produk'){const tabs='<div class="row noprint" style="gap:8px;flex-wrap:wrap;margin-bottom:16px">'+btn('product-tab','Daftar Barang',productTab!=='barang','barang')+btn('product-tab','Daftar Jasa',productTab!=='jasa','jasa')+btn('product-tab','Stok & Opname',productTab!=='stok','stok')+'</div>';html=tabs+(productTab==='stok'?renderOpnamePage():productTab==='jasa'?renderServiceList():head('Barang & Jasa','Barang baru hanya dapat didaftarkan melalui Nota Pembelian. Harga jual dan lokasi gudang/rak dapat diedit di sini.','')+`<section class="panel">${table(['SKU / Barcode','Barang','Gudang / Rak','HPP','Harga jual','Stok','Aksi'],data.products.map(p=>[esc(p.sku)+'<div class="muted">'+esc(p.barcode)+'</div>',esc(p.name)+'<div class="muted">'+esc(p.category)+' · '+esc(p.unit)+'</div>',esc(p.storage_location||'Belum ditentukan'),money(p.cost),money(p.price),p.stock,btn('product','Edit',true,p.id)]))}</section>`)}
if(page==='pembelian')html=head('Pembelian & Penerimaan','Satu nota berisi banyak barang, ongkir, diskon, pajak dan lampiran PDF/foto.',btn('receive','+ Nota pembelian'))+`<section class="panel">${table(['Tanggal','Pemasok / Nota','Barang','Total','Sumber','Aksi'],purchaseDocs.map(p=>[esc(p.invoice_date),esc(p.vendor)+' / '+esc(p.invoice),p.items.length+' barang',money(p.total),esc(p.source),btn('purchase-detail','Lihat nota',true,p.id)]))}</section>`;

if(page==='operasional')html=renderOperationalPage(s);
if(page==='keuangan')html=renderFinancePage(s);
if(page==='laporan'){let sales=data.sales.filter(t=>(!rangeFrom||day(t.created_at)>=rangeFrom)&&(!rangeTo||day(t.created_at)<=rangeTo)),omzet=sum(sales,t=>t.total),hpp=sum(sales,t=>sum(t.items,i=>i.cost*i.qty));html=head('Laporan','Laba kotor belum dikurangi biaya operasional. Filter tanggal berdasarkan WITA.',btn('csv','Unduh CSV')+btn('print','Cetak / PDF',true))+`<section class="panel noprint"><div class="row">${field('from','Dari tanggal',rangeFrom,'date')}${field('to','Sampai tanggal',rangeTo,'date')}${btn('filter','Terapkan')}</div></section>`+cards([['Omzet',money(omzet)],['HPP',money(hpp)],['Laba kotor',money(omzet-hpp)],['Nilai stok saat ini',money(sum(data.products,p=>p.stock*p.cost))]])+`<section class="panel">${saleTable(sales)}</section>`;}
if(page==='akses')html=head('Pengguna & Hak Akses','Atur role, status, dan checklist akses per fitur untuk setiap akun.')+`<section class="panel">${table(['Nama','Email','Role','Status','Aksi'],data.users.map(u=>[esc(u.name),esc(u.email),esc(u.role),u.active?'Aktif':'Menunggu / Nonaktif',btn('user','Atur akses',true,u.id)]))}</section>`;
if(page==='panduan')html=head('Panduan Operasional','Panduan sesuai fungsi aplikasi versi 2.0')+`<section class="panel"><p>Mulai dari pengaturan akun, barang, stok awal, lalu buka shift.</p><a class="btn" href="/panduan.html" target="_blank" rel="noopener">Buka buku panduan</a></section>`;
$('#content').innerHTML=(activeOpname()?'<div class="notice"><strong>SEDANG PROSES STOCK OPNAME</strong> · Penjualan, pembelian, dan perubahan data barang dikunci sampai hasil diproses.</div>':'')+html+'<p class="small" style="margin-top:20px">Larisindo POS 2.34 · Data tersimpan di Supabase · Perlu koneksi internet</p>';if(page==='kasir'&&cashierTab==='transaksi'){productsUI();cartUI();$('#search').oninput=productsUI;$('#search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();let p=data.products.find(p=>p.barcode===e.target.value||p.sku===e.target.value);if(p){add(p.id);e.target.value='';productsUI()}}};}}
let posCategory='Semua';
function productsUI(){const search=$('#search');if(!search)return;const q=search.value.toLowerCase().trim();const cats=['Semua',...new Set(data.products.map(p=>p.category).filter(Boolean)),'Jasa'];const holder=$('#posCategories');if(!cats.includes(posCategory))posCategory='Semua';holder.innerHTML=cats.map(c=>'<button type="button" class="pos-chip '+(posCategory===c?'selected':'')+'" data-action="pos-category" data-id="'+esc(c)+'">'+esc(c)+'</button>').join('');const products=data.products.filter(p=>(posCategory==='Semua'||p.category===posCategory)&&[p.name,p.sku,p.barcode].some(v=>String(v||'').toLowerCase().includes(q)));const svcs=services.filter(s=>s.active&&(posCategory==='Semua'||posCategory==='Jasa')&&[s.name,s.sku].some(v=>String(v||'').toLowerCase().includes(q)));$('#catalogCount').textContent=(products.length+svcs.length)+' item';const cards=products.map(p=>'<button class="product pos-product" data-action="add" data-id="'+p.id+'" '+(p.stock<1?'disabled':'')+'><span class="pos-product-art"><span class="pos-product-placeholder">▦</span></span><span class="pos-product-name">'+esc(p.name)+'</span><span class="pos-product-meta">'+esc(p.sku||'Produk')+' · Stok '+p.stock+'</span><span class="pos-product-bottom"><strong>'+money(p.price)+'</strong><span class="pos-add">+</span></span></button>').join('')+svcs.map(s=>'<button class="product pos-product" data-action="add-service" data-id="'+s.id+'"><span class="pos-product-art"><span class="pos-product-placeholder">✦</span></span><span class="pos-product-name">'+esc(s.name)+'</span><span class="pos-product-meta">Jasa · Tanpa stok</span><span class="pos-product-bottom"><strong>'+money(s.price)+'</strong><span class="pos-add">+</span></span></button>').join('');$('#productGrid').innerHTML=cards||'<div class="pos-empty">Tidak ada produk yang cocok. Coba kata kunci atau kategori lain.</div>'}
function addService(id){if(!ownShift())return notify('Buka shift terlebih dahulu');if(localStorage.getItem('larisindo.pending.'+data.me.id))return notify('Selesaikan pembayaran tertunda dahulu');const s=services.find(x=>x.id===id&&x.active);if(!s)return notify('Jasa tidak tersedia');const c=cart.find(x=>x.id===id&&x.type==='service');if(c)c.qty++;else cart.push({id,qty:1,type:'service'});cartUI()}
function add(id){if(!ownShift())return notify('Buka shift terlebih dahulu');if(localStorage.getItem('larisindo.pending.'+data.me.id))return notify('Selesaikan pembayaran tertunda dahulu');let p=data.products.find(p=>p.id===id),c=cart.find(c=>c.id===id);if((c?.qty||0)>=p.stock)return notify('Stok tidak cukup');if(c)c.qty++;else cart.push({id,qty:1});cartUI()}
function cartUI(){let total=sum(cart,c=>(c.type==='service'?services.find(s=>s.id===c.id):data.products.find(p=>p.id===c.id))?.price*c.qty);$('#cartArea').innerHTML=cart.map(c=>{let p=c.type==='service'?services.find(s=>s.id===c.id):data.products.find(p=>p.id===c.id);return `<div class="cartline"><div><strong>${esc(p.name)}</strong><div>${money(p.price)} × ${c.qty}</div></div><div>${btn('minus','−',true,c.id)} ${c.qty} ${btn(c.type==='service'?'add-service':'add','+',true,c.id)}</div></div>`}).join('')+`<div class="total"><span>Total</span><span>${money(total)}</span></div>${select('method','Metode pembayaran',[['Tunai','Tunai'],['Transfer','Transfer'],['QRIS','QRIS'],['Piutang','Piutang (kredit)']])}<div id="paymentFields"></div>${btn('pay','Bayar '+money(total))}`;$('#cartArea [name=method]').value=method;$('#cartArea [name=method]').onchange=e=>{method=e.target.value;paymentFields()};paymentFields();$('#cartArea [data-action=pay]').disabled=!cart.length||!ownShift()||busy;}
function paymentFields(){$('#paymentFields').innerHTML=method==='Tunai'?field('tendered','Uang diterima (Rp)','','number','min="0" step="1" required'):method==='Piutang'?field('customer','Nama pelanggan','','text','required minlength="2"')+field('due','Jatuh tempo','','date','required'):field('reference','Nomor referensi pembayaran','','text','minlength="3" required')+'<label class="field">Foto bukti pembayaran · Kamera<input type="file" id="paymentCamera" accept="image/*" capture="environment"></label><label class="field">Atau pilih file foto/PDF<input type="file" id="paymentFile" accept="image/jpeg,image/png,image/webp,application/pdf"></label><p class="small">Foto/PDF maksimal 10 MB. Bukti disimpan privat; Finance dapat memeriksanya.</p>'}
function modal(title,body,fn){if($('#dialog').open)$('#dialog').close();$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialogError').hidden=true;saveHandler=fn;$('#dialog').showModal()}
$('#dialogForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('#save').disabled=true;$('#dialogError').hidden=true;try{await saveHandler(Object.fromEntries(new FormData(e.target)));$('#dialog').close();await sync();notify('Tersimpan')}catch(err){$('#dialogError').textContent=err.message;$('#dialogError').hidden=false}finally{busy=false;$('#save').disabled=false}};
async function uploadPaymentEvidence(saleId,file){
 if(!file)return;
 if(file.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw Error('Bukti pembayaran harus JPG/PNG/WebP/PDF maksimal 10 MB');
 const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'})[file.type],path=saleId+'/bukti.'+ext;
 const response=await fetch(URL+'/storage/v1/object/larisindo-payment-evidence/'+path,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!response.ok&&response.status!==409)throw Error('Gagal upload bukti: '+(await response.text()).slice(0,150));
 await rpc('pos_payment_evidence',{p_sale:saleId,p_path:path,p_mime:file.type});
}
async function openPaymentEvidence(saleId){
 const e=paymentEvidence.find(x=>x.sale_id===saleId);if(!e)return notify('Belum ada lampiran bukti');
 const r=await request('/storage/v1/object/sign/larisindo-payment-evidence/'+e.storage_path,{expiresIn:120});
 window.open(URL+'/storage/v1'+r.signedURL,'_blank','noopener');
}
async function pay(retry=false){if(busy)return;const key='larisindo.pending.'+data.me.id;let args,proofFile=null;try{if(retry){args=JSON.parse(localStorage.getItem(key)||'null');if(!args)return notify('Tidak ada pembayaran tertunda')}else{if(localStorage.getItem(key))return notify('Periksa pembayaran tertunda terlebih dahulu');if(!cart.length||!ownShift())return notify('Keranjang atau shift tidak tersedia');proofFile=document.querySelector('#paymentCamera')?.files[0]||document.querySelector('#paymentFile')?.files[0]||null;if(proofFile&&(proofFile.size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(proofFile.type)))return notify('Foto/PDF maksimal 10 MB');let t=$('[name=tendered]')?.value,ref=$('[name=reference]')?.value;args={p_id:crypto.randomUUID(),p_shift:ownShift().id,p_items:cart.map(c=>({...c})),p_method:method,p_tendered:method==='Tunai'?Number(t):null,p_reference:ref||''};if(method==='Tunai'&&(!t||Number(t)<sum(cart,c=>(c.type==='service'?services.find(s=>s.id===c.id):data.products.find(p=>p.id===c.id)).price*c.qty)))return notify('Uang diterima belum cukup');if(method==='Piutang'){args.p_customer=$('[name=customer]')?.value.trim();args.p_due=$('[name=due]')?.value;if(!args.p_customer||!args.p_due)return notify('Isi pelanggan dan jatuh tempo')}else if(method!=='Tunai'&&args.p_reference.trim().length<3)return notify('Isi bukti pembayaran');localStorage.setItem(key,JSON.stringify(args))}busy=true;document.querySelectorAll('[data-action=pay],[data-action=retry]').forEach(b=>b.disabled=true);if(args.p_method==='Piutang')await rpc('pos_checkout_credit',{p_id:args.p_id,p_shift:args.p_shift,p_items:args.p_items,p_customer:args.p_customer,p_due:args.p_due});else await rpc('pos_checkout',args);localStorage.removeItem(key);cart=[];let uploadError=null;if(proofFile){try{await uploadPaymentEvidence(args.p_id,proofFile)}catch(err){uploadError=err.message}}await sync();showReceipt(args.p_id);notify(uploadError?'Transaksi tersimpan, bukti gagal diunggah: '+uploadError:'Transaksi berhasil tersimpan')}catch(e){if(e.status>=400&&e.status<500&&e.status!==401){localStorage.removeItem(key);notify(e.message+' — Transaksi ditolak; perbaiki isian lalu bayar kembali.')}else notify(e.message+' — Periksa/ulangi dengan ID transaksi yang sama.');await sync()}finally{busy=false;if(page==='kasir'&&$('#cartArea'))cartUI();}}
function showReceipt(id){let t=data.sales.find(x=>x.id===id);if(!t)return;const credit=cashierCredits.find(x=>x.id===id);const creditRemaining=credit?Number(credit.remaining):Number(t.total);let h=`<div id="receipt"><h2>LARISINDO MART</h2><p>LRS-${t.receipt_no} · ${date(t.created_at)}</p><p>Petugas: ${esc(data.users.find(u=>u.id===t.cashier_id)?.name||t.cashier_id)}</p>${table(['Barang','Jumlah','Harga','Subtotal'],t.items.map(i=>[esc(i.name),i.qty,money(i.price),money(i.price*i.qty)]))}<div class="total">Total ${money(t.total)}</div><p>Metode: ${esc(t.method)}</p>${t.method==='Tunai'?`<p>Uang: ${money(t.tendered)} · Kembali: ${money(t.change_due)}</p>`:`<p>Referensi: ${esc(t.reference)} · ${t.verified_at?'Terverifikasi Finance':'Menunggu verifikasi Finance'}</p>`}${t.method==='Piutang'?`<p>Tagihan: ${money(t.total)} · Dibayar: ${money(credit?.paid||0)} · Sisa: ${money(creditRemaining)}</p>`:''}<p>Terima kasih sudah berbelanja.</p></div>${btn('print-receipt','Cetak struk')}${t.method==='Piutang'&&creditRemaining>0&&(finance()||t.cashier_id===data.me.id)?btn('cashier-pay-credit','Bayar Piutang',false,t.id):''}`;modal('Nota Penjualan',h,async()=>{});$('#save').hidden=true;$('#cancel').textContent='Tutup';}
// CSV import intentionally writes only product master data; never changes stock or existing HPP.
const productCSVColumns=['sku','barcode','nama','kategori','satuan','harga_jual','hpp_awal','stok_minimum'];
function csvQuote(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function downloadProductTemplate(){
 const example=['BRG-001','8991234567890','Contoh Produk','Umum','pcs','12000','9000','10'];
 const csv='\ufeff'+[productCSVColumns,example].map(row=>row.map(csvQuote).join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=window.URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='Template-Produk-Larisindo.csv';link.click();setTimeout(()=>window.URL.revokeObjectURL(url),1000);
}
function parseCSV(text){
 text=text.replace(/^\ufeff/,'');const first=text.split(/\r?\n/,1)[0]||'';
 const counts=[';',',','\t'].map(d=>[d,(first.match(new RegExp(d==='\t'?'\\t':d===';'?';':',','g'))||[]).length]);
 const delimiter=counts.sort((a,b)=>b[1]-a[1])[0][0];
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}
  else if(c==='"')quoted=true;else if(c===delimiter){row.push(cell.trim());cell=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}else cell+=c;
 }
 if(quoted)throw Error('CSV memiliki tanda kutip yang belum ditutup');
 row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);
 return rows;
}
function prepareProductCSV(text){
 const rows=parseCSV(text);if(rows.length<2)throw Error('CSV kosong atau tidak memiliki baris produk');
 const columns=rows.shift().map(s=>s.toLowerCase().trim().replace(/\s+/g,'_'));
 for(const c of productCSVColumns)if(!columns.includes(c))throw Error('Kolom wajib tidak ditemukan: '+c);
 const knownSku=new Map(data.products.map(p=>[p.sku.toLowerCase(),p]));
 const knownBarcode=new Map(data.products.filter(p=>p.barcode).map(p=>[p.barcode.toLowerCase(),p]));
 const seenSku=new Set(),seenBarcode=new Set();
 return rows.map((values,i)=>{
  const r=Object.fromEntries(columns.map((c,j)=>[c,(values[j]||'').trim()]));
  const sku=r.sku||'',barcode=r.barcode||'',name=r.nama||'',category=r.kategori||'Umum',unit=r.satuan||'pcs';
  const price=Number(r.harga_jual),cost=Number(r.hpp_awal),minimum=Number(r.stok_minimum);
  let error='';
  if(!sku||sku.length>80||!name||name.length>160||!unit)error='SKU/nama/satuan tidak valid';
  else if(!r.harga_jual||!Number.isFinite(price)||price<=0||!r.hpp_awal||!Number.isFinite(cost)||cost<0||!r.stok_minimum||!Number.isInteger(minimum)||minimum<0)error='Harga/HPP/stok minimum tidak valid';
  else if(seenSku.has(sku.toLowerCase())||(barcode&&seenBarcode.has(barcode.toLowerCase())))error='SKU/barcode duplikat di CSV';
  seenSku.add(sku.toLowerCase());if(barcode)seenBarcode.add(barcode.toLowerCase());
  const bySku=knownSku.get(sku.toLowerCase()),byBarcode=barcode?knownBarcode.get(barcode.toLowerCase()):null;
  if(bySku&&byBarcode&&bySku.id!==byBarcode.id)error='SKU dan barcode merujuk dua produk berbeda';
  return {line:i+2,sku,barcode,name,category,unit,price,cost,minimum,existing:bySku||byBarcode||null,error};
 });
}
function openProductImport(){
 if(!can('produk'))return notify('Akses tidak diizinkan');
 let parsed=[];
 const body=`<p>Pilih CSV dengan pemisah titik koma (;) atau koma (,). Unduh template untuk urutan kolom yang benar.</p>
 <label class="field">File CSV<input id="productCsvFile" type="file" accept=".csv,text/csv,text/plain" required></label>
 ${select('importMode','Jika SKU/barcode sudah ada',[['skip','Lewati produk lama'],['update','Perbarui nama, kategori, satuan, harga jual, stok minimum (HPP dan stok tetap)']])}
 <div id="productCsvPreview" class="notice" aria-live="polite">Belum ada file dipilih.</div>
 <p class="small">Stok tidak diimpor. HPP hanya untuk produk baru. Maksimal 1.000 baris per file. Import yang sudah berhasil tidak dibatalkan otomatis jika baris berikutnya gagal.</p>`;
 editModal('Import Produk CSV',body,async()=>{
  if(!parsed.length)throw Error('Pilih file CSV yang valid dahulu');
  if(parsed.some(r=>r.error))throw Error('Perbaiki semua baris yang bermasalah sebelum import');
  const mode=$('#dialog [name=importMode]').value;
  const selected=parsed.filter(r=>mode==='update'||!r.existing);
  if(!selected.length)throw Error('Tidak ada produk baru untuk diimpor');
  if(!confirm('Impor '+selected.length+' produk? Stok dan HPP barang lama tidak akan diubah.'))throw Error('Import dibatalkan');
  let success=0;const failures=[];
  for(const r of selected){try{
   await rpc('pos_product',{p_id:r.existing?.id||null,p_sku:r.sku,p_barcode:r.barcode,p_name:r.name,p_category:r.category,p_unit:r.unit,p_price:r.price,p_cost:r.existing?Number(r.existing.cost):r.cost,p_minimum:r.minimum});success++;
  }catch(e){failures.push('Baris '+r.line+' ('+r.sku+'): '+e.message)}}
  if(failures.length)throw Error(success+' berhasil, '+failures.length+' gagal. '+failures.slice(0,3).join(' | ')+'; segarkan data sebelum mengulangi.');
  notify(success+' produk berhasil diimpor; '+(parsed.length-selected.length)+' dilewati');
 });
 $('#productCsvFile').addEventListener('change',async e=>{
  parsed=[];const el=$('#productCsvPreview'),file=e.target.files?.[0];if(!file)return;
  if(file.size>2_000_000){el.textContent='File terlalu besar (maksimum 2 MB)';return}
  try{parsed=prepareProductCSV(await file.text());if(parsed.length>1000)throw Error('Maksimum 1.000 baris per file');
   const invalid=parsed.filter(r=>r.error),existing=parsed.filter(r=>r.existing&&!r.error);
   el.innerHTML='<strong>'+parsed.length+' baris · '+existing.length+' sudah ada · '+invalid.length+' bermasalah</strong>'+
   table(['Baris','SKU','Nama','Harga','Status'],parsed.slice(0,15).map(r=>[r.line,esc(r.sku),esc(r.name),money(r.price),esc(r.error|| (r.existing?'Sudah ada':'Baru'))]))+
   (parsed.length>15?'<p>Menampilkan 15 baris pertama.</p>':'')+
   (invalid.length?'<p class="error">'+invalid.slice(0,8).map(r=>'Baris '+r.line+': '+esc(r.error)).join('; ')+'</p>':'');
  }catch(err){parsed=[];el.textContent=err.message}
 });
}

const optionsForSKU=sku=>{const prefix=String(sku||'').split('-')[0];return ["MKN","MNM","SNK","SMB","BMB","KBR","PRW","KSH","RTG","ATK","BYI","FRZ","KMS","JPK","JBS","BMS","SYR","UMM"].includes(prefix)?prefix:'UMM'};
const purchaseLine=()=>'<tr><td><select class="purchase-sku" style="min-width:145px"><option value="MKN">MKN · Makanan pokok</option><option value="MNM">MNM · Minuman</option><option value="SNK">SNK · Snack & biskuit</option><option value="SMB">SMB · Susu & bubuk</option><option value="BMB">BMB · Bumbu masak</option><option value="KBR">KBR · Kebersihan</option><option value="PRW">PRW · Perawatan tubuh</option><option value="KSH">KSH · Kesehatan</option><option value="RTG">RTG · Rumah tangga</option><option value="ATK">ATK · Alat tulis</option><option value="BYI">BYI · Perlengkapan bayi</option><option value="FRZ">FRZ · Frozen food</option><option value="KMS">KMS · Kemasan</option><option value="JPK">JPK · Jasa packing</option><option value="JBS">JBS · Jajan basah</option><option value="BMS">BMS · Bumbu segar</option><option value="SYR">SYR · Sayur segar</option><option value="UMM">UMM · Lainnya</option></select></td><td><input class="purchase-scan" placeholder="Scan barcode" autocomplete="off" style="min-width:130px"></td><td><input class="purchase-name" placeholder="Ketik nama barang" list="purchase-product-names" required maxlength="160" autocomplete="off" style="min-width:220px"><input type="hidden" class="purchase-product"></td><td><input class="purchase-location" placeholder="Gudang 1 / Rak A1" maxlength="100" list="purchase-location-list" style="min-width:160px"></td><td><input class="purchase-qty" type="number" min="1" max="999999" value="1" required style="width:72px"></td><td><select class="purchase-unit"><option value="pcs">pcs</option><option value="dus">dus</option><option value="bal">bal</option><option value="renceng">renceng</option></select><input class="purchase-factor" type="number" min="1" max="999999" value="1" title="Isi pcs per kemasan" style="width:85px" required></td><td><input class="purchase-cost" type="number" min="0" step="0.01" value="0" required style="width:110px"></td><td><input class="purchase-discount" type="number" min="0" step="0.01" value="0" required style="width:100px"></td><td class="purchase-line-total">Rp0</td><td><button class="btn secondary purchase-remove" type="button">×</button></td></tr>';
function openPurchaseDoc(){
 if(!can('pembelian'))return notify('Akses tidak diizinkan');
 const id=crypto.randomUUID();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const body='<div class="formgrid">'+'<label class="field">Pemasok<select name="vendor" required><option value="">Pilih pemasok</option>'+[...new Set(purchaseDocs.map(d=>d.vendor).filter(Boolean))].sort().map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'<option value="__new__">+ Pemasok baru</option></select></label><label class="field" id="new-vendor-wrap" style="display:none">Nama pemasok baru<input name="vendor_new" maxlength="160" placeholder="Nama pemasok"></label>'+field('invoice','Nomor nota','','text','required maxlength="120"')+field('invoice_date','Tanggal nota',today,'date','required')+select('source','Sumber pembayaran',[['Transfer BSI Larisindo','Transfer BSI Larisindo'],['Kas laci','Kas laci'],['Pengajuan Finance','Pengajuan Finance']])+'</div>'+
 '<p>Nama barang bisa diketik langsung. Nama/barcode yang cocok dengan master akan otomatis menggunakan barang yang sama. Untuk dus/bal/renceng isi jumlah pcs per kemasan.</p><datalist id="purchase-product-names">'+data.products.map(p=>'<option value="'+esc(p.name)+'"></option>').join('')+'</datalist>'+
 '<datalist id="purchase-location-list">'+[...new Set(data.products.map(p=>p.storage_location).filter(Boolean))].map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist><div style="overflow:auto"><table><thead><tr><th>SKU (kategori)</th><th>Barcode</th><th>Nama barang</th><th>Gudang / Rak</th><th>Qty</th><th>Satuan / isi pcs</th><th>Harga/kemasan</th><th>Diskon</th><th>Jumlah</th><th></th></tr></thead><tbody id="purchase-lines"></tbody></table></div>'+
 '<button type="button" class="btn secondary" id="purchase-add">+ Tambah barang</button>'+
 '<div class="formgrid" style="margin-top:16px">'+'<label class="field">Jenis diskon nota<select name="invoice_discount_type"><option value="rp">Rupiah (Rp)</option><option value="percent">Persen (%)</option></select></label>'+field('invoice_discount','Nilai diskon nota',0,'number','min="0" step="0.01" required')+field('shipping','Ongkir (Rp)',0,'number','min="0" step="0.01" required')+field('tax','Pajak (Rp)',0,'number','min="0" step="0.01" required')+
 '<label class="field">Foto/PDF nota (maks. 10 MB)<input type="file" name="attachment" accept="image/jpeg,image/png,image/webp,application/pdf"></label></div>'+
 '<div id="purchase-totals" class="notice" aria-live="polite"></div><p class="small">Ongkir, diskon, dan pajak dialokasikan ke HPP persediaan. Nota disimpan atomik. Lampiran disimpan privat setelah transaksi berhasil.</p>';
 $('#save').hidden=false;$('#cancel').textContent='Batal';modal('Nota pembelian · banyak barang',body,async f=>{
 const lines=[...document.querySelectorAll('#purchase-lines tr')].map(tr=>({product_id:tr.querySelector('.purchase-product').value||null,name:tr.querySelector('.purchase-name').value.trim(),barcode:tr.querySelector('.purchase-scan').value.trim(),sku_prefix:tr.querySelector('.purchase-sku').value,storage_location:tr.querySelector('.purchase-location').value.trim(),qty:Number(tr.querySelector('.purchase-qty').value),unit:tr.querySelector('.purchase-unit').value,factor:Number(tr.querySelector('.purchase-factor').value),cost:Number(tr.querySelector('.purchase-cost').value),discount:Number(tr.querySelector('.purchase-discount').value)}));
 if(!lines.length||lines.some(l=>!l.name||!Number.isInteger(l.factor)||l.factor<1||l.factor*l.qty>999999||(l.unit==='pcs'&&l.factor!==1)||!Number.isInteger(l.qty)||l.qty<1||l.qty>999999||!Number.isFinite(l.cost)||l.cost<0||!Number.isFinite(l.discount)||l.discount<0||l.discount>l.cost*l.qty)||new Set(lines.map(l=>(l.product_id||l.barcode||l.name).toLowerCase())).size!==lines.length)throw Error('Periksa barang, jumlah, harga, diskon, dan duplikasi produk');
 if(f.vendor==='__new__'&&(!f.vendor_new||f.vendor_new.trim().length<2))throw Error('Isi nama pemasok baru');if(f.invoice_discount_type==='percent'&&Number(f.invoice_discount)>100)throw Error('Diskon persen maksimal 100%');const file=document.querySelector('[name=attachment]').files[0];
 if(file&&(file.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)))throw Error('Lampiran hanya PDF/JPG/PNG/WebP, maksimal 10 MB');
 await rpc('pos_receive_doc_v2',{p_id:id,p_vendor:f.vendor==='__new__'?f.vendor_new.trim():f.vendor,p_invoice:f.invoice,p_date:f.invoice_date,p_items:lines,p_discount:f.invoice_discount_type==='percent'?Math.round(lines.reduce((sum,l)=>sum+l.qty*l.cost-l.discount,0)*Number(f.invoice_discount)/100*100)/100:Number(f.invoice_discount),p_shipping:Number(f.shipping),p_tax:Number(f.tax),p_source:f.source,p_shift:f.source==='Kas laci'?currentShift()?.id||null:null});
 if(file){
  const ext=({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type],path=id+'/nota.'+ext;
  try{
   let response=await fetch(URL+'/storage/v1/object/larisindo-purchase-notes/'+path,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file});
   if(!response.ok)throw Error((await response.json().catch(()=>({}))).message||'Upload gagal');
   await rpc('pos_purchase_attachment',{p_id:id,p_path:path});
  }catch(err){notify('Nota tersimpan, tetapi lampiran gagal: '+err.message);return;}
 }
 });
 const vendorSelect=document.querySelector('[name=vendor]');vendorSelect.addEventListener('change',()=>{document.querySelector('#new-vendor-wrap').style.display=vendorSelect.value==='__new__'?'':'none'});const tbody=document.querySelector('#purchase-lines');
 const lookupBarcode=raw=>{const code=String(raw||'').replace(/[\\s\\u200B-\\u200D]/g,'').trim().toLowerCase();if(!code)return null;const p=data.products.find(x=>[x.barcode,x.sku].some(v=>String(v||'').replace(/[\\s\\u200B-\\u200D]/g,'').trim().toLowerCase()===code));if(p)return p;return null};
 const fillBarcode=tr=>{const input=tr.querySelector('.purchase-scan'),p=lookupBarcode(input.value);if(!p)return false;tr.querySelector('.purchase-product').value=p.id;tr.querySelector('.purchase-name').value=p.name;tr.querySelector('.purchase-name').readOnly=true;input.value=p.barcode||'';tr.querySelector('.purchase-sku').value=optionsForSKU(p.sku);tr.querySelector('.purchase-location').value=p.storage_location||'';if(!tr.querySelector('.purchase-cost').dataset.edited)tr.querySelector('.purchase-cost').value=(p.cost||0)*Number(tr.querySelector('.purchase-factor').value||1);return true};
 const recalc=()=>{
  let subtotal=0,disc=0;
  tbody.querySelectorAll('tr').forEach(tr=>{
   const q=Number(tr.querySelector('.purchase-qty').value)||0,c=Number(tr.querySelector('.purchase-cost').value)||0,d=Number(tr.querySelector('.purchase-discount').value)||0;
   subtotal+=q*c;disc+=d;tr.querySelector('.purchase-line-total').textContent=money(q*c-d);
  });
  const discountValue=Number(document.querySelector('[name=invoice_discount]').value)||0,inv=document.querySelector('[name=invoice_discount_type]').value==='percent'?Math.round((subtotal-disc)*discountValue)/100:discountValue,ship=Number(document.querySelector('[name=shipping]').value)||0,tax=Number(document.querySelector('[name=tax]').value)||0;
  document.querySelector('#purchase-totals').textContent='Subtotal '+money(subtotal)+' · Diskon barang '+money(disc)+' · Diskon nota '+money(inv)+' · Ongkir '+money(ship)+' · Pajak '+money(tax)+' · TOTAL '+money(subtotal-disc-inv+ship+tax);
 };
 document.querySelector('#purchase-add').onclick=()=>{tbody.insertAdjacentHTML('beforeend',purchaseLine());tbody.lastElementChild.querySelector('.purchase-factor').disabled=true;tbody.lastElementChild.querySelector('.purchase-name').focus();recalc()};
 tbody.addEventListener('input',e=>{if(e.target.matches('.purchase-scan')){const tr=e.target.closest('tr');tr.querySelector('.purchase-name').readOnly=false;if(!fillBarcode(tr)){tr.querySelector('.purchase-product').value='';}}if(e.target.matches('.purchase-cost'))e.target.dataset.edited='1';if(e.target.matches('.purchase-name'))e.target.closest('tr').querySelector('.purchase-product').value='';recalc()});
 const matchProduct=tr=>{const name=tr.querySelector('.purchase-name').value.trim().toLowerCase(),code=tr.querySelector('.purchase-scan').value.trim();const p=(code&&data.products.find(x=>x.barcode===code||x.sku===code))||data.products.find(x=>x.name.toLowerCase()===name);tr.querySelector('.purchase-product').value=p?.id||'';if(p){tr.querySelector('.purchase-name').value=p.name;tr.querySelector('.purchase-location').value=p.storage_location||'';if(!tr.querySelector('.purchase-cost').dataset.edited)tr.querySelector('.purchase-cost').value=(p.cost||0)*Number(tr.querySelector('.purchase-factor').value||1)}return p};
 tbody.addEventListener('change',e=>{const tr=e.target.closest('tr');if(e.target.matches('.purchase-scan'))fillBarcode(tr);if(e.target.matches('.purchase-name'))matchProduct(tr);if(e.target.matches('.purchase-unit')){const factor=tr.querySelector('.purchase-factor');if(e.target.value==='pcs')factor.value=1;factor.disabled=e.target.value==='pcs'}if(e.target.matches('.purchase-factor')){const p=matchProduct(tr);if(p&&!tr.querySelector('.purchase-cost').dataset.edited)tr.querySelector('.purchase-cost').value=(p.cost||0)*Number(e.target.value||1)}recalc()});
 tbody.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!e.target.matches('.purchase-scan'))return;
  e.preventDefault();const scan=e.target.value.trim();
  const p=lookupBarcode(scan);
  if(!p){const tr=e.target.closest('tr');tr.querySelector('.purchase-name').focus();notify('Barcode baru: ketik nama barang sekali, selanjutnya barcode akan dikenali.');return}
  const tr=e.target.closest('tr');fillBarcode(tr);
  tr.querySelector('.purchase-qty').focus();tr.querySelector('.purchase-qty').select();recalc();
 });
 tbody.addEventListener('click',e=>{if(e.target.matches('.purchase-remove')){e.target.closest('tr').remove();recalc()}});
 document.querySelectorAll('[name=invoice_discount],[name=invoice_discount_type],[name=shipping],[name=tax]').forEach(el=>el.addEventListener('input',recalc));
 document.querySelector('#purchase-add').click();
}
async function showPurchaseDoc(id){
 const d=purchaseDocs.find(x=>x.id===id);if(!d)return notify('Nota tidak ditemukan');
 const body='<p><strong>'+esc(d.vendor)+' · '+esc(d.invoice)+'</strong><br>'+esc(d.invoice_date)+' · '+esc(d.source)+'</p>'+
 table(['Barang','Barcode','Qty','Harga/unit','Diskon','Biaya dialokasikan','Total'],d.items.map(i=>[esc(i.product_name),esc(i.barcode||'-'),(i.purchase_qty||i.qty)+' '+esc(i.purchase_unit||'pcs')+' ('+(i.units_per_pack||1)+' pcs/kemasan)',money(i.unit_cost),money(i.discount),money(i.allocated_extra),money(i.line_total)]))+
 '<p>Subtotal: '+money(d.subtotal)+' · Diskon barang: '+money(d.item_discount)+' · Diskon nota: '+money(d.invoice_discount)+' · Ongkir: '+money(d.shipping)+' · Pajak: '+money(d.tax)+'</p><h2>Total '+money(d.total)+'</h2>'+
 (d.attachment_path?'<button type="button" class="btn secondary" id="purchase-attachment">Buka foto/PDF nota</button>':'<p>Belum ada lampiran.</p>');
 $('#save').hidden=true;$('#cancel').textContent='Tutup';modal('Detail nota pembelian',body,()=>{});
 if(d.attachment_path)document.querySelector('#purchase-attachment').onclick=async()=>{
  try{const res=await request('/storage/v1/object/sign/larisindo-purchase-notes/'+d.attachment_path,{expiresIn:120});window.open(URL+'/storage/v1'+res.signedURL,'_blank','noopener')}catch(e){notify('Lampiran gagal dibuka: '+e.message)}
 };
}

function editModal(title,html,fn){$('#save').hidden=false;$('#cancel').textContent='Batal';modal(title,html,fn)}
async function action(a,id){if(a==='pos-category'){posCategory=id;return productsUI()}if(a==='add-service')return addService(id);if(a==='service-new')return openServiceForm(null);if(a==='service-edit')return openServiceForm(id);if(a==='opname-email')return shareOpnameTemplate(id);if(a==='opname-cancel')return cancelOpnameOrder(id);if(a==='opname-template')return downloadOpnameTemplate(id,false);if(a==='opname-template-xlsx')return downloadOpnameTemplate(id,true);if(a==='opname-import')return openOpnameImport(id);if(a==='opname-transfer')return openStockTransfer();if(a==='opname-adjust-reason')return openStockReason();if(a==='opname-start')return editModal('Perintah Stock Opname',field('number','Nomor perintah','SO-'+day(new Date()).replaceAll('-',''),'text','required minlength="3"')+field('location','Lokasi / Gudang','Gudang Utama','text','required')+field('notes','Keterangan')+'<div class="notice"><strong>Template Stock Opname</strong><p class="small">Unduh daftar barang dalam format Excel atau CSV, isi kolom stok fisik, lalu impor hasilnya setelah perintah dibuat.</p>'+btn('opname-template','Unduh Template CSV',true)+btn('opname-template-xlsx','Unduh Template Excel',true)+btn('opname-email','Kirim Template via Email',true)+'</div>',f=>rpc('pos_opname_start',{p_id:crypto.randomUUID(),p_number:f.number,p_location:f.location,p_notes:f.notes}));
if(a==='opname-count')return openOpnameCount(id);
if(a==='opname-report')return showOpnameReport(id);
if(a==='opname-process')return processOpname(id);
if(a==='cashier-pay-credit')return openCreditPayment(id);
if(a==='product-tab'){productTab=id;return render()}
if(a==='cashier-tab'){cashierTab=id;return render()}
if(a==='cashier-week-prev'){cashierWeekOffset--;return render()}
if(a==='cashier-week-next'){cashierWeekOffset++;return render()}
if(a==='credit-payment')return openCreditPayment();
if(a==='add')return add(id);if(a==='minus'){let c=cart.find(c=>c.id===id);if(c&&--c.qty<=0)cart=cart.filter(c=>c.id!==id);return cartUI()}if(a==='pay'||a==='retry'){if(activeOpname())return notify('Sedang proses stock opname. Penjualan dikunci.');return pay(a==='retry')}if(a==='receipt')return showReceipt(id);if(a==='payment-evidence')return openPaymentEvidence(id);if(a==='print')return window.print();if(a==='print-receipt'){let w=window.open('','_blank');if(!w)return notify('Izinkan pop-up untuk mencetak');w.document.write('<!doctype html><html><head><title>Nota Larisindo</title><style>body{font:12px monospace;max-width:320px;margin:auto}table{width:100%}td,th{text-align:left;padding:6px 0}button{display:none}@media print{@page{size:80mm auto;margin:4mm}}</style></head><body>'+$('#receipt').innerHTML+'</body></html>');w.document.close();w.onload=()=>w.print();return}
if(a==='open'&&(page==='operasional'||(page==='kasir'&&cashierTab==='laci'))){const requestId=crypto.randomUUID();return editModal('Buka shift',field('opening','Uang fisik awal (Rp)',500000,'number','min="0" max="1000000000" required')+'<p>Hitung uang yang benar-benar diterima. Hanya satu shift dapat aktif pada laci bersama.</p>',f=>rpc('pos_open_shift',{p_id:requestId,p_opening:Number(f.opening)}))}
if(a==='close'&&(page==='operasional'||(page==='kasir'&&cashierTab==='laci'))){let s=ownShift();if(!s)return;return editModal('Tutup shift',`<div class="notice">Kas seharusnya ${money(expected(s))}. Hitung kas fisik; catat alasan jika ada selisih.</div>`+field('counted','Kas fisik (Rp)','','number','min="0" required')+field('note','Catatan / alasan selisih'),f=>rpc('pos_close_shift',{p_id:s.id,p_counted:Number(f.counted),p_note:f.note}))}
if(a==='template-products')return downloadProductTemplate();
if(a==='import-products')return openProductImport();
if(activeOpname()&&['product','import-products','adjust','receive'].includes(a))return notify('Sedang proses stock opname. Perubahan barang dikunci.');
if(a==='product'){
 const p=data.products.find(x=>x.id===id);
 if(!p)return notify('Barang baru harus dimasukkan melalui menu Pembelian → Nota Pembelian.');
 return editModal('Edit harga & lokasi · '+p.name,`<p><strong>${esc(p.name)}</strong> · ${esc(p.sku)} · ${esc(p.barcode||'Tanpa barcode')}</p><div class="formgrid">${field('price','Harga jual (minimal HPP)',p.price,'number','min="1" required')}${field('storage_location','Gudang / Rak',p.storage_location||'','text','maxlength="100" placeholder="Contoh: Gudang 1 / Rak A1"')}</div><p class="small">HPP menggunakan Moving Weighted Average saat pembelian. Nama, SKU dan barcode barang baru hanya diinput lewat Nota Pembelian.</p>`,async f=>{
 if(Number(f.price)<Number(p.cost))throw Error('Harga jual tidak boleh di bawah HPP '+money(p.cost));
 await rpc('pos_product',{p_id:p.id,p_sku:p.sku,p_barcode:p.barcode||'',p_name:p.name,p_category:p.category,p_unit:p.unit,p_price:Number(f.price),p_cost:Number(p.cost),p_minimum:Number(p.minimum)});
 await rpc('pos_set_product_location',{p_product:p.id,p_location:f.storage_location||''});
 });
}
if(a==='adjust'){let p=data.products.find(p=>p.id===id);return editModal('Opname: '+p.name,field('stock','Stok fisik',p.stock,'number','min="0" required')+field('reason','Alasan / berita acara','','text','minlength="5" required')+'<p>Koreksi ini memengaruhi nilai persediaan dan meninggalkan jejak permanen.</p>',f=>rpc('pos_adjust',{p_id:id,p_stock:Number(f.stock),p_reason:f.reason}))}
if(a==='receive')return openPurchaseDoc();
if(a==='purchase-detail')return showPurchaseDoc(id);
if(a==='finance-tab'){financeTab=id;return render()}
if(a==='finance-add'&&page==='operasional')return openFinanceEntry();
if(a==='cash'&&page==='operasional'){let s=currentShift(),requestId=crypto.randomUUID();return editModal('Mutasi kas laci',select('kind','Jenis',[['Setoran keluar','Setoran keluar laci'],['Pengeluaran','Pengeluaran toko'],['Penerimaan lain','Penerimaan lain (bukan penjualan)']])+field('amount','Jumlah (Rp)','','number','min="1" required')+field('note','Tujuan / nomor bukti','','text','minlength="3" required'),f=>rpc('pos_cash_move',{p_id:requestId,p_shift:s.id,p_amount:Number(f.amount)*(f.kind==='Penerimaan lain'?1:-1),p_kind:f.kind,p_note:f.note}))}
if((a==='verify-sale'||a==='verify-shift')&&page==='operasional'){return editModal('Verifikasi Finance','<p>Pastikan rincian transaksi cocok dengan bukti bank / hasil hitung fisik. Verifikasi akan mencatat akun dan waktu pemeriksa.</p>',()=>rpc('pos_verify',{p_kind:a==='verify-sale'?'sale':'shift',p_id:id}))}
if(a==='user'){let u=data.users.find(x=>x.id===id);return editModal('Atur akses '+u.email,field('name','Nama',u.name,'text','required')+select('role','Role',['Super Admin','Finance','Supervisor','Kasir'].map(r=>[r,r]))+select('active','Status',[['true','Aktif'],['false','Nonaktif']])+permissionEditor(u),async f=>{const permissions={};document.querySelectorAll('#dialog .feature-access').forEach(el=>permissions[el.dataset.permission]=el.checked);await rpc('pos_user',{p_id:id,p_role:f.role,p_active:f.active==='true',p_name:f.name});await rpc('pos_permission_save',{p_user:id,p_permissions:permissions})}),($('#dialog [name=role]').value=u.role),($('#dialog [name=active]').value=String(u.active))}
if(a==='filter'){rangeFrom=$('[name=from]').value;rangeTo=$('[name=to]').value;if(rangeFrom&&rangeTo&&rangeFrom>rangeTo)return notify('Rentang tanggal terbalik');return render()}
if(a==='csv'){let rows=data.sales.filter(t=>(!rangeFrom||day(t.created_at)>=rangeFrom)&&(!rangeTo||day(t.created_at)<=rangeTo));let quote=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';let csv='\ufeff'+[['Nota','Tanggal WITA','Metode','Omzet','HPP','Laba kotor','Referensi'],...rows.map(t=>{let h=sum(t.items,i=>i.cost*i.qty);return ['LRS-'+t.receipt_no,date(t.created_at),t.method,t.total,h,t.total-h,t.reference]})].map(row=>row.map(quote).join(';')).join('\r\n');let link=document.createElement('a');link.href=window.URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download='Larisindo-Penjualan.csv';link.click();setTimeout(()=>window.URL.revokeObjectURL(link.href),1000);}}
document.addEventListener('click',async e=>{let b=e.target.closest('[data-page],[data-action]');if(!b)return;if(b.dataset.action&&b.closest('#dialogForm'))e.preventDefault();if(b.dataset.page){if(busy)return;if(b.dataset.page!==page&&cart.length&&!confirm('Keranjang belum dibayar. Pindah halaman?'))return;cart=[];page=b.dataset.page;render();return}try{await action(b.dataset.action,b.dataset.id)}catch(err){notify(err.message)}});
// Supabase confirmation/recovery links use fragment tokens. Remove them immediately from the address bar.
const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('access_token')){setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});history.replaceState(null,'',location.pathname+(hash.get('type')==='recovery'?'?recovery=1':''))}
await sync();if(new URLSearchParams(location.search).get('recovery')==='1'&&session){editModal('Atur kata sandi baru',field('password','Kata sandi baru','','password','minlength="12" required'),async f=>{const res=await fetch(URL+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({password:f.password})});if(!res.ok)throw Error('Gagal mengganti kata sandi');history.replaceState(null,'',location.pathname)})}
