const Input = ({ label, name, type = "text", value, onChange }) => {
  return (
    <div className="mb-3">
      <label className="block text-sm mb-1">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full border p-2 rounded"
      />
    </div>
  );
};

export default Input;