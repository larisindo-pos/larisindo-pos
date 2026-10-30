# Larisindo POS 2.1

Aplikasi kasir daring berbasis HTML/CSS/JavaScript modules, Supabase Auth/Postgres RPC, dan Vercel static hosting.

Alamat produksi: https://larisindo-pos.vercel.app/
Alamat alternatif: https://larisindo-pos-alam24.vercel.app/
Panduan: /panduan.html (dapat dicetak ke PDF).

## Status penerapan

- Supabase: larisindo-pos / qtfrgzdequpaegttjgrw / Singapura; organisasi App Kasir Larisindo.
- Vercel: larisindo-pos, tim ALAM.
- Migrasi core dan private RPC sudah diterapkan. Database tidak diisi data contoh operasional.
- Versi 2.1 memakai akun yang dibuat admin di Supabase Authentication → Users → Add user → Create new user, dengan Auto Confirm User aktif.
- Pendaftaran mandiri dan reset sandi lewat email dihapus dari antarmuka. Login biasa tidak memerlukan SMTP.
- Pendaftaran mandiri baru dihilangkan dari antarmuka. Agar endpoint signup publik juga tertutup, pengelola perlu mematikan Allow new users to sign up di Supabase Authentication → Sign In / Providers. Pengaturan ini belum diubah karena dashboard saat ini meminta login; pembuatan akun melalui admin tetap digunakan.
- Usulan trigger tambahan ditolak pemeriksaan otomatis karena berisiko mengganggu provisioning Auth; trigger tidak diterapkan.
- Akun pemilik appkasir.larisindo@gmail.com sudah terkonfirmasi melalui tindakan admin terbatas pada akun tersebut, berrole Super Admin dan aktif. Tindakan dicatat dalam audit. Password tidak dibaca atau diubah pengembang.
- Akun karyawan buatan admin mendapat role Kasir nonaktif. Super Admin mengaktifkan dan menetapkan role di menu Pengguna.
- SMTP tidak menjadi syarat alur akun ini. Email invitation dan reset lewat email tetap membutuhkan pengirim bila kelak digunakan.
- Site URL dan empat redirect URL produksi tetap tersimpan untuk fitur autentikasi yang relevan.

## Struktur

- public/: berkas website yang diterbitkan; config.js hanya berisi URL serta publishable key, bukan service-role key.
- database/schema.sql: migrasi awal untuk database kosong.
- database/002_private_rpc.sql: implementasi hak istimewa ditempatkan di schema private, API publik memakai wrapper invoker.
- tests/database.sql: uji fungsi dalam transaksi yang di-rollback; hanya untuk database kosong lingkungan uji. Jangan menjalankan pada database berisi data operasional karena beberapa assertion menghitung seluruh penjualan.
- tests/ui.cjs: pengujian DOM dengan jsdom; pasang jsdom 26.1.0 pada lingkungan pengujian sebelum menjalankannya. Ini bukan tes browser visual.
- vercel.json: pengaturan header keamanan.

## Model keamanan dan konsistensi

Semua tabel menggunakan RLS serta tidak mempunyai hak akses langsung untuk anon/authenticated. Ini sengaja deny-all; akses hanya melalui RPC yang memverifikasi auth.uid(), akun aktif, role, dan kepemilikan shift. Implementasi SECURITY DEFINER berada di schema private dengan search_path kosong; helper internal tidak dapat dipanggil klien. Audit ditulis di server. Kredensial service-role tidak digunakan di browser.

Checkout memegang lock shift dan produk, memvalidasi stok/harga/uang diterima, lalu mencatat penjualan, detail, stok, dan audit dalam transaksi yang sama. UUID transaksi digunakan ulang ketika jaringan gagal. Tutup shift memakai lock yang sama untuk mencegah penjualan sesudah penutupan.

## Validasi

Sebelas skenario database lulus: transaksi, kembalian dan idempotensi; keranjang kosong; stok kurang; larangan penyesuaian stok oleh kasir; larangan pengelolaan akun oleh kasir; HPP tersembunyi; rekonsiliasi kas; shift tertutup; verifikasi Finance; larangan baca tabel langsung; serta larangan RPC anonim. Uji DOM merender 10 menu dan memeriksa escaping nama barang, checkout, nota, serta pembersihan transaksi tertunda.

Endpoint produksi berstatus READY dan HTTP 200. Endpoint database tanpa login menolak pembacaan produk dan RPC. Login dengan akun pengguna nyata serta printer/scanner di lokasi belum diuji.

## Cakupan operasional

Fungsi aktif tercantum dalam panduan. Satu laci bersama dan satu shift aktif. Pembayaran Transfer/QRIS dicatat manual dan diverifikasi Finance, tanpa payment gateway. Perlu internet. Pembelian satu baris per barang. Belum mencakup refund/retur, diskon, pajak, kasbon, hutang vendor, reseller atau unggah bukti. Jangan mengklaim data laporan sebagai laba bersih. Siapkan saldo awal nyata dan backup database sebelum operasional rutin.

## Penerapan ulang

Unggah source ke proyek Vercel dengan Framework Other dan Output Directory public. Tidak ada build/install dependencies pada produksi. Pastikan Supabase Auth menggunakan domain yang benar. Jangan menerapkan ulang schema.sql ke database yang sudah berisi data; gunakan migrasi bertahap.

Security advisor tidak melaporkan WARN/ERROR setelah pemindahan implementasi RPC ke private. INFO RLS Enabled No Policy merupakan konsekuensi deny-all tabel; klien sengaja tidak mempunyai akses langsung. Referensi: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Import produk CSV (v2.2)
Pada menu **Barang & Harga** (Super Admin/Supervisor), klik **Template CSV** untuk mengunduh contoh, lalu **Import CSV**. Kolom wajib: `sku;barcode;nama;kategori;satuan;harga_jual;hpp_awal;stok_minimum`. Simpan CSV sebagai UTF-8; pemisah `;`, `,`, atau tab diterima. Pratinjau memeriksa kesalahan, SKU/barcode ganda, dan kecocokan dengan barang lama. Pilih lewati atau perbarui barang lama. Impor tidak mengubah stok; HPP barang lama tidak diubah. Untuk penambahan stok gunakan menu Penerimaan atau Opname. Batas 1.000 baris/2 MB; untuk menghindari perubahan sebagian, unggah dalam batch kecil dan cek hasilnya.
