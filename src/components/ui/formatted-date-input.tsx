import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FormattedDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

export function FormattedDateInput({ value, onChange, className, ...props }: FormattedDateInputProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  const getDisplayValue = (val: string) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const textVal = e.target.value;
    
    // Check if user is typing or if it matches DD/MM/YYYY format exactly
    const parts = textVal.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      
      // Only fire onChange if we have a valid complete date (year length is 4)
      if (year.length === 4) {
        const parsedDate = `${year}-${month}-${day}`;
        if (!isNaN(Date.parse(parsedDate))) {
          onChange(parsedDate);
        }
      }
    } else if (textVal === "") {
      onChange("");
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <Input
        type="text"
        placeholder="HH/BB/TTTT"
        value={getDisplayValue(value)}
        onChange={handleTextChange}
        className={className}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          if (dateInputRef.current) {
            if (typeof dateInputRef.current.showPicker === "function") {
              dateInputRef.current.showPicker();
            } else {
              dateInputRef.current.click();
            }
          }
        }}
        className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={dateInputRef}
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute right-0 top-0 w-0 h-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}
