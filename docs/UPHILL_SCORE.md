# Uphill Score (Hill Strength & Hill Endurance) — Technical Spec

> Status: **DESIGN ONLY — belum ada kode yang diubah.**
> Target: menggantikan peran "Hill Score" Garmin di tab **Trail & Mountain Running**
> dengan mesin skor yang 100% diturunkan dari data aktivitas COROS milik atlet.

---

## 1. Ringkasan Keputusan

| Keputusan | Nilai |
| :--- | :--- |
| Skor gabungan | `0–100`, satu angka + label band |
| Sub-skor | `Hill Strength` (0–100) dan `Hill Endurance` (0–100) |
| Basis data | **Climb segments** hasil ekstraksi FIT records (altitude + time + distance + HR) |
| Normalisasi | Ke **LTHR** atlet, bukan ke VO2max (VO2max tidak tersedia per-climb) |
| Agregasi | Persentil 90 (bukan max) → tahan outlier GPS |
| Window | Rolling **90 hari** untuk skor dan tren; delta 28 hari membandingkan dua window 90 hari |
| Confidence | 0–100%, ditampilkan eksplisit; skor < 30% confidence diberi status *provisional* |
| Fallback | Tanpa climb segments → skor tidak dihitung (bukan ditebak dari VAM agregat) |

**Alasan fallback keras:** metrik `activities.vam_meters_per_hour` yang ada sekarang =
`elevation_gain / total_duration`, sehingga **mencampur tanjakan, turunan, dan berhenti**.
Untuk aktivitas 21.36 km / D+ 1562 m / 284 min, kolom itu bernilai **330 m/h**, padahal
VAM menanjak riilnya kemungkinan **650–800 m/h**. Memakai angka ini untuk Hill Score akan
menghasilkan skor yang salah ~50%. Karena itu fitur ini butuh data per-segmen.

---

## 2. Audit Data (kondisi database saat ini)

Hasil query `data/coros_athlete.db`:

| Item | Nilai |
| :--- | :--- |
| Total aktivitas | 88 |
| `sport_type = 'trail_run'` | 11 |
| Aktivitas dengan D+ > 150 m | 12 |
| `lap_splits` ter-cache | **0** |
| `gps_track` ter-cache | 4 |
| Punya `Adjusted Pace` (GAP) di `raw_data` | 83 / 88 |
| Punya `Average Power` di `raw_data` | 84 / 88 |

Implikasi:

1. **Lap splits belum ada yang tersimpan.** Lap hanya diparse saat user membuka detail
   aktivitas (`/api/activities/track`). Jadi dashboard belum punya granularitas tanjakan.
2. **FIT records sudah diparse** di route tersebut (`records[].altitude`, `timestamp`,
   `distance`, `heart_rate`), tetapi **hanya lat/lng yang di-cache**. Ini sumber data
   utama yang harus mulai dipersistenkan.
3. `raw_data` menyimpan **GAP dan power** dari COROS — berguna sebagai cross-check,
   bukan sebagai pengganti segmentasi (GAP hanya rata-rata satu aktivitas).
4. Populasi trail masih kecil (11–12 aktivitas). Untuk skor yang stabil, backfill wajib
   dijalankan sekali, dan UI harus punya empty/provisional state yang jujur.

---

## 3. Definisi Metrik

### 3.0 Cakupan Data & Ambang Minimal

**Sport yang dihitung:** hanya keluarga lari — `run`, `trail_run`, `track_run`.
`bike`, `strength`, dan sepeda statis **tidak** dihitung karena VAM bersepeda tidak
sebanding dengan lari (bobot + mekanika berbeda).

Catatan: filter ini **belum** ada di draft awal dan wajib ditambahkan. Tanpa filter,
aktivitas sepeda dengan tanjakan panjang bisa masuk dan menggelembungkan skor.

**Ambang berlapis:**

| Level | Syarat | Tujuan |
| :--- | :--- | :--- |
| Aktivitas | `D+ ≥ 100 m`, durasi `≥ 10 menit`, `≥ 30` titik altitude valid | Buang run datar / treadmill |
| Segmen climb | `gain ≥ 30 m`, `distance ≥ 300 m`, `avg grade ≥ 3%`, bertahan `≥ 60 s` | Buang roller & noise GPS |
| Hill Strength | climb `120–900 s` dengan `avg grade ≥ 6%` | Fokus tanjakan pendek–curam |
| Hill Endurance | climb `≥ 900 s` (15 menit) | Fokus tanjakan panjang |
| Skor layak tampil | minimal `3` climb eligible dalam 90 hari | Hindari skor dari 1 tanjakan |

Konsekuensi praktis: satu tanjakan yang masuk hitungan biasanya **≥ 50 m gain pada
grade ≥ 8%** (≈ 600 m jarak). Aktivitas dengan D+ 100–150 m bisa lolos gate aktivitas,
tetapi sering hanya menghasilkan 1 climb — skornya akan berstatus *provisional*.

**Data riil atlet saat ini** (query `data/coros_athlete.db`):

| Sport | Jumlah | Lolos gate aktivitas (D+ ≥ 100 m) | D+ maks |
| :--- | ---: | ---: | ---: |
| `run` | 73 | 5 | 172 m |
| `trail_run` | 11 | 10 | 1562 m |
| `track_run` | 1 | 1 | 656 m |
| `strength` | 3 | 0 | 0 |

