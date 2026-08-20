# Sumber Data Layer Dashboard

Keterkaitan tiap layer di dashboard dengan berkas asalnya di `workspace/`.

Berkas di `data/*.json` adalah hasil **publish yang diringkas** — hanya membawa
kolom yang dipakai popup peta. Untuk analisis ulang atau pengiriman data keluar,
gunakan GPKG sumber di kolom **Sumber**, yang atributnya jauh lebih lengkap
(contoh: Pasar 7 kolom di JSON vs 44 kolom di GPKG).

> Dibuat otomatis oleh `workspace/export_shapefile/bangun_dokumentasi_sumber.py`.
> Jalankan ulang setiap ada layer baru. Versi tabel: `sumber-data.csv`.

## Ringkasan

- **65** layer — Salinan GPKG (terverifikasi)
- **22** layer — Lahir sebagai JSON (hasil analisis)
- **5** layer — Olahan dari GPKG
- **2** layer — Alat bantu peta

Arti status:

| Status | Arti |
|---|---|
| Salinan GPKG (terverifikasi) | Jumlah fitur di dashboard **sama persis** dengan GPKG sumber. Aman dianggap salinan yang diringkas kolomnya. |
| Olahan dari GPKG | GPKG-nya ada, tapi yang dipublish hasil transformasi (agregasi/reklasifikasi/dissolve). **Bukan** versi ringkas — beda produk. |
| Lahir sebagai JSON (hasil analisis) | Keluaran skrip analisis. Tidak ada GPKG setara, tidak ada atribut yang hilang. |
| GPKG sumber belum teridentifikasi | Perlu ditelusuri. |

## Alat Ukur

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Alat Ukur Jarak (Ruler) | `-` | Alat bantu peta | — | — |

## Aset PU

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Aset BIM PU | `data/infra/setjen_nustra_aset_bim_pu.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Aset_PU/infrastruktur_aset_bim_pu.gpkg` | — |
| Aset Tanah PU | `data/infra/setjen_nustra_aset_tanah_pu.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Aset_PU/infrastruktur_aset_tanah_pu.gpkg` | — |

## Batas Administrasi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Batas Desa/Kelurahan | `data/administrasi_desa_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/administrasi/administrasi_ntb_ntt.gpkg` | `workspace/analisis/bersihkan_sliver_administrasi/01_bersihkan_sliver.py` |
| Batas Kabupaten/Kota | `data/administrasi_kabkota_ntb_ntt.json` | Olahan dari GPKG | `workspace/administrasi/administrasi_ntb_ntt.gpkg` | `workspace/analisis/bersihkan_sliver_administrasi/01_bersihkan_sliver.py` |
| Batas Kecamatan | `data/administrasi_kecamatan_ntb_ntt.json` | Olahan dari GPKG | `workspace/administrasi/administrasi_ntb_ntt.gpkg` | `workspace/analisis/bersihkan_sliver_administrasi/01_bersihkan_sliver.py`<br>`workspace/analisis/fsn_sapi_ntb/01_siapkan_choropleth_kecamatan.py` |

## Geologi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Formasi Geologi | `data/geologi_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/geologi/geologi_peta_geologi_ntt.gpkg` | `workspace/analisis/fisik_414_tanah/03_geologi_ntb_ntt.py` |
| Litologi (NTB+NTT) | `data/geologi_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_414_tanah/output/geologi_ntb_ntt.gpkg` | `workspace/analisis/fisik_414_tanah/03_geologi_ntb_ntt.py` |

## Guna Lahan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Lahan Baku Sawah -- Kepadatan (NTT) | `data/lbs_density_grid.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Permukiman -- Kepadatan (NTT) | `data/permukiman_density_grid.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Tutupan Lahan (NTB+NTT) | `data/tutupan_lahan_ntb_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/fisik_412_ntb_ntt/06_export_ke_webgis.py` |

