export default function SummaryCard({ icon: Icon, label, value, detail, tone = "default" }) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <div className="summary-card__icon">
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