Artinya: 5 road run yang lolos gate punya densitas hanya **3.4–6.4 m/km**, sehingga
kemungkinan besar **tidak menghasilkan satu climb pun** (butuh ≥3% kontinu). Jadi
sampel efektif hampir seluruhnya trail — sesuai ekspektasi — tetapi filter sport tetap
wajib agar perilakunya eksplisit dan tidak berubah saat ada activity sepeda baru.

### 3.1 Hill Strength
Kemampuan menghasilkan **vertical speed tinggi pada tanjakan pendek–curam**
(2–15 menit, grade ≥ 6%). Analog: 5-min climbing power.

### 3.2 Hill Endurance
Kemampuan **mempertahankan** output menanjak pada tanjakan panjang (≥ 15 menit)
atau rangkaian tanjakan dalam satu sesi, dengan drift HR minimal.

### 3.3 Hill Score (gabungan)
```
HillScore = round(0.55 × Strength + 0.45 × Endurance)
```
Bobot condong ke Strength karena tanjakan pendek–curam adalah pembeda utama
kemampuan trail, sementara Endurance lebih mudah dibangun dan lebih banyak noise
(kualitas altimeter, pacing, stoppage).

Band (dapat dikalibrasi ulang setelah 30+ climb terkumpul):

| Skor | Label EN | Label ID |
| :--- | :--- | :--- |
| 85–100 | Elite | Elite |
| 70–84 | Advanced | Mahir |
| 50–69 | Trained | Terlatih |
| 30–49 | Developing | Berkembang |
| 0–29 | Recreational | Rekreasi |

---

## 4. Struktur Data Baru

### 4.1 Migrasi SQLite (`src/lib/db.ts`)

Tambahkan ke `alterStatements` (pola backward-compatible yang sudah ada):

```sql
ALTER TABLE activities ADD COLUMN climb_segments TEXT;     -- JSON ClimbSegment[]
ALTER TABLE activities ADD COLUMN ascent_time_sec INTEGER DEFAULT 0;
ALTER TABLE activities ADD COLUMN climbs_analyzed_at INTEGER DEFAULT 0;
```

Tidak perlu tabel baru. `climb_segments` bersifat derived cache, aman dihapus/dihitung ulang.

### 4.2 Tipe (`src/lib/analytics.ts`)

```ts
export interface ClimbSegment {
  idx: number;
  startDistM: number;
  endDistM: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  durationSec: number;
  ascentTimeSec: number;      // waktu saat grade >= 2%
  avgGradePct: number;
  maxGradePct: number;        // p95, bukan max mentah
  vamMh: number;              // gainM / (ascentTimeSec / 3600)
  paceSecPerKm: number;       // aktual
  gapPaceSecPerKm: number;    // Minetti grade-adjusted
  avgHr: number;              // 0 bila tidak ada
  maxHr: number;
  hrDriftPct: number;         // (EF half-2 - EF half-1) / EF half-1 × 100
  ascentFraction: number;     // ascentTimeSec / durationSec
  isSteep: boolean;           // avgGrade >= 8
  isLong: boolean;            // durationSec >= 900
  quality: number;            // 0..1 (lihat §6.4)
}
```

---

## 5. Pipeline Ekstraksi Climb

Lokasi: `src/app/api/activities/track/route.ts`, di dalam callback `fitParser.parse`,
setelah `records` tersedia. Fungsi murni `extractClimbSegments(records)` diletakkan di
`src/lib/analytics.ts` agar bisa diuji tanpa I/O.

### 5.1 Preprocessing

0. Gate sport: hanya proses `run`, `trail_run`, `track_run` (§3.0). Return `[]` untuk lainnya.
1. Filter record valid: `timestamp` ada, `distance` monoton naik, `altitude != null`.
   Minimal **30 titik** dan rentang altitude ≥ 5 m.
2. Pilih sumber altitude: `enhanced_altitude` (barometrik) → fallback `altitude`.
   Jika hanya GPS altitude, naikkan ambang minimum gain dari 30 m → 50 m.
3. Smoothing altitude: moving average **7 titik** (≈15–30 s). Jangan smooth `distance`.
4. Grade dihitung pada window bergerak **60 s**:
   `grade = Δalt / Δdist` (clamp Δdist minimal 5 m).

### 5.2 State machine deteksi tanjakan

```
IDLE --(grade >= 3% selama >= 60 s DAN akumulasi gain >= 15 m)--> CLIMBING
CLIMBING --(grade <= -2% selama >= 30 s)--> IDLE
CLIMBING --(grade <= 1.5% selama >= 60 s)--> IDLE
```

Penggabungan & filter:

- Gabungkan dua climb jika jarak antar-puncak < 200 m descent **dan** jeda < 60 s.
- Buang climb dengan `gainM < 30` **atau** `distanceM < 300`.
- Hitung ulang metrik climb dari record di dalam rentang `startDistM..endDistM`
  (jangan pakai hasil smoothing untuk gain final).
- `maxGradePct` = persentil 95 dari grade 30 s, untuk membuang spike altimeter.

