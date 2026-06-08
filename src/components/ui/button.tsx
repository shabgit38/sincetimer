import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-stone-100 text-stone-950 hover:bg-white dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white',
  outline:
    'border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-200 dark:hover:border-white/20 dark:hover:bg-white/[0.06]',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/[0.06] dark:hover:text-stone-100',
  destructive: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-900/60',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3',
  md: 'h-10 px-4',
  lg: 'h-11 px-5',
};

export function Button({
  className = '',
  variant = 'default',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
