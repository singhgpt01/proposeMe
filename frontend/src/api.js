const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const generateProposal = async (prompt, token = null) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to generate proposal");
  }

  return await response.json();
};
