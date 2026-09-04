import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { formatCurrency } from "~/lib/utils";
import type { ShippingMethod } from "~/types";

interface ShippingCardProps {
  method: ShippingMethod;
  selected: boolean;
  onSelect: (method: ShippingMethod) => void;
  isLoading?: boolean;
}

export function ShippingCard({
  method,
  selected,
  onSelect,
  isLoading = false,
}: ShippingCardProps) {
  const [isSelected, setIsSelected] = useState(false);

  useEffect(() => {
    setIsSelected(selected);
  }, [selected]);

  const handleSelect = () => {
    if (isLoading) return;
    setIsSelected(true);
    onSelect(method);
  };

  return (
    <button
      onClick={handleSelect}
      disabled={isLoading}
      className={`
        w-full p-4 rounded-lg border-2 transition-all duration-200
        flex items-center justify-between gap-3
        ${
          isSelected
            ? "border-pink-500 bg-pink-50"
            : "border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/30"
        }
        ${isLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            w-5 h-5 rounded-full border-2 flex items-center justify-center
            transition-all duration-200
            ${
              isSelected
                ? "border-pink-500 bg-pink-500"
                : "border-gray-300 bg-white"
            }
          `}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="text-left">
          <p
            className={`font-medium ${
              isSelected ? "text-pink-700" : "text-gray-900"
            }`}
          >
            {method.name}
          </p>
          <p
            className={`text-sm ${
              isSelected ? "text-pink-500" : "text-gray-500"
            }`}
          >
            {method.description}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`font-semibold ${
            isSelected ? "text-pink-600" : "text-gray-900"
          }`}
        >
          {method.price === 0 ? "Grátis" : formatCurrency(method.price)}
        </p>
        {method.deliveryTime && (
          <p
            className={`text-xs ${
              isSelected ? "text-pink-400" : "text-gray-400"
            }`}
          >
            {method.deliveryTime}
          </p>
        )}
      </div>
    </button>
  );
}
