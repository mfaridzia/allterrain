"use client";

import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, Info, Target, BookOpen } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export type MetricTerm =
  | "ctl"
  | "atl"
  | "tsb"
  | "ramp_rate"
  | "acwr"
  | "monotony"
  | "strain"
  | "tid"
  | "decoupling"
  | "hrv"
  | "recovery_score"
  | "resting_hr"
  | "vam"
  | "km_effort"
  | "gap"
  | "climb_density"
  | "ads"
  | "cumulative_gain"
  | "cumulative_loss"
  | "readiness"
  | "trail_race_mode"
  | "trail_conservative_mode";

export interface MetricDefinition {
  title: string;
  subtitle: string;
  definition: string;
  sweetSpot: string;
  source: string;
}

export const METRIC_GLOSSARY: Record<MetricTerm, MetricDefinition> = {
  ctl: {
    title: "CTL (Chronic Training Load) — Fitness",
    subtitle: "Kebugaran Aerobik Jangka Panjang",
    definition:
      "Mengukur tabungan kebugaran Anda berdasarkan rata-rata eksponensial beban latihan (Training Load / rTSS) selama 42 hari terakhir. Semakin tinggi angka CTL, semakin besar kapasitas paru-paru dan stamina otot Anda.",
    sweetSpot: "Naik bertahap +5 s/d +8 poin per minggu (jangan loncat drastis).",
    source: "Dr. Eric Bannister (1975) & Dr. Andrew Coggan (PMC Science)",
  },
  atl: {
    title: "ATL (Acute Training Load) — Fatigue",
    subtitle: "Kelelahan Fisik Jangka Pendek",
    definition:
      "Mengukur tingkat stres dan kelelahan fisiologis tubuh Anda berdasarkan rata-rata beban latihan 7 hari terakhir. ATL bereaksi cepat saat Anda latihan berat dan meluruh drastis saat istirahat.",
    sweetSpot: "Boleh tinggi saat fase latihan berat, tetapi harus diturunkan saat taper sebelum lomba.",
    source: "Bannister Impulse-Response Fatigue Model",
  },
  tsb: {
    title: "TSB (Training Stress Balance) — Form",
    subtitle: "Kesiapan Tempur Hari Ini (CTL - ATL)",
    definition:
      "Menggambarkan apakah tubuh Anda sedang segar bugar atau kelelahan. Rumusnya: Kebugaran (CTL) dikurangi Kelelahan (ATL).",
    sweetSpot:
      "+5 s/d +15 (Fresh / Siap Balap), -10 s/d -30 (Optimal Training / Produktif), < -30 (Zona Bahaya Cedera / Overreaching).",
    source: "Joe Friel & Andrew Coggan Athletic Performance Model",
  },
  ramp_rate: {
    title: "Ramp Rate — Kenaikan Kebugaran Mingguan",
    subtitle: "Kecepatan Menambah Beban Latihan",
    definition:
      "Perubahan angka CTL (Fitness) Anda dalam 7 hari terakhir. Menjadi indikator apakah Anda menambah porsi latihan secara bertahap atau terlalu bernafsu.",
    sweetSpot: "+5 s/d +8 poin/minggu (Aman & Efektif). Kenaikan > +10 poin/minggu berisiko tinggi cedera sendi/tendon.",
    source: "Endurance Sports Science Workload Ramp Guidelines",
  },
  acwr: {
    title: "ACWR (Acute:Chronic Workload Ratio)",
    subtitle: "Rasio Beban Akut vs Kronis (Gabbett)",
    definition:
      "Membandingkan kelelahan 7 hari terakhir (beban akut) dengan kebugaran 28 hari terakhir (beban kronis). Menjadi standar emas kedokteran olahraga untuk memprediksi risiko cedera.",
    sweetSpot: "0.8 – 1.3 (Sweet Spot / Aman Maksimal). Jika > 1.5, risiko cedera melonjak 2–4 kali lipat (*Danger Spike*).",
    source: "Prof. Tim Gabbett (2016), British Journal of Sports Medicine",
  },
  monotony: {
    title: "Training Monotony (Keseragaman Beban)",
    subtitle: "Variasi Beban Hari ke Hari",
    definition:
      "Rasio rata-rata beban harian dibagi deviasi standarnya dalam 7 hari. Angka tinggi berarti latihan Anda setiap hari 'begitu-begitu saja' tanpa hari istirahat yang benar-benar santai.",
    sweetSpot: "< 1.5 (Sehat, ada variasi keras & santai). > 2.0 (Terlalu monoton, memicu overtraining syndrome).",
    source: "Dr. Carl Foster (1998), University of Wisconsin",
  },
  strain: {
    title: "Training Strain (Beban Kumulatif Foster)",
    subtitle: "Total Beban Fisiologis Mingguan",
    definition:
      "Hasil kali antara Total Beban Mingguan dikalikan Angka Monotony. Menunjukkan seberapa dalam stres fisiologis yang dialami sistem imun dan otot Anda.",
    sweetSpot: "Di bawah 4.000 (Aman). Di atas 6.000 menandakan tubuh sangat rentan terserang flu, demam, atau burnout.",
    source: "Foster's Athletic Monitoring Model",
  },
  tid: {
    title: "TID (Training Intensity Distribution)",
    subtitle: "Distribusi Intensitas Latihan (80/20)",
    definition:
      "Proporsi waktu latihan di Zona Santai (Z1/Z2 Aerobik), Zona Menengah (Z3 Tempo/Threshold), dan Zona Keras (Z4/Z5 Anaerobik/VO2Max).",
    sweetSpot: "Polarized / Pyramidal: Minimal 75-80% latihan wajib di Zona 1 & 2 agar fondasi aerobik pembakar lemak terbentuk kokoh.",
    source: "Dr. Stephen Seiler (2006) & Dr. Matt Fitzgerald (80/20 Running)",
  },
  decoupling: {
    title: "Aerobic Decoupling (Cardiac Drift)",
    subtitle: "Penyimpangan Detak Jantung vs Pace (Pa:HR)",
    definition:
      "Mengukur kestabilan jantung saat lari dengan kecepatan konstan. Jika pace tetap sama tetapi detak jantung perlahan naik tinggi, berarti jantung Anda mengalami stres termal/kelelahan aerobik.",
    sweetSpot: "< 3.5% – 5.0% (Aerobic Base Kuat / Bebas ADS). > 5.0% (Menandakan kekurangan fondasi aerobik Zona 2).",
    source: "Joe Friel (Total Heart Rate Training) & Scott Johnston (Uphill Athlete)",
  },
  hrv: {
    title: "HRV (Heart Rate Variability — RMSSD)",
    subtitle: "Variabilitas Detak Jantung / Sistem Saraf",
    definition:
      "Variasi milidetik antar detak jantung saat Anda tidur. HRV tinggi menandakan sistem saraf parasimpatik (pemulihan & regenerasi) aktif bekerja.",
    sweetSpot: "Status 'NORMAL' sesuai baseline pribadi COROS Anda. Jika drop drastis di bawah normal, tubuh Anda sedang melawan stres/infeksi.",
    source: "Autonomic Nervous System & COROS EvoLab Science",
  },
  recovery_score: {
    title: "Recovery Score (%)",
    subtitle: "Kesiapan Fisik Harian Jam COROS",
    definition:
      "Indeks komprehensif dari COROS yang menggabungkan kualitas tidur semalam, HRV, resting heart rate, dan beban latihan hari sebelumnya.",
    sweetSpot: "80% - 100% (Siap Latihan Berat / Race), 60% - 79% (Latihan Sedang), < 60% (Istirahat / Easy Jog).",
    source: "COROS EvoLab Recovery Algorithm",
  },
  resting_hr: {
    title: "Resting Heart Rate (RHR)",
    subtitle: "Denyut Nadi Istirahat",
    definition:
      "Denyut nadi terendah saat Anda tidur atau beristirahat total. RHR atlet endurance terlatih umumnya sangat rendah (40–55 bpm) karena volume sekuncup jantung (*stroke volume*) yang besar.",
    sweetSpot: "Jika RHR pagi Anda naik 5–7 bpm di atas rata-rata, itu sinyal awal tubuh belum pulih atau akan sakit.",
    source: "Cardiovascular Endurance Physiology",
  },
  vam: {
    title: "VAM (Velocità Ascensionale Media)",
    subtitle: "Kecepatan Nanjak Vertikal (Meter / Jam)",
    definition:
      "Mengukur berapa meter vertikal (D+) yang bisa Anda daki dalam waktu 1 jam di tanjakan gunung. Menjadi acuan utama untuk memprediksi waktu tiba di pos balapan trail.",
    sweetSpot: "400 - 600 m/jam (Solid Mountain Runner), 600 - 800 m/jam (Advanced), > 800 m/jam (Elite/VK specialist).",
    source: "Dr. Michele Ferrari (Cycling/Running VAM Model)",
  },
  km_effort: {
    title: "ITRA Km-Effort",
    subtitle: "Jarak Setara Datar (Km + D+/100)",
    definition:
      "Formula resmi asosiasi trail internasional (ITRA) untuk menyetarakan beban lari gunung dengan jalan datar. Setiap 100 meter tanjakan vertikal (D+) dihitung setara menambah 1 km lari datar.",
    sweetSpot: "Contoh: Lari 36 km dengan +2.200m D+ memiliki beban fisik setara lari 58 km di jalan aspal datar!",
    source: "International Trail Running Association (ITRA) Regulations",
  },
  gap: {
    title: "GAP (Grade Adjusted Pace — Minetti Model)",
    subtitle: "Pace Normalisasi Tanjakan",
    definition:
      "Pace ekuivalen jika Anda berlari dengan output tenaga yang sama di jalan aspal datar, dihitung menggunakan kurva beban metabolik tanjakan Dr. Alberto Minetti.",
    sweetSpot: "Membantu Anda tidak panik saat pace di tanjakan melambat ke 14:00/km, karena tenaga aslinya setara 5:30/km di jalan datar.",
    source: "Dr. Alberto E. Minetti (2002), Journal of Applied Physiology",
  },
  climb_density: {
    title: "Climb Density Ratio (D+ / Km)",
    subtitle: "Tingkat Kecuraman Jalur Gunung",
    definition:
      "Rasio antara total elevasi tanjakan (D+) dibagi jarak horizontal (km). Menentukan apakah lomba tersebut tergolong lari santai, pegunungan, atau skyrunning terjal.",
    sweetSpot: "<25 m/km (Rolling), 25-60 m/km (Moderate Mountain), 60-95 m/km (High Alpine), >95 m/km (Skyrunning).",
    source: "Kílian Jornet & Scott Johnston, 'Training for the Uphill Athlete'",
  },
  ads: {
    title: "Aerobic Deficiency Syndrome (ADS)",
    subtitle: "Sindrom Defisiensi Aerobik Pembakar Lemak",
    definition:
      "Kondisi ketika mesin pembakaran lemak tubuh kurang terlatih karena terlalu sering lari di intensitas menengah/tinggi (Zona 3/4). Akibatnya, glikogen cepat habis dan pelari mudah lemas (*bonking*) di tanjakan panjang.",
    sweetSpot: "Status 'No ADS Detected' berarti metabolisme lemak Anda sangat kokoh (diuji via Decoupling < 3.5%).",
    source: "Scott Johnston, Uphill Athlete Aerobic Threshold Diagnostics",
  },
  cumulative_gain: {
    title: "Cumulative Gain (D+) — Total Tanjakan",
    subtitle: "Akumulasi Kenaikan Elevasi Barometrik",
    definition:
      "Jumlah total elevasi tanjakan (meter D+) yang tercatat oleh sensor barometer jam COROS dari seluruh sesi latihan di database Anda (periode 90 hari). Menunjukkan akumulasi daya tanjak yang sudah dilatih otot kaki Anda.",
    sweetSpot: "Rutin mengumpulkan 1.000m - 2.500m D+ per minggu saat fase persiapan lomba ultra trail.",
    source: "COROS Barometric Altimeter Sensor & GPS Elevation Engine",
  },
  cumulative_loss: {
    title: "Cumulative Loss (D-) — Total Turunan",
    subtitle: "Akumulasi Beban Eksentrik Kuadrisep",
    definition:
      "Jumlah total penurunan vertikal (meter D-) dari seluruh aktivitas lari Anda. Lari di turunan memberikan stres benturan eksentrik tinggi pada otot paha depan (quadriceps), yang wajib dilatih agar paha tidak hancur/kram saat balap.",
    sweetSpot: "Volume D- idealnya seimbang dengan D+ untuk melatih 'Quad Armor' tanpa merusak sendi lutut.",
    source: "Eccentric Muscle Contraction Science & Kilian Jornet Quad Armor Model",
  },
  readiness: {
    title: "Training Readiness & Suggestion",
    subtitle: "Rekomendasi Latihan Harian Berbasis Sains Olahraga",
    definition:
      "Kalkulasi murni deterministik (tanpa halusinasi AI) yang menggabungkan status TSB Form (Banister), plafon beban aman ACWR Governor (Gabbett 2016), dan recovery otonom tubuh. Memberikan panduan target beban, durasi, dan zona intensitas optimal untuk hari berikutnya.",
    sweetSpot: "Ikuti rekomendasi Active Recovery pasca sesi berat (TL ≥ 80) agar adaptasi glikogen dan otot tercapai maksimal tanpa risiko cedera.",
    source: "Banister (1991), Coggan & Allen (2010), Gabbett (2016 BJSM), Plews et al. (2013)",
  },
  trail_race_mode: {
    title: "Race Target Finish Time (Race Mode)",
    subtitle: "Pacing Lomba Berbasis Ambang Aerobik & Trekking Poles",
    definition:
      "Prediksi kompetisi optimal dengan formula Adaptive Split-Segment: Total = T_nanjak + T_turun + T_datar + T_pos. Tanjakan menggunakan rata-rata VAM riil COROS Anda dinaikkan 35% (efisiensi poles & taper) dengan koreksi kelelahan Peter Riegel, turunan agresif (1.500–1.650 m/h), dan jeda efisien di water station (20 detik/km).",
    sweetSpot: "Target ideal jika mengejar Cut-Off Time (COT) atau mengincar target waktu kompetisi.",
    source: "Minetti et al. (2002) Gradient Cost, Giovanelli (2016) VAM, & Peter Riegel (1981)",
  },
  trail_conservative_mode: {
    title: "Conservative Finisher Time (Base Z2)",
    subtitle: "Pacing Santai Bertahan Berbasis Zona 2 Rendah",
    definition:
      "Prediksi waktu 'Survive & Finish' dengan denyut jantung tetap di Zona 1–2 (Fat-Max) untuk mencegah kram & bonking. Menanjak pada baseline VAM riil tanpa dipaksa, turunan defensif (1.200–1.350 m/h) guna melindungi sendi lutut dari benturan eksentrik, serta jeda istirahat pos yang leluasa (40 detik/km).",
    sweetSpot: "Strategi terbaik untuk debut ultra marathon, rute teknikal berbatu lepas, atau cuaca ekstrem.",
    source: "Millet et al. (2011) Eccentric Fatigue & Kilian Jornet Base Pacing Model",
  },
};

