-- CreateIndex
CREATE INDEX "Channel_boardId_parentId_idx" ON "Channel"("boardId", "parentId");

-- CreateIndex
CREATE INDEX "Member_boardId_profileId_role_idx" ON "Member"("boardId", "profileId", "role");

-- CreateIndex
CREATE INDEX "Member_profileId_role_idx" ON "Member"("profileId", "role");

-- CreateIndex
CREATE INDEX "Slot_mode_memberId_idx" ON "Slot"("mode", "memberId");