### 5.3 Output per climb

- `vamMh` memakai **ascentTimeSec** (hanya waktu menanjak), bukan total durasi.
- `gapPaceSecPerKm` memakai biaya energi Minetti (fungsi `calculateGapPace` yang sudah ada).
- `hrDriftPct` hanya diisi bila `avgHr > 0` dan durasi ≥ 5 menit.

### 5.4 Persistensi

Di blok `// 10. Cache ...` tambahkan:

```ts
if (climbs.length > 0) {
  updates.push("climb_segments = ?");
  args.push(JSON.stringify(climbs));
  updates.push("ascent_time_sec = ?");
  args.push(climbs.reduce((s, c) => s + c.ascentTimeSec, 0));
  updates.push("climbs_analyzed_at = ?");
  args.push(Date.now());
}
```

Fast-path di awal route juga harus mengembalikan `climbs` bila sudah ter-cache,
supaya tidak memanggil COROS MCP berulang.

---

## 6. Formula Skor

### 6.1 Normalisasi intensitas ke LTHR

Setiap climb diskalakan ke intensitas ambang:

```
hrRatio = (avgHr − restHr) / (LTHR − restHr)   // hanya jika avgHr > 0
vamThr  = vamMh × clamp(sqrt(1 / clamp(hrRatio, 0.55, 1.15)), 0.85, 1.20)
```

- Climb di bawah ambang (hrRatio < 1) dinaikkan, di atas ambang diturunkan.
- Kompresi akar kuadrat meredam ekstrapolasi berlebihan: hike santai pada
  ~65% LTHR tidak otomatis dianggap mampu menanjak pada VAM ambang.
- Faktor dibatasi 0.85–1.20 agar HR (yang lag dan dipengaruhi terrain) tidak
  mendominasi skor.
- Jika `avgHr = 0` → `vamThr = vamMh`, `quality × 0.6`.

### 6.2 Koreksi grade ke referensi 10%

VAM turun seiring bertambahnya grade. Agar climb 6% dan 14% bisa dibandingkan:

```
vamRef = vamThr × (grade / 10)^0.30     // clamp grade 5..20
```

### 6.3 Strength & Endurance raw

```
StrengthRaw  = P80( vamRef ) untuk climb 120–900 s, grade >= 6%,
               avg HR >= 75% LTHR (climb easy dikecualikan)
EnduranceRaw = P75( vamRef ) untuk climb duration >= 900 s
               × clamp(1 + hrDriftPct / 100, 0.85, 1.05)
```

`P80`/`P75` dihitung *duration-weighted* (climb 12 menit lebih mewakili
daripada climb 3 menit), dengan bobot per climb dibatasi maksimal 60 menit
agar satu hike santai yang sangat panjang tidak mendominasi persentil.

Aturan v1.2:
- **Strength minimal 3 climb** yang lolos filter easy, sama dengan gate skor keseluruhan.
  Jika kurang, `strength = null` dan composite memakai Endurance saja.
- Climb dengan `avgHr > 0` dan `avgHr < 0.75 × LTHR` **tetap dihitung untuk
  Endurance dan volume**, tetapi **tidak masuk Strength**. Tujuannya: hike santai
  11 menit tidak boleh menjadi patokan "hill strength".
- Climb tanpa HR tetap masuk Strength (tidak bisa dinilai intensitasnya), dengan
  penalti `quality × 0.6` pada confidence.
- `P80` dipilih menggantikan `P90`: dengan 5–10 climb, `P90` praktis sama dengan
  climb terbaik sehingga satu effort bisa menggeser sub-skor ~10 poin.

### 6.4 Mapping ke 0–100 (log-scale anchors)

```
score(x, min, max) = clamp(5 + 95 × (ln x − ln min) / (ln max − ln min), 0, 100)
```

| Metrik | `min` (skor 5) | `max` (skor 100) | Contoh |
| :--- | ---: | ---: | :--- |
| Strength (`vamRef`, m/h) | 300 | 1300 | 400 → 24 · 600 → 50 · 800 → 69 · 1100 → 89 |
| Endurance (`vamRef`, m/h) | 250 | 1050 | 350 → 27 · 500 → 51 · 650 → 68 · 800 → 82 |

Anchor ini adalah **kalibrasi awal** dan harus diverifikasi dengan data riil atlet
(§11). Simpan sebagai konstanta bernama, bukan angka sihir di komponen.

### 6.4.1 Composite & volume sufficiency

```
base         = round(0.55 × Strength + 0.45 × Endurance)
volumeFactor = clamp(0.92 + 0.08 × log10(max(gain, 100) / 1000) / log10(8), 0.92, 1.00)
HillScore    = round(base × volumeFactor)
```

`gain` = total `gainM` semua climb eligible dalam window 90 hari (termasuk climb
easy). Faktor ini **hanya mendiskon volume rendah, tidak pernah menaikkan skor**:
1.000 m gain → 0.92, 4.000 m → ±0.97, 8.000 m ke atas → 1.00.

Alasannya: dua atlet dengan climb terbaik sama tetapi volume tanjakan sangat
berbeda tidak seharusnya mendapat skor identik. Volume diterapkan ke composite
saja, sehingga Strength/Endurance tetap murni metrik performa. Volume juga
dihitung ulang per window untuk delta 28 hari dan tren 8 minggu.

