import './StatCard.css';

function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon-wrap">
        {icon}
      </div>
      <div className="stat-card__info">
        <h3 className="stat-card__label">{label}</h3>
        <p className="stat-card__value">{value}</p>
      </div>
    </div>
  );
}

export default StatCard;