## Hidrografi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Daratan (Global) | `data/hidrografi_land_global.json` | Salinan GPKG (terverifikasi) | `workspace/hidrografi/hidrografi_land_global.gpkg` | `workspace/hidrografi/export_land_global_ke_webgis.py` |
| Kedalaman Laut (Batimetri Global) | `data/hidrografi_laut_ntb_ntt.json` | Olahan dari GPKG | `workspace/hidrografi/hidrografi_laut_indonesia.gpkg` | `workspace/hidrografi/export_kedalaman_laut_ke_webgis.py` |

## Jalan & Jembatan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Inpres Jalan Daerah | `data/infra/binamarga_nustra_inpres_jalan_daerah.json` | Salinan GPKG (terverifikasi) | `workspace/jalan/Paket_Sumba_Timur/jalan_inpres_jalan_daerah.gpkg` | — |
| Jalan Kabupaten/Kota | `data/jalan_kabupaten_kota_ntb_ntt.json` | Olahan dari GPKG | `workspace/jalan/geofabrik_nusa_tenggara/roads_ntb_ntt_clipped.gpkg` | `workspace/jalan/geofabrik_nusa_tenggara/export_jalan_kabkota_web.py` |
| Jalan Nasional | `data/infra/jalan_nasional_join_admin_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/jalan/Nasional/jalan_nasional_ntt__4.gpkg` | — |
| Jalan Provinsi | `data/infra/jalan_provinsi_join_admin_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/jalan/Provinsi/jalan_provinsi_ntt__2.gpkg` | — |
| Jembatan Gantung | `data/infra/binamarga_nustra_jembatan_gantung.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/BM/infrastruktur_jembatan_gantung.gpkg` | — |
| Jembatan Nasional | `data/infra/binamarga_nustra_jembatan_nasional.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/BM/infrastruktur_jembatan_nasional.gpkg` | — |
| Lereng | `data/infra/binamarga_nustra_lereng.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/BM/infrastruktur_lereng.gpkg` | — |

## Jaringan Distribusi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Gravity Model (NTT) — Garis Lurus | `data/gravity_flow_lines_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/gravity_model_distribusi_padi/04_export_ke_webgis.py` |
| Gravity Model (NTT) — Rute Jalan Riil | `data/gravity_flow_routed_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/gravity_model_distribusi_padi/04_export_ke_webgis.py` |
| Simpul Distribusi Sapi Potong (NTB) — Pasar Hewan & Karantina/Pelabuhan | `data/fsn_sapi_distribusi_ntb.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/fsn_sapi_ntb/03_export_ke_webgis.py` |

## Kebencanaan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Bahaya Banjir (NTB+NTT) | `data/bahaya_banjir_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_banjir_ntb_ntt.gpkg` | — |
| Bahaya Banjir Bandang (NTB+NTT) | `data/bahaya_banjir_bandang_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_banjir_bandang_ntb_ntt.gpkg` | — |
| Bahaya Cuaca Ekstrim (NTB+NTT) | `data/bahaya_cuaca_ekstrim_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_cuaca_ekstrim_ntb_ntt.gpkg` | — |
| Bahaya Gelombang Ekstrim & Abrasi (NTB+NTT) | `data/bahaya_gea_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_gea_ntb_ntt.gpkg` | — |
| Bahaya Gempa Bumi (NTB+NTT) | `data/bahaya_gempabumi_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_gempabumi_ntb_ntt.gpkg` | — |
| Bahaya Kebakaran Hutan & Lahan (NTB+NTT) | `data/bahaya_karhutla_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_karhutla_ntb_ntt.gpkg` | — |
| Bahaya Kekeringan (NTB+NTT) | `data/bahaya_kekeringan_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_kekeringan_ntb_ntt.gpkg` | — |
| Bahaya Letusan Gunung Api (NTB+NTT) | `data/bahaya_gunungapi_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_gunungapi_ntb_ntt.gpkg` | — |
| Bahaya Likuefaksi (NTB+NTT) | `data/bahaya_likuefaksi_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_likuefaksi_ntb_ntt.gpkg` | — |
| Bahaya Tanah Longsor (NTB+NTT) | `data/bahaya_tanah_longsor_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_tanah_longsor_ntb_ntt.gpkg` | — |
| Bahaya Tsunami (NTB+NTT) | `data/bahaya_tsunami_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_416_kebencanaan/output/bahaya_tsunami_ntb_ntt.gpkg` | — |

