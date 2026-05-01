export type FriendRequestRequester = {
  id: string;
  username: string;
  discriminator: string;
  avatarAsset: { url: string } | null;
  fullUsername: string;
};

export type PendingFriendRequest = {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  requester: FriendRequestRequester;
};
