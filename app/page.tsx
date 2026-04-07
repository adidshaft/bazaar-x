import { BazaarDashboard } from "../components/bazaar-dashboard";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const scene = Array.isArray(resolvedSearchParams.scene)
    ? resolvedSearchParams.scene[0]
    : resolvedSearchParams.scene;

  return <BazaarDashboard initialScene={scene ?? null} />;
}