## Kepadatan Penggilingan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Jumlah Penggilingan per Desa (NTT) | `data/desa_boundary_with_giling.json` | Lahir sebagai JSON (hasil analisis) | — | — |

## Klimatologi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Curah Hujan (NTB+NTT) | `data/curah_hujan_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_413_ntb_ntt/output/curah_hujan_ntb_ntt.gpkg` | `workspace/analisis/fisik_413_ntb_ntt/01_siapkan_curah_hujan.py`<br>`workspace/analisis/fisik_413_ntb_ntt/02_export_ke_webgis.py` |
| Curah Hujan per Pos (NTT) | `data/pos_curah_hujan_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_413_ntb_ntt/output/pos_curah_hujan_ntt.gpkg` | `workspace/analisis/fisik_413_ntb_ntt/01_siapkan_curah_hujan.py`<br>`workspace/analisis/fisik_413_ntb_ntt/02_export_ke_webgis.py` |
| Zona Agroklimat Oldeman (NTB+NTT) | `data/agroklimat_oldeman_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_413_ntb_ntt/output/agroklimat_oldeman_ntb_ntt.gpkg` | `workspace/analisis/fisik_413_ntb_ntt/04_agroklimat.py` |
| Zona Agroklimat Schmidt-Ferguson (NTB+NTT) | `data/agroklimat_schmidt_ferguson_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_413_ntb_ntt/output/agroklimat_schmidt_ferguson_ntb_ntt.gpkg` | `workspace/analisis/fisik_413_ntb_ntt/04_agroklimat.py` |
| Zona Iklim (Schmidt-Ferguson) | `data/klimatologi_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/klimatologi/klimatologi_peta_klimatologi_ntt.gpkg` | — |

## Pasar

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Pasar (Indonesia) | `data/pasar_indonesia.json` | Salinan GPKG (terverifikasi) | `workspace/pasar/pasar_sisp_kemendag.gpkg` | `workspace/pasar/export_ke_webgis.py` |

## Pelabuhan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Pelabuhan Perikanan (Indonesia) | `data/pelabuhan_perikanan_indonesia.json` | Salinan GPKG (terverifikasi) | `workspace/pelabuhan/pelabuhan_perikanan_pipp_kkp_lengkap.gpkg` | `workspace/pelabuhan/export_ke_webgis.py` |

## Pengerucutan Sentra Pangan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Pengerucutan Sentra Pangan (NTB) | `data/pengerucutan_sentra_pangan_ntb.json` | Salinan GPKG (terverifikasi) | `workspace/sentra_pangan/pengerucutan_sentra_pangan_ntb_kemenpu.gpkg` | `workspace/sentra_pangan/build_pengerucutan_ntb.py` |
| Pengerucutan Sentra Pangan (NTT) | `data/pengerucutan_sentra_pangan_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/sentra_pangan/pengerucutan_sentra_pangan_ntt_kemenpu.gpkg` | `workspace/sentra_pangan/build_pengerucutan_ntt.py` |

## Pergudangan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Gudang (Indonesia) | `data/pergudangan_gudang_indonesia.json` | Salinan GPKG (terverifikasi) | `workspace/pergudangan/pergudangan_gudang.gpkg` | `workspace/pergudangan/export_ke_webgis.py` |

## Permukiman & Utilitas

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| BPB | `data/infra/cipta_karya_nustra_bpb.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_bpb.gpkg` | — |
| IPAL | `data/infra/cipta_karya_nustra_ipal.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_ipal.gpkg` | — |
| IPLT | `data/infra/cipta_karya_nustra_iplt.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_iplt.gpkg` | — |
| PKS | `data/infra/cipta_karya_nustra_pks.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_pks.gpkg` | — |
| PLBN | `data/infra/cipta_karya_nustra_plbn.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_plbn.gpkg` | — |
| Rumah Sakit | `data/infra/cipta_karya_nustra_rumah_sakit.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_rumah_sakit.gpkg` | — |
| SPAM | `data/infra/cipta_karya_nustra_spam.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_spam.gpkg` | — |
| TPA | `data/infra/cipta_karya_nustra_tpa.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/CK/infrastruktur_tpa.gpkg` | — |

