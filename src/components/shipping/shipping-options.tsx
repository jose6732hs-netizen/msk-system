import { useState, useCallback } from "react";
import { ShippingCard } from "./shipping-card";
import type { ShippingMethod } from "~/types";

interface ShippingOptionsProps {
  methods: ShippingMethod[];
  selectedMethodId?: string;
  onSelect: (method: ShippingMethod) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ShippingOptions({
  methods,
  selectedMethodId,
  onSelect,
  isLoading = false,
  error = null,
}: ShippingOptionsProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectedMethodId
  );
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelect = useCallback(
    async (method: ShippingMethod) => {
      if (isSelecting || isLoading) return;

      setIsSelecting(true);
      setSelectedId(method.id);

      try {
        await onSelect(method);
      } catch (err) {
        // Revert selection on error
        setSelectedId(selectedMethodId);
      } finally {
        setIsSelecting(false);
      }
    },
    [isSelecting, isLoading, onSelect, selectedMethodId]
  );

  if (isLoading && methods.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-pink-600 font-medium">Frete</span>
          <span className="text-gray-400">carregando...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
        <p className="text-red-600 text-sm">
          <span className="text-pink-600 font-medium">Frete: </span>
          {error}
        </p>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-gray-500 text-sm">
          <span className="text-pink-600 font-medium">Frete: </span>
          Nenhuma opção de entrega disponível para esta região.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-pink-600 font-medium">Frete</span>
        {isSelecting && (
          <span className="text-xs text-pink-400 animate-pulse">
            atualizando...
          </span>
        )}
      </div>

      <div className="space-y-2">
        {methods.map((method) => (
          <ShippingCard
            key={method.id}
            method={method}
            selected={selectedId === method.id}
            onSelect={handleSelect}
            isLoading={isSelecting && selectedId !== method.id}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400">
        <span className="text-pink-400">*</span> Os prazos de entrega são
        estimados e podem variar conforme a região.
      </p>
    </div>
  );
}
