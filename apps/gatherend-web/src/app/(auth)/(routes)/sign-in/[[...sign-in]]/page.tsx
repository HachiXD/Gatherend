import { CustomSignIn } from "@/components/auth/custom-sign-in";
import { getServerSession } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

type SignInPageProps = {
  searchParams: Promise<{
    verified?: string;
  }>;
};

export default async function Page({ searchParams }: SignInPageProps) {
  const session = await getServerSession();
  if (session?.userId) {
    redirect("/boards");
  }

  const { verified } = await searchParams;

  return (
    <div className="h-full flex items-center justify-center py-12 px-4">
      <CustomSignIn showEmailVerifiedMessage={verified === "1"} />
    </div>
  );
}
