import { Metadata } from "next";
import { getPublicAthleteProfile } from "@/lib/public-profile";
import { PublicProfileView } from "@/components/PublicProfileView";

interface PageProps {
  params: Promise<{
    username: string;
  }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { username } = await props.params;
  const decodedUsername = decodeURIComponent(username);

  const profile = await getPublicAthleteProfile(decodedUsername);

  if (!profile.found || !profile.isPublic) {
    return {
      title: `@${decodedUsername} — Private Profile | ALLTERRAIN`,
      description: `This athlete's profile is currently private on ALLTERRAIN.`,
    };
  }

  const ctlText = profile.pmc ? ` • CTL ${profile.pmc.ctl}` : "";
  const distText = profile.volume ? ` • ${profile.volume.totalDistanceKm} KM` : "";

  const title = `@${profile.nickname} — Athletic Telemetry${ctlText} | ALLTERRAIN`;
  const description = `View @${profile.nickname}'s athletic telemetry, Bannister PMC curve, and mountain dynamics on ALLTERRAIN.${distText}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "ALLTERRAIN Athletic Intelligence",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicAthletePage(props: PageProps) {
  const { username } = await props.params;
  const decodedUsername = decodeURIComponent(username);
  const data = await getPublicAthleteProfile(decodedUsername);

  return <PublicProfileView data={data} />;
}
