import { currentProfile } from "@/lib/current-profile";
import { redirect } from "next/navigation";
import { getBoardsForSidebar } from "@/lib/get-board-with-data";
import { NavigationAction } from "./navigation-action";
import { NavigationItem } from "./navigation-item";
import { getBoardImageUrl } from "@/lib/avatar-utils";

export const NavigationSidebar = async () => {
  const profile = await currentProfile();

  if (!profile) {
    return redirect("/");
  }

  const boards = await getBoardsForSidebar(profile.id);

  return (
    <div className="w-full h-full overflow-y-auto pt-3 pb-3 scrollbar-navigation">
      <div className="grid grid-cols-4 gap-3 place-items-center -translate-x-2">
        <div className="translate-x-1.5">
          <NavigationAction />
        </div>
        {boards.map((board) => {
          const channelIds = board.channels?.map((c) => c.id) || [];
          const imageUrl = getBoardImageUrl(
            board.imageUrl,
            board.id,
            board.name,
            96,
          );

          return (
            <NavigationItem
              key={board.id}
              id={board.id}
              name={board.name}
              imageUrl={imageUrl}
              channelIds={channelIds}
            />
          );
        })}
      </div>
    </div>
  );
};