### 6.5 Confidence

```
sample        = jumlah climb yang benar-benar dipakai
                (Strength non-easy ATAU Endurance)
sampleCoverage = clamp(sample / 8, 0, 1)
recency       = 1.0 (climb terakhir <= 14 hari) → 0.7 (90 hari), linear
quality       = rata-rata quality climb yang dipakai
confidence    = round(100 × sampleCoverage × recency × quality)
```

Climb yang hanya lolos sebagai Strength tetapi easy (HR < 75% LTHR) tidak
menambah `sample`, karena tidak dipakai di sub-skor mana pun. Climb easy yang
berdurasi ≥ 15 menit tetap dihitung sebagai Endurance.

`quality` per climb:
- 1.0: `enhanced_altitude` + HR lengkap, durasi ≥ 3 menit
- 0.9: hanya field `altitude` standar (resolusi 5 m) + HR lengkap
- 0.6: `enhanced_altitude` tanpa HR
- 0.54: field `altitude` standar tanpa HR
- ×0.8 jika durasi < 2 menit (biasanya sudah dibuang filter)

Status UI:
- `confidence >= 60` → **Established**
- `30–59` → **Provisional** (badge kuning, gauge putus-putus)
- `< 30` atau `sample < 3` → **Insufficient data** (jangan tampilkan angka besar)

### 6.6 Tren

```
delta28d = HillScore(90 hari terakhir) − HillScore(90 hari yang berakhir 28 hari lalu)
trend[]  = HillScore(90 hari berakhir di tiap titik mingguan), 8 titik
```

Keduanya memakai window 90 hari yang sama dengan skor utama. Ini penting: window
28 hari yang pendek bisa kehilangan climb Strength dan tiba-tiba hanya memakai
Endurance, sehingga delta/tren meloncat tanpa perubahan performa nyata.

Volume factor dihitung ulang di tiap window, sehingga tren mencerminkan performa
**dan** konsistensi volume, bukan hanya climb terbaik.

Tampilkan sebagai `±N` dengan panah. Jangan tampilkan tren jika window
punya `sample < 3`.

### 6.7 Yang sengaja TIDAK dipakai

- **Berat badan / W/kg**: `user_settings` belum menyimpan body mass secara konsisten;
  power COROS juga tidak tersedia per-climb. Masuk backlog.
- **Cuaca/heat**: di luar cakupan.
- **`decoupling_pct` aktivitas**: saat ini banyak nilainya **dimodelkan**, bukan dihitung
  dari lap asli (lihat `coros-mcp.ts`, blok `baseDrift`). Jangan dipakai sebagai input skor.
  Gunakan `hrDriftPct` dari climb segments yang benar-benar terukur.

### 6.8 Basis Ilmiah & Tingkat Bukti

**Jawaban jujur: komponennya berbasis literatur, tetapi skor akhirnya bukan formula
yang tervalidasi di jurnal.** Tidak ada paper yang menerbitkan "hill score 0–100".
Garmin sendiri tidak mempublikasikan algoritmanya. Karena itu spec ini harus dibaca
sebagai *evidence-informed heuristic*, bukan *scientifically validated index*.

| Komponen | Dasar ilmiah | Tingkat bukti |
| :--- | :--- | :--- |
| VAM sebagai ukuran kapasitas menanjak | Metrik definisional (m/jam), konvensi skyrunning; relevansi biaya metabolik menanjak dikuatkan Vernillo et al. (2017) | Metrik deskriptif mapan, bukan skor |
| Koreksi grade / GAP | Minetti et al. (2002), 10 pelari, treadmill −45%…+45%: biaya energi naik tidak linear terhadap grade | **Kuat** untuk biaya energi; dasar GAP Strava |
| Deteksi segmen (grade ≥3% + hysteresis) | Konvensi signal processing & analitik olahraga; tidak ada standar akademik tunggal | Engineering convention |
| Normalisasi ke LTHR | Hubungan %HRmax–%VO2max (Swain et al., 1994); LTHR sebagai anchor intensitas (ACSM) | Konsep kuat; **eksponen 1.2 = aproksimasi teknik** |
| Cardiac drift / retensi EF | Coyle & González-Alonso (2001): stroke volume turun dan HR naik setelah 10–20 menit pada beban konstan | Fenomena **kuat**; ambang 5% = pilihan |
| Konstruk Strength vs Endurance | Garmin Hill Score memakai dua sub-skor + VO2max, tetapi **metodologi tidak dipublikasikan** | Konstruk industri, bukan peer-reviewed |
| Uphill performance = f(vVO2max, kekuatan ekstensor, BMI) | Lemire et al. (2021), 5 km uphill 8%, r² = 0,94 pada 10 atlet terlatih | **Kuat** — mendukung komponen kekuatan & bobot tubuh |
| Bobot 55/45, anchor 300–1300 / 250–1050 m/h, eksponen grade 0.30, kompresi sqrt HR, cap bobot 60 menit, window 2–15/≥15 menit, cut-off band | Tidak ada sumber | **Kalibrasi empiris — wajib divalidasi** |

