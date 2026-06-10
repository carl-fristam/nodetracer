import { GitBranch, Network } from "lucide-react";

export type ViewMode = "tree" | "graph";

interface Props {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: Props) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn${mode === "tree" ? " active" : ""}`}
        onClick={() => onChange("tree")}
      >
        <GitBranch size={14} />
        Tree
      </button>
      <button
        className={`view-toggle-btn${mode === "graph" ? " active" : ""}`}
        onClick={() => onChange("graph")}
      >
        <Network size={14} />
        Graph
      </button>
    </div>
  );
}
