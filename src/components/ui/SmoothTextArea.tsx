import React, { useState, useEffect, useRef } from 'react';

interface SmoothTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onValueChange: (val: string) => void;
}

export const SmoothTextArea = React.forwardRef<HTMLTextAreaElement, SmoothTextAreaProps>((props, ref) => {
  const { value, onValueChange, onChange, ...rest } = props;
  const [localValue, setLocalValue] = useState<string>((value as string) || '');
  const isSelectedRef = useRef(false);

  // Keep local value in sync with prop updates when not actively typing/focused
  useEffect(() => {
    if (!isSelectedRef.current) {
      setLocalValue((value as string) || '');
    }
  }, [value]);

  // Debouce propagation of typed text to parent state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onValueChange(localValue);
      }
    }, 150); // Fast 150ms debounce ensures smooth typing and near-instant backup
    return () => clearTimeout(timer);
  }, [localValue, value, onValueChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    if (onChange) {
      onChange(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isSelectedRef.current = true;
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    isSelectedRef.current = false;
    onValueChange(localValue); // Propagate instantly on blur
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <textarea
      {...rest}
      ref={ref}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
});

SmoothTextArea.displayName = 'SmoothTextArea';
