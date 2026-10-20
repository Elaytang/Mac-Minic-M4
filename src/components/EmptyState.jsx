import { SearchX } from "lucide-react";

export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <SearchX size={22} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
