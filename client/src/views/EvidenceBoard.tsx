import React, { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { EntityType } from "shared";
import { useWorkspaceStore, type BoardNode, type BoardEdge } from "../store/workspaceStore.js";
import { EvidenceCardNode } from "../components/board/EvidenceCardNode.js";
import { BoardSidebar } from "../components/board/BoardSidebar.js";
import { BottomNav } from "../components/common/BottomNav.js";
import { Modal } from "../components/common/Modal.js";

const nodeTypes = {
  evidenceCard: EvidenceCardNode,
};

export const EvidenceBoard: React.FC = () => {
  const {
    boardNodes,
    boardEdges,
    boardHistory,
    pinnedEntities,
    setBoard,
    undoBoard,
    clearBoard,
  } = useWorkspaceStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Map internal store nodes to React Flow Node objects
  const rfNodes = useMemo<Node[]>(() => {
    return boardNodes.map((n) => ({
      id: n.id,
      type: "evidenceCard",
      position: n.position,
      data: {
        label: n.data.label,
        entityType: n.data.entityType,
        onDelete: (id: string) => {
          const nextNodes = boardNodes.filter((node) => node.id !== id);
          const nextEdges = boardEdges.filter(
            (edge) => edge.source !== id && edge.target !== id
          );
          setBoard(nextNodes, nextEdges);
        },
      },
    }));
  }, [boardNodes, boardEdges, setBoard]);

  // Map internal store edges to React Flow Edge objects
  const rfEdges = useMemo<Edge[]>(() => {
    return boardEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: { stroke: "#8A8578", strokeWidth: 2 },
      labelStyle: { fill: "#E8E2D6", fontFamily: "monospace", fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: "#141414", fillOpacity: 0.9, stroke: "#2A2A2A" },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 2,
    }));
  }, [boardEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, rfNodes);
      const nextBoardNodes: BoardNode[] = updatedNodes.map((un) => ({
        id: un.id,
        position: un.position,
        data: {
          label: (un.data as { label: string }).label,
          entityType: (un.data as { entityType: EntityType }).entityType,
        },
      }));
      setBoard(nextBoardNodes, boardEdges, false);
    },
    [rfNodes, boardEdges, setBoard]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updatedEdges = applyEdgeChanges(changes, rfEdges);
      const edgeMap = new Map(boardEdges.map((e) => [e.id, e.label]));
      const nextBoardEdges: BoardEdge[] = updatedEdges.map((ue) => ({
        id: ue.id,
        source: ue.source,
        target: ue.target,
        label: edgeMap.get(ue.id) || "CONNECTED TO",
      }));
      setBoard(boardNodes, nextBoardEdges, false);
    },
    [rfEdges, boardNodes, boardEdges, setBoard]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const newEdge: BoardEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: connection.source,
        target: connection.target,
        label: "CONNECTED TO",
      };

      setBoard(boardNodes, [...boardEdges, newEdge]);
    },
    [boardNodes, boardEdges, setBoard]
  );

  const handleAddLinkFromSidebar = (
    source: string,
    target: string,
    label: "SEEN AT" | "SCHEDULED ON" | "MENTIONED BY" | "CONNECTED TO"
  ) => {
    const newEdge: BoardEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source,
      target,
      label,
    };
    setBoard(boardNodes, [...boardEdges, newEdge]);
  };

  const handleRemoveLink = (edgeId: string) => {
    const nextEdges = boardEdges.filter((e) => e.id !== edgeId);
    setBoard(boardNodes, nextEdges);
  };

  const handleAddCard = (label: string, entityType: EntityType) => {
    const newNode: BoardNode = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: {
        x: 100 + (boardNodes.length % 5) * 40,
        y: 100 + (boardNodes.length % 5) * 40,
      },
      data: {
        label,
        entityType,
      },
    };
    setBoard([...boardNodes, newNode], boardEdges);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] bg-bg overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 h-full relative">
          {/* Controls Toolbar */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={undoBoard}
              disabled={boardHistory.length === 0}
              className="px-3 py-1.5 bg-panel border border-line hover:border-muted text-paper disabled:opacity-40 uppercase font-bold tracking-wider rounded-xs transition-colors shadow"
            >
              UNDO
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={boardNodes.length === 0 && boardEdges.length === 0}
              className="px-3 py-1.5 bg-panel border border-line hover:border-red-text text-paper hover:text-red-text disabled:opacity-40 uppercase font-bold tracking-wider rounded-xs transition-colors shadow"
            >
              CLEAR BOARD
            </button>
          </div>

          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-bg"
          >
            <Background color="#1F1F1F" gap={20} size={1} />
            <Controls className="!bg-panel !border !border-line !shadow-lg [&>button]:!border-line [&>button]:!fill-paper" />
          </ReactFlow>
        </div>

        {/* Sidebar: Non-Pointer Actions & Link List */}
        <BoardSidebar
          nodes={boardNodes}
          edges={boardEdges}
          pinnedEntities={pinnedEntities}
          onAddLink={handleAddLinkFromSidebar}
          onRemoveLink={handleRemoveLink}
          onAddCard={handleAddCard}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        currentView="board"
        onNavigate={(view) => {
          window.location.hash = `#${view}`;
        }}
      />

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="CLEAR EVIDENCE BOARD?"
      >
        <div className="space-y-4 font-mono text-xs">
          <p className="text-paper leading-relaxed">
            ARE YOU SURE YOU WANT TO CLEAR ALL CARDS AND CONNECTIONS FROM THE EVIDENCE BOARD?
          </p>
          <p className="text-muted text-[11px]">
            THIS ACTION CAN BE REVERTED USING THE UNDO BUTTON.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 border border-line text-paper uppercase hover:bg-line rounded-xs"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => {
                clearBoard();
                setShowClearConfirm(false);
              }}
              className="px-4 py-2 bg-red hover:bg-red-bright text-paper font-bold uppercase rounded-xs"
            >
              CONFIRM CLEAR
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
