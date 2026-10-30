import {URL,KEY} from './config.js';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'Rp'+Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:0}),date=s=>s?new Date(s).toLocaleString('id-ID',{timeZone:'Asia/Makassar'}):'—',day=s=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Makassar'}).format(new Date(s)),sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0);
let financeEntries=[],financeTab='laba',purchaseDocs=[];let session=null,data=null,page='dashboard',cart=[],busy=false,saveHandler=null,rangeFrom='',rangeTo='',method='Tunai';try{session=JSON.parse(localStorage.getItem('larisindo.session')||'null')}catch{};
const menus=[['dashboard','◫','Dashboard'],['kasir','▣','Kasir'],['produk','▤','Barang & Harga'],['stok','▥','Stok & Opname'],['pembelian','🛒','Pembelian'],['nota','▧','Nota Penjualan'],['operasional','▤','Keuangan Operasional'],['keuangan','▦','Kas & Audit'],['laporan','▥','Laporan'],['akses','♙','Pengguna'],['panduan','?','Panduan']];
const roles={dashboard:['Super Admin','Finance','Supervisor','Kasir'],kasir:['Super Admin','Kasir'],produk:['Super Admin','Supervisor'],stok:['Super Admin','Supervisor'],pembelian:['Super Admin','Supervisor'],nota:['Super Admin','Finance','Supervisor','Kasir'],operasional:['Super Admin','Finance','Kasir'],keuangan:['Super Admin','Finance','Kasir'],laporan:['Super Admin','Finance','Supervisor'],akses:['Super Admin'],panduan:['Super Admin','Finance','Supervisor','Kasir']};
const can=p=>data&&roles[p]?.includes(data.me.role), finance=()=>['Super Admin','Finance'].includes(data.me.role),ownShift=()=>data.shifts.find(s=>!s.closed_at&&s.cashier_id===data.me.id),currentShift=()=>data.shifts.find(s=>!s.closed_at),expected=s=>Number(s.opening_cash)+sum(data.sales.filter(t=>t.shift_id===s.id&&t.method==='Tunai'),t=>t.total)+sum(data.cash_moves.filter(m=>m.shift_id===s.id),m=>m.amount);
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,5000)}
function setSession(s){session=s;if(s)localStorage.setItem('larisindo.session',JSON.stringify(s));else localStorage.removeItem('larisindo.session')}
async function request(path,body,auth=true,retry=true){let res=await fetch(URL+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});let result=await res.json().catch(()=>null);if(res.status===401&&auth&&retry&&session?.refresh_token){await refresh();return request(path,body,auth,false)}if(!res.ok){let e=Error(result?.msg||result?.message||result?.error_description||'Permintaan gagal ('+res.status+')');e.status=res.status;e.code=result?.code;throw e;}return result}
async function refresh(){const s=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token},false,false);setSession(s)}
const rpc=(name,args={})=>request('/rest/v1/rpc/'+name,args);
async function sync(){if(!session){$('#auth').hidden=false;$('#shell').hidden=true;return}try{data=await rpc('pos_snapshot');purchaseDocs=can('pembelian')||finance()?await rpc('pos_purchase_list'):[];financeEntries=finance()?await rpc('pos_finance_list'):[];$('#auth').hidden=true;$('#shell').hidden=false;render()}catch(e){$('#auth').hidden=false;$('#shell').hidden=true;$('#authError').hidden=false;$('#authError').textContent=e.message+' — Jika baru mendaftar, minta Super Admin mengaktifkan akun.'}}
async function auth(){const email=$('#email').value.trim(),password=$('#password').value;$('#authError').hidden=true;if(!$('#authForm').reportValidity())return;const buttons=[...$('#authForm').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{const s=await request('/auth/v1/token?grant_type=password',{email,password},false);setSession(s);await sync()}catch(e){$('#authError').textContent=e.message;$('#authError').hidden=false}finally{buttons.forEach(b=>b.disabled=false)}}
$('#authForm').onsubmit=e=>{e.preventDefault();auth()};
$('#logout').onclick=async()=>{try{await request('/auth/v1/logout',{})}catch{}setSession(null);data=null;cart=[];sync()};$('#refresh').onclick=()=>sync();$('#cancel').onclick=()=>$('#dialog').close();
function head(title,desc,buttons=''){return `<div class="top"><div><h1>${title}</h1><p>${desc}</p></div><div class="actions">${buttons}</div></div>`}const btn=(a,label,secondary=false,id='')=>`<button class="btn ${secondary?'secondary':''}" data-action="${a}" data-id="${esc(id)}">${label}</button>`;
const field=(name,label,value='',type='text',attrs='')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`,select=(name,label,options)=>`<label class="field">${label}<select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
function table(headers,rows){return `<div style="overflow:auto"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}">Belum ada data.</td></tr>`}</tbody></table></div>`}function cards(entries){return '<div class="cards">'+entries.map(([l,v])=>`<div class="card"><div class="muted">${l}</div><div class="metric">${v}</div></div>`).join('')+'</div>'}
function saleTable(sales){return table(['Nota / Waktu','Kasir','Pembayaran','Total','Aksi'],sales.map(s=>['LRS-'+s.receipt_no+'<div class="muted">'+date(s.created_at)+'</div>',esc(data.users.find(u=>u.id===s.cashier_id)?.name||s.cashier_id.slice(0,8)),esc(s.method)+(s.method!=='Tunai'?`<div class="badge">${s.verified_at?'Terverifikasi':'Menunggu verifikasi'}</div>`:''),money(s.total),btn('receipt','Lihat / Cetak',true,s.id)+(finance()&&s.method!=='Tunai'&&!s.verified_at?btn('verify-sale','Verifikasi',false,s.id):'')]))}

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
  const bankSales=sum(data.sales.filter(s=>s.method!=='Tunai'),s=>s.total);
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
  const operatingSales=sum(sales,s=>s.total),paidOps=sum(entries.filter(e=>e.category==='Beban Operasional'),e=>e.amount);
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
  html+='<section class="panel"><h2>Rekonsiliasi Bank / QRIS</h2>'+table(['Tanggal','Nota','Metode','Jumlah','Referensi','Status'],data.sales.filter(x=>x.method!=='Tunai').map(x=>[date(x.created_at),esc(x.receipt_no),esc(x.method),money(x.total),esc(x.reference||'—'),x.verified_at?'Terverifikasi':'Menunggu Finance']))+'<p class="notice">Verifikasi bukti transfer belum sama dengan rekonsiliasi mutasi rekening. Untuk rekonsiliasi bank penuh masih diperlukan impor rekening koran, saldo bank awal/akhir, biaya admin, dan pencocokan per transaksi.</p></section>';
  html+='<section class="panel"><h2>Mutasi kas laci</h2>'+table(['Waktu','Jenis','Jumlah','Catatan'],data.cash_moves.map(m=>[date(m.created_at),esc(m.kind),money(m.amount),esc(m.note)]))+'</section>';
 }
 return html;
}
function renderOperationalPage(s){
 let html=head('Keuangan Operasional','Catat biaya, modal, pembayaran, utang/piutang, serta serah terima kasir. Semua tercatat otomatis di Kas & Audit.',(finance()?btn('finance-add','+ Transaksi keuangan'):'')+(currentShift()?btn('cash','+ Mutasi laci',true):'')+(s?btn('close','Tutup shift',true):''));
 if(finance())html+='<section class="panel"><h2>Transaksi keuangan</h2><p class="small">Masukkan gaji, listrik, sewa, investasi, modal, dan pembayaran melalui formulir ini. Penjualan melalui Kasir, pembelian barang melalui Pembelian. Jangan catat pengeluaran yang sama dua kali.</p>'+table(['Tanggal','Kategori','Sumber','Pihak','Keterangan','Jumlah'],financeEntries.slice(0,200).map(e=>[esc(e.occurred_on),esc(e.category),esc(e.account),esc(e.counterparty||'—'),esc(e.description),money(e.amount)]))+'</section>';
 html+='<section class="panel"><h2>Shift kasir & verifikasi</h2>'+table(['Petugas / buka','Modal','Kas sistem','Kas fisik / selisih','Verifikasi'],data.shifts.map(x=>[esc(data.users.find(u=>u.id===x.cashier_id)?.name||'Kasir')+' / '+date(x.opened_at),money(x.opening_cash),money(x.closed_at?x.expected_cash:expected(x)),x.closed_at?money(x.counted_cash)+' / '+money(x.difference):'Aktif',x.closed_at?(x.verified_at?'Terverifikasi':finance()?btn('verify-shift','Verifikasi',false,x.id):'Menunggu Finance'):'—']))+'</section>';
 if(finance())html+='<section class="panel"><h2>Verifikasi transfer / QRIS</h2>'+table(['Waktu','Nota','Metode','Jumlah','Status'],data.sales.filter(x=>x.method!=='Tunai').map(x=>[date(x.created_at),esc(x.receipt_no),esc(x.method),money(x.total),x.verified_at?'Terverifikasi':btn('verify-sale','Verifikasi bukti',false,x.id)]))+'</section>';
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

function render(){if(!can(page))page='dashboard';$('#identity').textContent=data.me.name+' · '+data.me.role+' · WITA';$('#side').innerHTML=menus.filter(([k])=>can(k)).map(([k,i,l])=>`<button class="nav ${page===k?'active':''}" data-page="${k}">${i} ${l}</button>`).join('');let html='';let s=ownShift();
if(page==='dashboard'){let today=data.sales.filter(t=>day(t.created_at)===day(new Date()));html=head('Dashboard Larisindo','Ringkasan hari ini · waktu Mataram (WITA)')+cards([['Omzet hari ini',money(sum(today,t=>t.total))],['Transaksi hari ini',today.length],['Stok minimum',data.products.filter(p=>p.stock<=p.minimum).length],['Pembayaran belum diverifikasi',data.sales.filter(t=>t.method!=='Tunai'&&!t.verified_at).length]])+`<section class="panel"><h2>Transaksi terbaru</h2>${saleTable(data.sales.slice(0,8))}</section><div class="notice">${s?'Shift kamu aktif. Kas seharusnya '+money(expected(s))+'.':'Buka shift pada menu Kasir untuk mulai melayani.'} ${data.me.role==='Kasir'?'Ringkasan transaksi hanya milik akunmu.':''}</div>`;}
if(page==='kasir'){let pending=localStorage.getItem('larisindo.pending.'+data.me.id);html=head('Kasir',s?'Shift aktif sejak '+date(s.opened_at):'Satu laci kas bersama · tutup shift sebelum serah terima',s?btn('close','Tutup shift',true):btn('open','Buka shift'))+(pending?`<div class="notice">Ada pembayaran yang perlu dipastikan hasilnya. ${btn('retry','Periksa / ulangi pembayaran')}</div>`:'')+`<div class="pos"><section class="panel"><input id="search" placeholder="Cari nama, SKU, atau scan barcode" autocomplete="off"><div id="productGrid" class="products"></div></section><section class="panel"><h2>Keranjang belanja</h2><div id="cartArea"></div></section></div>`;}
if(page==='produk')html=head('Barang & Harga','Stok awal 0. Tambahkan stok melalui penerimaan barang atau opname.',btn('product','+ Tambah barang')+btn('import-products','Import CSV',true)+btn('template-products','Template CSV',true))+`<section class="panel">${table(['SKU / Barcode','Barang','HPP','Harga jual','Stok','Aksi'],data.products.map(p=>[esc(p.sku)+'<div class="muted">'+esc(p.barcode)+'</div>',esc(p.name)+'<div class="muted">'+esc(p.category)+' · '+esc(p.unit)+'</div>',money(p.cost),money(p.price),p.stock,btn('product','Edit',true,p.id)]))}</section>`;
if(page==='stok')html=head('Stok & Opname','Setiap perubahan stok mencatat petugas, waktu, jumlah, dan alasan.')+`<section class="panel">${table(['Barang','Stok','Minimum','Aksi'],data.products.map(p=>[esc(p.name),p.stock,p.minimum,btn('adjust','Sesuaikan stok',true,p.id)]))}</section><section class="panel"><h2>Riwayat pergerakan</h2>${table(['Waktu','Barang','Perubahan','Sumber / Alasan'],data.stock_moves.slice(0,200).map(m=>[date(m.created_at),esc(data.products.find(p=>p.id===m.product_id)?.name||m.product_id),m.delta,esc(m.kind)+' · '+esc(m.reason)]))}</section>`;
if(page==='pembelian')html=head('Pembelian & Penerimaan','Satu nota berisi banyak barang, ongkir, diskon, pajak dan lampiran PDF/foto.',btn('receive','+ Nota pembelian'))+`<section class="panel">${table(['Tanggal','Pemasok / Nota','Barang','Total','Sumber','Aksi'],purchaseDocs.map(p=>[esc(p.invoice_date),esc(p.vendor)+' / '+esc(p.invoice),p.items.length+' barang',money(p.total),esc(p.source),btn('purchase-detail','Lihat nota',true,p.id)]))}</section>`;
if(page==='nota')html=head('Nota Penjualan','Catatan penjualan permanen. Struk dapat dicetak kembali.')+`<section class="panel">${saleTable(data.sales)}</section>`;
if(page==='operasional')html=renderOperationalPage(s);
if(page==='keuangan')html=renderFinancePage(s);
if(page==='laporan'){let sales=data.sales.filter(t=>(!rangeFrom||day(t.created_at)>=rangeFrom)&&(!rangeTo||day(t.created_at)<=rangeTo)),omzet=sum(sales,t=>t.total),hpp=sum(sales,t=>sum(t.items,i=>i.cost*i.qty));html=head('Laporan','Laba kotor belum dikurangi biaya operasional. Filter tanggal berdasarkan WITA.',btn('csv','Unduh CSV')+btn('print','Cetak / PDF',true))+`<section class="panel noprint"><div class="row">${field('from','Dari tanggal',rangeFrom,'date')}${field('to','Sampai tanggal',rangeTo,'date')}${btn('filter','Terapkan')}</div></section>`+cards([['Omzet',money(omzet)],['HPP',money(hpp)],['Laba kotor',money(omzet-hpp)],['Nilai stok saat ini',money(sum(data.products,p=>p.stock*p.cost))]])+`<section class="panel">${saleTable(sales)}</section>`;}
if(page==='akses')html=head('Pengguna & Hak Akses','Admin membuat akun melalui Supabase, lalu Super Admin mengaktifkan akun dan menetapkan role.')+`<section class="panel">${table(['Nama','Email','Role','Status','Aksi'],data.users.map(u=>[esc(u.name),esc(u.email),esc(u.role),u.active?'Aktif':'Menunggu / Nonaktif',btn('user','Atur akses',true,u.id)]))}</section>`;
if(page==='panduan')html=head('Panduan Operasional','Panduan sesuai fungsi aplikasi versi 2.0')+`<section class="panel"><p>Mulai dari pengaturan akun, barang, stok awal, lalu buka shift.</p><a class="btn" href="/panduan.html" target="_blank" rel="noopener">Buka buku panduan</a></section>`;
$('#content').innerHTML=html+'<p class="small" style="margin-top:20px">Larisindo POS 2.7 · Data tersimpan di Supabase · Perlu koneksi internet</p>';if(page==='kasir'){productsUI();cartUI();$('#search').oninput=productsUI;$('#search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();let p=data.products.find(p=>p.barcode===e.target.value||p.sku===e.target.value);if(p){add(p.id);e.target.value='';productsUI()}}};}}
function productsUI(){const q=$('#search').value.toLowerCase();$('#productGrid').innerHTML=data.products.filter(p=>[p.name,p.sku,p.barcode].some(v=>String(v||'').toLowerCase().includes(q))).map(p=>`<button class="product" data-action="add" data-id="${p.id}" ${p.stock<1?'disabled':''}><strong>${esc(p.name)}</strong><span class="price">${money(p.price)}</span><div class="muted">${esc(p.sku)} · Stok ${p.stock}</div></button>`).join('')||'<p>Belum ada barang. Supervisor perlu menambahkan barang dan stok.</p>'}
function add(id){if(!ownShift())return notify('Buka shift terlebih dahulu');if(localStorage.getItem('larisindo.pending.'+data.me.id))return notify('Selesaikan pembayaran tertunda dahulu');let p=data.products.find(p=>p.id===id),c=cart.find(c=>c.id===id);if((c?.qty||0)>=p.stock)return notify('Stok tidak cukup');if(c)c.qty++;else cart.push({id,qty:1});cartUI()}
function cartUI(){let total=sum(cart,c=>data.products.find(p=>p.id===c.id)?.price*c.qty);$('#cartArea').innerHTML=cart.map(c=>{let p=data.products.find(p=>p.id===c.id);return `<div class="cartline"><div><strong>${esc(p.name)}</strong><div>${money(p.price)} × ${c.qty}</div></div><div>${btn('minus','−',true,c.id)} ${c.qty} ${btn('add','+',true,c.id)}</div></div>`}).join('')+`<div class="total"><span>Total</span><span>${money(total)}</span></div>${select('method','Metode pembayaran',[['Tunai','Tunai'],['Transfer','Transfer'],['QRIS','QRIS']])}<div id="paymentFields"></div>${btn('pay','Bayar '+money(total))}`;$('#cartArea [name=method]').value=method;$('#cartArea [name=method]').onchange=e=>{method=e.target.value;paymentFields()};paymentFields();$('#cartArea [data-action=pay]').disabled=!cart.length||!ownShift()||busy;}
function paymentFields(){$('#paymentFields').innerHTML=method==='Tunai'?field('tendered','Uang diterima (Rp)','','number','min="0" step="1" required'):field('reference','Referensi / nomor pembayaran','','text','minlength="3" required')+'<p class="small">Pastikan pembayaran terlihat pada rekening/merchant. Finance akan memverifikasinya.</p>'}
function modal(title,body,fn){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialogError').hidden=true;saveHandler=fn;$('#dialog').showModal()}
$('#dialogForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('#save').disabled=true;$('#dialogError').hidden=true;try{await saveHandler(Object.fromEntries(new FormData(e.target)));$('#dialog').close();await sync();notify('Tersimpan')}catch(err){$('#dialogError').textContent=err.message;$('#dialogError').hidden=false}finally{busy=false;$('#save').disabled=false}};
async function pay(retry=false){if(busy)return;const key='larisindo.pending.'+data.me.id;let args;try{if(retry){args=JSON.parse(localStorage.getItem(key)||'null');if(!args)return notify('Tidak ada pembayaran tertunda')}else{if(localStorage.getItem(key))return notify('Periksa pembayaran tertunda terlebih dahulu');if(!cart.length||!ownShift())return notify('Keranjang atau shift tidak tersedia');let t=$('[name=tendered]')?.value,ref=$('[name=reference]')?.value;args={p_id:crypto.randomUUID(),p_shift:ownShift().id,p_items:cart.map(c=>({...c})),p_method:method,p_tendered:method==='Tunai'?Number(t):null,p_reference:ref||''};if(method==='Tunai'&&(!t||Number(t)<sum(cart,c=>data.products.find(p=>p.id===c.id).price*c.qty)))return notify('Uang diterima belum cukup');if(method!=='Tunai'&&args.p_reference.trim().length<3)return notify('Isi referensi pembayaran');localStorage.setItem(key,JSON.stringify(args))}busy=true;document.querySelectorAll('[data-action=pay],[data-action=retry]').forEach(b=>b.disabled=true);await rpc('pos_checkout',args);localStorage.removeItem(key);cart=[];await sync();showReceipt(args.p_id);notify('Transaksi berhasil tersimpan')}catch(e){if(e.status>=400&&e.status<500&&e.status!==401){localStorage.removeItem(key);notify(e.message+' — Transaksi ditolak; perbaiki isian lalu bayar kembali.')}else notify(e.message+' — Periksa/ulangi dengan ID transaksi yang sama.');await sync()}finally{busy=false;if(page==='kasir'&&$('#cartArea'))cartUI();}}
function showReceipt(id){let t=data.sales.find(x=>x.id===id);if(!t)return;let h=`<div id="receipt"><h2>LARISINDO MART</h2><p>LRS-${t.receipt_no} · ${date(t.created_at)}</p><p>Petugas: ${esc(data.users.find(u=>u.id===t.cashier_id)?.name||t.cashier_id)}</p>${table(['Barang','Jumlah','Harga','Subtotal'],t.items.map(i=>[esc(i.name),i.qty,money(i.price),money(i.price*i.qty)]))}<div class="total">Total ${money(t.total)}</div><p>Metode: ${esc(t.method)}</p>${t.method==='Tunai'?`<p>Uang: ${money(t.tendered)} · Kembali: ${money(t.change_due)}</p>`:`<p>Referensi: ${esc(t.reference)} · ${t.verified_at?'Terverifikasi Finance':'Menunggu verifikasi Finance'}</p>`}<p>Terima kasih sudah berbelanja.</p></div>${btn('print-receipt','Cetak struk')}`;modal('Nota Penjualan',h,async()=>{});$('#save').hidden=true;$('#cancel').textContent='Tutup';}
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

const purchaseLine=()=>'<tr><td><input class="purchase-scan" placeholder="Scan barcode / SKU" autocomplete="off" style="min-width:130px"></td><td><input class="purchase-name" placeholder="Ketik nama barang" list="purchase-product-names" required maxlength="160" autocomplete="off" style="min-width:220px"><input type="hidden" class="purchase-product"></td><td><input class="purchase-qty" type="number" min="1" max="999999" value="1" required style="width:72px"></td><td><select class="purchase-unit"><option value="pcs">pcs</option><option value="dus">dus</option><option value="bal">bal</option><option value="renceng">renceng</option></select><input class="purchase-factor" type="number" min="1" max="999999" value="1" title="Isi pcs per kemasan" style="width:85px" required></td><td><input class="purchase-cost" type="number" min="0" step="0.01" value="0" required style="width:110px"></td><td><input class="purchase-discount" type="number" min="0" step="0.01" value="0" required style="width:100px"></td><td class="purchase-line-total">Rp0</td><td><button class="btn secondary purchase-remove" type="button">×</button></td></tr>';
function openPurchaseDoc(){
 if(!can('pembelian'))return notify('Akses tidak diizinkan');
 const id=crypto.randomUUID();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const body='<div class="formgrid">'+field('vendor','Pemasok','','text','required maxlength="160"')+field('invoice','Nomor nota','','text','required maxlength="120"')+field('invoice_date','Tanggal nota',today,'date','required')+select('source','Sumber pembayaran',[['Dana luar laci','Dana luar laci / transfer'],['Kas laci','Kas laci aktif']])+'</div>'+
 '<p>Nama barang bisa diketik langsung. Nama/barcode yang cocok dengan master akan otomatis menggunakan barang yang sama. Untuk dus/bal/renceng isi jumlah pcs per kemasan.</p><datalist id="purchase-product-names">'+data.products.map(p=>'<option value="'+esc(p.name)+'"></option>').join('')+'</datalist>'+
 '<div style="overflow:auto"><table><thead><tr><th>Barcode/SKU</th><th>Nama barang</th><th>Qty</th><th>Satuan / isi pcs</th><th>Harga/kemasan</th><th>Diskon (Rp)</th><th>Jumlah</th><th></th></tr></thead><tbody id="purchase-lines"></tbody></table></div>'+
 '<button type="button" class="btn secondary" id="purchase-add">+ Tambah barang</button>'+
 '<div class="formgrid" style="margin-top:16px">'+field('invoice_discount','Diskon nota (Rp)',0,'number','min="0" step="0.01" required')+field('shipping','Ongkir (Rp)',0,'number','min="0" step="0.01" required')+field('tax','Pajak (Rp)',0,'number','min="0" step="0.01" required')+
 '<label class="field">Foto/PDF nota (maks. 10 MB)<input type="file" name="attachment" accept="image/jpeg,image/png,image/webp,application/pdf"></label></div>'+
 '<div id="purchase-totals" class="notice" aria-live="polite"></div><p class="small">Ongkir, diskon, dan pajak dialokasikan ke HPP persediaan. Nota disimpan atomik. Lampiran disimpan privat setelah transaksi berhasil.</p>';
 $('#save').hidden=false;$('#cancel').textContent='Batal';modal('Nota pembelian · banyak barang',body,async f=>{
 const lines=[...document.querySelectorAll('#purchase-lines tr')].map(tr=>({product_id:tr.querySelector('.purchase-product').value||null,name:tr.querySelector('.purchase-name').value.trim(),barcode:tr.querySelector('.purchase-scan').value.trim(),qty:Number(tr.querySelector('.purchase-qty').value),unit:tr.querySelector('.purchase-unit').value,factor:Number(tr.querySelector('.purchase-factor').value),cost:Number(tr.querySelector('.purchase-cost').value),discount:Number(tr.querySelector('.purchase-discount').value)}));
 if(!lines.length||lines.some(l=>!l.name||!Number.isInteger(l.factor)||l.factor<1||l.factor*l.qty>999999||(l.unit==='pcs'&&l.factor!==1)||!Number.isInteger(l.qty)||l.qty<1||l.qty>999999||!Number.isFinite(l.cost)||l.cost<0||!Number.isFinite(l.discount)||l.discount<0||l.discount>l.cost*l.qty)||new Set(lines.map(l=>(l.product_id||l.barcode||l.name).toLowerCase())).size!==lines.length)throw Error('Periksa barang, jumlah, harga, diskon, dan duplikasi produk');
 const file=document.querySelector('[name=attachment]').files[0];
 if(file&&(file.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)))throw Error('Lampiran hanya PDF/JPG/PNG/WebP, maksimal 10 MB');
 await rpc('pos_receive_doc_v2',{p_id:id,p_vendor:f.vendor,p_invoice:f.invoice,p_date:f.invoice_date,p_items:lines,p_discount:Number(f.invoice_discount),p_shipping:Number(f.shipping),p_tax:Number(f.tax),p_source:f.source,p_shift:f.source==='Kas laci'?currentShift()?.id||null:null});
 if(file){
  const ext=({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type],path=id+'/nota.'+ext;
  try{
   let response=await fetch(URL+'/storage/v1/object/larisindo-purchase-notes/'+path,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file});
   if(!response.ok)throw Error((await response.json().catch(()=>({}))).message||'Upload gagal');
   await rpc('pos_purchase_attachment',{p_id:id,p_path:path});
  }catch(err){notify('Nota tersimpan, tetapi lampiran gagal: '+err.message);return;}
 }
 });
 const tbody=document.querySelector('#purchase-lines');
 const recalc=()=>{
  let subtotal=0,disc=0;
  tbody.querySelectorAll('tr').forEach(tr=>{
   const q=Number(tr.querySelector('.purchase-qty').value)||0,c=Number(tr.querySelector('.purchase-cost').value)||0,d=Number(tr.querySelector('.purchase-discount').value)||0;
   subtotal+=q*c;disc+=d;tr.querySelector('.purchase-line-total').textContent=money(q*c-d);
  });
  const inv=Number(document.querySelector('[name=invoice_discount]').value)||0,ship=Number(document.querySelector('[name=shipping]').value)||0,tax=Number(document.querySelector('[name=tax]').value)||0;
  document.querySelector('#purchase-totals').textContent='Subtotal '+money(subtotal)+' · Diskon barang '+money(disc)+' · Diskon nota '+money(inv)+' · Ongkir '+money(ship)+' · Pajak '+money(tax)+' · TOTAL '+money(subtotal-disc-inv+ship+tax);
 };
 document.querySelector('#purchase-add').onclick=()=>{tbody.insertAdjacentHTML('beforeend',purchaseLine());tbody.lastElementChild.querySelector('.purchase-factor').disabled=true;tbody.lastElementChild.querySelector('.purchase-name').focus();recalc()};
 tbody.addEventListener('input',e=>{if(e.target.matches('.purchase-cost'))e.target.dataset.edited='1';if(e.target.matches('.purchase-name'))e.target.closest('tr').querySelector('.purchase-product').value='';recalc()});
 const matchProduct=tr=>{const name=tr.querySelector('.purchase-name').value.trim().toLowerCase(),code=tr.querySelector('.purchase-scan').value.trim();const p=(code&&data.products.find(x=>x.barcode===code||x.sku===code))||data.products.find(x=>x.name.toLowerCase()===name);tr.querySelector('.purchase-product').value=p?.id||'';if(p){tr.querySelector('.purchase-name').value=p.name;if(!tr.querySelector('.purchase-cost').dataset.edited)tr.querySelector('.purchase-cost').value=(p.cost||0)*Number(tr.querySelector('.purchase-factor').value||1)}return p};
 tbody.addEventListener('change',e=>{const tr=e.target.closest('tr');if(e.target.matches('.purchase-name'))matchProduct(tr);if(e.target.matches('.purchase-unit')){const factor=tr.querySelector('.purchase-factor');if(e.target.value==='pcs')factor.value=1;factor.disabled=e.target.value==='pcs'}if(e.target.matches('.purchase-factor')){const p=matchProduct(tr);if(p&&!tr.querySelector('.purchase-cost').dataset.edited)tr.querySelector('.purchase-cost').value=(p.cost||0)*Number(e.target.value||1)}recalc()});
 tbody.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!e.target.matches('.purchase-scan'))return;
  e.preventDefault();const scan=e.target.value.trim();
  const p=data.products.find(x=>x.barcode===scan||x.sku===scan);
  if(!p){notify('Barcode/SKU belum terdaftar. Tambahkan melalui Barang & Harga.');return}
  const tr=e.target.closest('tr');tr.querySelector('.purchase-product').value=p.id;tr.querySelector('.purchase-name').value=p.name;tr.querySelector('.purchase-cost').value=(p.cost||0)*Number(tr.querySelector('.purchase-factor').value||1);e.target.value=p.barcode||p.sku;
  tr.querySelector('.purchase-qty').focus();tr.querySelector('.purchase-qty').select();recalc();
 });
 tbody.addEventListener('click',e=>{if(e.target.matches('.purchase-remove')){e.target.closest('tr').remove();recalc()}});
 document.querySelectorAll('[name=invoice_discount],[name=shipping],[name=tax]').forEach(el=>el.addEventListener('input',recalc));
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
async function action(a,id){if(a==='add')return add(id);if(a==='minus'){let c=cart.find(c=>c.id===id);if(c&&--c.qty<=0)cart=cart.filter(c=>c.id!==id);return cartUI()}if(a==='pay'||a==='retry')return pay(a==='retry');if(a==='receipt')return showReceipt(id);if(a==='print')return window.print();if(a==='print-receipt'){let w=window.open('','_blank');if(!w)return notify('Izinkan pop-up untuk mencetak');w.document.write('<!doctype html><html><head><title>Nota Larisindo</title><style>body{font:12px monospace;max-width:320px;margin:auto}table{width:100%}td,th{text-align:left;padding:6px 0}button{display:none}@media print{@page{size:80mm auto;margin:4mm}}</style></head><body>'+$('#receipt').innerHTML+'</body></html>');w.document.close();w.onload=()=>w.print();return}
if(a==='open'&&page==='operasional'){const requestId=crypto.randomUUID();return editModal('Buka shift',field('opening','Uang fisik awal (Rp)',500000,'number','min="0" max="1000000000" required')+'<p>Hitung uang yang benar-benar diterima. Hanya satu shift dapat aktif pada laci bersama.</p>',f=>rpc('pos_open_shift',{p_id:requestId,p_opening:Number(f.opening)}))}
if(a==='close'&&page==='operasional'){let s=ownShift();if(!s)return;return editModal('Tutup shift',`<div class="notice">Kas seharusnya ${money(expected(s))}. Hitung kas fisik; catat alasan jika ada selisih.</div>`+field('counted','Kas fisik (Rp)','','number','min="0" required')+field('note','Catatan / alasan selisih'),f=>rpc('pos_close_shift',{p_id:s.id,p_counted:Number(f.counted),p_note:f.note}))}
if(a==='template-products')return downloadProductTemplate();
if(a==='import-products')return openProductImport();
if(a==='product'){let p=data.products.find(x=>x.id===id)||{};return editModal(p.id?'Edit barang':'Tambah barang',`<div class="formgrid">${field('sku','SKU',p.sku||'','text','required maxlength="80"')}${field('barcode','Barcode',p.barcode||'')}${field('name','Nama',p.name||'','text','required maxlength="160"')}${field('category','Kategori',p.category||'Umum')}${field('unit','Satuan',p.unit||'pcs','text','required')}${field('price','Harga jual',p.price||'','number','min="1" required')}${p.id?'<p>HPP berubah melalui penerimaan barang.</p>':field('cost','HPP awal per unit',0,'number','min="0" required')}${field('minimum','Stok minimum',p.minimum??10,'number','min="0" required')}</div>`,f=>rpc('pos_product',{p_id:p.id||null,p_sku:f.sku,p_barcode:f.barcode,p_name:f.name,p_category:f.category,p_unit:f.unit,p_price:Number(f.price),p_cost:Number(p.cost||f.cost||0),p_minimum:Number(f.minimum)}))}
if(a==='adjust'){let p=data.products.find(p=>p.id===id);return editModal('Opname: '+p.name,field('stock','Stok fisik',p.stock,'number','min="0" required')+field('reason','Alasan / berita acara','','text','minlength="5" required')+'<p>Koreksi ini memengaruhi nilai persediaan dan meninggalkan jejak permanen.</p>',f=>rpc('pos_adjust',{p_id:id,p_stock:Number(f.stock),p_reason:f.reason}))}
if(a==='receive')return openPurchaseDoc();
if(a==='purchase-detail')return showPurchaseDoc(id);
if(a==='finance-tab'){financeTab=id;return render()}
if(a==='finance-add'&&page==='operasional')return openFinanceEntry();
if(a==='cash'&&page==='operasional'){let s=currentShift(),requestId=crypto.randomUUID();return editModal('Mutasi kas laci',select('kind','Jenis',[['Setoran keluar','Setoran keluar laci'],['Pengeluaran','Pengeluaran toko'],['Penerimaan lain','Penerimaan lain (bukan penjualan)']])+field('amount','Jumlah (Rp)','','number','min="1" required')+field('note','Tujuan / nomor bukti','','text','minlength="3" required'),f=>rpc('pos_cash_move',{p_id:requestId,p_shift:s.id,p_amount:Number(f.amount)*(f.kind==='Penerimaan lain'?1:-1),p_kind:f.kind,p_note:f.note}))}
if((a==='verify-sale'||a==='verify-shift')&&page==='operasional'){return editModal('Verifikasi Finance','<p>Pastikan rincian transaksi cocok dengan bukti bank / hasil hitung fisik. Verifikasi akan mencatat akun dan waktu pemeriksa.</p>',()=>rpc('pos_verify',{p_kind:a==='verify-sale'?'sale':'shift',p_id:id}))}
if(a==='user'){let u=data.users.find(x=>x.id===id);return editModal('Atur akses '+u.email,field('name','Nama',u.name,'text','required')+select('role','Role',['Super Admin','Finance','Supervisor','Kasir'].map(r=>[r,r]))+select('active','Status',[['true','Aktif'],['false','Nonaktif']]),f=>rpc('pos_user',{p_id:id,p_role:f.role,p_active:f.active==='true',p_name:f.name})),($('#dialog [name=role]').value=u.role),($('#dialog [name=active]').value=String(u.active))}
if(a==='filter'){rangeFrom=$('[name=from]').value;rangeTo=$('[name=to]').value;if(rangeFrom&&rangeTo&&rangeFrom>rangeTo)return notify('Rentang tanggal terbalik');return render()}
if(a==='csv'){let rows=data.sales.filter(t=>(!rangeFrom||day(t.created_at)>=rangeFrom)&&(!rangeTo||day(t.created_at)<=rangeTo));let quote=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';let csv='\ufeff'+[['Nota','Tanggal WITA','Metode','Omzet','HPP','Laba kotor','Referensi'],...rows.map(t=>{let h=sum(t.items,i=>i.cost*i.qty);return ['LRS-'+t.receipt_no,date(t.created_at),t.method,t.total,h,t.total-h,t.reference]})].map(row=>row.map(quote).join(';')).join('\r\n');let link=document.createElement('a');link.href=window.URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download='Larisindo-Penjualan.csv';link.click();setTimeout(()=>window.URL.revokeObjectURL(link.href),1000);}}
document.addEventListener('click',async e=>{let b=e.target.closest('[data-page],[data-action]');if(!b)return;if(b.dataset.page){if(busy)return;if(b.dataset.page!==page&&cart.length&&!confirm('Keranjang belum dibayar. Pindah halaman?'))return;cart=[];page=b.dataset.page;render();return}try{await action(b.dataset.action,b.dataset.id)}catch(err){notify(err.message)}});
// Supabase confirmation/recovery links use fragment tokens. Remove them immediately from the address bar.
const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('access_token')){setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});history.replaceState(null,'',location.pathname+(hash.get('type')==='recovery'?'?recovery=1':''))}
await sync();if(new URLSearchParams(location.search).get('recovery')==='1'&&session){editModal('Atur kata sandi baru',field('password','Kata sandi baru','','password','minlength="12" required'),async f=>{const res=await fetch(URL+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({password:f.password})});if(!res.ok)throw Error('Gagal mengganti kata sandi');history.replaceState(null,'',location.pathname)})}