## Peternakan

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Populasi Sapi Potong per Kecamatan (NTB, 5 Kab. Prioritas) | `data/fsn_sapi_kecamatan_ntb.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/fsn_sapi_ntb/03_export_ke_webgis.py` |

## Prasarana Strategis

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Gedung SPPG | `data/infra/prasarana_strategis_nustra_gedung_sppg.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Prasarana_Strategis/infrastruktur_gedung_sppg.gpkg` | — |
| Madrasah | `data/infra/prasarana_strategis_nustra_madrasah.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Prasarana_Strategis/infrastruktur_madrasah.gpkg` | — |
| Perguruan Tinggi | `data/infra/prasarana_strategis_nustra_perguruan_tinggi.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Prasarana_Strategis/infrastruktur_perguruan_tinggi.gpkg` | — |
| Sarana Prasarana Perekonomian | `data/infra/prasarana_strategis_nustra_sarana_prasarana_perekonomian.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Prasarana_Strategis/infrastruktur_sarana_prasarana_perekonomian.gpkg` | — |
| Sekolah | `data/infra/prasarana_strategis_nustra_sekolah.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/Prasarana_Strategis/infrastruktur_sekolah.gpkg` | — |

## Rantai Pasok Padi (FSN)

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Estimasi Produksi Padi per Desa (NTB) | `data/fsn_padi_desa_ntb.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/lbs_padi_desa_ntb/03_export_ke_webgis.py` |
| Produksi → Pengolahan → Beras → Konsumsi (NTT, s.d. level desa) | `-` | Alat bantu peta | — | — |