**Cross-check anchor dengan data literatur.** Lemire et al. (2021) mengukur atlet
*highly trained* di tanjakan 8%: 12,0 km/jam pada 94% HRmax → VAM ≈ **960 m/h**.
Setelah dinormalisasi ke LTHR (≈88% HRmax) dengan §6.1, nilainya ≈ **890 m/h**, yang
memetakan ke skor Strength ≈ **78** pada anchor §6.4. Artinya anchor kita menempatkan
"highly trained" di band *Advanced* (70–84) dan menyisakan 85–100 untuk elite —
hasil yang masuk akal. Ini **bukan validasi**, hanya sanity check.

**Rencana validasi sebelum skor diklaim sebagai metrik yang bermakna:**

1. **Convergent validity** — korelasi Hill Score dengan hasil lomba nyata (mis. waktu
   ITRA/race finish, atau `estimateTrailRaceFinishTime` yang sudah dikalibrasi VAM).
   Target `r ≥ 0.6` pada ≥ 20 aktivitas/lomba.
2. **Test-retest** — dua sesi tanjakan serupa dalam 7 hari; coefficient of variation < 5%.
3. **Known-groups** — skor atlet rekreasi vs elite harus terpisah minimal 25 poin.
4. **Sensitivity** — skor naik setelah blok latihan vert 6–8 minggu, tanpa perubahan
   pada metrik road (PMC/rTSS).
5. **Kalibrasi anchor** — setelah ≥ 30 climb, sesuaikan `min`/`max` agar distribusi
   tidak menumpuk di 40–60.

Sampai kelima langkah ini dijalankan, UI **wajib** menampilkan label *provisional*
dan tooltip yang menyebut skor ini adalah estimasi, bukan hasil uji laboratorium.

### 6.9 Evaluasi Formula Kandidat Bergaya Garmin

Ada formula yang beredar (diduga hasil regresi atas output Garmin):

```
HillScore ≈ round(0.224 × Strength + 0.492 × Endurance + 1.203 × VO2max − 40.26)
```

**Status: belum diadopsi.** Formula ini **bukan** algoritma Garmin — Garmin tidak
mempublikasikan metodologinya, hanya menyatakan skor memakai kombinasi *fitness* dan
*performance data* serta sebagian bersandar pada VO2max. Formula di atas lebih mungkin
merupakan **OLS fit** atas data observasi.

Analisis koefisien:

| Turunan | Efek per +1 poin | Rasio |
| :--- | ---: | :--- |
| Strength | +0.224 | 1.0× |
| Endurance | +0.492 | 2.2× |
| VO2max (ml/kg/min) | +1.203 | 5.4× Strength |

Interpretasi: model ini **didominasi VO2max**. Bobot kecil Strength/Endurance adalah
*partial effect* setelah VO2max masuk, bukan "kepentingan" relatif kedua sub-skor.

**Cek numerik dengan data atlet** (`coros_evolab_cache` menyimpan `vo2max: 57`):

| Strength | Endurance | Hasil |
| ---: | ---: | ---: |
| 50 | 50 | **64** |
| 60 | 60 | **71** |
| 70 | 60 | **74** |

Angkanya masuk akal untuk profil trail atlet ini. Tetapi itu belum membuktikan apa pun.

**Red flags sebelum dipakai produksi:**

1. **Provenance tidak diketahui** — N, R², cross-validation, dan apakah data berasal dari
   satu atlet atau populasi. Regresi dari time-series satu orang tidak akan generalize.
2. **Butuh clamping** — `S=0, E=0, VO2max=30` → **−4.2**; `S=100, E=100, VO2max=70` → **115.6**.
   Harus `clamp(0, 100)`.
3. **Multikolinearitas** — Strength, Endurance, dan VO2max saling berkorelasi (semua
   diturunkan dari lari + kapasitas aerobik). Koefisien jadi tidak stabil dan bisa
   berubah tanda pada sampel lain.
4. **Skala sub-skor tidak kompatibel** — koefisien dilatih pada sub-skor Garmin. Sub-skor
   kita didefinisikan dan dikalibrasi berbeda; mencampurnya adalah *category error*
   kecuali terbukti berkorelasi tinggi dengan sub-skor Garmin.
5. **Double counting** — sub-skor kita sudah dinormalisasi ke LTHR (§6.1), yang merupakan
   proksi kapasitas aerobik. Menambahkan VO2max menghitung latent variable yang sama dua kali.
6. **VO2max COROS bisa stale** — nilainya cache dari EvoLab, tidak selalu update, dan
   tidak tersedia untuk atlet tanpa data race predictor.

**Keputusan yang diusulkan:**

- **Opsi A (default):** jangan pakai koefisiennya. Pakai formula struktural
  `w1·Strength + w2·Endurance` dengan bobot hasil kalibrasi internal, dan tampilkan
  VO2max hanya sebagai konteks, bukan input skor.
- **Opsi B (jika provenance terbukti):** pakai sebagai **target kalibrasi** — sesuaikan
  bobot kita agar distribusinya mendekati output formula ini, tanpa memakai koefisien
  mentahnya.
- **Opsi C:** adopsi persis formulanya, dengan `clamp(0,100)`, bobot VO2max diturunkan
  (karena sub-skor kita sudah HR-normalized), dan label eksplisit
  *"Garmin-style estimate, bukan Hill Score Garmin"*.

