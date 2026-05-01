import { FlatList, StyleSheet } from "react-native";
import { BoardCard } from "./board-card";
import type { UserBoard } from "../types/board";

type BoardsGridProps = {
  boards: UserBoard[];
};

export function BoardsGrid({ boards }: BoardsGridProps) {
  return (
    <FlatList
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      data={boards}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <BoardCard board={item} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {},
  row: {
    gap: 12,
    marginBottom: 12,
  },
});
