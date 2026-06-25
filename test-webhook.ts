const auth = "Bearer tlZPQjflST";
const body = {
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }]
};

await fetch("http://127.0.0.1:3001/v1/agora/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": auth },
  body: JSON.stringify(body)
})
  .then(res => res.text().then(t => console.log(res.status, t)))
  .catch(console.error);
