-- CreateIndex
CREATE INDEX "Conversation_profileOneId_idx" ON "Conversation"("profileOneId");

-- CreateIndex
CREATE INDEX "Conversation_profileOneId_profileTwoId_idx" ON "Conversation"("profileOneId", "profileTwoId");

-- CreateIndex
CREATE INDEX "Conversation_profileTwoId_profileOneId_idx" ON "Conversation"("profileTwoId", "profileOneId");
