/** Colours of each button variant (shared by Button and LinkButton). */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline'

export const buttonVariants: Record<Variant, string> = {
  primary:
    'bg-teal-700 text-white shadow-sm hover:bg-teal-800 focus-visible:ring-teal-600/30 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400',
  secondary:
    'border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400/25 ' +
    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/25 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-600/30',
  dangerOutline:
    'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-600/20 ' +
    'dark:border-rose-400/40 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-400/10',
}
