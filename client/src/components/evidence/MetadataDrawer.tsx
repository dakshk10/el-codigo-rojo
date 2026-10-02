import React, { useState } from "react";

export interface MetadataDrawerProps {
  metadata?: Record<string, string>;
}

export const MetadataDrawer: React.FC<MetadataDrawerProps> = ({ metadata }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <div className="border border-line bg-panel/80 mb-4 rounded-sm">
      <button
        type="button"
        id="btn-toggle-metadata"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left flex items-center justify-between text-xs font-mono text-muted hover:text-paper transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold">
          <span>{isOpen ? "▼" : "▶"}</span>
          <span>CLASSIFIED METADATA ARCHIVE</span>
        </span>
        <span className="text-[10px] text-amber uppercase border border-amber/40 px-1 py-0.2 bg-amber/10">
          {metadata["classification"] ?? "RESTRICTED"}
        </span>
      </button>

      {isOpen && (
        <div
          data-testid="metadata-content"
          className="px-4 py-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono"
        >
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <span className="text-muted text-[10px] uppercase tracking-wider">
                {key}:
              </span>
              <span className="text-paper font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
