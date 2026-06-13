import { useCallback } from "react";
import { GitBranch, Network } from "lucide-react";
import { motion } from "framer-motion";

export type ViewMode = "tree" | "graph";

interface Props {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const TABS = [
  { mode: "tree" as ViewMode, label: "Tree", icon: GitBranch },
  { mode: "graph" as ViewMode, label: "Graph", icon: Network },
];

const PILL_WIDTH_PX = 80;
const PILL_SPACING_PX = 2;

export function ViewToggle({ mode, onChange }: Props) {
  const activeIndex = mode === "tree" ? 0 : 1;

  const trackMouse = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div className="view-toggle">
      <motion.div
        className="toggle-pill"
        animate={{ x: activeIndex * (PILL_WIDTH_PX + PILL_SPACING_PX) }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      />
      {TABS.map(({ mode: tabMode, label, icon: Icon }) => (
        <button
          key={tabMode}
          className={`view-toggle-btn${mode === tabMode ? " active" : ""}`}
          onClick={() => onChange(tabMode)}
          onMouseMove={trackMouse}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