Apa pun opsinya, **jangan klaim** angka ini sebagai "rumus Garmin".

---

## 7. Perubahan API

### 7.1 `GET /api/analytics/dashboard`

Tambahkan objek (payload tetap kecil — jangan kirim semua segmen):

```jsonc
"trail": {
  "uphill": {
    "score": 63,
    "strength": 68,
    "endurance": 57,
    "band": "trained",
    "confidence": 72,
    "status": "established",          // established | provisional | insufficient
    "delta28d": 3,
    "sampleClimbs": 14,
    "lastClimbAt": 1760000000000,
    "trend": [{ "weekStart": "2026-09-01", "score": 58, "strength": 61, "endurance": 54 }],
    "bestClimbs": [
      { "activityId": "act_...", "name": "...", "date": 1760000000000,
        "gainM": 420, "distanceM": 3100, "avgGradePct": 13.5,
        "vamMh": 812, "gapPaceSecPerKm": 512 }
    ]
  }
}
```

`bestClimbs` maksimal 5 item. Segmen lengkap diambil on-demand.

### 7.2 Endpoint baru (opsional, untuk detail)

`GET /api/activities/climbs?id=act_...`
→ `{ climbs: ClimbSegment[] }`. Hanya membaca kolom cache, tidak memanggil COROS.

### 7.3 Backfill

Dua jalur:

1. **Lazy** — otomatis saat user membuka detail aktivitas (sudah terjadi di route track).
2. **Batch** — `POST /api/activities/backfill-climbs`
   - auth-gated per athlete, `limit` default 5, maksimal 10 per request
   - sekuensial (hindari rate limit COROS + bandwidth S3)
   - idempotent: lewati baris dengan `climbs_analyzed_at > 0`
   - response: `{ processed, succeeded, failed, remaining }`

Untuk 12 aktivitas trail saat ini, backfill penuh ≈ 2–5 menit.

---

## 8. UI (TrailSuite)

### 8.1 Penempatan

Section baru **tepat setelah "Mountain KPI Row"** (VAM / D+ / D−) dan sebelum
"Trail Race Predictor". Alasan: skor ini adalah *diagnostic*, sementara predictor
adalah *planning tool* — user melihat kapasitas dulu, baru simulasi.

### 8.2 Layout

```
┌─ UPHILL SCORE ─────────────────────────── [Established 72%] ─┐
│                                                              │
│   ┌────────────┐   Hill Strength   ████████████░░░░  68      │
│   │     63     │   Hill Endurance  ██████████░░░░░░  57      │
│   │  TRAINED   │   ▁▂▃▅▆▆▇  +3 vs 28d                       │
│   └────────────┘                                             │
│                                                              │
│   Best climbs (90d)                                          │
│   13.5% · 3.1 km · +420 m · 812 m/h · 12 Sep   [lihat]        │
│                                                              │
│   ⓘ Cara dihitung · Butuh 8 tanjakan untuk skor stabil        │
└──────────────────────────────────────────────────────────────┘
```

Komponen:
- **Gauge utama**: angka besar + label band, warna aksen per band
  (rekreasi zinc, berkembang amber, terlatih lime, mahir orange, elite red).
- **Dua progress bar** untuk sub-skor (bukan radar — radar sudah dipakai Recovery).
- **Confidence badge** di kanan atas; `provisional` → gauge putus-putus + tooltip.
- **Trend sparkline** 8 minggu (Recharts, chart tipis 40 px, tanpa axis).
- **Best climbs**: maksimal 3 baris + tombol "lihat semua" (modal).
- **Tooltip formula** memakai `MetricTooltip` yang sudah ada.
- **Empty state**: ikon gunung + "Belum cukup data tanjakan" + tombol
  "Analisis 12 aktivitas" yang memicu backfill (dengan progress).

### 8.3 Bahasa & aksesibilitas

- Semua string lewat `translations.ts` di namespace `trail.uphill.*` (EN + ID).
- Jangan encode makna hanya lewat warna: sertakan label teks band.
- Angka skor memakai `tabular-nums`; gauge punya `aria-valuenow/valuemin/valuemax`.

### 8.4 i18n keys (minimum)

```
trail.uphill.title, .subtitle
trail.uphill.strength, .endurance, .score
trail.uphill.band.recreational|developing|trained|advanced|elite
trail.uphill.confidence.established|provisional|insufficient
trail.uphill.trendUp, .trendDown, .trendFlat
trail.uphill.bestClimbs, .viewAll, .noData, .runBackfill
trail.uphill.formula.*
trail.uphill.tooltip.strength, .endurance
```

---

## 9. File yang Akan Disentuh

