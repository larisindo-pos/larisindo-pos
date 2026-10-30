const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('public/app.js','utf8');
const part=code.slice(code.indexOf('const productCSVColumns='),code.indexOf('function openProductImport('));
const context={data:{products:[{id:'existing',sku:'OLD',barcode:'888'}]}};
vm.createContext(context);vm.runInContext(part+';this.parseCSV=parseCSV;this.prepareProductCSV=prepareProductCSV;',context);
const csv='sku;barcode;nama;kategori;satuan;harga_jual;hpp_awal;stok_minimum\r\nA;123;"Susu; Kotak";Minuman;pcs;12000;9000;10\r\nOLD;888;Lama;Umum;pcs;10000;8000;5';
const rows=context.prepareProductCSV(csv);assert.equal(rows.length,2);assert.equal(rows[0].name,'Susu; Kotak');assert.equal(rows[1].existing.id,'existing');assert.equal(rows[0].error,'');
const bad=context.prepareProductCSV(csv+'\r\nA;999;Duplikat;Umum;pcs;100;50;1');assert(bad[2].error.includes('duplikat'));
console.log('CSV parser and duplicate tests OK');
