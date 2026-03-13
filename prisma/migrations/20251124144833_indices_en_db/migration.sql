-- CreateIndex
CREATE INDEX "Board_refreshedAt_idx" ON "Board"("refreshedAt");

-- CreateIndex
CREATE INDEX "Board_languages_idx" ON "Board"("languages");

-- CreateIndex
CREATE INDEX "Board_tag_idx" ON "Board"("tag");

-- CreateIndex
CREATE INDEX "BoardBan_boardId_profileId_idx" ON "BoardBan"("boardId", "profileId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Member_boardId_profileId_idx" ON "Member"("boardId", "profileId");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Slot_boardId_mode_memberId_idx" ON "Slot"("boardId", "mode", "memberId");