export const METRIC_GLOSSARY_EN: Record<MetricTerm, MetricDefinition> = {
  ctl: {
    title: "CTL (Chronic Training Load) — Fitness",
    subtitle: "Long-Term Aerobic Base & Fitness",
    definition:
      "Measures your aerobic fitness foundation based on an exponentially weighted 42-day rolling average of daily Training Load (rTSS). Higher CTL reflects greater cardiovascular capacity and muscular endurance.",
    sweetSpot: "Progressive ramp of +5 to +8 points/week. Avoid sudden volume spikes.",
    source: "Dr. Eric Bannister (1975) & Dr. Andrew Coggan (PMC Modeling)",
  },
  atl: {
    title: "ATL (Acute Training Load) — Fatigue",
    subtitle: "Short-Term Physiological Fatigue",
    definition:
      "Measures immediate physiological fatigue based on an exponential 7-day average of Training Load. Spikes quickly with intense sessions and decays rapidly with rest.",
    sweetSpot: "Expected to spike during hard training blocks; should decay during taper before race day.",
    source: "Bannister Impulse-Response Model",
  },
  tsb: {
    title: "TSB (Training Stress Balance) — Form",
    subtitle: "Race Readiness & Freshness (CTL - ATL)",
    definition:
      "Quantifies how fresh or fatigued you are today by subtracting Fatigue (ATL) from Fitness (CTL). Positive values reflect freshness; negative values indicate accumulated fatigue.",
    sweetSpot:
      "+5 to +15 (Fresh / Peak Race Day), -10 to -30 (Optimal Training Stress), < -30 (High Injury Risk / Overreaching).",
    source: "Joe Friel & Andrew Coggan Athletic Performance Model",
  },
  ramp_rate: {
    title: "Ramp Rate — Weekly Fitness Progression",
    subtitle: "Rate of Training Load Progression",
    definition:
      "The net change in your CTL (Fitness) over the trailing 7 days. Key indicator for sustainable workload progression.",
    sweetSpot: "+5 to +8 pts/week is safe and effective. Ramp rate > +10 pts/week significantly elevates soft-tissue injury risk.",
    source: "Endurance Sports Science Workload Guidelines",
  },
  acwr: {
    title: "ACWR (Acute:Chronic Workload Ratio)",
    subtitle: "Injury Risk Index (Gabbett Model)",
    definition:
      "Compares acute workload (7-day average) against chronic fitness (28-day average). The global gold standard in sports medicine for workload safety and injury prevention.",
    sweetSpot: "0.8 – 1.3 (Sweet Spot / Optimal Adaptability). Values > 1.5 indicate an injury danger spike.",
    source: "Prof. Tim Gabbett (2016), British Journal of Sports Medicine",
  },
  monotony: {
    title: "Training Monotony — Daily Load Variability",
    subtitle: "Session-to-Session Load Uniformity",
    definition:
      "Mean daily load divided by its 7-day standard deviation. High values indicate repetitive, unvaried daily training without true restorative rest.",
    sweetSpot: "< 1.5 is healthy with good hard/easy variation. > 2.0 indicates excessive monotony and risk of overtraining.",
    source: "Dr. Carl Foster (1998), University of Wisconsin",
  },
  strain: {
    title: "Training Strain — Cumulative Physiological Stress",
    subtitle: "Weekly Total Stress Index",
    definition:
      "Product of total weekly training load multiplied by training monotony. Quantifies systemic stress on immune function and muscular repair.",
    sweetSpot: "< 4,000 is safe. Values > 6,000 indicate high susceptibility to illness, systemic inflammation, or burnout.",
    source: "Foster's Athletic Monitoring Model",
  },
  tid: {
    title: "TID (Training Intensity Distribution)",
    subtitle: "Aerobic vs Anaerobic Time Allocation (80/20)",
    definition:
      "Allocation of training time between Low Intensity (Z1/Z2 Aerobic), Moderate Intensity (Z3 Tempo/Threshold), and High Intensity (Z4/Z5 VO2max/Anaerobic).",
    sweetSpot: "Polarized / Pyramidal: At least 75-80% of total volume should remain in Zone 1-2 to optimize mitochondrial density and fat oxidation.",
    source: "Dr. Stephen Seiler (2006) & Dr. Matt Fitzgerald (80/20 Running)",
  },
  decoupling: {
    title: "Aerobic Decoupling (Cardiac Drift)",
    subtitle: "Heart Rate to Pace Relationship (Pa:HR)",
    definition:
      "Evaluates cardiovascular stability during sustained steady-state running. If heart rate drifts upward while pace remains constant, aerobic decoupling occurs.",
    sweetSpot: "< 3.5% – 5.0% reflects a strong aerobic base. > 5.0% indicates dehydration, thermal stress, or insufficient Zone 2 base.",
    source: "Joe Friel & Scott Johnston (Training for the Uphill Athlete)",
  },
  hrv: {
    title: "HRV (Heart Rate Variability — rMSSD)",
    subtitle: "Autonomic Nervous System Recovery",
    definition:
      "Millisecond variation between successive heartbeats during sleep. High nocturnal HRV signifies parasympathetic dominance (recovery and adaptation).",
    sweetSpot: "'NORMAL' status aligned with personal COROS baseline. Sharp drops indicate systemic stress, poor sleep, or oncoming illness.",
    source: "Autonomic Nervous System & COROS EvoLab Science",
  },
  recovery_score: {
    title: "Recovery Score (%)",
    subtitle: "Daily Physiological Readiness",
    definition:
      "Comprehensive readiness score calculated by COROS integrating sleep quality, nocturnal HRV, resting heart rate, and previous day's load.",
    sweetSpot: "80% - 100% (Ready for High Intensity / Race), 60% - 79% (Moderate Load), < 60% (Rest Day or Easy Spin).",
    source: "COROS EvoLab Recovery Algorithm",
  },
  resting_hr: {
    title: "Resting Heart Rate (RHR)",
    subtitle: "Basal Cardiac Frequency",
    definition:
      "Lowest pulse rate recorded during sleep or full rest. Conditioned endurance athletes exhibit low RHR (40–55 bpm) due to high cardiac stroke volume.",
    sweetSpot: "An elevation of +5 to +7 bpm above personal baseline signals incomplete recovery or impending infection.",
    source: "Cardiovascular Endurance Physiology",
  },
  vam: {
    title: "VAM (Velocità Ascensionale Media)",
    subtitle: "Vertical Climbing Velocity (m/h)",
    definition:
      "Measures vertical meters ascended per hour on steep trail climbs. Essential benchmark for pacing mountain races and estimating aid station arrival.",
    sweetSpot: "400 - 600 m/h (Solid Mountain Runner), 600 - 800 m/h (Advanced), > 800 m/h (Elite / Vertical Kilometer).",
    source: "Dr. Michele Ferrari (VAM Climbing Model)",
  },
  km_effort: {
    title: "ITRA Km-Effort",
    subtitle: "Flat-Equivalent Distance (Km + D+/100)",
    definition:
      "Standard trail running formula by ITRA equating mountain elevation to flat running. Every 100 meters of vertical gain (D+) equals an extra 1 km of flat running effort.",
    sweetSpot: "Example: 36 km with +2,200m D+ equals the physiological load of running 58 km on flat pavement.",
    source: "International Trail Running Association (ITRA)",
  },
  gap: {
    title: "GAP (Grade Adjusted Pace — Minetti Model)",
    subtitle: "Gradient-Normalized Running Pace",
    definition:
      "Equivalent running pace if you were exerting the same metabolic wattage on flat asphalt, calculated using Dr. Alberto Minetti's metabolic grade cost curve.",
    sweetSpot: "Allows runners to manage effort on climbs without panic when pace drops to 13:00/km, knowing true effort equals 5:15/km flat.",
    source: "Dr. Alberto E. Minetti (2002), Journal of Applied Physiology",
  },
  climb_density: {
    title: "Climb Density Ratio (D+ / Km)",
    subtitle: "Route Steepness & Technical Profile",
    definition:
      "Ratio of total vertical elevation gain (D+) divided by horizontal distance (km). Categorizes whether a race is rolling trail, alpine, or skyrunning.",
    sweetSpot: "< 25 m/km (Rolling), 25 - 60 m/km (Moderate Mountain), 60 - 95 m/km (High Alpine), > 95 m/km (Skyrunning).",
    source: "Kílian Jornet & Scott Johnston ('Training for the Uphill Athlete')",
  },
  ads: {
    title: "Aerobic Deficiency Syndrome (ADS)",
    subtitle: "Sub-optimal Fat Oxidation Capacity",
    definition:
      "Condition where lipid metabolism is underdeveloped due to excessive mid-intensity running (Zone 3/4). Causes rapid glycogen depletion and premature bonking on long mountain runs.",
    sweetSpot: "'No ADS Detected' indicates efficient aerobic fat burning (validated by Decoupling < 3.5%).",
    source: "Scott Johnston, Uphill Athlete Aerobic Threshold Diagnostics",
  },
  cumulative_gain: {
    title: "Cumulative Gain (D+) — Total Elevation",
    subtitle: "Barometric Vertical Ascent Total",
    definition:
      "Total vertical elevation gain (meters D+) recorded by your COROS watch across all workouts in the database (90-day window). Quantifies accumulated uphill climbing volume.",
    sweetSpot: "1,000m - 2,500m D+ weekly accumulation during peak ultra-trail preparation blocks.",
    source: "COROS Barometric Altimeter Sensor & GPS Elevation Engine",
  },
  cumulative_loss: {
    title: "Cumulative Loss (D-) — Total Descent",
    subtitle: "Eccentric Quadriceps Load Total",
    definition:
      "Total vertical descent (meters D-) across all sessions. Downhill running imposes heavy eccentric muscle stress on the quadriceps, essential for building race resistance.",
    sweetSpot: "D- volume should ideally track D+ to build 'Quad Armor' without excessive knee joint wear.",
    source: "Eccentric Muscle Contraction Science & Kilian Jornet Quad Armor Model",
  },
  readiness: {
    title: "Training Readiness & Suggestion",
    subtitle: "Science-Backed Daily Workout Recommendation",
    definition:
      "Deterministic calculation combining TSB Form (Bannister), safe load ceilings (Gabbett ACWR Governor), and autonomic recovery. Guides optimal target load, duration, and intensity zone for the next day.",
    sweetSpot: "Adhere to Active Recovery recommendations following hard sessions (TL >= 80) to maximize adaptation and minimize injury risk.",
    source: "Bannister (1991), Coggan & Allen (2010), Gabbett (2016 BJSM), Plews et al. (2013)",
  },
  trail_race_mode: {
    title: "Race Target Finish Time (Race Mode)",
    subtitle: "Physiological Race Target Pacing Model",
    definition:
      "Optimal competitive finish projection using the Adaptive Split-Segment formula: Total = T_uphill + T_downhill + T_flat + T_aid. Climbing speed scales your real historical COROS VAM by +35% (poles & race taper efficiency) with Peter Riegel ultra fatigue decay, aggressive descent (1,500–1,650 m/h), and swift aid station stops (20s/km).",
    sweetSpot: "Ideal benchmark for beating tight Cut-Off Times (COT) or age-group targets with disciplined fueling.",
    source: "Minetti et al. (2002) Gradient Cost, Giovanelli (2016) VAM, & Peter Riegel (1981)",
  },
  trail_conservative_mode: {
    title: "Conservative Finisher Time (Base Z2)",
    subtitle: "Low Z2 Aerobic Base & Safe Finish Model",
    definition:
      "Safe 'Survive & Finish' projection keeping heart rate strictly within Zones 1-2 (Fat-Max) to eliminate bonking risk. Ascends at your natural unamplified COROS baseline VAM, descends conservatively (1,200–1,350 m/h) to protect quadriceps and knee joints from eccentric damage, with relaxed aid station buffers (40s/km).",
    sweetSpot: "Best strategy for ultra debuts, extreme weather, or loose volcanic scree terrain.",
    source: "Millet et al. (2011) Neuromuscular Fatigue in Ultra & Kilian Jornet Base Pacing",
  },
};

