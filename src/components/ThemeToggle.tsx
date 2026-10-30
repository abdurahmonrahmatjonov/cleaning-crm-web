import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '../theme';

export default function ThemeToggle() {
  const dark = useTheme() === 'dark';
  const icon = 'absolute transition-all duration-300';
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? "Yorug' rejim" : "Qorong'u rejim"}
      title={dark ? "Yorug' rejim" : "Qorong'u rejim"}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-gray-600 hover:bg-gray-100 active:scale-90"
    >
      <Sun size={18} className={`${icon} ${dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
      <Moon size={18} className={`${icon} ${dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
    </button>
  );
}
