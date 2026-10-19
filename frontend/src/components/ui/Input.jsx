const Input = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  ...inputProps
}) => {
  const inputId = `input-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="mb-4">
      <label
        className="mb-2 block text-sm font-semibold tracking-tight text-ink"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={`h-12 w-full rounded-control border bg-slate-50 px-4 text-[15px] text-ink outline-none transition placeholder:text-subtle hover:bg-white focus:bg-white focus:ring-4 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-100"
            : "border-line focus:border-ink focus:ring-slate-950/10"
        }`}
      />
      {error && (
        <p className="mt-1.5 text-sm font-medium text-red-600" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
