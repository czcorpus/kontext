/**
 * We use a custom rc-slider type file as the vendor
 * module declaration is not compatible with our module
 * settings (node16)
 */

declare module 'rc-slider' {
  import React from 'react';

  export interface SliderProps {
    onChange?: (value: number | number[]) => void;
    defaultValue?: number | number[];
    value?: number | number[];
    min?: number;
    max?: number;
    step?: number;
    ariaLabelledByForHandle?: string;
  }

  const Slider: React.FC<SliderProps>;
  export default Slider;
}