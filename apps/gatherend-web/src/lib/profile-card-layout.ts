import {
  getProfileCardActiveSlots,
  type ActiveProfileCardSlots,
  type ProfileCardLayoutInput,
  type ProfileCardLeafKey,
} from "@/lib/profile-card-slots";

export const PROFILE_CARD_BRANCH_KEYS = [
  "mainBody",
  "topRow",
  "bottomRow",
  "bottomTextColumn",
  "bottomImagesColumn",
  "rightRow",
] as const;

export type ProfileCardBranchKey = (typeof PROFILE_CARD_BRANCH_KEYS)[number];

export type ProfileCardNodeKey = ProfileCardBranchKey | ProfileCardLeafKey;

export type ProfileCardOrientation = "horizontal" | "vertical";

export interface ProfileCardLayoutLeafNode {
  kind: "leaf";
  id: ProfileCardLeafKey;
  active: true;
  activeLeafCount: 1;
  visibleLeafIds: [ProfileCardLeafKey];
}

export interface ProfileCardLayoutBranchNode {
  kind: "branch";
  id: ProfileCardBranchKey;
  active: true;
  orientation: ProfileCardOrientation;
  layoutMode: "single" | "split";
  children: ProfileCardLayoutNode[];
  activeLeafCount: number;
  visibleLeafIds: ProfileCardLeafKey[];
}

export type ProfileCardLayoutNode =
  | ProfileCardLayoutLeafNode
  | ProfileCardLayoutBranchNode;

export interface ResolvedProfileCardLayout {
  activeSlots: ActiveProfileCardSlots;
  root: ProfileCardLayoutBranchNode | null;
  bodyColumns: 0 | 1 | 2;
  hasLeftColumn: boolean;
  hasRightColumn: boolean;
  shouldPromoteSingleLeaf: boolean;
  singleLeafId: ProfileCardLeafKey | null;
}

const BRANCH_CHILDREN: Record<ProfileCardBranchKey, ProfileCardNodeKey[]> = {
  mainBody: ["topRow", "bottomRow", "rightRow"],
  topRow: ["leftTopImage", "leftTopText"],
  bottomRow: ["bottomTextColumn", "bottomImagesColumn"],
  bottomTextColumn: ["leftBottomTextSectionA", "leftBottomTextSectionB"],
  bottomImagesColumn: [
    "leftBottomRightTopImage",
    "leftBottomRightBottomImage",
  ],
  rightRow: ["rightTopImage", "rightBottomImage"],
};

const BRANCH_ORIENTATION: Record<ProfileCardBranchKey, ProfileCardOrientation> =
  {
    mainBody: "vertical",
    topRow: "horizontal",
    bottomRow: "horizontal",
    bottomTextColumn: "vertical",
    bottomImagesColumn: "vertical",
    rightRow: "horizontal",
  };

function isBranchKey(id: ProfileCardNodeKey): id is ProfileCardBranchKey {
  return (PROFILE_CARD_BRANCH_KEYS as readonly string[]).includes(id);
}

function isLeafActive(
  id: ProfileCardLeafKey,
  activeSlots: ActiveProfileCardSlots,
): boolean {
  switch (id) {
    case "leftTopImage":
      return activeSlots.leftTopImage;
    case "leftTopText":
      return activeSlots.leftTopText;
    case "leftBottomTextSectionA":
      return activeSlots.leftBottomTextSectionA;
    case "leftBottomTextSectionB":
      return activeSlots.leftBottomTextSectionB;
    case "leftBottomRightTopImage":
      return activeSlots.leftBottomRightTopImage;
    case "leftBottomRightBottomImage":
      return activeSlots.leftBottomRightBottomImage;
    case "rightTopImage":
      return activeSlots.rightTopImage;
    case "rightBottomImage":
      return activeSlots.rightBottomImage;
    default:
      return false;
  }
}

function buildLeafNode(
  id: ProfileCardLeafKey,
  activeSlots: ActiveProfileCardSlots,
): ProfileCardLayoutLeafNode | null {
  if (!isLeafActive(id, activeSlots)) {
    return null;
  }

  return {
    kind: "leaf",
    id,
    active: true,
    activeLeafCount: 1,
    visibleLeafIds: [id],
  };
}

function buildBranchNode(
  id: ProfileCardBranchKey,
  activeSlots: ActiveProfileCardSlots,
): ProfileCardLayoutBranchNode | null {
  const children = BRANCH_CHILDREN[id]
    .map((childId) =>
      isBranchKey(childId)
        ? buildBranchNode(childId, activeSlots)
        : buildLeafNode(childId, activeSlots),
    )
    .filter((child): child is ProfileCardLayoutNode => child !== null);

  if (children.length === 0) {
    return null;
  }

  const visibleLeafIds = children.flatMap((child) => child.visibleLeafIds);
  const activeLeafCount = children.reduce(
    (count, child) => count + child.activeLeafCount,
    0,
  );

  return {
    kind: "branch",
    id,
    active: true,
    orientation: BRANCH_ORIENTATION[id],
    layoutMode: children.length === 1 ? "single" : "split",
    children,
    activeLeafCount,
    visibleLeafIds,
  };
}

export function resolveProfileCardLayout(
  input: ProfileCardLayoutInput,
): ResolvedProfileCardLayout {
  const activeSlots = getProfileCardActiveSlots(input);
  const root = activeSlots.mainBody
    ? buildBranchNode("mainBody", activeSlots)
    : null;
  const singleLeafId =
    activeSlots.activeLeafCount === 1 ? activeSlots.activeLeafIds[0] : null;

  return {
    activeSlots,
    root,
    bodyColumns: root ? 1 : 0,
    hasLeftColumn: activeSlots.topRow || activeSlots.bottomRow,
    hasRightColumn: activeSlots.rightRow,
    shouldPromoteSingleLeaf: activeSlots.activeLeafCount === 1,
    singleLeafId,
  };
}

export function findProfileCardNode(
  root: ProfileCardLayoutBranchNode | null,
  nodeId: ProfileCardNodeKey,
): ProfileCardLayoutNode | null {
  if (!root) {
    return null;
  }

  if (root.id === nodeId) {
    return root;
  }

  const stack: ProfileCardLayoutNode[] = [...root.children];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    if (node.id === nodeId) {
      return node;
    }

    if (node.kind === "branch") {
      stack.push(...node.children);
    }
  }

  return null;
}
