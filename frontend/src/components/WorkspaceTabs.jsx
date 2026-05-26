export default function WorkspaceTabs({ tabs, value, onChange, className = "module-nav workspace-tab-nav" }) {
  return (
    <div className={className}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={value === tab.value ? "active-nav" : "nav-btn"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
