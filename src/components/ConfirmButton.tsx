"use client";

export function ConfirmButton({ message, children, ...props }: { message: string } & React.ComponentProps<"button">) {
  return (
    <button {...props} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
