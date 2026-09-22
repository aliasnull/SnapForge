/** Reusable UI primitives. Small, presentational, no domain knowledge. */

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './Icon';
import { clamp } from '../lib/format';

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  block,
  loading,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    !children && icon ? 'btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" /> : icon ? <Icon name={icon} size={17} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={17} /> : null}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* IconButton                                                                 */
/* -------------------------------------------------------------------------- */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required — the button has no visible text. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={[
        'btn',
        `btn--${variant}`,
        'btn--icon',
        size !== 'md' ? `btn--${size}` : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}

export function NumberInput({
  label,
  value,
  onValueChange,
  min = 1,
  max = 20000,
  suffix,
  id,
  ...rest
}: NumberInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="field">
      <label className="label" htmlFor={inputId}>
        {label}
        {suffix ? <span className="subtle"> ({suffix})</span> : null}
      </label>
      <input
        id={inputId}
        className="input"
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(next)) onValueChange(clamp(next, min, max));
        }}
        onBlur={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          onValueChange(Number.isFinite(next) ? clamp(next, min, max) : min);
        }}
        {...rest}
      />
    </div>
  );
}

interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onValueChange: (value: T) => void;
  hint?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onValueChange,
  hint,
  id,
  ...rest
}: SelectFieldProps<T>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="field">
      <label className="label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="select"
        value={value}
        onChange={(event) => onValueChange(event.target.value as T)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  /** Rendered at the right of the label row, e.g. `75%`. */
  displayValue: string;
  disabled?: boolean;
  hint?: string;
  /** `low`/`high` describe the ends of the scale for screen readers. */
  minLabel?: string;
  maxLabel?: string;
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  displayValue,
  disabled,
  hint,
  minLabel,
  maxLabel,
}: RangeFieldProps) {
  const generatedId = useId();

  return (
    <div className="field">
      <div className="control-group__head">
        <label className="label" htmlFor={generatedId}>
          {label}
        </label>
        <span className="control-value">{displayValue}</span>
      </div>
      <input
        id={generatedId}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(Number(event.target.value))}
        aria-valuetext={displayValue}
        {...(minLabel ? { 'aria-valuemin': min } : {})}
        {...(maxLabel ? { 'aria-valuemax': max } : {})}
      />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                     */
/* -------------------------------------------------------------------------- */

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id?: string;
}

export function Switch({ checked, onCheckedChange, label, id }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;

  return (
    <label className="switch" htmlFor={switchId}>
      <input
        id={switchId}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className="switch__label">{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          data-active={option.value === value}
          aria-pressed={option.value === value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge / Callout                                                            */
/* -------------------------------------------------------------------------- */

interface BadgeProps {
  children: ReactNode;
  icon?: IconName;
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function Badge({ children, icon, tone = 'default', className = '' }: BadgeProps) {
  return (
    <span className={['badge', tone !== 'default' ? `badge--${tone}` : '', className].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

interface CalloutProps {
  children: ReactNode;
  title?: string;
  tone?: 'default' | 'info' | 'warning' | 'danger' | 'success';
  icon?: IconName;
}

const CALLOUT_ICONS: Record<NonNullable<CalloutProps['tone']>, IconName> = {
  default: 'info',
  info: 'info',
  warning: 'alert',
  danger: 'alert-circle',
  success: 'check-circle',
};

export function Callout({ children, title, tone = 'default', icon }: CalloutProps) {
  return (
    <div className={['callout', tone !== 'default' ? `callout--${tone}` : ''].filter(Boolean).join(' ')} role="note">
      <Icon name={icon ?? CALLOUT_ICONS[tone]} size={18} />
      <div>
        {title ? <div className="callout__title">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modal__head">
          <h2 style={{ fontSize: 'var(--fs-lg)' }}>{title}</h2>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'image', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

interface ProgressBarProps {
  value: number;
  max: number;
  done?: boolean;
  label?: string;
}

export function ProgressBar({ value, max, done, label }: ProgressBarProps) {
  const percent = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;

  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? 'Progress'}
    >
      <div
        className={['progress__bar', done ? 'progress__bar--done' : ''].filter(Boolean).join(' ')}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
