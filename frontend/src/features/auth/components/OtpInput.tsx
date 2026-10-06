"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

export const OTP_LENGTH = 8;

/** Eight single-digit boxes that behave like one field: auto-advance, backspace, paste. */
export function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? "");

  function setDigits(next: string, focusIndex: number) {
    onChange(next);
    refs.current[Math.min(focusIndex, OTP_LENGTH - 1)]?.focus();
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // Typing over a filled box replaces it; typing several digits (autofill) spreads them out.
    const next = (value.slice(0, index) + typed + value.slice(index + typed.length)).slice(0, OTP_LENGTH);
    setDigits(next, index + typed.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) setDigits(value.slice(0, index) + value.slice(index + 1), index);
      else if (index > 0) setDigits(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(pasted, pasted.length);
  }

  return (
    <div role="group" aria-label="Sign-in code" className="flex gap-1.5">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          className={`h-[54px] min-w-0 flex-1 rounded-lg border bg-surface text-center text-[22px] font-semibold text-ink outline-none focus:border-2 focus:border-primary ${
            invalid ? "border-danger-line" : "border-line"
          }`}
        />
      ))}
    </div>
  );
}
