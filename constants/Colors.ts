const tintColorLight = '#3b82f6'; // Blue
const tintColorDark = '#60a5fa'; // Lighter blue for dark mode

export default {
  light: {
    text: '#1e293b', // Dark slate
    background: '#f8fafc', // Light gray background
    tint: tintColorLight,
    tabIconDefault: '#94a3b8', // Medium gray
    tabIconSelected: tintColorLight,
    // Health-focused colors
    primary: '#3b82f6', // Blue
    secondary: '#10b981', // Green
    accent: '#06b6d4', // Cyan
    success: '#10b981', // Green
    warning: '#f59e0b', // Amber
    error: '#ef4444', // Red
    surface: '#ffffff', // White
    surfaceVariant: '#f1f5f9', // Light gray
    textSecondary: '#64748b', // Medium gray
    textTertiary: '#94a3b8', // Light gray
  },
  dark: {
    text: '#f1f5f9', // Light gray
    background: '#0f172a', // Dark slate
    tint: tintColorDark,
    tabIconDefault: '#64748b', // Medium gray
    tabIconSelected: tintColorDark,
    // Health-focused colors for dark mode
    primary: '#60a5fa', // Lighter blue
    secondary: '#34d399', // Lighter green
    accent: '#22d3ee', // Lighter cyan
    success: '#34d399', // Lighter green
    warning: '#fbbf24', // Lighter amber
    error: '#f87171', // Lighter red
    surface: '#1e293b', // Dark slate
    surfaceVariant: '#334155', // Medium slate
    textSecondary: '#94a3b8', // Medium gray
    textTertiary: '#64748b', // Darker gray
  },
};
