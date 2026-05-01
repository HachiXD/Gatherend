import { FlatList, StyleSheet } from "react-native";
import type { Conversation } from "../domain/conversation";
import { ConversationRow } from "./conversation-row";

type ConversationsListProps = {
  conversations: Conversation[];
  hidingConversationId?: string | null;
  onHideConversation?: (conversation: Conversation) => void;
  onSelectConversation: (conversationId: string) => void;
};

export function ConversationsList({
  conversations,
  hidingConversationId,
  onHideConversation,
  onSelectConversation,
}: ConversationsListProps) {
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ConversationRow
          conversation={item}
          isHiding={hidingConversationId === item.id}
          onHide={onHideConversation}
          onPress={onSelectConversation}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingBottom: 20,
  },
});
