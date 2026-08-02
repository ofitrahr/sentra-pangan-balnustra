# WebGIS FSN Padi & Infrastruktur NTT — v2 (arsitektur catalog-driven)

## Apa yang berubah dari versi sebelumnya

Versi lama: 1 file HTML raksasa (~13 MB), semua data ditanam langsung di dalamnya.
Versi baru: `index.html` + `app.js` jadi "shell" kecil (~30 KB gabungan), data
dipecah jadi puluhan file kecil di folder `data/`, dan **daftar layer apa saja
yang tersedia diatur lewat 1 file `catalog.json`**.

Efeknya:
- Tampilan awal cuma perlu unduh ~276 KB (bukan 13 MB) — jauh lebih cepat.
- Layer lain (kecamatan, desa, infrastruktur) baru diunduh browser **saat
  benar-benar dicentang/di-drill**, bukan di awal.
- **Nambah layer baru = nambah entri di `catalog.json` + taruh file datanya di
  `data/`. Tidak perlu ubah kode `app.js` sama sekali** (kecuali kamu butuh
  jenis visualisasi yang benar-benar baru, lihat bagian "Menambah render_type
  baru" di bawah).

## Struktur folder

```
├── index.html          <- shell HTML (jarang perlu diubah)
├── app.js              <- logic dashboard, baca catalog.json (jarang diubah)
├── catalog.json         <- DAFTAR SEMUA LAYER (paling sering kamu/Claude Code edit)
└── data/
    ├── fsn_kabupaten_points.json
    ├── fsn_kabupaten_polygons.json
    ├── fsn_kecamatan_points.json
    ├── fsn_kecamatan_boundary.json
    ├── fsn_desa_points.json
    ├── desa_boundary_with_giling.json
    ├── lbs_density_grid.json
    ├── permukiman_density_grid.json
    └── infra/
        ├── binamarga_nustra_jalan_nasional.json
        ├── ... (37 file lainnya)
```

## Cara deploy ke GitHub Pages (gratis, langkah persis)

1. Buat repo baru di GitHub (bisa public atau private — kalau private, GitHub
   Pages butuh paket berbayar; kalau tim internal kecil, public repo juga
   aman selama tidak ada data sensitif/rahasia di dalamnya).
2. Upload SEMUA isi folder ini (index.html, app.js, catalog.json, data/) ke
   root repo tsb. Termudah: drag-drop lewat web GitHub, atau via git:
   ```
   git init
   git add .
   git commit -m "Initial WebGIS v2"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```
3. Di repo tsb: **Settings → Pages → Source: pilih branch `main`, folder `/
   (root)`** → Save.
4. Tunggu 1-2 menit, GitHub kasih tahu URL live-nya, formatnya:
   `https://<username>.github.io/<nama-repo>/`
5. Buka URL itu — dashboard sudah jalan online, bisa dibagikan ke tim.

Setiap kali kamu `git push` perubahan baru (data baru, catalog.json diedit),
GitHub Pages otomatis re-deploy dalam 1-2 menit. Tidak perlu proses manual apapun.

## Cara menambah layer baru (paling sering dilakukan)

1. Siapkan data barunya sebagai GeoJSON (titik/garis/polygon), taruh di
   `data/` (atau `data/infra/` kalau kategori infrastruktur).
2. Tambahkan 1 entri baru di array `"layers"` pada `catalog.json`, contoh
   untuk layer titik baru:
   ```json
   {
     "id": "nama_unik_layer",
     "category": "salah_satu_id_di_categories",
     "label": "Nama yang tampil di panel kontrol",
     "render_type": "point",
     "data_url": "data/nama_file_baru.json",
     "count": 123,
     "default_visible": false,
     "source": "Sumber datanya dari mana",
     "download_url": "https://link-dropbox-atau-lainnya/file_asli.gpkg?dl=1"
   }
   ```
3. `git push` — selesai, layer baru otomatis muncul di panel kontrol,
   ter-kelompok sesuai `category`-nya, tanpa perlu sentuh `app.js`.

`render_type` yang sudah didukung `app.js` saat ini: `point`, `line`,
`polygon`, `density_grid` (peta kepadatan grid seperti LBS/Permukiman),
`choropleth_polygon` (polygon diwarnai berdasar 1 angka, seperti Jumlah
Penggilingan per Desa), dan `fsn_drilldown` (khusus 1 layer FSN, sudah
ada, biasanya tidak perlu ditambah lagi).

### Menambah render_type baru (misal untuk network analysis / desire line)

Kalau butuh gaya visualisasi yang benar-benar baru (bukan variasi dari 5 tipe
di atas), perlu tambahan kode di `app.js`, fungsi `buildAndShowLayer()` —
tambah 1 blok `else if(entry.render_type === 'nama_type_baru'){ ... }` yang
mengembalikan Leaflet layer. Ini bagian yang paling cocok dikerjakan lewat
**Claude Code** (beri akses ke repo ini, minta dia tambah render_type baru
sesuai desain visualnya), karena butuh iterasi kode yang lebih dalam
dibanding sekadar edit `catalog.json`.

## File asli (SHP/GPKG) untuk tombol download

Field `download_url` di tiap entri catalog.json **aman pakai link Dropbox**
(`?dl=1` di akhir link) — karena itu cuma link `<a href>` biasa yang memicu
browser mengunduh file, bukan proses `fetch()` yang kena aturan CORS.
Yang TIDAK aman dipakai dari Dropbox adalah `data_url` (karena itu di-
`fetch()` oleh `app.js` untuk digambar di peta) — untuk itu tetap host di
folder `data/` repo GitHub ini.

## Kontak teknis / catatan lanjutan

Dibangun bertahap lewat sesi kerja dengan Claude (Anthropic). Untuk
pemeliharaan rutin (nambah data mingguan/bulanan), disarankan pakai
**Claude Code** yang bekerja langsung di clone repo ini, supaya perubahan
bisa di-commit & di-review lewat git history — bukan mengulang dari nol
tiap kali seperti sesi chat biasa.
