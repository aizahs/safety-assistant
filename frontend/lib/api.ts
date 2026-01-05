const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export async function healthCheck() {
  const res = await fetch(`${BACKEND}/health`);
  return res.json();
}

export async function askQuestion(question: string) {
  const res = await fetch(`${BACKEND}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  return res.json();
}
