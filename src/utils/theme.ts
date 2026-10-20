export type ThemeMode = 'dark' | 'light';

export function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem('infratrack_theme');
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return 'dark'; // Default dark theme for datacenter operations
}

export function applyTheme(theme: ThemeMode) {
  localStorage.setItem('infratrack_theme', theme);
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}
