const themeConfig = {
  name: "Proposeme",
  colors: {
    primary: "#05034D",
    accent: "#F03F3B",
    background: "#FFFFFF", // Override to white for light theme readability
    surface: "#F8F9FA",
    text: "#000000",
    textLight: "#6C757D",
    white: "#FFFFFF",
    error: "#DC3545",
    success: "#28A745",
  },
  fonts: {
    primary: "'Poppins', sans-serif",
    heading: "'Poppins', sans-serif",
  },
  spacing: {
    borderRadius: "4px",
    padding: "1rem",
    gap: "1.5rem",
  },
  shadows: {
    button: "rgba(241, 92, 60, 0.4) 0px 8px 20px -3px",
    card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  }
};

export default themeConfig;