| File | Perubahan |
| :--- | :--- |
| `src/lib/db.ts` | 3 kolom baru di `alterStatements` |
| `src/lib/analytics.ts` | `ClimbSegment`, `extractClimbSegments`, `calculateUphillScore`, `classifyHillBand` |
| `src/app/api/activities/track/route.ts` | ekstraksi climb + cache + fast-path |
| `src/app/api/analytics/dashboard/route.ts` | agregasi 90 hari + payload `trail.uphill` |
| `src/app/api/activities/backfill-climbs/route.ts` | **baru** |
| `src/components/TrailSuite.tsx` | section Uphill Score |
| `src/components/UphillScoreCard.tsx` | **baru** (agar TrailSuite tidak makin gemuk — sudah 1831 baris) |
| `src/app/page.tsx` | pass props `uphill` |
| `src/lib/i18n/translations.ts` | EN + ID |
| `ARCHITECTURE.md` | update setelah implementasi (fitur inti + formula) |
| `DESIGN_SYSTEM.md` | update bila ada pola gauge baru |

---

## 10. Edge Cases & Guardrail

| Kasus | Perlakuan |
| :--- | :--- |
| Tidak ada altitude (treadmill/indoor) | Skip; tidak masuk sampel |
| Altitude hanya field `altitude` standar (resolusi 5 m) | `quality × 0.9` |
| HR tidak ada | Skor tetap dihitung, `quality × 0.6` |
| Climb easy (HR < 75% LTHR) | Dikecualikan dari Strength; tetap untuk Endurance & volume |
| Strength < 3 climb | `strength = null`, composite memakai Endurance |
| Satu climb sangat ekstrem | P80 + filter easy + volume factor → tidak mendominasi |
| Volume tanjakan rendah | Composite dikali 0.92–1.00 (tidak pernah menaikkan skor) |
| Aktivitas < 10 menit / D+ < 100 m | Tidak eligible |
| Lari di tanjakan tapi jalan kaki | Tetap dihitung (VAM tidak peduli gait), tapi `ascentFraction` disimpan untuk analisis |
| Multi-lap/loop berulang | Climb dihitung per segmen fisik, bukan per lap |
| Trail run di treadmil dengan elevasi manual | Tidak eligible (tidak ada altitude stream) |
| Data < 3 climb | `insufficient`, jangan tampilkan skor |
| Atlet baru / habis cedera | Confidence menangani; jangan paksa skor |

### 10.1 Jaminan Non-Regresi (fitur existing)

Semua perubahan bersifat **aditif** dan berada di jalur terpisah:

| Fitur existing | Dampak |
| :--- | :--- |
| `vam_meters_per_hour`, PMC/CTL/ATL/TSB, rTSS | **Tidak disentuh.** Tidak ada perubahan formula maupun query |
| Trail Race Predictor (VAM historis) | Tetap memakai `avgVam` yang sekarang. `climb_segments` tidak menggantikannya |
| Decoupling / TID / HR zones | Tidak diubah. `decoupling_pct` sintetis tetap seperti sekarang |
| GPX simulator (`/trail-planner`) | Tidak terkait sama sekali |
| AI Coach context | Tidak berubah di iterasi 1 (bisa ditambah nanti) |
| Activity detail (`/api/activities/track`) | Response lama tetap; hanya **menambah** field `climbs` bila tersedia |
| Sync engine (`coros-mcp.ts`) | Tidak diubah. Backfill memakai jalur track yang sudah ada |

Risiko teknis yang sudah diantisipasi:

1. **Latensi dashboard** — agregasi hanya membaca JSON yang sudah di-cache, maksimal
   5 climb dikirim ke client. Tidak ada parsing FIT saat request dashboard.
2. **Latensi first-open activity** — ekstraksi climb adalah loop O(n) atas records yang
   **sudah** diparse untuk GPS/lap; tambahan ±10–40 ms. Tetap diberi guard: bila
   `records.length > 30.000`, hentikan ekstraksi dan tandai `quality = 0`.
3. **Ukuran DB** — ±0.3 KB per climb, realistis 10–30 climb per aktivitas trail panjang
   → ±3–9 KB/aktivitas. Untuk 100 aktivitas ≈ < 1 MB.
4. **Rate limit COROS** — hanya backfill yang memanggil MCP; dibatasi 5–10/request,
   sekuensial, idempotent. Dashboard tidak pernah memicu backfill otomatis.
5. **Payload API** — `trail.uphill.bestClimbs` dibatasi 5 item.
6. **Null handling** — semua pembacaan memakai guard `if (!climb_segments) → insufficient`,
   sehingga tidak ada `JSON.parse(undefined)`.

### 10.2 Backward Compatibility

| Aspek | Status | Mekanisme |
| :--- | :--- | :--- |
| Database lama | ✅ | `ALTER TABLE ... ADD COLUMN` dibungkus `try/catch` (pola existing di `db.ts`) |
| Turso / libsql | ✅ | Sintaks `ADD COLUMN` didukung; tidak ada `DROP`/`RENAME` |
| Data aktivitas lama | ✅ | Kolom baru `NULL` → status *insufficient*, UI menampilkan empty state |
| Backfill bertahap | ✅ | Idempotent via `climbs_analyzed_at`; boleh dijalankan berkali-kali |
| Rollback kode | ✅ | Kolom ekstra diabaikan versi lama; tidak ada perubahan destruktif |
| Client lama | ✅ | `trail.uphill` adalah field **opsional**; field existing tidak berubah |
| Settings / localStorage | ✅ | Tidak ada key baru yang wajib |
| Riwayat tren | ⚠️ | Tren dihitung ulang dari `climb_segments`; jika formula dikalibrasi ulang, angka lama ikut berubah. Mitigasi: simpan `UPHILL_FORMULA_VERSION` dan tampilkan versi di tooltip |

