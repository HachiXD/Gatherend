import { redirect } from "next/navigation";

export default async function CommunityPageRedirect({
  params,
}: {
  params: Promise<{ boardId: string; communityId: string }>;
}) {
  const { boardId, communityId } = await params;

  redirect(`/boards/${boardId}/discovery/communities/${communityId}/boards`);
}
