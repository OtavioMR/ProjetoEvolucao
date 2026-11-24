import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { useApp } from '../app-provider';

const dark = {
  background: '#0C1014',
  surface: '#161C23',
  border: '#303A45',
  text: '#F5F7FA',
  secondary: '#B5C0CE',
  accent: '#FFB454',
  accentText: '#251600',
  error: '#FFB4AB',
  success: '#9DDFC1',
  input: '#10161D',
};
const light: typeof dark = {
  background: '#F7F5F1',
  surface: '#FFFFFF',
  border: '#D1D5DA',
  text: '#19212B',
  secondary: '#505D6D',
  accent: '#8D4A00',
  accentText: '#FFFFFF',
  error: '#A62E24',
  success: '#246947',
  input: '#F5F6F8',
};
const ThemeContext = createContext({ colors: dark, isDark: true });
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { small: 10, medium: 16, large: 24 };

export function ThemeProvider({ children }: PropsWithChildren) {
  const { snapshot } = useApp();
  const system = useColorScheme();
  const selected = snapshot?.preferences.theme ?? 'dark';
  const isDark = selected === 'dark' || (selected === 'system' && system !== 'light');
  return (
    <ThemeContext.Provider value={{ colors: isDark ? dark : light, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
