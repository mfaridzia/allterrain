"use client";

import React from "react";
import { ShieldCheck, Lock, Database, UserX, Trash2, Mail } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/lib/i18n/context";

export default function PrivacyPolicyPage() {
  const { language } = useTranslation();
  const isId = language === "id";

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8 pt-6">
        {/* Title */}
        <section className="space-y-2 border-b-2 border-zinc-950 pb-6">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950 leading-tight">
            {isId ? "Kebijakan Privasi ALLTERRAIN" : "ALLTERRAIN Privacy Policy"}
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
              <Lock className="h-5 w-5 text-emerald-600 stroke-[2.5]" />
              <h2>{isId ? "1. Komitmen & Kedaulatan Data Anda" : "1. Our Privacy Commitment & Data Sovereignty"}</h2>
            </div>
            <p>
              {isId
                ? "ALLTERRAIN dirancang dengan arsitektur privacy-first (mengutamakan privasi). Kami meyakini bahwa data performa atletik, telemetri fisiologis, dan rute GPS Anda sepenuhnya merupakan milik pribadi Anda. Kami tidak memonetisasi, tidak memasang pelacak iklan, dan tidak memperjualbelikan data Anda kepada pihak ketiga mana pun."
                : "ALLTERRAIN is built with a privacy-first architecture. We believe that your athletic telemetry, physiological markers, and GPS route data belong solely to you. We do not monetize, do not run advertising trackers, and will never sell or broker your personal data to any third party."}
            </p>
          </article>

          {/* Section 2 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <Database className="h-5 w-5 text-blue-600 stroke-[2.5]" />
              <h2>{isId ? "2. Data yang Dikumpulkan via COROS MCP" : "2. Data Collected via Official COROS MCP"}</h2>
            </div>
            <p>
              {isId
                ? "Ketika Anda menghubungkan akun COROS atau memasukkan Bearer Token, aplikasi memproses data berikut secara langsung dari antarmuka resmi COROS API:"
                : "When you authorize your COROS account or input a manual Bearer Token, ALLTERRAIN synchronizes the following data through official COROS API protocols:"}
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm text-zinc-700">
              <li>
                <strong>{isId ? "Token Akses:" : "Authorization Tokens:"}</strong>{" "}
                {isId ? "Token OAuth yang dienkripsi untuk sinkronisasi data latihan." : "Encrypted OAuth tokens used strictly to authenticate API sync requests."}
              </li>
              <li>
                <strong>{isId ? "Telemetri Latihan:" : "Workout Telemetry:"}</strong>{" "}
                {isId ? "Jarak, durasi, heart rate, cadence, elevasi, kurva pace splits, dan Training Load (rTSS/TRIMP)." : "Distance, elapsed time, heart rate, cadence, elevation gain/loss, pace splits, and Training Load (rTSS/TRIMP)."}
              </li>
              <li>
                <strong>{isId ? "Metrik Pemulihan:" : "Recovery & Biomarkers:"}</strong>{" "}
                {isId ? "Resting Heart Rate, skor pemulihan, dan HRV jika tersedia dari jam COROS Anda." : "Resting heart rate, recovery scores, and HRV status if recorded by your COROS watch."}
              </li>
            </ul>
          </article>

          {/* Section 3 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <ShieldCheck className="h-5 w-5 text-orange-600 stroke-[2.5]" />
              <h2>{isId ? "3. Keamanan Penyimpanan & Enkripsi" : "3. Storage & Encryption Architecture"}</h2>
            </div>
            <p>
              {isId
                ? "Data latihan Anda disimpan secara aman di database privat terenkripsi. Token autentikasi dienkripsi saat disimpan (encryption-at-rest). Akses database dilindungi oleh lapisan otentikasi ketat dan tidak dapat diakses oleh publik."
                : "Your training data is stored in your private encrypted database instance. Access tokens are encrypted at rest using industry-standard cryptography. The database is shielded behind secure session boundaries and is never accessible to the public internet."}
            </p>
          </article>

          {/* Section 4 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <UserX className="h-5 w-5 text-rose-600 stroke-[2.5]" />
              <h2>{isId ? "4. Kebijakan AI Coach (BYOK)" : "4. AI Coach Policy (Bring Your Own Key)"}</h2>
            </div>
            <p>
              {isId
                ? "Fitur AI Training Coach beroperasi dengan model Bring-Your-Own-Key (BYOK). API Key yang Anda masukkan (misal DeepSeek, Claude, OpenAI, atau Gemini) hanya digunakan secara langsung untuk memanggil endpoint resmi penyedia AI pilihan Anda. ALLTERRAIN tidak pernah menyimpan, mencatat, atau membagikan API key Anda kepada pihak luar."
                : "The AI Training Coach operates on a Bring-Your-Own-Key (BYOK) paradigm. The API keys you supply (DeepSeek, Claude, OpenAI, or Gemini) are used strictly to communicate directly with your selected AI provider. ALLTERRAIN never logs, intercepts, or redistributes your private API keys."}
            </p>
          </article>

          {/* Section 5 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <Trash2 className="h-5 w-5 text-zinc-700 stroke-[2.5]" />
              <h2>{isId ? "5. Hak Penghapusan & Pemutusan Akun" : "5. Data Retention & Account Disconnection"}</h2>
            </div>
            <p>
              {isId
                ? "Anda dapat memutus koneksi akun COROS kapan saja dengan menekan tombol 'Putuskan Akun' (Disconnect) di bilah navigasi atas. Melakukan disconnect akan secara instan menghapus token akses aktif dan membatalkan sesi Anda."
                : "You may revoke access to your COROS account at any time by clicking the 'Disconnect' button in the application header. Disconnecting immediately invalidates and deletes your active authorization tokens and terminates your active session."}
            </p>
          </article>

          {/* Section 6 */}
          <article className="p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3">
            <div className="flex items-center gap-2.5 font-black text-zinc-950 text-base">
              <Mail className="h-5 w-5 text-purple-600 stroke-[2.5]" />
              <h2>{isId ? "6. Kontak & Pertanyaan" : "6. Contact & Inquiries"}</h2>
            </div>
            <p>
              {isId
                ? "Jika Anda memiliki pertanyaan seputar kebijakan privasi ini atau pengelolaan data di ALLTERRAIN, silakan hubungi pengembang:"
                : "If you have questions or concerns regarding this Privacy Policy or how your data is handled in ALLTERRAIN, please contact the developer:"}
            </p>
            <p className="font-mono text-xs font-bold text-zinc-950 bg-zinc-100 p-3 rounded-xl border-2 border-zinc-950 inline-block shadow-[2px_2px_0px_0px_#09090b]">
              Muhammad Farid Zia ·{" "}
              <a href="mailto:muhfaridzia@gmail.com" className="text-orange-600 underline">
                muhfaridzia@gmail.com
              </a>
            </p>
          </article>
        </div>

      </main>

      <Footer />
    </div>
  );
}
