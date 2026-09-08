"use client";

import React from "react";
import Link from "next/link";
import { FileText, AlertTriangle, ShieldCheck, HeartPulse, Scale, Mail } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/lib/i18n/context";

export default function TermsOfServicePage() {
  const { language } = useTranslation();
  const isId = language === "id";

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8 pt-6">
        {/* Title */}
        <section className="space-y-2 border-b-2 border-zinc-950 pb-6">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950 leading-tight">
            {isId ? "Ketentuan Layanan ALLTERRAIN" : "ALLTERRAIN Terms of Service"}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-bold">
            {isId ? "Terakhir diperbarui: September 2026" : "Last Updated: September 2026"}
          </p>
        </section>

        {/* Content Sections */}
        <div className="space-y-6 text-sm text-zinc-800 leading-relaxed font-medium">
          {/* Section 1 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <ShieldCheck className="h-5 w-5 text-emerald-600 stroke-[2.5]" />
              <h2>{isId ? "1. Penerimaan Ketentuan" : "1. Acceptance of Terms"}</h2>
            </div>
            <p>
              {isId
                ? "Dengan mengakses web ALLTERRAIN, menghubungkan akun COROS Anda, atau mengunggah data latihan, Anda menyatakan telah membaca, memahami, dan menyetujui Ketentuan Layanan ini. Jika Anda tidak menyetujui ketentuan ini, mohon untuk tidak menggunakan layanan ini."
                : "By accessing ALLTERRAIN, connecting your COROS account, or synchronizing training data, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree to these terms, please do not use this platform."}
            </p>
          </article>

          {/* Section 2 - CRITICAL MEDICAL DISCLAIMER */}
          <article className="p-6 rounded-2xl bg-[#FFF8E6] border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <HeartPulse className="h-5 w-5 text-rose-600 stroke-[2.5]" />
              <h2>{isId ? "2. SANGGAHAN MEDIS (Medical Disclaimer)" : "2. IMPORTANT NON-MEDICAL DISCLAIMER"}</h2>
            </div>
            <p className="text-zinc-900 font-bold">
              {isId
                ? "ALLTERRAIN BUKAN ALAT MEDIS DAN TIDAK MENYEDIAKAN NASIHAT ATAU DIAGNOSIS MEDIS."
                : "ALLTERRAIN IS NOT A MEDICAL DEVICE AND DOES NOT PROVIDE LICENSED MEDICAL, CLINICAL, OR PHYSIOTHERAPY ADVICE."}
            </p>
            <p>
              {isId
                ? "Semua kalkulasi fisiologis—termasuk kurva Banister PMC (Fitness/Fatigue/Form), rasio risiko cedera ACWR, rekomendasi kesiapan latihan harian, evaluasi cardiac drift, dan estimasi nutrisi lomba trail—adalah model estimasi berbasis sains olahraga untuk tujuan edukasi dan peningkatan performa atletik. Anda bertanggung jawab penuh atas keputusan latihan fisik Anda. Selalu konsultasikan dengan dokter atau ahli kesehatan berlisensi sebelum memulai program latihan intensif."
                : "All physiological calculations—including Banister PMC curves (CTL/ATL/TSB), ACWR injury risk ratio, daily training readiness prescriptions, aerobic decoupling (Pa:HR), and trail fueling guidelines—are sports science mathematical estimates intended strictly for athletic performance and educational purposes. You assume full personal responsibility for your physical training. Always consult with a qualified medical professional before undertaking rigorous physical exercise."}
            </p>
          </article>

          {/* Section 3 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <Scale className="h-5 w-5 text-blue-600 stroke-[2.5]" />
              <h2>{isId ? "3. Batasan Tanggung Jawab" : "3. Limitation of Liability"}</h2>
            </div>
            <p>
              {isId
                ? "Sejauh yang diizinkan oleh hukum yang berlaku, pengembang ALLTERRAIN tidak bertanggung jawab atas cedera fisik, gangguan kesehatan, kelelahan berlebih (overtraining), ketidakakuratan data sensor perangkat wearable, atau kerugian langsung maupun tidak langsung yang timbul akibat penggunaan atau ketergantungan pada metrik yang ditampilkan oleh platform ini."
                : "To the maximum extent permitted by law, ALLTERRAIN and its maintainers shall not be liable for any physical injury, health complications, overtraining syndromes, wearable hardware telemetry inaccuracies, or direct/indirect damages arising from reliance upon the metrics or recommendations provided by this application."}
            </p>
          </article>

          {/* Section 4 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-600 stroke-[2.5]" />
              <h2>{isId ? "4. Kepatuhan & Hak Kekayaan Intelektual" : "4. API Compliance & Intellectual Property"}</h2>
            </div>
            <p>
              {isId
                ? "ALLTERRAIN beroperasi secara independen menggunakan integrasi resmi COROS Open API / Model Context Protocol (MCP). COROS adalah merek dagang terdaftar milik COROS Wearables Inc. ALLTERRAIN tidak terafiliasi, disponsori, atau didukung secara resmi oleh COROS Wearables Inc. Seluruh kode, desain antarmuka, dan algoritma platform ini dilindungi oleh hak cipta pengembang."
                : "ALLTERRAIN operates independently using official COROS Open API and Model Context Protocol (MCP) integrations. COROS is a registered trademark of COROS Wearables Inc. ALLTERRAIN is not formally affiliated with, sponsored by, or endorsed by COROS Wearables Inc. All custom algorithms, user interfaces, and source code are the intellectual property of the maintainer."}
            </p>
          </article>

          {/* Section 5 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <Mail className="h-5 w-5 text-purple-600 stroke-[2.5]" />
              <h2>{isId ? "5. Pertanyaan & Kontak" : "5. Questions & Contact"}</h2>
            </div>
            <p>
              {isId
                ? "Jika Anda memiliki pertanyaan seputar ketentuan layanan ini, silakan hubungi:"
                : "If you have questions regarding these Terms of Service, please reach out directly:"}
            </p>
            <p className="font-mono text-xs font-bold text-zinc-950 bg-zinc-100 p-3 rounded-xl border-2 border-zinc-950 inline-block shadow-[2px_2px_0px_0px_#09090b]">
              Muhammad Farid Zia ·{" "}
              <a href="mailto:muhfaridzia@gmail.com" className="text-orange-600 underline">
                muhfaridzia@gmail.com
              </a>
            </p>
          </article>
        </div>

        {/* Back Link */}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border-2 border-zinc-950 font-black text-xs text-zinc-900 shadow-[3px_3px_0px_0px_#09090b] hover:bg-orange-50 hover:border-orange-600 hover:text-orange-600 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <span>{isId ? "← Kembali ke Overview" : "← Back to Overview"}</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