import { createPortal } from "react-dom";

interface MetricTooltipProps {
  term: MetricTerm;
  children?: React.ReactNode;
  iconOnly?: boolean;
  className?: string;
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  term,
  children,
  iconOnly = false,
  className = "",
}) => {
  const { language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
    arrowLeft: number;
  } | null>(null);

  const glossary = language === "en" ? METRIC_GLOSSARY_EN : METRIC_GLOSSARY;
  const data = glossary[term] || METRIC_GLOSSARY[term];
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    const popoverHeight = popoverRef.current?.offsetHeight || 250;

    // Check collision with top of viewport / sticky navbar (~65px)
    const spaceAbove = rect.top;
    const placement: "top" | "bottom" = spaceAbove >= popoverHeight + 70 ? "top" : "bottom";

    // Center horizontally on trigger
    const triggerCenter = rect.left + rect.width / 2;
    let left = triggerCenter - tooltipWidth / 2;

    // Clamp horizontally inside viewport
    const minLeft = 16;
    const maxLeft = window.innerWidth - tooltipWidth - 16;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    // Arrow position relative to popover box
    const arrowLeft = Math.max(16, Math.min(tooltipWidth - 16, triggerCenter - left));
    const top = placement === "top" ? rect.top - 8 : rect.bottom + 8;

    setCoords({ top, left, placement, arrowLeft });
  }, []);

  // Recalculate on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true, capture: true });
    window.addEventListener("resize", updatePosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  if (!data) return <>{children}</>;

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative inline-flex items-center group cursor-pointer ${className}`}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        {children ? (
          <span className="inline-flex items-center gap-1 border-b border-dotted border-zinc-500 hover:border-cyan-400 transition-colors">
            {children}
            <HelpCircle className="h-3 w-3 text-zinc-500 group-hover:text-cyan-400 transition-colors shrink-0" />
          </span>
        ) : (
          <HelpCircle className="h-3.5 w-3.5 text-zinc-500 hover:text-cyan-400 transition-colors shrink-0" />
        )}
      </div>

      {/* Floating Tooltip Popover rendered in Portal above everything (z-[99999]) */}
      {isOpen &&
        mounted &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[99999] w-72 sm:w-80 p-3.5 rounded-xl bg-zinc-950/95 border border-cyan-500/50 text-left shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl space-y-2 pointer-events-auto transition-opacity animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.placement === "top" ? "translateY(-100%)" : "none",
              maxWidth: "calc(100vw - 32px)",
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {/* Directional Arrow */}
            {coords.placement === "top" ? (
              <div
                className="absolute top-full -mt-1 border-4 border-transparent border-t-cyan-500/50"
                style={{ left: `${coords.arrowLeft}px`, transform: "translateX(-50%)" }}
              />
            ) : (
              <div
                className="absolute bottom-full -mb-1 border-4 border-transparent border-b-cyan-500/50"
                style={{ left: `${coords.arrowLeft}px`, transform: "translateX(-50%)" }}
              />
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
              <div>
                <h4 className="text-xs font-black text-white leading-tight">{data.title}</h4>
                <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">{data.subtitle}</p>
              </div>
              <span className="h-5 w-5 rounded-md bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-300 shrink-0">
                <Info className="h-3 w-3" />
              </span>
            </div>

            {/* Definition */}
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">{data.definition}</p>

            {/* Sweet Spot */}
            <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800/80 space-y-0.5 text-[10px]">
              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                <Target className="h-3 w-3 shrink-0" />
                <span>{language === "en" ? "Sweet Spot / Optimal Range:" : "Sweet Spot / Target Ideal:"}</span>
              </div>
              <p className="text-zinc-300 font-mono leading-normal">{data.sweetSpot}</p>
            </div>

            {/* Theoretical Source */}
            <div className="flex items-center gap-1 text-[9px] text-zinc-500 pt-0.5 font-mono">
              <BookOpen className="h-3 w-3 shrink-0 text-zinc-600" />
              <span className="truncate">{data.source}</span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
