export type ListItem = {
  id: string;
  text: string;
  completed: boolean;
};

export function createListItem(text = ""): ListItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    completed: false,
  };
}

export function getListItems(metadata: Record<string, unknown>): ListItem[] {
  if (!Array.isArray(metadata.list_items)) return [];

  return metadata.list_items.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) return [];
    return [{
      id: typeof item.id === "string" && item.id ? item.id : `list-item-${index}`,
      text,
      completed: item.completed === true,
    }];
  });
}