## Sosial-Ekonomi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Indikator Sosial Kabupaten (NTB+NTT) — IPM, Kemiskinan, Populasi | `data/sosial_kabupaten_ntb_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/sosial_kabupaten_ntb_ntt/02_export_ke_webgis.py` |
| Kinerja Ekonomi Sektor Pertanian (NTB+NTT, per kabupaten) | `data/sosial_ekonomi_pertanian_ntb_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | — |

## Sumber Daya Air & Irigasi

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Bendung | `data/infra/sda_nustra_bendung.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_bendung.gpkg` | — |
| Bendungan Konstruksi | `data/infra/sda_nustra_bendungan_konstruksi.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_bendungan_konstruksi.gpkg` | — |
| Bendungan Operasi | `data/infra/sda_nustra_bendungan_operasi.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_bendungan_operasi.gpkg` | — |
| Daerah Irigasi Permukaan | `data/infra/sda_nustra_daerah_irigasi_permukaan.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_daerah_irigasi_permukaan.gpkg` | — |
| Danau | `data/infra/sda_nustra_danau.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_danau.gpkg` | — |
| Intake Sungai | `data/infra/sda_nustra_intake_sungai.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_intake_sungai.gpkg` | — |
| Kebutuhan Air | `data/infra/sda_nustra_kebutuhan_air.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_kebutuhan_air.gpkg` | — |
| Mata Air | `data/infra/sda_nustra_mata_air.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_mata_air.gpkg` | — |
| Neraca Air | `data/infra/sda_nustra_neraca_air.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_neraca_air.gpkg` | — |
| PAH_ ABSAH | `data/infra/sda_nustra_pah_absah.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_pah_absah.gpkg` | — |
| Pengaman Pantai | `data/infra/sda_nustra_pengaman_pantai.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_pengaman_pantai.gpkg` | — |
| Pengendali Sedimen | `data/infra/sda_nustra_pengendali_sedimen.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_pengendali_sedimen.gpkg` | — |
| Pos Curah Hujan | `data/infra/sda_nustra_pos_curah_hujan.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_pos_curah_hujan.gpkg` | — |
| Pos Duga Air | `data/infra/sda_nustra_pos_duga_air.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_pos_duga_air.gpkg` | — |
| Pos Klimatologi | `data/infra/sda_nustra_pos_klimatologi.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_pos_klimatologi.gpkg` | — |
| Sumur | `data/infra/sda_nustra_sumur.json` | Salinan GPKG (terverifikasi) | `workspace/infrastruktur/SDA/infrastruktur_sumur.gpkg` | — |

## Survei Flores

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Rute Survei Flores (NTT) — Hari 1 (Labuan Bajo: Bandara–TPI Kampung Ujung–Pasar Batu Cermin–Warloka) | `data/survei_flores_tahap1_rute_hari1.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Rute Survei Flores (NTT) — Hari 2 (Labuan Bajo: kunjungan 5 dinas Kab. Manggarai Barat) | `data/survei_flores_tahap1_rute_hari2.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Rute Survei Flores (NTT) — Hari 3 (Mbeliling (jagung)–Lembor–Gudang Tangge–Ruteng) | `data/survei_flores_tahap1_rute_hari3.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Rute Survei Flores (NTT) — Hari 4 (Ruteng: Satar Mese Barat–BULOG–Reo–Borong) | `data/survei_flores_tahap1_rute_hari4.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Rute Survei Flores (NTT) — Hari 5 (kunjungan dinas Manggarai Timur–Compang Ndejing–Pasar Borong–Mbay) | `data/survei_flores_tahap1_rute_hari5.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Rute Survei Flores (NTT) — Hari 6 (kunjungan dinas Nagekeo–Pelabuhan Marapokot–Bendungan Mbay–Ende) | `data/survei_flores_tahap1_rute_hari6.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Rute Survei Flores (NTT) — Hari 7 (Ende: Hotel–Bandara, kepulangan) | `data/survei_flores_tahap1_rute_hari7.json` | Lahir sebagai JSON (hasil analisis) | — | — |
| Titik Observasi — Survei Flores Tahap I (NTT, Pulau Flores) | `data/survei_flores_tahap1_titik.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/survei_flores_tahap1/03_export_ke_webgis.py` |

## Tanah

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Jenis Tanah WRB (NTB+NTT) - estimasi | `data/jenis_tanah_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_414_tanah/output/jenis_tanah_ntb_ntt.gpkg` | `workspace/analisis/fisik_414_tanah/01_jenis_tanah_soilgrids.py` |
| Kemampuan Lahan (NTB+NTT) - estimasi | `data/kemampuan_lahan_ntb_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/fisik_414_tanah/output/kemampuan_lahan_ntb_ntt.gpkg` | `workspace/analisis/fisik_414_tanah/02_kemampuan_lahan.py` |

## Topografi & Lereng

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Garis Kontur (NTB+NTT) | `data/kontur_ntb_ntt.json` | Olahan dari GPKG | `workspace/analisis/fisik_412_ntb_ntt/output/kontur_ntb_ntt_50m.gpkg` | `workspace/analisis/fisik_412_ntb_ntt/09_export_kontur_ke_webgis.py` |
| Kemiringan Lereng (NTB+NTT) | `data/kemiringan_lereng_ntb_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/fisik_412_ntb_ntt/06_export_ke_webgis.py` |

## Zonasi Garam

| Layer | Berkas dashboard | Status | Sumber | Skrip pembuat |
|---|---|---|---|---|
| Produksi Garam per Desa (Kab. Sumbawa, NTB, 2025) | `data/produksi_garam_desa_sumbawa.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/zonasi_garam_ntt/06_choropleth_desa_sumbawa.py` |
| Produksi Garam per Kabupaten (NTT, 2025) | `data/produksi_garam_kabupaten_ntt.json` | Lahir sebagai JSON (hasil analisis) | — | `workspace/analisis/zonasi_garam_ntt/03_choropleth_produksi_garam.py`<br>`workspace/analisis/zonasi_garam_ntt/04_export_choropleth_ke_webgis.py` |
| Zonasi/Lokasi Garam (NTT) | `data/zonasi_garam_ntt.json` | Salinan GPKG (terverifikasi) | `workspace/analisis/zonasi_garam_ntt/output/zonasi_garam_ntt_hasil.gpkg` | `workspace/analisis/zonasi_garam_ntt/02_export_ke_webgis.py` |

