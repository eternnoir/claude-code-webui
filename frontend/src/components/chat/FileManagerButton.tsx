import { FolderIcon } from "lucide-react";

interface FileManagerButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function FileManagerButton({
  onClick,
  disabled = false,
}: FileManagerButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      aria-label="Open file manager"
      title="Open file manager"
    >
      <FolderIcon className="h-5 w-5" />
    </button>
  );
}