Satu-satunya "biaya" kompatibilitas: aktivitas yang **belum** di-backfill tidak akan
punya skor. Ini disengaja — lebih baik kosong dan jujur daripada menebak dari VAM
agregat yang mencampur turunan.

---

## 11. Validasi Sebelum Rilis

1. **Unit test** `extractClimbSegments`:
   - ramp sintetis 10% 5 menit → tepat 1 climb, gain ±5%
   - profil turun-naik dengan plateau → 2 climb, tidak merge
   - noise ±3 m pada grade 2% → 0 climb (tidak ada false positive)
2. **Validasi silang** dengan data riil:
   - 21.36 km / D+ 1562 m → total gain dari climb ≈ D+ aktivitas (±10%)
   - climbing VAM harus **650–850 m/h**, bukan 330 m/h
   - bandingkan `gapPaceSecPerKm` dengan `Adjusted Pace` COROS di `raw_data` (±15 s/km)
3. **Sanity check skor**:
   - atlet rekreasi (VAM 450–600) → Strength 35–55
   - atlet kuat (VAM 800–950) → Strength 70–85
   - elite (VAM > 1100) → Strength > 90
4. **Regresi**: dashboard tetap < 500 ms untuk 88 aktivitas (agregasi hanya membaca JSON
   yang sudah ter-cache, bukan parsing FIT saat request).
5. **Kalibrasi anchor** setelah ≥ 30 climb terkumpul: sesuaikan `min`/`max` di §6.4
   agar distribusi skor atlet tidak menumpuk di 40–60.

---

## 12. Rencana Kerja (estimasi)

| Fase | Pekerjaan | Estimasi |
| :--- | :--- | ---: |
| 1 | Migrasi + `ClimbSegment` + `extractClimbSegments` + unit test | 0.5 hari |
| 2 | Integrasi track route + backfill endpoint + jalankan pada 12 aktivitas | 0.5 hari |
| 3 | `calculateUphillScore` + agregasi dashboard + test data riil | 0.5 hari |
| 4 | `UphillScoreCard` + integrasi TrailSuite + i18n EN/ID | 1 hari |
| 5 | QA visual, kalibrasi anchor, dokumentasi | 0.5 hari |

Total ≈ **3 hari kerja**. Tidak ada dependency eksternal baru.

---

## 13. Risiko & Pertanyaan Terbuka

1. **COROS MCP rate limit** saat backfill massal — mitigasi: batch kecil, sekuensial,
   idempotent. Perlu dicek limit aktual sebelum batch > 20.
2. **Kualitas altitude COROS** (barometrik vs GPS) bervariasi per device — perlu sample
   dari beberapa device sebelum mengunci ambang 3%.
3. **Anchor skor** masih asumsi. Butuh minimal 30 climb (≈ 3–6 bulan) untuk kalibrasi
   yang benar-benar personal/populasional.
4. **Definisi "strength"** bisa diperdebatkan: VAM vs GAP speed vs power. Spec ini memilih
   VAM ternormalisasi HR karena paling tahan terhadap perbedaan device dan tidak butuh
   berat badan.
5. **Apakah skor harus memengaruhi rekomendasi training?** (mis. auto-menyesuaikan
   weekly vert target). Diusulkan **tidak** di iterasi pertama — tampilkan dulu sebagai
   diagnostik agar user percaya pada angkanya.

---

## 14. Referensi

1. Minetti AE, Moia C, Roi GS, Susta D, Ferretti G. Energy cost of walking and running at
   extreme uphill and downhill slopes. *J Appl Physiol.* 2002;93(3):1039–1046.
   doi:10.1152/japplphysiol.01177.2001.
2. Vernillo G, Giandolini M, Edwards WB, Morin JB, Samozino P, Millet GY. Biomechanics and
   physiology of uphill and downhill running. *Sports Med.* 2017;47(4):615–629.
   doi:10.1007/s40279-016-0605-y.
3. Lemire M, Hureau TJ, Favret F, Geny B, Kouassi BYL, Boukhari M, Lonsdorfer E,
   Remetter R, Dufour SP. Physiological factors determining downhill vs uphill running
   endurance performance. *J Sci Med Sport.* 2021;24(1):85–91.
   doi:10.1016/j.jsams.2020.06.004.
4. Coyle EF, González-Alonso J. Cardiovascular drift during prolonged exercise: new
   perspectives. *Exerc Sport Sci Rev.* 2001;29(2):88–92. PMID 11337829.
5. Swain DP, Abernathy KS, Smith CS, Lee SJ, Bunn SA. Target heart rates for the development
   of cardiorespiratory fitness. *Med Sci Sports Exerc.* 1994;26(1):112–116. PMID 8133731.
6. Garmin. *Hill Score — Uphill Running Insights.* Halaman teknologi resmi.
   https://www.garmin.com/en-US/garmin-technology/running-science/running-dynamics/hill-score/
   (algoritma tidak dipublikasikan).
7. Friel J. *The Triathlete's Training Bible* — dasar penggunaan Pa:HR / aerobic decoupling
   sebagai indikator drift aerobik (bukan peer-reviewed).
