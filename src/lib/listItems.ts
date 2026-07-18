export type ListItem = {
  id: string;
  text: string;
  completed: boolean;
  quantity?: number;
  price?: number;
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

  const items = metadata.list_items.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) return [];
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : undefined;
    const price = typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0 ? item.price : undefined;
    return [{
      id: typeof item.id === "string" && item.id ? item.id : `list-item-${index}`,
      text,
      completed: item.completed === true,
      ...(quantity !== undefined ? { quantity } : {}),
      ...(price !== undefined ? { price } : {}),
    }];
  });

  return [
    ...items.filter((item) => !item.completed),
    ...items.filter((item) => item.completed),
  ];
}
